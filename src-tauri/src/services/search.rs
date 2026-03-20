use rusqlite::{params, Connection};

use crate::{
    error::AppResult,
    models::search::{SearchResponse, SearchResultItem},
};

pub fn search_messages(
    connection: &Connection,
    query: &str,
    limit: u32,
    offset: u32,
    author_role: Option<&str>,
    year: Option<i32>,
) -> AppResult<SearchResponse> {
    let limit = limit.clamp(1, 1000);
    let author_role = normalize_author_role(author_role);
    let year_text = year.map(|value| value.to_string());
    let trimmed_query = query.trim();

    if trimmed_query.is_empty() {
        return browse_messages(connection, limit, offset, author_role, year_text.as_deref());
    }

    let (fts_items, fts_total) =
        search_fts(connection, trimmed_query, limit, offset, author_role, year_text.as_deref())?;

    if !fts_items.is_empty() {
        return Ok(SearchResponse {
            has_more: (offset as usize + fts_items.len()) < fts_total,
            items: fts_items,
            total: fts_total,
            limit,
            offset,
        });
    }

    search_like(
        connection,
        trimmed_query,
        limit,
        offset,
        author_role,
        year_text.as_deref(),
    )
}

fn search_fts(
    connection: &Connection,
    query: &str,
    limit: u32,
    offset: u32,
    author_role: Option<&str>,
    year_text: Option<&str>,
) -> AppResult<(Vec<SearchResultItem>, usize)> {
    let total: i64 = connection.query_row(
        r#"
        SELECT COUNT(*)
        FROM messages_fts
        JOIN messages m
          ON m.id = messages_fts.message_id
         AND m.conversation_id = messages_fts.conversation_id
        WHERE messages_fts MATCH ?1
          AND (?2 IS NULL OR m.author_role = ?2)
          AND (?3 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?3)
        "#,
        params![query, author_role, year_text],
        |row| row.get(0),
    )?;

    let mut statement = connection.prepare(
        r#"
        SELECT
          m.id,
          m.conversation_id,
          c.title,
          m.author_role,
          m.content_text,
          COALESCE(
            NULLIF(snippet(messages_fts, 3, '<mark>', '</mark>', ' ... ', 18), ''),
            substr(m.content_text, 1, 240)
          ) AS snippet,
          bm25(messages_fts) AS score,
          m.create_time
        FROM messages_fts
        JOIN messages m
          ON m.id = messages_fts.message_id
         AND m.conversation_id = messages_fts.conversation_id
        JOIN conversations c ON c.id = messages_fts.conversation_id
        WHERE messages_fts MATCH ?1
          AND (?4 IS NULL OR m.author_role = ?4)
          AND (?5 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?5)
        ORDER BY COALESCE(m.create_time, 0) DESC, score ASC
        LIMIT ?2 OFFSET ?3
        "#,
    )?;

    let rows = statement.query_map(params![query, limit, offset, author_role, year_text], |row| {
        Ok(SearchResultItem {
            message_id: row.get(0)?,
            conversation_id: row.get(1)?,
            conversation_title: row.get(2)?,
            author_role: row.get(3)?,
            content_text: row.get(4)?,
            snippet: row.get(5)?,
            score: row.get(6)?,
            create_time: row.get(7)?,
        })
    })?;

    Ok((rows.collect::<Result<Vec<_>, _>>()?, total.max(0) as usize))
}

fn search_like(
    connection: &Connection,
    query: &str,
    limit: u32,
    offset: u32,
    author_role: Option<&str>,
    year_text: Option<&str>,
) -> AppResult<SearchResponse> {
    let escaped = format!("%{}%", escape_like_value(query));

    let total: i64 = connection.query_row(
        r#"
        SELECT COUNT(*)
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE (
            m.content_text LIKE ?1 ESCAPE '\'
            OR c.title LIKE ?1 ESCAPE '\'
          )
          AND (?2 IS NULL OR m.author_role = ?2)
          AND (?3 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?3)
        "#,
        params![escaped, author_role, year_text],
        |row| row.get(0),
    )?;

    let mut statement = connection.prepare(
        r#"
        SELECT
          m.id,
          m.conversation_id,
          c.title,
          m.author_role,
          m.content_text,
          substr(m.content_text, 1, 240) AS snippet,
          0.0 AS score,
          m.create_time
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE (
            m.content_text LIKE ?1 ESCAPE '\'
            OR c.title LIKE ?1 ESCAPE '\'
          )
          AND (?4 IS NULL OR m.author_role = ?4)
          AND (?5 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?5)
        ORDER BY COALESCE(m.create_time, 0) DESC
        LIMIT ?2 OFFSET ?3
        "#,
    )?;

    let rows = statement.query_map(params![escaped, limit, offset, author_role, year_text], |row| {
        Ok(SearchResultItem {
            message_id: row.get(0)?,
            conversation_id: row.get(1)?,
            conversation_title: row.get(2)?,
            author_role: row.get(3)?,
            content_text: row.get(4)?,
            snippet: row.get(5)?,
            score: row.get(6)?,
            create_time: row.get(7)?,
        })
    })?;

    let items = rows.collect::<Result<Vec<_>, _>>()?;
    let total = total.max(0) as usize;

    Ok(SearchResponse {
        has_more: (offset as usize + items.len()) < total,
        items,
        total,
        limit,
        offset,
    })
}

fn browse_messages(
    connection: &Connection,
    limit: u32,
    offset: u32,
    author_role: Option<&str>,
    year_text: Option<&str>,
) -> AppResult<SearchResponse> {
    let total: i64 = connection.query_row(
        r#"
        SELECT COUNT(*)
        FROM messages m
        WHERE (?1 IS NULL OR m.author_role = ?1)
          AND (?2 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?2)
        "#,
        params![author_role, year_text],
        |row| row.get(0),
    )?;

    let mut statement = connection.prepare(
        r#"
        SELECT
          m.id,
          m.conversation_id,
          c.title,
          m.author_role,
          m.content_text,
          substr(m.content_text, 1, 240) AS snippet,
          0.0 AS score,
          m.create_time
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
        WHERE (?3 IS NULL OR m.author_role = ?3)
          AND (?4 IS NULL OR strftime('%Y', datetime(m.create_time, 'unixepoch')) = ?4)
        ORDER BY COALESCE(m.create_time, 0) DESC
        LIMIT ?1 OFFSET ?2
        "#,
    )?;

    let rows = statement.query_map(params![limit, offset, author_role, year_text], |row| {
        Ok(SearchResultItem {
            message_id: row.get(0)?,
            conversation_id: row.get(1)?,
            conversation_title: row.get(2)?,
            author_role: row.get(3)?,
            content_text: row.get(4)?,
            snippet: row.get(5)?,
            score: row.get(6)?,
            create_time: row.get(7)?,
        })
    })?;

    let items = rows.collect::<Result<Vec<_>, _>>()?;
    let total = total.max(0) as usize;

    Ok(SearchResponse {
        has_more: (offset as usize + items.len()) < total,
        items,
        total,
        limit,
        offset,
    })
}

fn escape_like_value(input: &str) -> String {
    input
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}

fn normalize_author_role(author_role: Option<&str>) -> Option<&str> {
    match author_role {
        Some("user") => Some("user"),
        Some("all") | None => None,
        _ => None,
    }
}
