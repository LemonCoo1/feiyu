use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found")]
    NotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
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
