#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod download;
mod download_tracker;
mod library;
mod player;
mod scrape;
mod settings;
mod video_server;

use crate::settings::AppState;
use crate::commands::DownloadState;
use crate::download_tracker::DownloadTracker;
use crate::library::Library;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::{Manager, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

// Video server state
pub struct VideoServerState {
    pub server_url: Arc<RwLock<Option<String>>>,
}

fn main() {
    // Initialize download tracker and library
    let config_dir = dirs::config_dir()
        .expect("Failed to get config directory")
        .join("animepahe-dl");

    let download_tracker = DownloadTracker::new(config_dir.clone())
        .expect("Failed to initialize download tracker");

    let library_db_path = config_dir.join("library.db");
    let library = Library::new(library_db_path)
        .expect("Failed to initialize library");

    // Initialize video server state
    let video_server_state = VideoServerState {
        server_url: Arc::new(RwLock::new(None)),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::init())
        .manage(DownloadState::new())
        .manage(download_tracker)
        .manage(library)
        .manage(video_server_state)
        .setup(|app| {
            // Start video streaming server
            let server_state = app.state::<VideoServerState>();
            let server_url_clone = server_state.server_url.clone();
            let _app_handle = app.handle().clone();

            tauri::async_runtime::spawn(async move {
                // Find ffmpeg path
                let ffmpeg_path = which::which("ffmpeg")
                    .ok()
                    .and_then(|p| p.to_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| "ffmpeg".to_string());

                match video_server::start_video_server(ffmpeg_path).await {
                    Ok(url) => {
                        println!("Video streaming server started at: {}", url);
                        *server_url_clone.write().await = Some(url);
                    }
                    Err(e) => {
                        eprintln!("Failed to start video server: {}", e);
                    }
                }
            });

            // Setup system tray
            let show_item = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = TrayIconBuilder::with_id("main")
                .tooltip("Animepahe DL Desktop")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(app) = tray.app_handle().get_webview_window("main") {
                            let _ = app.show();
                            let _ = app.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::search_anime,
            commands::fetch_featured_anime,
            commands::fetch_latest_releases,
            commands::fetch_episodes,
            commands::preview_sources,
            commands::resolve_video_url,
            commands::start_download,
            commands::check_requirements,
            commands::open_path,
            commands::get_app_version,
            commands::cancel_download,
            commands::get_incomplete_downloads,
            commands::resume_download,
            commands::remove_download_record,
            commands::clear_completed_downloads,
            commands::validate_download_integrity,
            commands::check_episode_downloaded,
            commands::get_library_entry,
            commands::get_library_entries,
            commands::get_anime_library,
            commands::get_anime_episodes,
            commands::mark_episode_watched,
            commands::delete_library_entry,
            commands::delete_anime_from_library,
            commands::get_library_stats,
            commands::search_library,
            commands::export_library,
            commands::import_library,
            commands::export_library_to_file,
            commands::import_library_from_file,
            commands::migrate_library_posters,
            commands::fetch_image_as_base64,
            commands::play_notification_sound,
            commands::update_tray_title,
            commands::open_system_settings,
            commands::fetch_image_proxy,
            // Player commands
            commands::get_local_video_url,
            commands::get_video_stream_url,
            commands::get_compatible_video_path,
            commands::validate_video_file,
            commands::get_video_metadata
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
