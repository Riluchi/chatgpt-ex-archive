use tauri::State;

use crate::{db::connection::open_database, services, state::AppState};

#[tauri::command]
pub fn search_messages(
    query: String,
    limit: Option<u32>,
    offset: Option<u32>,
    author_role: Option<String>,
    year: Option<i32>,
    state: State<'_, AppState>,
) -> Result<crate::models::search::SearchResponse, String> {
    let connection = open_database(state.db_path()).map_err(|err| err.to_string())?;
    services::search::search_messages(
        &connection,
        &query,
        limit.unwrap_or(500),
        offset.unwrap_or(0),
        author_role.as_deref(),
        year,
    )
        .map_err(|err| err.to_string())
}
