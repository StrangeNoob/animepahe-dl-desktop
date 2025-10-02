#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod api;
mod commands;
mod download;
mod scrape;
mod settings;

use crate::settings::AppState;
use crate::commands::DownloadState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::init())
        .manage(DownloadState::new())
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
            commands::cancel_download
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
