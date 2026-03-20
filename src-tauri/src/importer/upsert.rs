use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::{
    error::AppResult,
    models::{
        conversation::{NormalizedConversationPathRecord, NormalizedConversationRecord},
        message::NormalizedMessageRecord,
        search::{ImportPayload, ImportResult},
    },
};

pub fn import_archive_payload(
    connection: &mut Connection,
    payload: ImportPayload,
) -> AppResult<ImportResult> {
    let tx = connection.transaction()?;

    let mut messages_by_conversation: HashMap<&str, Vec<&NormalizedMessageRecord>> = HashMap::new();
    for message in &payload.messages {
        messages_by_conversation
            .entry(message.conversation_id.as_str())
            .or_default()
            .push(message);
    }

    let mut paths_by_conversation: HashMap<&str, Vec<&NormalizedConversationPathRecord>> =
        HashMap::new();
    for path in &payload.paths {
        paths_by_conversation
            .entry(path.conversation_id.as_str())
            .or_default()
            .push(path);
    }

    let existing_conversation_ids = load_existing_conversation_ids(&tx)?;
    let mut conversations_imported = 0usize;
    let mut messages_imported = 0usize;
    let mut duplicate_conversations = 0usize;

    for conversation in &payload.conversations {
        if existing_conversation_ids.contains(conversation.id.as_str()) {
            duplicate_conversations += 1;
            continue;
        }

        let conversation_messages = messages_by_conversation
            .get(conversation.id.as_str())
            .cloned()
            .unwrap_or_default();
        let conversation_paths = paths_by_conversation
            .get(conversation.id.as_str())
            .cloned()
            .unwrap_or_default();

        replace_conversation(
            &tx,
            conversation,
            conversation_messages.clone(),
            conversation_paths,
        )?;
        conversations_imported += 1;
        messages_imported += conversation_messages.len();
    }

    tx.commit()?;

    Ok(ImportResult {
        conversations_imported,
        messages_imported,
        skipped_nodes: payload.skipped_nodes,
        duplicate_conversations,
    })
}

fn load_existing_conversation_ids(connection: &Connection) -> AppResult<std::collections::HashSet<String>> {
    let mut statement = connection.prepare("SELECT id FROM conversations")?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    Ok(rows.collect::<Result<std::collections::HashSet<_>, _>>()?)
}

fn replace_conversation(
    connection: &Connection,
    conversation: &NormalizedConversationRecord,
    mut messages: Vec<&NormalizedMessageRecord>,
    paths: Vec<&NormalizedConversationPathRecord>,
) -> AppResult<()> {
    connection.execute(
        r#"
        INSERT INTO conversations (id, title, create_time, update_time, imported_at)
        VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
        "#,
        params![
            conversation.id,
            conversation.title,
            conversation.create_time,
            conversation.update_time
        ],
    )?;

    let path_depths: HashMap<&str, i64> = paths
        .iter()
        .map(|path| (path.message_id.as_str(), path.depth))
        .collect();
    let message_ids: std::collections::HashSet<&str> =
        messages.iter().map(|message| message.id.as_str()).collect();

    messages.sort_by(|left, right| {
        let left_depth = path_depths.get(left.id.as_str()).copied().unwrap_or(0);
        let right_depth = path_depths.get(right.id.as_str()).copied().unwrap_or(0);

        left_depth
            .cmp(&right_depth)
            .then_with(|| {
                left.create_time
                    .partial_cmp(&right.create_time)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .then_with(|| left.id.cmp(&right.id))
    });

    for message in messages {
        let parent_id = message
            .parent_id
            .as_deref()
            .filter(|parent_id| message_ids.contains(parent_id));

        connection.execute(
            r#"
            INSERT INTO messages (
              id,
              conversation_id,
              parent_id,
              author_role,
              content_text,
              create_time,
              update_time,
              status,
              metadata_json
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
            "#,
            params![
                message.id,
                message.conversation_id,
                parent_id,
                message.author_role,
                message.content_text,
                message.create_time,
                message.update_time,
                message.status,
                message.metadata_json
            ],
        )?;

        connection.execute(
            r#"
            INSERT INTO messages_fts (
              message_id,
              conversation_id,
              title,
              content_text,
              author_role
            ) VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
            params![
                message.id,
                message.conversation_id,
                conversation.title,
                message.content_text,
                message.author_role
            ],
        )?;
    }

    for path in paths {
        connection.execute(
            r#"
            INSERT INTO conversation_paths (
              conversation_id,
              message_id,
              depth,
              is_terminal
            ) VALUES (?1, ?2, ?3, ?4)
            "#,
            params![
                path.conversation_id,
                path.message_id,
                path.depth,
                i64::from(path.is_terminal)
            ],
        )?;
    }

    Ok(())
}
