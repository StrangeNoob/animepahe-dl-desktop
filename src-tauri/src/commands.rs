use std::{collections::BTreeMap, path::PathBuf, sync::Arc};
use std::collections::HashMap;
use std::sync::Mutex as StdMutex;
use std::io::Write;

use tokio::time::{sleep, Duration};
use tokio::sync::Mutex as TokioMutex;

use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{async_runtime::JoinHandle, AppHandle, Emitter, Manager, State, Window};
use base64::Engine;

use crate::{
    api, download, scrape,
    settings::{self, AppSettings, AppState},
    download_tracker::{DownloadTracker, DownloadRecord},
};

// Track active downloads for cancellation
#[derive(Clone)]
pub struct DownloadState {
    active: Arc<TokioMutex<HashMap<u32, tokio::sync::watch::Sender<bool>>>>,
}

impl DownloadState {
    pub fn new() -> Self {
        Self {
            active: Arc::new(TokioMutex::new(HashMap::new())),
        }
    }
}

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

#[derive(Debug, Serialize, Clone)]
pub struct DownloadCompleteNotification {
    pub anime_name: String,
    pub episode: u32,
    pub file_path: String,
    pub file_size: i64,
    pub success: bool,
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

// Request type for start_download command
#[derive(Debug, Deserialize)]
pub struct StartDownloadRequest {
    pub anime_name: String,
    pub anime_slug: String,
    pub episodes: Vec<u32>,
    pub audio_type: Option<String>,
    pub resolution: Option<String>,
    pub download_dir: Option<String>,
    pub host: String,
    #[serde(default)]
    pub resume_download_id: Option<String>,
    #[serde(default)]
    pub threads: Option<usize>,
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
    path: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    episode: u32,
    done: usize,
    total: usize,
    speed_bps: f64, // bytes per second
    elapsed_seconds: u64, // time spent downloading
}

#[tauri::command]
pub async fn start_download(
    state: State<'_, AppState>,
    download_state: State<'_, DownloadState>,
    window: Window,
    tracker: State<'_, DownloadTracker>,
    library: State<'_, crate::library::Library>,
    req: StartDownloadRequest,
) -> Result<(), String> {
    // Check requirements before starting download
    let app_handle = window.app_handle();
    let requirements_check = check_requirements_internal(&app_handle)?;
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

    if let Ok(path) = resolve_ffmpeg_path(&app_handle) {
        download::set_ffmpeg_path(path);
    }

    let cookie = state.cookie();
    let anime_name = req.anime_name.clone();
    let host = settings::normalize_host(&req.host);
    let download_dir = req
        .download_dir
        .as_ref()
        .map(|p| std::path::PathBuf::from(p));
    let threads = req.threads.unwrap_or_else(|| {
        state.settings.lock().unwrap().max_threads
    });
    let episodes = req.episodes.clone();

    // Clone states before spawning to avoid lifetime issues
    let download_state_arc = (*download_state).clone();
    let tracker_clone = (*tracker).clone();
    let library_clone = (*library).clone();

    tauri::async_runtime::spawn(async move {
        if episodes.is_empty() {
            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode: 0,
                    status: "No episodes selected".into(),
                    path: None,
                },
            );
            return;
        }

        // Fetch and save anime poster locally
        let poster_path = match api::fetch_anime_poster(&req.anime_slug, &cookie, &host).await {
            Ok(Some(url)) => {
                // Download and save the poster image
                match download_and_save_poster(&url, &req.anime_slug, &cookie, &host).await {
                    Ok(path) => Some(path),
                    Err(e) => {
                        eprintln!("Failed to download poster: {}", e);
                        None
                    }
                }
            }
            _ => None,
        };

        for episode in episodes {
            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Fetching link".into(),
                    path: None,
                },
            );

            let sess = match api::find_session_for_episode(&req.anime_slug, episode, &cookie, &host).await
            {
                Ok(s) => s,
                Err(err) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                            path: None,
                        },
                    );
                    continue;
                }
            };
            let play_page = format!("{}/play/{}/{}", host, req.anime_slug, sess);
            let candidates = match scrape::extract_candidates(&play_page, &cookie).await {
                Ok(c) => c,
                Err(err) => {
                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                            path: None,
                        },
                    );
                    continue;
                }
            };
            let chosen = scrape::select_candidate(
                &candidates,
                req.audio_type.as_deref(),
                req.resolution.as_deref(),
            );
            let Some(candidate) = chosen else {
                let _ = window.emit(
                    "download-status",
                    StatusPayload {
                        episode,
                        status: "No matching source".into(),
                        path: None,
                    },
                );
                continue;
            };
            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Extracting playlist".into(),
                    path: None,
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
                                path: None,
                            },
                        );
                        continue;
                    }
                };

            eprintln!(
                "Playlist extraction completed for episode {}, starting download process",
                episode
            );

            let _ = window.emit(
                "download-status",
                StatusPayload {
                    episode,
                    status: "Downloading".into(),
                    path: None,
                },
            );

            // Generate expected file path
            let sanitized_name = sanitize_filename::sanitize(&anime_name);
            let file_name = format!("{} - Episode {}.mp4", sanitized_name, episode);
            let file_path = if let Some(ref dir) = download_dir {
                dir.join(&file_name)
            } else {
                PathBuf::from(&file_name)
            };

            // Create or get download tracker ID
            let download_id = if let Some(ref resume_id) = req.resume_download_id {
                resume_id.clone()
            } else {
                match tracker_clone.add_download(
                    anime_name.clone(),
                    episode as i32,
                    req.anime_slug.clone(),
                    file_path.to_string_lossy().to_string(),
                    req.audio_type.clone(),
                    req.resolution.clone(),
                ) {
                    Ok(id) => id,
                    Err(err) => {
                        eprintln!("Failed to create download record: {}", err);
                        format!("{}-ep{}-{}", req.anime_slug, episode, chrono::Utc::now().timestamp())
                    }
                }
            };

            let total = Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let done = Arc::new(std::sync::atomic::AtomicUsize::new(0));

            // Create cancellation token for this episode
            let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
            {
                let mut active = download_state_arc.active.lock().await;
                active.insert(episode, cancel_tx);
            }

            let progress_window = window.clone();
            let progress_episode = episode;
            let progress_total = total.clone();
            let progress_done = done.clone();
            let mut progress_cancel_rx = cancel_rx.clone();

            // Track speed and elapsed time
            let start_time = std::time::Instant::now();
            let last_done = Arc::new(std::sync::atomic::AtomicUsize::new(0));
            let last_time = Arc::new(StdMutex::new(std::time::Instant::now()));

            let progress_last_done = last_done.clone();
            let progress_last_time = last_time.clone();
            let progress_tracker = tracker_clone.clone();
            let progress_download_id = download_id.clone();

            let progress_handle: JoinHandle<()> = tauri::async_runtime::spawn(async move {
                loop {
                    tokio::select! {
                        _ = progress_cancel_rx.changed() => {
                            if *progress_cancel_rx.borrow() {
                                break;
                            }
                        }
                        _ = sleep(Duration::from_millis(200)) => {
                            let t = progress_total.load(std::sync::atomic::Ordering::Relaxed);
                            let d = progress_done.load(std::sync::atomic::Ordering::Relaxed);

                            // Calculate speed
                            let now = std::time::Instant::now();
                            let last_d = progress_last_done.swap(d, std::sync::atomic::Ordering::Relaxed);
                            let elapsed = {
                                let mut last_t = progress_last_time.lock().unwrap();
                                let elapsed = now.duration_since(*last_t).as_secs_f64();
                                *last_t = now;
                                elapsed
                            };

                            let speed_bps = if elapsed > 0.0 && d > last_d {
                                (d - last_d) as f64 / elapsed
                            } else {
                                0.0
                            };

                            if t > 0 {
                                // Update tracker with progress
                                let _ = progress_tracker.update_progress(
                                    &progress_download_id,
                                    d as u64,
                                    Some(t as u64),
                                );

                                let elapsed_seconds = start_time.elapsed().as_secs();
                                let _ = progress_window.emit(
                                    "download-progress",
                                    ProgressPayload {
                                        episode: progress_episode,
                                        done: d,
                                        total: t,
                                        speed_bps,
                                        elapsed_seconds,
                                    },
                                );
                            }
                        }
                    }
                }
            });

            eprintln!("Starting download_episode function for episode {}", episode);

            let download_cancel_rx = cancel_rx.clone();
            let status = download::download_episode(
                &anime_name,
                episode,
                &playlist,
                threads,
                &cookie,
                download_dir.as_deref(),
                &host,
                Some((total.clone(), done.clone())),
                Some(download_cancel_rx),
            )
            .await;

            // Stop progress tracking and remove from active downloads
            {
                let mut active = download_state_arc.active.lock().await;
                if let Some(tx) = active.remove(&episode) {
                    let _ = tx.send(true);
                }
            }

            progress_handle.await.ok();

            match status {
                Ok(path) => {
                    // Mark download as completed in tracker
                    let _ = tracker_clone.mark_completed(&download_id);

                    // Add to library and get file size
                    let file_size = if let Ok(metadata) = std::fs::metadata(&path) {
                        let size = metadata.len() as i64;
                        let _ = library_clone.add_download(
                            &anime_name,
                            &req.anime_slug,
                            episode as i32,
                            req.resolution.as_deref(),
                            req.audio_type.as_deref(),
                            &path.to_string_lossy(),
                            size,
                            poster_path.as_deref(),
                            &host,
                        );
                        size
                    } else {
                        0
                    };

                    let folder = path
                        .parent()
                        .map(|p| p.to_path_buf())
                        .unwrap_or(path.clone());

                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: "Done".into(),
                            path: Some(folder.to_string_lossy().to_string()),
                        },
                    );

                    // Emit download complete notification
                    let notification = DownloadCompleteNotification {
                        anime_name: anime_name.clone(),
                        episode,
                        file_path: path.to_string_lossy().to_string(),
                        file_size,
                        success: true,
                    };
                    println!("[NOTIFICATION] Emitting download-complete event for {} Episode {}", anime_name, episode);
                    println!("[NOTIFICATION] File path: {}", path.to_string_lossy());
                    let _ = window.emit("download-complete", notification);
                }
                Err(err) => {
                    // Mark download as failed in tracker
                    let _ = tracker_clone.mark_failed(&download_id, err.to_string());

                    let _ = window.emit(
                        "download-status",
                        StatusPayload {
                            episode,
                            status: format!("Failed: {err}"),
                            path: None,
                        },
                    );

                    // Emit download failed notification
                    let _ = window.emit(
                        "download-failed",
                        DownloadCompleteNotification {
                            anime_name: anime_name.clone(),
                            episode,
                            file_path: String::new(),
                            file_size: 0,
                            success: false,
                        },
                    );
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_download(
    download_state: State<'_, DownloadState>,
    tracker: State<'_, DownloadTracker>,
    episode: u32,
) -> Result<(), String> {
    let mut active = download_state.active.lock().await;
    if let Some(tx) = active.remove(&episode) {
        tx.send(true).map_err(|_| "Failed to send cancel signal".to_string())?;

        // Find and mark the download as cancelled in tracker
        // We need to find the download record for this episode
        let downloads = tracker.get_incomplete_downloads();
        for download in downloads {
            if download.episode == episode as i32 {
                let _ = tracker.mark_cancelled(&download.id);
                break;
            }
        }

        Ok(())
    } else {
        Err(format!("Episode {} not found in active downloads", episode))
    }
}

#[tauri::command]
pub async fn check_requirements(
    app_handle: AppHandle,
) -> Result<RequirementsCheckResponse, String> {
    check_requirements_internal(&app_handle)
}

#[tauri::command]
pub async fn open_path(path: String) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("Path is empty".into());
    }
    open::that(&path).map_err(|err| err.to_string())
}

fn check_requirements_internal(
    app_handle: &AppHandle,
) -> Result<RequirementsCheckResponse, String> {
    let mut requirements = Vec::new();
    let mut all_available = true;

    match resolve_ffmpeg_path(&app_handle) {
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

fn resolve_ffmpeg_path(app_handle: &AppHandle) -> Result<PathBuf, which::Error> {
    if let Some(path) = bundled_ffmpeg_path(app_handle) {
        return Ok(path);
    }
    which::which("ffmpeg")
}

fn bundled_ffmpeg_path(app_handle: &AppHandle) -> Option<PathBuf> {
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &[
            "ffmpeg/windows/ffmpeg.exe",
            "resources/ffmpeg/windows/ffmpeg.exe",
        ]
    } else if cfg!(target_os = "macos") {
        &["ffmpeg/macos/ffmpeg", "resources/ffmpeg/macos/ffmpeg"]
    } else {
        &["ffmpeg/linux/ffmpeg", "resources/ffmpeg/linux/ffmpeg"]
    };

    candidates.iter().find_map(|relative| {
        app_handle
            .path()
            .resolve(relative, BaseDirectory::Resource)
            .ok()
            .filter(|path| path.exists())
    })
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Resume download commands
#[tauri::command]
pub fn get_incomplete_downloads(
    tracker: State<'_, DownloadTracker>,
) -> Result<Vec<DownloadRecord>, String> {
    Ok(tracker.get_incomplete_downloads())
}

#[tauri::command]
pub async fn resume_download(
    tracker: State<'_, DownloadTracker>,
    download_id: String,
    state: State<'_, AppState>,
    download_state: State<'_, DownloadState>,
    window: Window,
    library: State<'_, crate::library::Library>,
) -> Result<(), String> {
    // Get the download record
    let record = tracker.get_download(&download_id)
        .ok_or_else(|| "Download record not found".to_string())?;

    // Remove the old record to allow fresh download with same settings
    tracker.remove_download(&download_id)?;

    // Prepare download request
    let req = StartDownloadRequest {
        anime_slug: record.slug.clone(),
        anime_name: record.anime_name.clone(),
        episodes: vec![record.episode as u32],
        audio_type: record.audio_type.clone(),
        resolution: record.resolution.clone(),
        download_dir: std::path::Path::new(&record.file_path)
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string()),
        host: state.settings.lock().unwrap().host_url.clone(),
        resume_download_id: None,
        threads: None, // Use default from settings
    };

    // Start the download
    start_download(state, download_state, window, tracker, library, req).await
}

#[tauri::command]
pub fn remove_download_record(
    tracker: State<'_, DownloadTracker>,
    download_id: String,
) -> Result<(), String> {
    tracker.remove_download(&download_id)
}

#[tauri::command]
pub fn clear_completed_downloads(
    tracker: State<'_, DownloadTracker>,
) -> Result<(), String> {
    tracker.clear_completed()
}

#[tauri::command]
pub fn validate_download_integrity(
    tracker: State<'_, DownloadTracker>,
    download_id: String,
) -> Result<bool, String> {
    tracker.validate_file(&download_id)
}

// Library commands

#[tauri::command]
pub fn check_episode_downloaded(
    library: State<'_, crate::library::Library>,
    slug: String,
    episode: i32,
) -> Result<bool, String> {
    library.check_episode_downloaded(&slug, episode)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library_entry(
    library: State<'_, crate::library::Library>,
    slug: String,
    episode: i32,
) -> Result<Option<crate::library::LibraryEntry>, String> {
    library.get_library_entry(&slug, episode)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library_entries(
    library: State<'_, crate::library::Library>,
) -> Result<Vec<crate::library::LibraryEntry>, String> {
    library.get_library_entries()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_anime_library(
    library: State<'_, crate::library::Library>,
) -> Result<Vec<crate::library::AnimeStats>, String> {
    library.get_anime_library()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_anime_episodes(
    library: State<'_, crate::library::Library>,
    slug: String,
) -> Result<Vec<crate::library::LibraryEntry>, String> {
    library.get_anime_episodes(&slug)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_episode_watched(
    library: State<'_, crate::library::Library>,
    id: i64,
) -> Result<(), String> {
    library.mark_episode_watched(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_library_entry(
    library: State<'_, crate::library::Library>,
    id: i64,
) -> Result<(), String> {
    library.delete_library_entry(id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_anime_from_library(
    library: State<'_, crate::library::Library>,
    slug: String,
) -> Result<(), String> {
    library.delete_anime(&slug)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_library_stats(
    library: State<'_, crate::library::Library>,
) -> Result<crate::library::LibraryStats, String> {
    library.get_library_stats()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_library(
    library: State<'_, crate::library::Library>,
    query: String,
) -> Result<Vec<crate::library::AnimeStats>, String> {
    library.search_library(&query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_library(
    library: State<'_, crate::library::Library>,
) -> Result<String, String> {
    library.export_library()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_library(
    library: State<'_, crate::library::Library>,
    json: String,
) -> Result<usize, String> {
    library.import_library(&json)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_library_to_file(
    library: State<'_, crate::library::Library>,
    file_path: String,
) -> Result<(), String> {
    let json = library.export_library()
        .map_err(|e| e.to_string())?;
    std::fs::write(&file_path, json)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
pub fn import_library_from_file(
    library: State<'_, crate::library::Library>,
    file_path: String,
) -> Result<usize, String> {
    let json = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    library.import_library(&json)
        .map_err(|e| e.to_string())
}

async fn download_and_save_poster(
    url: &str,
    slug: &str,
    cookie: &str,
    host: &str,
) -> Result<String, String> {
    // Create posters directory in config
    let config_dir = dirs::config_dir()
        .ok_or("Failed to get config directory")?
        .join("animepahe-dl")
        .join("posters");

    std::fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create posters directory: {}", e))?;

    // Extract filename from URL
    let filename = url
        .split('/')
        .last()
        .ok_or("Invalid URL")?;

    let poster_path = config_dir.join(filename);

    // Skip if already exists
    if poster_path.exists() {
        return Ok(poster_path.to_string_lossy().to_string());
    }

    // Download the image
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("Referer", format!("{}/anime/{}", host.trim_end_matches('/'), slug))
        .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .header("Cookie", cookie)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch poster: {}", e))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read poster bytes: {}", e))?;

    // Save to file
    let mut file = std::fs::File::create(&poster_path)
        .map_err(|e| format!("Failed to create poster file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write poster file: {}", e))?;

    Ok(poster_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn migrate_library_posters(
    library: State<'_, crate::library::Library>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let host = {
        let settings = state.settings.lock().unwrap();
        settings.host_url.clone()
    };
    let cookie = ""; // No cookie needed for poster migration

    // Get all anime from library
    let anime_list = library.get_anime_library()
        .map_err(|e| e.to_string())?;

    for anime in anime_list {
        // Skip if already has local path
        if let Some(ref url) = anime.thumbnail_url {
            if url.starts_with("/") || url.starts_with("~") {
                continue; // Already local path
            }

            // Download and save poster
            if let Ok(local_path) = download_and_save_poster(url, &anime.slug, cookie, &host).await {
                // Update all episodes with this anime
                let _ = library.update_poster_path(&anime.slug, &local_path);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn fetch_image_as_base64(path: String) -> Result<String, String> {
    // Read image from local filesystem
    let bytes = std::fs::read(&path)
        .map_err(|e| format!("Failed to read image file: {}", e))?;

    // Convert to base64
    let base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    // Detect content type from file extension
    let content_type = if path.ends_with(".png") {
        "image/png"
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg"
    } else if path.ends_with(".webp") {
        "image/webp"
    } else if path.ends_with(".gif") {
        "image/gif"
    } else {
        "image/jpeg" // default
    };

    Ok(format!("data:{};base64,{}", content_type, base64))
}

// Notification commands

#[tauri::command]
pub async fn play_notification_sound() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("afplay")
            .arg("/System/Library/Sounds/Glass.aiff")
            .spawn()
            .map_err(|e| format!("Failed to play sound: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("powershell")
            .args(&["-c", "[console]::beep(800,200)"])
            .spawn()
            .map_err(|e| format!("Failed to play sound: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("paplay")
            .arg("/usr/share/sounds/freedesktop/stereo/complete.oga")
            .spawn()
            .ok(); // Don't fail if sound file doesn't exist
    }

    Ok(())
}

#[tauri::command]
pub fn update_tray_title(app: AppHandle, title: String) -> Result<(), String> {
    println!("[TRAY] Attempting to update tray title to: {}", title);
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_tooltip(Some(&title))
            .map_err(|e| {
                println!("[TRAY] Failed to update tray: {}", e);
                format!("Failed to update tray: {}", e)
            })?;
        println!("[TRAY] Successfully updated tray title");
    } else {
        println!("[TRAY] WARNING: Tray not found!");
    }
    Ok(())
}

#[tauri::command]
pub async fn open_system_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Open System Settings > Notifications
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.notifications")
            .spawn()
            .map_err(|e| format!("Failed to open system settings: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Open Windows Settings > Notifications
        Command::new("explorer")
            .arg("ms-settings:notifications")
            .spawn()
            .map_err(|e| format!("Failed to open system settings: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        // Try to open GNOME settings for notifications
        if let Ok(_) = Command::new("gnome-control-center")
            .arg("notifications")
            .spawn()
        {
            return Ok(());
        }

        // Fallback: try to open generic settings
        if let Ok(_) = Command::new("gnome-control-center").spawn() {
            return Ok(());
        }

        // If GNOME not available, try KDE
        if let Ok(_) = Command::new("systemsettings5")
            .arg("kcm_notifications")
            .spawn()
        {
            return Ok(());
        }

        // Last resort: try xdg-open with settings
        Command::new("xdg-open")
            .arg("settings://notifications")
            .spawn()
            .ok();
    }

    Ok(())
}
