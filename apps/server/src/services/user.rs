use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;
use crate::models::user_settings::{UserSettings, UpdateUserSettings};

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found")]
    NotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Invalid password")]
    InvalidPassword,
    #[error("Hash error: {0}")]
    HashError(String),
}

pub async fn get_by_id(pool: &PgPool, user_id: Uuid) -> Result<User, UserError> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(UserError::NotFound)
}

pub async fn search(pool: &PgPool, query: &str, current_user_id: Uuid) -> Result<Vec<User>, UserError> {
    let pattern = format!("%{}%", query);
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT * FROM users
        WHERE (username ILIKE $1 OR display_name ILIKE $1 OR email ILIKE $1)
          AND id != $2
        LIMIT 20
        "#,
    )
    .bind(&pattern)
    .bind(current_user_id)
    .fetch_all(pool)
    .await?;

    Ok(users)
}

pub async fn update_profile(
    pool: &PgPool,
    user_id: Uuid,
    display_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<User, UserError> {
    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(display_name)
    .bind(avatar_url)
    .fetch_optional(pool)
    .await?
    .ok_or(UserError::NotFound)?;

    Ok(user)
}

pub async fn update_status(pool: &PgPool, user_id: Uuid, status: &str) -> Result<(), UserError> {
    sqlx::query("UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1")
        .bind(user_id)
        .bind(status)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_settings(pool: &PgPool, user_id: Uuid) -> Result<UserSettings, UserError> {
    let settings = sqlx::query_as::<_, UserSettings>(
        "SELECT * FROM user_settings WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match settings {
        Some(s) => Ok(s),
        None => {
            // 不存在则创建默认设置
            let s = sqlx::query_as::<_, UserSettings>(
                "INSERT INTO user_settings (user_id) VALUES ($1) RETURNING *",
            )
            .bind(user_id)
            .fetch_one(pool)
            .await?;
            Ok(s)
        }
    }
}

pub async fn update_settings(
    pool: &PgPool,
    user_id: Uuid,
    req: UpdateUserSettings,
) -> Result<UserSettings, UserError> {
    // 确保记录存在
    get_settings(pool, user_id).await?;

    let settings = sqlx::query_as::<_, UserSettings>(
        r#"
        UPDATE user_settings SET
            notify_message = COALESCE($2, notify_message),
            notify_sound = COALESCE($3, notify_sound),
            notify_desktop = COALESCE($4, notify_desktop),
            notify_dnd = COALESCE($5, notify_dnd),
            notify_dnd_start = COALESCE($6::time, notify_dnd_start),
            notify_dnd_end = COALESCE($7::time, notify_dnd_end),
            privacy_add_me = COALESCE($8, privacy_add_me),
            privacy_online_visible = COALESCE($9, privacy_online_visible),
            privacy_read_receipt = COALESCE($10, privacy_read_receipt),
            chat_send_key = COALESCE($11, chat_send_key),
            chat_font_size = COALESCE($12, chat_font_size),
            theme = COALESCE($13, theme),
            language = COALESCE($14, language),
            two_factor_enabled = COALESCE($15, two_factor_enabled),
            updated_at = NOW()
        WHERE user_id = $1
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(req.notify_message)
    .bind(req.notify_sound)
    .bind(req.notify_desktop)
    .bind(req.notify_dnd)
    .bind(req.notify_dnd_start)
    .bind(req.notify_dnd_end)
    .bind(req.privacy_add_me)
    .bind(req.privacy_online_visible)
    .bind(req.privacy_read_receipt)
    .bind(req.chat_send_key)
    .bind(req.chat_font_size)
    .bind(req.theme)
    .bind(req.language)
    .bind(req.two_factor_enabled)
    .fetch_one(pool)
    .await?;

    Ok(settings)
}

pub async fn change_password(
    pool: &PgPool,
    user_id: Uuid,
    old_password: &str,
    new_password: &str,
) -> Result<(), UserError> {
    let user = get_by_id(pool, user_id).await?;

    let valid = bcrypt::verify(old_password, &user.password_hash).unwrap_or(false);
    if !valid {
        return Err(UserError::InvalidPassword);
    }

    let new_hash = bcrypt::hash(new_password, bcrypt::DEFAULT_COST)
        .map_err(|e| UserError::HashError(e.to_string()))?;

    sqlx::query("UPDATE users SET password_hash = $2, updated_at = NOW() WHERE id = $1")
        .bind(user_id)
        .bind(new_hash)
        .execute(pool)
        .await?;

    Ok(())
}
