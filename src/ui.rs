use crate::{api, download, scrape};
use anyhow::{anyhow, Context};
use rand::{distributions::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{self, Receiver};
use std::sync::{Arc, Mutex};
use tokio::runtime::Runtime;

const DEFAULT_HOST: &str = "https://animepahe.ru";
const LABEL_COLUMN_WIDTH: f32 = 130.0;

fn normalize_host(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        DEFAULT_HOST.to_string()
    } else {
        trimmed.trim_end_matches('/').to_string()
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct AppSettings {
    download_dir: Option<String>,
    theme_dark: bool,
    #[serde(default = "default_host_url")]
    host_url: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_dir: None,
            theme_dark: true,
            host_url: default_host_url(),
        }
    }
}

fn default_host_url() -> String {
    DEFAULT_HOST.to_string()
}

impl AppSettings {
    fn load() -> Self {
        if let Some(path) = settings_file_path() {
            if let Ok(contents) = fs::read_to_string(&path) {
                match serde_json::from_str::<AppSettings>(&contents) {
                    Ok(mut parsed) => {
                        parsed.host_url = normalize_host(&parsed.host_url);
                        return parsed;
                    }
                    Err(err) => {
                        eprintln!("failed to parse settings at {}: {}", path.display(), err)
                    }
                }
            }
        }
        AppSettings::default()
    }

    fn save(&self) -> anyhow::Result<()> {
        if let Some(path) = settings_file_path() {
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).context("create settings directory")?;
            }
            let json = serde_json::to_string_pretty(self).context("serialize settings")?;
            fs::write(path, json).context("write settings")?;
        }
        Ok(())
    }
}

fn settings_file_path() -> Option<PathBuf> {
    dirs::config_dir().map(|mut dir| {
        dir.push("animepahe-dl");
        dir.push("settings.json");
        dir
    })
}

#[derive(Debug, Clone)]
struct PreviewItem {
    episode: u32,
    sources: Vec<scrape::Candidate>,
}

enum PreviewMessage {
    Success(Vec<PreviewItem>),
    Error(String),
}

pub struct AnimepaheApp {
    rt: Arc<Runtime>,
    // Inputs
    anime_name: String,
    anime_slug: String,
    episodes: String,
    resolution: String,
    audio: String,
    threads: u32,
    list_only: bool,
    debug: bool,
    // State
    cookie: String,
    episodes_fetched: Vec<api::Episode>,
    anime_display_name: String,
    is_busy: bool,
    // Search/UI state
    search_results: Vec<api::SearchItem>,
    selected_search: Option<usize>,
    episode_selection: BTreeSet<u32>,
    status_map: Arc<Mutex<BTreeMap<u32, String>>>,
    download_dir: Option<PathBuf>,
    progress_pairs: Arc<Mutex<BTreeMap<u32, (Arc<AtomicUsize>, Arc<AtomicUsize>)>>>,
    theme_dark: bool,
    host_url: String,
    // Preview state
    preview_open: bool,
    preview_loading: bool,
    preview_error: Option<String>,
    preview_items: Vec<PreviewItem>,
    preview_rx: Option<Receiver<PreviewMessage>>,
}

impl AnimepaheApp {
    pub fn new(cc: &eframe::CreationContext<'_>) -> Self {
        // Apply a slightly rounded dark theme
        let mut style = (*cc.egui_ctx.style()).clone();
        style.visuals = egui::Visuals::dark();
        style.spacing.item_spacing = egui::vec2(8.0, 8.0);
        style.spacing.button_padding = egui::vec2(10.0, 6.0);
        style.visuals.widgets.inactive.rounding = egui::Rounding::same(6.0);
        style.visuals.widgets.active.rounding = egui::Rounding::same(6.0);
        style.visuals.widgets.hovered.rounding = egui::Rounding::same(6.0);
        cc.egui_ctx.set_style(style);

        let rt = Runtime::new().expect("tokio runtime");
        let settings = AppSettings::load();
        let download_dir = settings.download_dir.as_ref().map(PathBuf::from);
        Self {
            rt: Arc::new(rt),
            anime_name: String::new(),
            anime_slug: String::new(),
            episodes: String::new(),
            resolution: String::new(),
            audio: String::new(),
            threads: 1,
            list_only: false,
            debug: false,
            cookie: gen_cookie(),
            episodes_fetched: vec![],
            anime_display_name: String::new(),
            is_busy: false,
            search_results: vec![],
            selected_search: None,
            episode_selection: BTreeSet::new(),
            status_map: Arc::new(Mutex::new(BTreeMap::new())),
            download_dir,
            progress_pairs: Arc::new(Mutex::new(BTreeMap::new())),
            theme_dark: settings.theme_dark,
            host_url: settings.host_url,
            preview_open: false,
            preview_loading: false,
            preview_error: None,
            preview_items: Vec::new(),
            preview_rx: None,
        }
    }

    fn persist_settings(&mut self) {
        let host = normalize_host(&self.host_url);
        self.host_url = host.clone();
        let settings = AppSettings {
            download_dir: self
                .download_dir
                .as_ref()
                .map(|p| p.to_string_lossy().into_owned()),
            theme_dark: self.theme_dark,
            host_url: host,
        };
        if let Err(e) = settings.save() {
            eprintln!("failed to save settings: {e}");
        }
    }

    fn process_preview_messages(&mut self) {
        let mut received: Option<PreviewMessage> = None;
        let mut disconnected = false;
        if let Some(rx) = self.preview_rx.as_ref() {
            match rx.try_recv() {
                Ok(msg) => received = Some(msg),
                Err(mpsc::TryRecvError::Empty) => {}
                Err(mpsc::TryRecvError::Disconnected) => disconnected = true,
            }
        }
        if disconnected {
            self.preview_rx = None;
            self.preview_loading = false;
        }
        if let Some(msg) = received {
            match msg {
                PreviewMessage::Success(items) => {
                    self.preview_items = items;
                    self.preview_error = None;
                }
                PreviewMessage::Error(err) => {
                    self.preview_items.clear();
                    self.preview_error = Some(err);
                }
            }
            self.preview_loading = false;
            self.preview_rx = None;
        }
    }

    fn current_host(&self) -> String {
        normalize_host(&self.host_url)
    }
}

impl eframe::App for AnimepaheApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.process_preview_messages();

        let mut apply_host_change = false;
        let host_display = self.current_host();
        egui::TopBottomPanel::top("top").show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.heading("Animepahe DL Desktop");
                ui.add_space(12.0);
                ui.label("Theme:");
                if ui.selectable_label(self.theme_dark, "Dark").clicked() {
                    if !self.theme_dark {
                        self.theme_dark = true;
                        self.persist_settings();
                    }
                }
                if ui.selectable_label(!self.theme_dark, "Light").clicked() {
                    if self.theme_dark {
                        self.theme_dark = false;
                        self.persist_settings();
                    }
                }
                ui.add_space(16.0);
                ui.label("Base URL:");
                ui.add_sized(
                    [240.0, 24.0],
                    egui::TextEdit::singleline(&mut self.host_url),
                );
                if ui.button("Apply").clicked() {
                    apply_host_change = true;
                }
                if ui.small_button("Reset").clicked() {
                    self.host_url = DEFAULT_HOST.to_string();
                    apply_host_change = true;
                }
                ui.add_space(16.0);
                ui.hyperlink_to("Animepahe", host_display.clone());
            });
        });
        if apply_host_change {
            self.persist_settings();
        }

        if self.theme_dark {
            ctx.set_visuals(egui::Visuals::dark());
        } else {
            ctx.set_visuals(egui::Visuals::light());
        }

        egui::CentralPanel::default().show(ctx, |ui| {
            ui.add_space(8.0);
            egui::Frame::group(&ctx.style())
                .inner_margin(egui::Margin::symmetric(12.0, 10.0))
                .show(ui, |ui| {
                    ui.heading("Search & Filters");
                    ui.add_space(8.0);

                    labeled_row(ui, "Anime name", |ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.anime_name)
                                .desired_width(260.0)
                                .hint_text("Enter anime name"),
                        );
                    });
                    ui.add_space(6.0);

                    labeled_row(ui, "Slug / UUID", |ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.anime_slug)
                                .desired_width(260.0)
                                .hint_text("Filled after selecting a search result"),
                        );
                    });
                    ui.add_space(6.0);

                    labeled_row(ui, "Episodes", |ui| {
                        ui.add(
                            egui::TextEdit::singleline(&mut self.episodes)
                                .desired_width(260.0)
                                .hint_text("1,3-5,*"),
                        );
                    });
                    ui.add_space(6.0);

                    labeled_row(ui, "Filters", |ui| {
                        ui.horizontal(|ui| {
                            ui.add(
                                egui::TextEdit::singleline(&mut self.resolution)
                                    .desired_width(80.0)
                                    .hint_text("Resolution"),
                            );
                            ui.add(
                                egui::TextEdit::singleline(&mut self.audio)
                                    .desired_width(80.0)
                                    .hint_text("Audio"),
                            );
                            ui.label("Threads:");
                            ui.add(
                                egui::DragValue::new(&mut self.threads)
                                    .clamp_range(1..=64)
                                    .speed(1.0),
                            );
                        });
                    });
                    ui.add_space(6.0);

                    labeled_row(ui, "Options", |ui| {
                        ui.toggle_value(&mut self.list_only, "List m3u8 only");
                        ui.toggle_value(&mut self.debug, "Debug");
                    });
                    ui.add_space(6.0);

                    labeled_row(ui, "Output folder", |ui| {
                        let shown = self
                            .download_dir
                            .as_ref()
                            .map(|p| p.display().to_string())
                            .unwrap_or_else(|| "(project folder)".into());
                        ui.horizontal(|ui| {
                            ui.monospace(shown);
                            if ui.button("Choose").clicked() {
                                if let Some(dir) = rfd::FileDialog::new()
                                    .set_title("Choose download directory")
                                    .pick_folder()
                                {
                                    self.download_dir = Some(dir);
                                    self.persist_settings();
                                }
                            }
                            if self.download_dir.is_some() && ui.small_button("Clear").clicked() {
                                self.download_dir = None;
                                self.persist_settings();
                            }
                        });
                    });

                    ui.add_space(12.0);
                    ui.horizontal(|ui| {
                        ui.spacing_mut().item_spacing.x = 10.0;
                        if ui
                            .add_enabled(!self.is_busy, egui::Button::new("Search by name"))
                            .clicked()
                        {
                            let name = self.anime_name.clone();
                            let cookie = self.cookie.clone();
                            let host = self.current_host();
                            self.is_busy = true;
                            let rt = self.rt.clone();
                            let result = rt.block_on(async move {
                                if name.trim().is_empty() {
                                    return Err(anyhow!("Anime name is empty"));
                                }
                                let items = api::search_anime(&name, &cookie, &host).await?;
                                Ok::<Vec<api::SearchItem>, anyhow::Error>(items)
                            });
                            if let Ok(items) = result {
                                self.search_results = items;
                                self.selected_search = None;
                            }
                            self.is_busy = false;
                        }

                        if ui
                            .add_enabled(!self.is_busy, egui::Button::new("Use selection"))
                            .clicked()
                        {
                            if let Some(i) = self.selected_search {
                                if let Some(item) = self.search_results.get(i) {
                                    self.anime_slug = item.session.clone();
                                    self.anime_display_name = item.title.clone();
                                }
                            }
                        }

                        if ui
                            .add_enabled(!self.is_busy, egui::Button::new("Fetch episodes"))
                            .clicked()
                        {
                            let slug = self.anime_slug.trim().to_string();
                            let cookie = self.cookie.clone();
                            let name_hint = self.anime_name.clone();
                            let host = self.current_host();
                            self.is_busy = true;
                            let rt = self.rt.clone();
                            let result = rt.block_on(async move {
                                if slug.is_empty() {
                                    return Err(anyhow!("Slug is empty"));
                                }
                                let episodes =
                                    api::fetch_all_episodes(&slug, &cookie, &host).await?;
                                let display =
                                    api::resolve_anime_name(&slug, &cookie, &name_hint, &host)
                                        .await
                                        .unwrap_or_else(|_| name_hint);
                                Ok::<(Vec<api::Episode>, String), anyhow::Error>((
                                    episodes, display,
                                ))
                            });
                            if let Ok((eps, name)) = result {
                                self.episodes_fetched = eps;
                                self.anime_display_name = name;
                                self.episode_selection.clear();
                            }
                            self.is_busy = false;
                        }

                        if ui
                            .add_enabled(!self.is_busy, egui::Button::new("Download"))
                            .clicked()
                        {
                            let slug = self.anime_slug.trim().to_string();
                            let cookie = self.cookie.clone();
                            let audio = self.audio.trim().to_string();
                            let resolution = self.resolution.trim().to_string();
                            let list_only = self.list_only;
                            let threads = self.threads as usize;
                            let episodes_str = self.episodes.trim().to_string();
                            let display_name = if self.anime_display_name.is_empty() {
                                self.anime_name.clone()
                            } else {
                                self.anime_display_name.clone()
                            };
                            let rt = self.rt.clone();
                            let ctx2 = ui.ctx().clone();
                            let status_map = self.status_map.clone();
                            let progress_pairs = self.progress_pairs.clone();
                            let selected_eps: Vec<u32> =
                                self.episode_selection.iter().copied().collect();
                            let out_dir = self.download_dir.clone();
                            let host = self.current_host();
                            self.is_busy = true;
                            std::thread::spawn(move || {
                                let _ = rt.block_on(async move {
                                    let episodes: Vec<u32> = if !selected_eps.is_empty() {
                                        selected_eps
                                    } else if !episodes_str.is_empty() {
                                        api::expand_episode_spec(
                                            &episodes_str,
                                            &slug,
                                            &cookie,
                                            &host,
                                        )
                                        .await?
                                    } else {
                                        vec![]
                                    };
                                    for ep in episodes {
                                        if let Ok(mut m) = status_map.lock() {
                                            m.insert(ep, "Fetching link".into());
                                        }
                                        ctx2.request_repaint();
                                        let sess = match api::find_session_for_episode(
                                            &slug, ep, &cookie, &host,
                                        )
                                        .await
                                        {
                                            Ok(s) => s,
                                            Err(e) => {
                                                if let Ok(mut m) = status_map.lock() {
                                                    m.insert(ep, format!("Failed: {}", e));
                                                }
                                                continue;
                                            }
                                        };
                                        let play_page = format!("{}/play/{}/{}", host, slug, sess);
                                        let candidates =
                                            match scrape::extract_candidates(&play_page, &cookie)
                                                .await
                                            {
                                                Ok(c) => c,
                                                Err(e) => {
                                                    if let Ok(mut m) = status_map.lock() {
                                                        m.insert(ep, format!("Failed: {}", e));
                                                    }
                                                    continue;
                                                }
                                            };
                                        let audio_opt = if audio.is_empty() {
                                            None
                                        } else {
                                            Some(audio.as_str())
                                        };
                                        let res_opt = if resolution.is_empty() {
                                            None
                                        } else {
                                            Some(resolution.as_str())
                                        };
                                        let selected = scrape::select_candidate(
                                            &candidates,
                                            audio_opt,
                                            res_opt,
                                        );
                                        if let Some(ep_link) = selected.map(|c| c.src.clone()) {
                                            if let Ok(mut m) = status_map.lock() {
                                                m.insert(ep, "Extracting playlist".into());
                                            }
                                            let m3u8 = match scrape::extract_m3u8_from_link(
                                                &ep_link, &cookie, &host,
                                            )
                                            .await
                                            {
                                                Ok(u) => u,
                                                Err(e) => {
                                                    if let Ok(mut m) = status_map.lock() {
                                                        m.insert(ep, format!("Failed: {}", e));
                                                    }
                                                    continue;
                                                }
                                            };
                                            if list_only {
                                                if let Ok(mut m) = status_map.lock() {
                                                    m.insert(ep, format!("m3u8: {}", m3u8));
                                                }
                                            } else {
                                                if let Ok(mut m) = status_map.lock() {
                                                    m.insert(ep, "Downloading".into());
                                                }
                                                let prog = {
                                                    let total =
                                                        std::sync::Arc::new(AtomicUsize::new(0));
                                                    let done =
                                                        std::sync::Arc::new(AtomicUsize::new(0));
                                                    if let Ok(mut p) = progress_pairs.lock() {
                                                        p.insert(ep, (total.clone(), done.clone()));
                                                    }
                                                    Some((total, done))
                                                };
                                                let base = out_dir.as_deref();
                                                match download::download_episode(
                                                    &display_name,
                                                    ep,
                                                    &m3u8,
                                                    threads,
                                                    &cookie,
                                                    base,
                                                    &host,
                                                    prog,
                                                )
                                                .await
                                                {
                                                    Ok(_) => {
                                                        if let Ok(mut m) = status_map.lock() {
                                                            m.insert(ep, "Done".into());
                                                        }
                                                    }
                                                    Err(e) => {
                                                        if let Ok(mut m) = status_map.lock() {
                                                            m.insert(ep, format!("Failed: {}", e));
                                                        }
                                                    }
                                                }
                                            }
                                        } else {
                                            if let Ok(mut m) = status_map.lock() {
                                                m.insert(ep, "No matching source".into());
                                            }
                                        }
                                        ctx2.request_repaint();
                                    }
                                    Ok::<(), anyhow::Error>(())
                                });
                            });
                        }
                    });

                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        if ui
                            .add_enabled(
                                !self.is_busy && !self.preview_loading,
                                egui::Button::new("Preview sources"),
                            )
                            .clicked()
                        {
                            let slug = self.anime_slug.trim().to_string();
                            let cookie = self.cookie.clone();
                            let episodes_str = self.episodes.trim().to_string();
                            let selected_eps: Vec<u32> =
                                self.episode_selection.iter().copied().collect();
                            let cached_eps = self.episodes_fetched.clone();
                            let host = self.current_host();
                            if slug.is_empty() {
                                self.preview_error = Some("Slug is empty".into());
                                self.preview_items.clear();
                                self.preview_open = true;
                                self.preview_loading = false;
                                self.preview_rx = None;
                            } else {
                                let (tx, rx) = mpsc::channel();
                                self.preview_rx = Some(rx);
                                self.preview_loading = true;
                                self.preview_error = None;
                                self.preview_items.clear();
                                self.preview_open = true;
                                let ctx2 = ui.ctx().clone();
                                let rt = self.rt.clone();
                                std::thread::spawn(move || {
                                    let result = rt.block_on(async move {
                                        let mut episodes: Vec<u32> = if !selected_eps.is_empty() {
                                            selected_eps
                                        } else if !episodes_str.is_empty() {
                                            api::expand_episode_spec(
                                                &episodes_str,
                                                &slug,
                                                &cookie,
                                                &host,
                                            )
                                            .await?
                                        } else {
                                            cached_eps
                                                .iter()
                                                .filter_map(|e| {
                                                    e.episode.as_u64().map(|v| v as u32)
                                                })
                                                .collect()
                                        };
                                        episodes.sort_unstable();
                                        episodes.dedup();
                                        if episodes.is_empty() {
                                            return Err(anyhow!(
                                                "No episodes selected for preview"
                                            ));
                                        }

                                        let mut episode_sessions: BTreeMap<u32, String> =
                                            BTreeMap::new();
                                        for ep in &cached_eps {
                                            if let Some(n) = ep.episode.as_u64() {
                                                episode_sessions
                                                    .insert(n as u32, ep.session.clone());
                                            }
                                        }

                                        let mut items = Vec::new();
                                        let mut fallback_sessions: Option<BTreeMap<u32, String>> =
                                            None;
                                        for ep in episodes {
                                            let sess = if let Some(s) = episode_sessions.get(&ep) {
                                                s.clone()
                                            } else {
                                                if fallback_sessions.is_none() {
                                                    let fetched = api::fetch_all_episodes(
                                                        &slug, &cookie, &host,
                                                    )
                                                    .await?;
                                                    let mut map = BTreeMap::new();
                                                    for e in fetched {
                                                        if let Some(n) = e.episode.as_u64() {
                                                            map.insert(n as u32, e.session);
                                                        }
                                                    }
                                                    fallback_sessions = Some(map);
                                                }
                                                fallback_sessions
                                                    .as_ref()
                                                    .and_then(|m| m.get(&ep).cloned())
                                                    .ok_or_else(|| {
                                                        anyhow!("Episode {} not found", ep)
                                                    })?
                                            };
                                            let play_page =
                                                format!("{}/play/{}/{}", host, slug, sess);
                                            let candidates =
                                                scrape::extract_candidates(&play_page, &cookie)
                                                    .await?;
                                            items.push(PreviewItem {
                                                episode: ep,
                                                sources: candidates,
                                            });
                                        }
                                        Ok(items)
                                    });

                                    let message = match result {
                                        Ok(items) => PreviewMessage::Success(items),
                                        Err(e) => PreviewMessage::Error(e.to_string()),
                                    };
                                    let _ = tx.send(message);
                                    ctx2.request_repaint();
                                });
                            }
                        }
                    });
                });

            ui.add_space(12.0);

            egui::Frame::group(&ctx.style())
                .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                .show(ui, |ui| {
                    ui.heading("Selection summary");
                    ui.add_space(4.0);
                    let anime_label = if self.anime_display_name.is_empty() {
                        "-".to_string()
                    } else {
                        self.anime_display_name.clone()
                    };
                    ui.label(format!("Anime: {}", anime_label));
                    ui.label(format!("Fetched episodes: {}", self.episodes_fetched.len()));
                });

            if !self.search_results.is_empty() {
                ui.add_space(12.0);
                egui::Frame::group(&ctx.style())
                    .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                    .show(ui, |ui| {
                        ui.heading("Search results");
                        ui.label("Pick one:");
                        ui.add_space(6.0);
                        egui::ScrollArea::vertical()
                            .max_height(180.0)
                            .show(ui, |ui| {
                                for (i, item) in self.search_results.iter().enumerate() {
                                    let selected = self.selected_search == Some(i);
                                    if ui.selectable_label(selected, &item.title).clicked() {
                                        self.selected_search = Some(i);
                                    }
                                }
                            });
                    });
            }

            if !self.episodes_fetched.is_empty() {
                ui.add_space(12.0);
                egui::Frame::group(&ctx.style())
                    .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                    .show(ui, |ui| {
                        ui.heading("Episode selection");
                        ui.add_space(6.0);
                        ui.horizontal(|ui| {
                            if ui.button("Select all").clicked() {
                                self.episode_selection.clear();
                                for e in &self.episodes_fetched {
                                    if let Some(n) = e.episode.as_u64() {
                                        self.episode_selection.insert(n as u32);
                                    }
                                }
                            }
                            if ui.button("Clear").clicked() {
                                self.episode_selection.clear();
                            }
                            if ui.button("Use selection").clicked() {
                                if !self.episode_selection.is_empty() {
                                    let spec = self
                                        .episode_selection
                                        .iter()
                                        .map(|n| n.to_string())
                                        .collect::<Vec<_>>()
                                        .join(",");
                                    self.episodes = spec;
                                }
                            }
                        });
                        ui.add_space(6.0);
                        egui::ScrollArea::vertical()
                            .max_height(200.0)
                            .show(ui, |ui| {
                                for e in &self.episodes_fetched {
                                    if let Some(n) = e.episode.as_u64() {
                                        let n = n as u32;
                                        let mut checked = self.episode_selection.contains(&n);
                                        ui.horizontal(|ui| {
                                            ui.checkbox(&mut checked, format!("E{}", n));
                                            if checked {
                                                self.episode_selection.insert(n);
                                            } else {
                                                self.episode_selection.remove(&n);
                                            }
                                        });
                                    }
                                }
                            });
                    });
            }

            ui.add_space(12.0);
            egui::Frame::group(&ctx.style())
                .inner_margin(egui::Margin::symmetric(12.0, 8.0))
                .show(ui, |ui| {
                    ui.heading("Download status");
                    ui.add_space(6.0);
                    egui::ScrollArea::vertical()
                        .max_height(220.0)
                        .show(ui, |ui| {
                            if let (Ok(map), Ok(pp)) =
                                (self.status_map.lock(), self.progress_pairs.lock())
                            {
                                for (ep, st) in map.iter() {
                                    let color = if st.starts_with("Done") {
                                        egui::Color32::GREEN
                                    } else if st.starts_with("Failed") {
                                        egui::Color32::RED
                                    } else {
                                        egui::Color32::YELLOW
                                    };
                                    ui.colored_label(color, format!("E{}: {}", ep, st));
                                    if let Some((total, done)) = pp.get(ep) {
                                        let t = total.load(Ordering::Relaxed) as f32;
                                        let d = done.load(Ordering::Relaxed) as f32;
                                        if t > 0.0 {
                                            let frac = (d / t).clamp(0.0, 1.0);
                                            ui.add(
                                                egui::ProgressBar::new(frac)
                                                    .text(format!("{:.0}%", frac * 100.0)),
                                            );
                                        }
                                    }
                                }
                            }
                        });
                });
        });

        if self.preview_open {
            let mut open = self.preview_open;
            egui::Window::new("Episode Sources")
                .open(&mut open)
                .resizable(true)
                .show(ctx, |ui| {
                    if self.preview_loading {
                        ui.horizontal(|ui| {
                            ui.spinner();
                            ui.label("Loading sources...");
                        });
                    } else if let Some(err) = &self.preview_error {
                        ui.colored_label(egui::Color32::RED, err);
                    } else if self.preview_items.is_empty() {
                        ui.label("No sources available.");
                    } else {
                        egui::ScrollArea::vertical().show(ui, |ui| {
                            for item in &self.preview_items {
                                ui.separator();
                                ui.heading(format!("Episode {}", item.episode));
                                if item.sources.is_empty() {
                                    ui.label("No sources found for this episode.");
                                } else {
                                    for source in &item.sources {
                                        let audio = source.audio.as_deref().unwrap_or("-");
                                        let resolution =
                                            source.resolution.as_deref().unwrap_or("-");
                                        ui.horizontal(|ui| {
                                            ui.label(format!("Audio: {}", audio));
                                            ui.label(format!("Resolution: {}", resolution));
                                            ui.monospace(&source.src);
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
            self.preview_open = open;
        }
    }
}

fn labeled_row(ui: &mut egui::Ui, label: &str, add_contents: impl FnOnce(&mut egui::Ui)) {
    ui.columns(2, |columns| {
        columns[0].set_min_width(LABEL_COLUMN_WIDTH);
        columns[0].label(label);
        add_contents(&mut columns[1]);
    });
}

fn gen_cookie() -> String {
    let rand: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(16)
        .map(char::from)
        .collect();
    format!("__ddg2_={}", rand)
}
