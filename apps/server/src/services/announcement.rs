use sqlx::PgPool;
use uuid::Uuid;
use crate::models::announcement::{Announcement, CreateAnnouncementRequest, UpdateAnnouncementRequest};

#[derive(Debug, thiserror::Error)]
pub enum AnnouncementError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Permission denied")]
    PermissionDenied,
}

pub async fn create(
    pool: &PgPool,
    conversation_id: Uuid,
    author_id: Uuid,
    req: CreateAnnouncementRequest,
) -> Result<Announcement, AnnouncementError> {
    // 验证是否是群主或管理员
    let member = sqlx::query_scalar::<_, String>(
        "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
    )
    .bind(conversation_id)
    .bind(author_id)
    .fetch_optional(pool)
    .await?;

    match member.as_deref() {
        Some("owner") | Some("admin") => {}
        _ => return Err(AnnouncementError::PermissionDenied),
    }

    let ann = sqlx::query_as::<_, Announcement>(
        r#"
        INSERT INTO group_announcements (id, conversation_id, author_id, content)
        VALUES (gen_random_uuid(), $1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(conversation_id)
    .bind(author_id)
    .bind(&req.content)
    .fetch_one(pool)
    .await?;

    Ok(ann)
}

pub async fn list(pool: &PgPool, conversation_id: Uuid) -> Result<Vec<Announcement>, AnnouncementError> {
    let anns = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM group_announcements WHERE conversation_id = $1 ORDER BY pinned DESC, created_at DESC"
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await?;
    Ok(anns)
}

pub async fn update(
    pool: &PgPool,
    announcement_id: Uuid,
    user_id: Uuid,
    req: UpdateAnnouncementRequest,
) -> Result<Announcement, AnnouncementError> {
    // 验证权限
    let ann = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM group_announcements WHERE id = $1"
    )
    .bind(announcement_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AnnouncementError::Database(sqlx::Error::RowNotFound))?;

    let member = sqlx::query_scalar::<_, String>(
        "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
    )
    .bind(ann.conversation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match member.as_deref() {
        Some("owner") | Some("admin") => {}
        _ => return Err(AnnouncementError::PermissionDenied),
    }

    let updated = sqlx::query_as::<_, Announcement>(
        r#"
        UPDATE group_announcements
        SET content = COALESCE($2, content),
            pinned = COALESCE($3, pinned),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(announcement_id)
    .bind(req.content)
    .bind(req.pinned)
    .fetch_one(pool)
    .await?;

    Ok(updated)
}

pub async fn delete(pool: &PgPool, announcement_id: Uuid, user_id: Uuid) -> Result<(), AnnouncementError> {
    let ann = sqlx::query_as::<_, Announcement>(
        "SELECT * FROM group_announcements WHERE id = $1"
    )
    .bind(announcement_id)
    .fetch_optional(pool)
    .await?
    .ok_or(AnnouncementError::Database(sqlx::Error::RowNotFound))?;

    let member = sqlx::query_scalar::<_, String>(
        "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2"
    )
    .bind(ann.conversation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    match member.as_deref() {
        Some("owner") | Some("admin") => {}
        _ => return Err(AnnouncementError::PermissionDenied),
    }

    sqlx::query("DELETE FROM group_announcements WHERE id = $1")
        .bind(announcement_id)
        .execute(pool)
        .await?;

    Ok(())
}
