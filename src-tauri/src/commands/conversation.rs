use tauri::State;

use crate::{db::connection::open_database, services, state::AppState};

#[tauri::command]
pub fn get_conversation(
    conversation_id: String,
    state: State<'_, AppState>,
) -> Result<crate::models::conversation::ConversationDetail, String> {
    let connection = open_database(state.db_path()).map_err(|err| err.to_string())?;
    services::conversation::get_conversation_detail(&connection, &conversation_id)
        .map_err(|err| err.to_string())
}
