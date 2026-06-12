use sqlx::PgPool;
use uuid::Uuid;

use crate::models::channel::{Channel, ChannelMember, ChannelMessage, ChannelWithMeta};

#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("Channel not found")]
    NotFound,
    #[error("Already a member")]
    AlreadyMember,
    #[error("Not a member")]
    NotMember,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn create(
    pool: &PgPool,
    creator_id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Channel, ChannelError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (id, name, description, created_by)
        VALUES (gen_random_uuid(), $1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(creator_id)
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'owner')",
    )
    .bind(channel.id)
    .bind(creator_id)
    .execute(pool)
    .await?;

    Ok(channel)
}

pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<ChannelWithMeta>, ChannelError> {
    let channels = sqlx::query_as::<_, ChannelWithMeta>(
        r#"
        SELECT c.*,
            (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
        FROM channels c
        JOIN channel_members cm ON c.id = cm.channel_id
        WHERE cm.user_id = $1
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(channels)
}

pub async fn join(
    pool: &PgPool,
    channel_id: Uuid,
    user_id: Uuid,
) -> Result<(), ChannelError> {
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)",
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if existing {
        return Err(ChannelError::AlreadyMember);
    }

    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'member')",
    )
    .bind(channel_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_member_ids(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<Vec<Uuid>, ChannelError> {
    let ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(pool)
    .await?;

    Ok(ids)
}

pub async fn get_messages(
    pool: &PgPool,
    channel_id: Uuid,
    before: Option<Uuid>,
    limit: i64,
) -> Result<Vec<ChannelMessage>, ChannelError> {
    let messages = if let Some(before_id) = before {
        sqlx::query_as::<_, ChannelMessage>(
            r#"
            SELECT * FROM channel_messages
            WHERE channel_id = $1 AND created_at < (SELECT created_at FROM channel_messages WHERE id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(channel_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, ChannelMessage>(
            r#"
            SELECT * FROM channel_messages
            WHERE channel_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(channel_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    Ok(messages)
}

pub async fn send_message(
    pool: &PgPool,
    channel_id: Uuid,
    sender_id: Uuid,
    content_type: &str,
    content: serde_json::Value,
    parent_message_id: Option<Uuid>,
) -> Result<ChannelMessage, ChannelError> {
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)",
    )
    .bind(channel_id)
    .bind(sender_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(ChannelError::NotMember);
    }

    let msg = sqlx::query_as::<_, ChannelMessage>(
        r#"
        INSERT INTO channel_messages (id, channel_id, sender_id, content_type, content, parent_message_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(channel_id)
    .bind(sender_id)
    .bind(content_type)
    .bind(content)
    .bind(parent_message_id)
    .fetch_one(pool)
    .await?;

    Ok(msg)
}
