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
use tauri::{Manager, menu::{Menu, MenuItem}, tray::{TrayIconBuilder, TrayIconEvent}};

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
        .plugin(tauri_plugin_notification::init())
        .manage(AppState::init())
        .manage(DownloadState::new())
        .manage(download_tracker)
        .manage(library)
        .setup(|app| {
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
            commands::import_library,
            commands::play_notification_sound,
            commands::update_tray_title,
            commands::open_system_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
