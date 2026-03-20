use rusqlite::Connection;

use crate::error::AppResult;

pub fn run_migrations(connection: &Connection) -> AppResult<()> {
    connection.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          create_time REAL NULL,
          update_time REAL NULL,
          imported_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT NOT NULL,
          conversation_id TEXT NOT NULL,
          parent_id TEXT NULL,
          author_role TEXT NOT NULL,
          content_text TEXT NOT NULL,
          create_time REAL NULL,
          update_time REAL NULL,
          status TEXT NULL,
          metadata_json TEXT NULL,
          PRIMARY KEY(conversation_id, id),
          FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS conversation_paths (
          conversation_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          depth INTEGER NOT NULL,
          is_terminal INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(conversation_id, message_id),
          FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
        );

        DROP TABLE IF EXISTS messages_fts;

        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          message_id UNINDEXED,
          conversation_id UNINDEXED,
          title,
          content_text,
          author_role,
          tokenize = 'trigram'
        );

        INSERT INTO messages_fts (
          message_id,
          conversation_id,
          title,
          content_text,
          author_role
        )
        SELECT
          m.id,
          m.conversation_id,
          c.title,
          m.content_text,
          m.author_role
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id;

        CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
        ON messages(conversation_id);

        CREATE INDEX IF NOT EXISTS idx_messages_parent_id
        ON messages(parent_id);

        CREATE INDEX IF NOT EXISTS idx_paths_conversation_depth
        ON conversation_paths(conversation_id, depth);
        "#,
    )?;

    Ok(())
}
