use rusqlite::{params, Connection, OptionalExtension};

use crate::{
    error::{AppError, AppResult},
    models::conversation::{ConversationDetail, ConversationMessage, ConversationSummary},
};

pub fn get_conversation_detail(
    connection: &Connection,
    conversation_id: &str,
) -> AppResult<ConversationDetail> {
    let conversation = connection
        .query_row(
            r#"
        SELECT
          c.id,
          c.title,
          c.create_time,
          c.update_time,
          COUNT(m.id) AS message_count
        FROM conversations c
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.id = ?1
        GROUP BY c.id, c.title, c.create_time, c.update_time
        "#,
            params![conversation_id],
            |row| {
                Ok(ConversationSummary {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    create_time: row.get(2)?,
                    update_time: row.get(3)?,
                    message_count: row.get(4)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::State(format!("conversation {conversation_id} not found")))?;

    let mut statement = connection.prepare(
        r#"
        SELECT
          m.id,
          m.conversation_id,
          m.parent_id,
          m.author_role,
          m.content_text,
          m.create_time,
          m.update_time,
          COALESCE(cp.depth, 0) AS depth
        FROM messages m
        LEFT JOIN conversation_paths cp
          ON cp.conversation_id = m.conversation_id
         AND cp.message_id = m.id
        WHERE m.conversation_id = ?1
        ORDER BY
          COALESCE(cp.depth, 0) ASC,
          COALESCE(m.create_time, 0) ASC,
          m.id ASC
        "#,
    )?;

    let messages = statement
        .query_map(params![conversation_id], |row| {
            Ok(ConversationMessage {
                id: row.get(0)?,
                conversation_id: row.get(1)?,
                parent_id: row.get(2)?,
                author_role: row.get(3)?,
                content_text: row.get(4)?,
                create_time: row.get(5)?,
                update_time: row.get(6)?,
                depth: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ConversationDetail {
        conversation,
        messages,
    })
}
