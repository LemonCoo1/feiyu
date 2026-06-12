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
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let messages = if let Some(before_id) = before {
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
