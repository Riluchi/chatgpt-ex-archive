mod commands;
mod db;
mod error;
mod importer;
mod models;
mod services;
mod state;
#[cfg(test)]
mod validation_tests;

use std::path::PathBuf;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let mut db_path: PathBuf = app.path().app_data_dir()?;
            db_path.push("archive.sqlite3");

            let state = AppState::new(db_path);
            state
                .initialize()
                .map_err(Box::<dyn std::error::Error>::from)?;
            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::import::import_archive,
            commands::search::search_messages,
            commands::conversation::get_conversation,
            commands::stats::get_archive_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
