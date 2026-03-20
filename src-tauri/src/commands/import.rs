use tauri::State;

use crate::{
    db::connection::open_database,
    importer::upsert::import_archive_payload,
    models::search::{ImportPayload, ImportResult},
    state::AppState,
};

#[tauri::command]
pub fn import_archive(
    payload: ImportPayload,
    state: State<'_, AppState>,
) -> Result<ImportResult, String> {
    let mut connection = open_database(state.db_path()).map_err(|err| err.to_string())?;
    import_archive_payload(&mut connection, payload).map_err(|err| err.to_string())
}
