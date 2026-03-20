use rusqlite::Connection;

use crate::{error::AppResult, models::search::ArchiveStats};

pub fn get_archive_stats(connection: &Connection) -> AppResult<ArchiveStats> {
    let mut statement = connection.prepare(
        r#"
        SELECT
          (SELECT COUNT(*) FROM conversations) AS conversation_count,
          (SELECT COUNT(*) FROM messages) AS message_count,
          (SELECT MAX(imported_at) FROM conversations) AS last_imported_at,
          (SELECT MIN(create_time) FROM messages WHERE create_time IS NOT NULL) AS oldest_message_time,
          (SELECT MAX(create_time) FROM messages WHERE create_time IS NOT NULL) AS newest_message_time
        "#,
    )?;

    statement.query_row([], |row| {
        Ok(ArchiveStats {
            conversation_count: row.get(0)?,
            message_count: row.get(1)?,
            last_imported_at: row.get(2)?,
            oldest_message_time: row.get(3)?,
            newest_message_time: row.get(4)?,
        })
    }).map_err(Into::into)
}
