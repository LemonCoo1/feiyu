use sqlx::PgPool;
use uuid::Uuid;

use crate::models::conversation::{Conversation, ConversationWithMeta, MemberWithUser};

#[derive(Debug, thiserror::Error)]
pub enum ConversationError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Permission denied")]
    PermissionDenied,
    #[error("Cannot remove yourself as owner. Transfer ownership first.")]
    OwnerCannotLeave,
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
            c.owner_id,
            c.created_at,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
            (SELECT content_type FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content_type,
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
            (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1) as other_user_id,
            (SELECT username FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_username,
            (SELECT display_name FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_display_name,
            (SELECT COUNT(*) FROM messages m
             WHERE m.conversation_id = c.id
               AND m.sender_id != $1
               AND NOT EXISTS (
                 SELECT 1 FROM read_receipts rr
                 WHERE rr.user_id = $1
                   AND rr.conversation_id = c.id
                   AND rr.last_read_message_id IS NOT NULL
                   AND m.created_at <= (SELECT m2.created_at FROM messages m2 WHERE m2.id = rr.last_read_message_id)
               )
            ) as unread_count
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

pub async fn create_group(
    pool: &PgPool,
    creator_id: Uuid,
    name: &str,
    member_ids: &[Uuid],
) -> Result<Conversation, ConversationError> {
    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (id, type, name, owner_id)
        VALUES (gen_random_uuid(), 'group', $1, $2)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(creator_id)
    .fetch_one(pool)
    .await?;

    let mut all_members = vec![creator_id];
    all_members.extend_from_slice(member_ids);
    all_members.sort();
    all_members.dedup();

    for member_id in &all_members {
        let role = if *member_id == creator_id { "owner" } else { "member" };
        sqlx::query(
            "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
        )
        .bind(conv.id)
        .bind(member_id)
        .bind(role)
        .execute(pool)
        .await?;
    }

    Ok(conv)
}

pub async fn get_members(
    pool: &PgPool,
    conversation_id: Uuid,
) -> Result<Vec<MemberWithUser>, ConversationError> {
    let members = sqlx::query_as::<_, MemberWithUser>(
        r#"
        SELECT
            u.id as user_id,
            u.username,
            u.display_name,
            u.avatar_url,
            u.status,
            cm.role,
            cm.joined_at
        FROM users u
        JOIN conversation_members cm ON u.id = cm.user_id
        WHERE cm.conversation_id = $1
        ORDER BY
            CASE cm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
            cm.joined_at ASC
        "#,
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await?;

    Ok(members)
}

pub async fn get_member_role(
    pool: &PgPool,
    conversation_id: Uuid,
    user_id: Uuid,
) -> Result<Option<String>, ConversationError> {
    let role = sqlx::query_scalar::<_, String>(
        "SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    )
    .bind(conversation_id)
    .bind(user_id)
    .fetch_optional(pool)
    .await?;

    Ok(role)
}

pub async fn add_member(
    pool: &PgPool,
    conversation_id: Uuid,
    operator_id: Uuid,
    user_id: Uuid,
) -> Result<(), ConversationError> {
    let role = get_member_role(pool, conversation_id, operator_id).await?;
    match role.as_deref() {
        Some("owner") | Some("admin") => {}
        _ => return Err(ConversationError::PermissionDenied),
    }

    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn remove_member(
    pool: &PgPool,
    conversation_id: Uuid,
    operator_id: Uuid,
    user_id: Uuid,
) -> Result<(), ConversationError> {
    // 自己退出
    if operator_id == user_id {
        let role = get_member_role(pool, conversation_id, operator_id).await?;
        if role.as_deref() == Some("owner") {
            return Err(ConversationError::OwnerCannotLeave);
        }
        sqlx::query(
            "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
        )
        .bind(conversation_id)
        .bind(user_id)
        .execute(pool)
        .await?;
        return Ok(());
    }

    // 踢人
    let operator_role = get_member_role(pool, conversation_id, operator_id).await?;
    let target_role = get_member_role(pool, conversation_id, user_id).await?;

    match operator_role.as_deref() {
        Some("owner") => {
            // owner 可以踢任何人
        }
        Some("admin") => {
            // admin 只能踢普通成员
            if target_role.as_deref() == Some("owner") || target_role.as_deref() == Some("admin") {
                return Err(ConversationError::PermissionDenied);
            }
        }
        _ => return Err(ConversationError::PermissionDenied),
    }

    sqlx::query(
        "DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn assign_admin(
    pool: &PgPool,
    conversation_id: Uuid,
    owner_id: Uuid,
    user_id: Uuid,
) -> Result<(), ConversationError> {
    let role = get_member_role(pool, conversation_id, owner_id).await?;
    if role.as_deref() != Some("owner") {
        return Err(ConversationError::PermissionDenied);
    }

    // 确认目标是群成员
    let target_role = get_member_role(pool, conversation_id, user_id).await?;
    if target_role.is_none() {
        return Err(ConversationError::Database(sqlx::Error::RowNotFound));
    }

    sqlx::query(
        "UPDATE conversation_members SET role = 'admin' WHERE conversation_id = $1 AND user_id = $2",
    )
    .bind(conversation_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn update_name(
    pool: &PgPool,
    conversation_id: Uuid,
    name: &str,
) -> Result<Conversation, ConversationError> {
    let conv = sqlx::query_as::<_, Conversation>(
        "UPDATE conversations SET name = $2 WHERE id = $1 AND type = 'group' RETURNING *",
    )
    .bind(conversation_id)
    .bind(name)
    .fetch_optional(pool)
    .await?
    .ok_or(ConversationError::Database(sqlx::Error::RowNotFound))?;

    Ok(conv)
}
