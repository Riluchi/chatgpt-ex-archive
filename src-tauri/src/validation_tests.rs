use std::{fs, path::PathBuf};

use rusqlite::Connection;

use crate::{
    db::migrations::run_migrations,
    importer::upsert::import_archive_payload,
    models::search::ImportPayload,
    services::{
        conversation::get_conversation_detail, search::search_messages, stats::get_archive_stats,
    },
};

fn payload_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join(".tmp-verify")
        .join("payload.json")
}

fn first_query_term(payload: &ImportPayload) -> String {
    payload
        .messages
        .iter()
        .map(|message| message.content_text.trim())
        .find(|text| text.chars().count() >= 3)
        .map(|text| text.chars().take(3).collect::<String>())
        .unwrap_or("ChatGPT".to_string())
}

fn load_payload() -> ImportPayload {
    let payload_text =
        fs::read_to_string(payload_path()).expect("expected generated payload.json for validation");
    serde_json::from_str(&payload_text).expect("payload.json must be valid ImportPayload")
}

fn payload_subset(payload: &ImportPayload, take: usize, skip: usize) -> ImportPayload {
    let conversations: Vec<_> = payload
        .conversations
        .iter()
        .skip(skip)
        .take(take)
        .cloned()
        .collect();
    let conversation_ids: std::collections::HashSet<_> =
        conversations.iter().map(|conversation| conversation.id.clone()).collect();
    let messages: Vec<_> = payload
        .messages
        .iter()
        .filter(|message| conversation_ids.contains(&message.conversation_id))
        .cloned()
        .collect();
    let paths: Vec<_> = payload
        .paths
        .iter()
        .filter(|path| conversation_ids.contains(&path.conversation_id))
        .cloned()
        .collect();

    ImportPayload {
        conversations,
        messages,
        paths,
        skipped_nodes: payload.skipped_nodes,
    }
}

#[test]
fn imports_and_searches_real_export_payload() {
    let payload = load_payload();

    let expected_conversations = payload.conversations.len();
    let expected_messages = payload.messages.len();
    let query_term = first_query_term(&payload);
    let first_conversation_id = payload
        .conversations
        .first()
        .expect("real payload should contain conversations")
        .id
        .clone();

    let mut connection = Connection::open_in_memory().expect("in-memory db should open");
    run_migrations(&connection).expect("migrations should run");

    let import_result =
        import_archive_payload(&mut connection, payload).expect("import should succeed");

    assert_eq!(import_result.conversations_imported, expected_conversations);
    assert_eq!(import_result.messages_imported, expected_messages);

    let results =
        search_messages(&connection, &query_term, 10, 0, Some("user"), None)
            .expect("search should succeed");
    assert!(
        !results.items.is_empty(),
        "expected at least one search result for query term: {query_term}"
    );

    let detail =
        get_conversation_detail(&connection, &first_conversation_id).expect("detail should load");
    assert_eq!(detail.conversation.id, first_conversation_id);
    assert!(!detail.messages.is_empty(), "conversation should contain messages");
}

#[test]
fn appends_multiple_imports_and_skips_duplicates() {
    let payload = load_payload();
    let first = payload_subset(&payload, 100, 0);
    let second = payload_subset(&payload, 100, 100);
    let first_query = first_query_term(&first);

    let mut connection = Connection::open_in_memory().expect("in-memory db should open");
    run_migrations(&connection).expect("migrations should run");

    let first_result =
        import_archive_payload(&mut connection, first.clone()).expect("first import should work");
    assert_eq!(first_result.conversations_imported, first.conversations.len());
    assert_eq!(first_result.duplicate_conversations, 0);

    let second_result =
        import_archive_payload(&mut connection, second.clone()).expect("second import should work");
    assert_eq!(second_result.conversations_imported, second.conversations.len());
    assert_eq!(second_result.duplicate_conversations, 0);

    let stats = get_archive_stats(&connection).expect("stats should load");
    assert_eq!(
        stats.conversation_count as usize,
        first.conversations.len() + second.conversations.len()
    );

    let first_search =
        search_messages(&connection, &first_query, 20, 0, Some("user"), None)
            .expect("search across appended data");
    assert!(
        !first_search.items.is_empty(),
        "expected first import data to remain searchable after second import"
    );

    let duplicate_result =
        import_archive_payload(&mut connection, first).expect("duplicate import should work");
    assert_eq!(duplicate_result.conversations_imported, 0);
    assert_eq!(duplicate_result.duplicate_conversations, 100);

    let stats_after_duplicate = get_archive_stats(&connection).expect("stats should load");
    assert_eq!(stats_after_duplicate.conversation_count, stats.conversation_count);
}
