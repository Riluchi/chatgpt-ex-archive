use tauri::State;

use crate::{db::connection::open_database, services, state::AppState};

#[tauri::command]
pub fn get_archive_stats(
    state: State<'_, AppState>,
) -> Result<crate::models::search::ArchiveStats, String> {
    let connection = open_database(state.db_path()).map_err(|err| err.to_string())?;
    services::stats::get_archive_stats(&connection).map_err(|err| err.to_string())
}
