use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Announcement {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub author_id: Uuid,
    pub content: String,
    pub pinned: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAnnouncementRequest {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAnnouncementRequest {
    pub content: Option<String>,
    pub pinned: Option<bool>,
}
