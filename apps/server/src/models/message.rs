use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Option<Uuid>,
    pub content_type: String,
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub recalled: bool,
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}
