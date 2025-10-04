#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod download;
mod download_tracker;
mod scrape;
mod settings;

use crate::settings::AppState;
use crate::commands::DownloadState;
use crate::download_tracker::DownloadTracker;

fn main() {
    // Initialize download tracker
    let config_dir = dirs::config_dir()
        .expect("Failed to get config directory")
        .join("animepahe-dl");

    let download_tracker = DownloadTracker::new(config_dir)
        .expect("Failed to initialize download tracker");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::init())
        .manage(DownloadState::new())
        .manage(download_tracker)
        .invoke_handler(tauri::generate_handler![
            commands::load_settings,
            commands::save_settings,
            commands::search_anime,
            commands::fetch_episodes,
            commands::preview_sources,
            commands::start_download,
            commands::check_requirements,
            commands::open_path,
            commands::get_app_version,
            commands::cancel_download,
            commands::get_incomplete_downloads,
            commands::resume_download,
            commands::remove_download_record,
            commands::clear_completed_downloads,
            commands::validate_download_integrity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
