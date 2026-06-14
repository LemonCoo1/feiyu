use chrono::NaiveTime;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserSettings {
    pub user_id: Uuid,
    pub notify_message: bool,
    pub notify_sound: bool,
    pub notify_desktop: bool,
    pub notify_dnd: bool,
    pub notify_dnd_start: Option<NaiveTime>,
    pub notify_dnd_end: Option<NaiveTime>,
    pub privacy_add_me: String,
    pub privacy_online_visible: bool,
    pub privacy_read_receipt: bool,
    pub chat_send_key: String,
    pub chat_font_size: String,
    pub theme: String,
    pub language: String,
    pub two_factor_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserSettings {
    pub notify_message: Option<bool>,
    pub notify_sound: Option<bool>,
    pub notify_desktop: Option<bool>,
    pub notify_dnd: Option<bool>,
    pub notify_dnd_start: Option<String>,
    pub notify_dnd_end: Option<String>,
    pub privacy_add_me: Option<String>,
    pub privacy_online_visible: Option<bool>,
    pub privacy_read_receipt: Option<bool>,
    pub chat_send_key: Option<String>,
    pub chat_font_size: Option<String>,
    pub theme: Option<String>,
    pub language: Option<String>,
    pub two_factor_enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub old_password: String,
    pub new_password: String,
}
