use serde::{Deserialize, Serialize};

use super::{
    conversation::{NormalizedConversationPathRecord, NormalizedConversationRecord},
    message::NormalizedMessageRecord,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPayload {
    pub conversations: Vec<NormalizedConversationRecord>,
    pub messages: Vec<NormalizedMessageRecord>,
    pub paths: Vec<NormalizedConversationPathRecord>,
    #[serde(default)]
    pub skipped_nodes: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub conversations_imported: usize,
    pub messages_imported: usize,
    pub skipped_nodes: usize,
    pub duplicate_conversations: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultItem {
    pub message_id: String,
    pub conversation_id: String,
    pub conversation_title: String,
    pub author_role: String,
    pub content_text: String,
    pub snippet: String,
    pub score: f64,
    pub create_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchiveStats {
    pub conversation_count: i64,
    pub message_count: i64,
    pub last_imported_at: Option<String>,
    pub oldest_message_time: Option<f64>,
    pub newest_message_time: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub items: Vec<SearchResultItem>,
    pub total: usize,
    pub has_more: bool,
    pub limit: u32,
    pub offset: u32,
}
