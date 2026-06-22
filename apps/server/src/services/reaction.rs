use sqlx::PgPool;
use uuid::Uuid;

use crate::models::reaction::{Reaction, ReactionGroup};

#[derive(Debug, thiserror::Error)]
pub enum ReactionError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Already reacted with this emoji")]
    AlreadyExists,
}

pub async fn add(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<Reaction, ReactionError> {
    let reaction = sqlx::query_as::<_, Reaction>(
        r#"
        INSERT INTO message_reactions (id, message_id, user_id, emoji)
        VALUES (gen_random_uuid(), $1, $2, $3)
        ON CONFLICT (message_id, user_id, emoji) DO NOTHING
        RETURNING *
        "#,
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .fetch_optional(pool)
    .await?
    .ok_or(ReactionError::AlreadyExists)?;
    Ok(reaction)
}

pub async fn remove(
    pool: &PgPool,
    message_id: Uuid,
    user_id: Uuid,
    emoji: &str,
) -> Result<(), ReactionError> {
    sqlx::query(
        "DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3",
    )
    .bind(message_id)
    .bind(user_id)
    .bind(emoji)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_by_message(
    pool: &PgPool,
    message_id: Uuid,
) -> Result<Vec<ReactionGroup>, ReactionError> {
    let reactions = sqlx::query_as::<_, Reaction>(
        "SELECT * FROM message_reactions WHERE message_id = $1 ORDER BY created_at",
    )
    .bind(message_id)
    .fetch_all(pool)
    .await?;

    let mut groups: std::collections::HashMap<String, ReactionGroup> =
        std::collections::HashMap::new();
    for r in reactions {
        let entry = groups.entry(r.emoji.clone()).or_insert_with(|| ReactionGroup {
            emoji: r.emoji.clone(),
            count: 0,
            user_ids: Vec::new(),
        });
        entry.count += 1;
        entry.user_ids.push(r.user_id);
    }
    Ok(groups.into_values().collect())
}
