use std::{collections::BTreeMap, sync::Arc};

use tokio::time::{sleep, Duration};

use serde::{Deserialize, Serialize};
use tauri::{async_runtime::JoinHandle, Emitter, State, Window};

use crate::{
    api, download, scrape,
    settings::{self, AppSettings, AppState},
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EpisodeInfo {
    pub number: u32,
    pub session: String,
}

#[derive(Debug, Serialize)]
pub struct FetchEpisodesResponse {
    pub episodes: Vec<EpisodeInfo>,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct PreviewItem {
    pub episode: u32,
    pub sources: Vec<scrape::Candidate>,
}

#[derive(Debug, Deserialize)]
pub struct SearchRequest {
    pub name: String,
    pub host: String,
}

#[tauri::command]
pub async fn load_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.lock().unwrap().clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    state.persist(settings).map_err(|err| err.to_string())
}

#[tauri::command]
pub async fn search_anime(
    state: State<'_, AppState>,
    req: SearchRequest,
) -> Result<Vec<api::SearchItem>, String> {
    let cookie = state.cookie();
    let host = settings::normalize_host(&req.host);
    api::search_anime(&req.name, &cookie, &host)
        .await
        .map_err(|err| err.to_string())
}

#[derive(Debug, Deserialize)]
pub struct FetchEpisodesRequest {
    pub slug: String,
    pub host: String,
    pub name_hint: String,
}

#[tauri::command]
pub async fn fetch_episodes(
    state: State<'_, AppState>,
    req: FetchEpisodesRequest,
) -> Result<FetchEpisodesResponse, String> {
    let cookie = state.cookie();
    let host = settings::normalize_host(&req.host);
    let episodes = api::fetch_all_episodes(&req.slug, &cookie, &host)
        .await
        .map_err(|err| err.to_string())?;
    let display = api::resolve_anime_name(&req.slug, &cookie, &req.name_hint, &host)
        .await
        .unwrap_or_else(|_| req.name_hint);

    let mut items = Vec::new();
    for ep in episodes {
        if let Some(num) = ep.episode.as_u64() {
            items.push(EpisodeInfo {
                number: num as u32,
                session: ep.session.clone(),
            });
        }
    }
    Ok(FetchEpisodesResponse {
        episodes: items,
        display_name: display,
    })
}

#[derive(Debug, Deserialize)]
pub struct PreviewRequest {
    pub slug: String,
    pub host: String,
    pub episodes: Vec<u32>,
    pub cached: Vec<EpisodeInfo>,
}

#[tauri::command]
pub async fn preview_sources(
    state: State<'_, AppState>,
    req: PreviewRequest,
) -> Result<Vec<PreviewItem>, String> {
    let cookie = state.cookie();
    let host = settings::normalize_host(&req.host);
    let mut session_map: BTreeMap<u32, String> = req
        .cached
        .into_iter()
        .map(|c| (c.number, c.session))
        .collect();
    if session_map.is_empty() {
        let episodes = api::fetch_all_episodes(&req.slug, &cookie, &host)
            .await
            .map_err(|err| err.to_string())?;
        for ep in episodes {
            if let Some(num) = ep.episode.as_u64() {
                session_map.insert(num as u32, ep.session.clone());
            }
        }
    }

    let mut items = Vec::new();
    for ep in req.episodes {
        let sess = session_map
            .get(&ep)
            .cloned()
            .ok_or_else(|| format!("Episode {ep} not found"))?;
        let play_page = format!("{}/play/{}/{}", host, req.slug, sess);
        let sources = scrape::extract_candidates(&play_page, &cookie)
            .await
            .map_err(|err| err.to_string())?;
        items.push(PreviewItem {
            episode: ep,
            sources,
        });
    }
    Ok(items)
}

#[derive(Debug, Deserialize)]
pub struct DownloadRequest {
    pub anime_name: String,
    pub slug: String,
    pub host: String,
    pub resolution: Option<String>,
    pub audio: Option<String>,
    pub threads: usize,
    pub list_only: bool,
    pub episodes_spec: Option<String>,
    pub selected: Vec<u32>,
    pub download_dir: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RequirementStatus {
    pub name: String,
    pub available: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RequirementsCheckResponse {
    pub all_available: bool,
    pub requirements: Vec<RequirementStatus>,
}

#[derive(Debug, Serialize, Clone)]
struct StatusPayload {
    episode: u32,
    status: String,
}

#[derive(Debug, Serialize, Clone)]
struct ProgressPayload {
    episode: u32,
    done: usize,
    total: usize,
}

#[tauri::command]
pub async fn start_download(
    window: Window,
    state: State<'_, AppState>,
    req: DownloadRequest,
) -> Result<(), String> {
    // Check requirements before starting download
    let requirements_check = check_requirements().await?;
    if !requirements_check.all_available {
        let missing: Vec<String> = requirements_check
            .requirements
            .iter()
            .filter(|r| !r.available)
            .map(|r| r.name.clone())
            .collect();
        return Err(format!(
            "Missing required dependencies: {}. Please install them before downloading.",
            missing.join(", ")
        ));
    }

    let cookie = state.cookie();
    let anime_name = if req.anime_name.is_empty() {
        req.slug.clone()
    } else {
        req.anime_name.clone()
    };
    let host = settings::normalize_host(&req.host);
    let download_dir = req
        .download_dir
        .as_ref()
        .map(|p| std::path::PathBuf::from(p));
    let threads = req.threads.max(2);
    let spec = req.episodes_spec.clone().unwrap_or_default();
    let selected = req.selected.clone();
    tauri::async_runtime::spawn(async move {
        let episodes: anyhow::Result<Vec<u32>> = if !selected.is_empty() {
            Ok(selected)
        } else if !spec.trim().is_empty() {
            api::expand_episode_spec(&spec, &req.slug, &cookie, &host).await
        } else {
            Ok(Vec::new())
        };

        let episodes = match episodes {
            Ok(e) if !e.is_empty() => e,
            Ok(_) => {
                let _ = window.emit(
                    "download-status",
                    StatusPayload {
                        episode: 0,
                        status: "No episodes selected".into(),
                    },
                );
                return;
            }
            Err(err) => {
                let _ = window.emit(
                    "download-status",
                    StatusPayload {
                        episode: 0,
                        status: format!("Failed: {err}"),
                    },
                );
                return;
            }
        };

        for episode in episodes {
            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Fetching link".into(),
                },
            );

            let sess = match api::find_session_for_episode(&req.slug, episode, &cookie, &host).await
            {
                Ok(s) => s,
                Err(err) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                        },
                    );
                    continue;
                }
            };
            let play_page = format!("{}/play/{}/{}", host, req.slug, sess);
            let candidates = match scrape::extract_candidates(&play_page, &cookie).await {
                Ok(c) => c,
                Err(err) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                        },
                    );
                    continue;
                }
            };
            let chosen = scrape::select_candidate(
                &candidates,
                req.audio.as_deref(),
                req.resolution.as_deref(),
            );
            let Some(candidate) = chosen else {
                let _ = window.emit(
                    "download-status",
                    StatusPayload {
                        episode,
                        status: "No matching source".into(),
                    },
                );
                continue;
            };
            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Extracting playlist".into(),
                },
            );
            let playlist =
                match scrape::extract_m3u8_from_link(&candidate.src, &cookie, &host).await {
                    Ok(p) => p,
                    Err(err) => {
                        let _ = window.emit(
                            "download-status",
                            StatusPayload {
                                episode,
                                status: format!("Failed: {err}"),
                            },
                        );
                        continue;
                    }
                };

            eprintln!("Playlist extraction completed for episode {}, starting download process", episode);

            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Downloading".into(),
                },
            );

            if req.list_only {
                let _ = window.emit(
                    "download-status",
                    StatusPayload {
                        episode,
                        status: format!("m3u8: {playlist}"),
                    },
                );
                continue;
            }

            let total = Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let done = Arc::new(std::sync::atomic::AtomicUsize::new(0));

            let progress_window = window.clone();
            let progress_episode = episode;
            let progress_total = total.clone();
            let progress_done = done.clone();
            let progress_handle: JoinHandle<()> = tauri::async_runtime::spawn(async move {
                loop {
                    let t = progress_total.load(std::sync::atomic::Ordering::Relaxed);
                    let d = progress_done.load(std::sync::atomic::Ordering::Relaxed);
                    if t > 0 {
                        let _ = progress_window.emit(
                            "download-progress",
                            ProgressPayload {
                                episode: progress_episode,
                                done: d,
                                total: t,
                            },
                        );
                    }
                    if t > 0 && d >= t {
                        break;
                    }
                    sleep(Duration::from_millis(200)).await;
                }
            });

            eprintln!("Starting download_episode function for episode {}", episode);

            let status = download::download_episode(
                &anime_name,
                episode,
                &playlist,
        threads,
                &cookie,
                download_dir.as_deref(),
                &host,
                Some((total.clone(), done.clone())),
            )
            .await;

            progress_handle.await.ok();

            match status {
                Ok(_) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: "Done".into(),
                        },
                    );
                }
                Err(err) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn check_requirements() -> Result<RequirementsCheckResponse, String> {
    let mut requirements = Vec::new();
    let mut all_available = true;

    // Check ffmpeg
    match which::which("ffmpeg") {
        Ok(path) => {
            requirements.push(RequirementStatus {
                name: "ffmpeg".to_string(),
                available: true,
                path: Some(path.to_string_lossy().to_string()),
                error: None,
            });
        }
        Err(err) => {
            all_available = false;
            requirements.push(RequirementStatus {
                name: "ffmpeg".to_string(),
                available: false,
                path: None,
                error: Some(format!("ffmpeg not found: {}", err)),
            });
        }
    }

    Ok(RequirementsCheckResponse {
        all_available,
        requirements,
    })
}
