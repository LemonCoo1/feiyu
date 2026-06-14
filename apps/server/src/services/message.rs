use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::Message;

#[derive(Debug, thiserror::Error)]
pub enum MessageError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn get_history(
    pool: &PgPool,
    conversation_id: Uuid,
    before: Option<Uuid>,
    since: Option<String>,
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let messages = if let Some(since_ts) = since {
        // 增量同步：返回 since 之后的所有新消息（升序）
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1 AND created_at > $2::timestamptz
            ORDER BY created_at ASC
            LIMIT $3
            "#,
        )
        .bind(conversation_id)
        .bind(&since_ts)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else if let Some(before_id) = before {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1 AND created_at < (SELECT created_at FROM messages WHERE id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(conversation_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    Ok(messages)
}

pub async fn search(
    pool: &PgPool,
    user_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let pattern = format!("%{}%", query);
    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT m.* FROM messages m
        JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
        WHERE cm.user_id = $1
          AND m.content::text ILIKE $2
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(messages)
}
