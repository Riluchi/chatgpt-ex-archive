use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NormalizedMessageRecord {
    pub id: String,
    pub conversation_id: String,
    pub parent_id: Option<String>,
    pub author_role: String,
    pub content_text: String,
    pub create_time: Option<f64>,
    pub update_time: Option<f64>,
    pub status: Option<String>,
    pub metadata_json: Option<String>,
}
