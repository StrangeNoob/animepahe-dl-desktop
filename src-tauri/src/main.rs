#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod download;
mod download_tracker;
mod library;
mod scrape;
mod settings;

use crate::settings::AppState;
use crate::commands::DownloadState;
use crate::download_tracker::DownloadTracker;
use crate::library::Library;

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

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::init())
        .manage(DownloadState::new())
        .manage(download_tracker)
        .manage(library)
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
            commands::import_library
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
