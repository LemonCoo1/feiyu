use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;

#[derive(Debug, thiserror::Error)]
pub enum ContactError {
    #[error("Contact already exists")]
    AlreadyExists,
    #[error("Cannot add yourself")]
    CannotAddSelf,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn add_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_id: Uuid,
) -> Result<(), ContactError> {
    if user_id == contact_id {
        return Err(ContactError::CannotAddSelf);
    }

    sqlx::query(
        r#"
        INSERT INTO contacts (user_id, contact_id, status)
        VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_contacts(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<User>, ContactError> {
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT u.* FROM users u
        JOIN contacts c ON u.id = c.contact_id
        WHERE c.user_id = $1 AND c.status = 'accepted'
        ORDER BY u.display_name, u.username
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(users)
}

pub async fn remove_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_id: Uuid,
) -> Result<(), ContactError> {
    sqlx::query(
        "DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)",
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_contact_ids(pool: &PgPool, user_id: Uuid) -> Result<Vec<Uuid>, ContactError> {
    let ids = sqlx::query_scalar::<_, Uuid>(
        "SELECT contact_id FROM contacts WHERE user_id = $1 AND status = 'accepted'",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(ids)
}
