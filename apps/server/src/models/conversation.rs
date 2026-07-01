use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub r#type: String,
    pub name: Option<String>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConversationMember {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct MemberWithUser {
    pub user_id: Uuid,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub status: String,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub r#type: String,
    pub name: Option<String>,
    pub member_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConversationWithMeta {
    pub id: Uuid,
    pub r#type: String,
    pub name: Option<String>,
    pub owner_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub last_message_content: Option<serde_json::Value>,
    pub last_message_content_type: Option<String>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub other_user_id: Option<Uuid>,
    pub other_username: Option<String>,
    pub other_display_name: Option<String>,
    pub unread_count: i64,
}
