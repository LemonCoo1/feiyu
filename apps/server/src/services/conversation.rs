use sqlx::PgPool;
use uuid::Uuid;

use crate::models::conversation::{Conversation, ConversationWithMeta};

#[derive(Debug, thiserror::Error)]
pub enum ConversationError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn create_direct(
    pool: &PgPool,
    user1_id: Uuid,
    user2_id: Uuid,
) -> Result<Conversation, ConversationError> {
    let existing = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.* FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id
        WHERE c.type = 'direct'
          AND cm1.user_id = $1 AND cm2.user_id = $2
        LIMIT 1
        "#,
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_optional(pool)
    .await?;

    if let Some(conv) = existing {
        return Ok(conv);
    }

    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (id, type)
        VALUES (gen_random_uuid(), 'direct')
        RETURNING *
        "#,
    )
    .fetch_one(pool)
    .await?;

    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
    )
    .bind(conv.id)
    .bind(user1_id)
    .bind(user2_id)
    .execute(pool)
    .await?;

    Ok(conv)
}

pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<ConversationWithMeta>, ConversationError> {
    let conversations = sqlx::query_as::<_, ConversationWithMeta>(
        r#"
        SELECT
            c.id,
            c.type,
            c.name,
            c.created_at,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
            (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1) as other_user_id,
            (SELECT username FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_username,
            (SELECT display_name FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_display_name
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE cm.user_id = $1
        ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(conversations)
}

pub async fn get_members(
    pool: &PgPool,
    conversation_id: Uuid,
) -> Result<Vec<Uuid>, ConversationError> {
    let members = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await?;

    Ok(members)
}
