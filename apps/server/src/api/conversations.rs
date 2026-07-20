use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use uuid::Uuid;

use crate::models::conversation::ConversationWithMeta;
use crate::models::conversation::MemberWithUser;
use crate::services::conversation;

pub async fn list(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ConversationWithMeta>>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    conversation::list_for_user(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(serde::Deserialize)]
pub struct CreateDirectRequest {
    pub user1_id: Uuid,
    pub user2_id: Uuid,
}

pub async fn create_direct(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateDirectRequest>,
) -> Result<Json<crate::models::conversation::Conversation>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    // 鉴权：调用方必须是会话的其中一方，禁止为他人创建会话
    if user_id != req.user1_id && user_id != req.user2_id {
        return Err((StatusCode::FORBIDDEN, "Cannot create conversation for other users".to_string()));
    }
    let conv = conversation::create_direct(&state.pool, req.user1_id, req.user2_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 通知对方有新会话（排除创建者自己）
    let other_user_id = if user_id == req.user1_id { req.user2_id } else { req.user1_id };
    if let Ok(Some(meta)) = conversation::get_conversation_with_meta(&state.pool, conv.id, other_user_id).await {
        let event = serde_json::to_string(&crate::ws::protocol::WsServerMessage::ConversationCreated {
            conversation: meta,
        }).unwrap();
        state.hub.send_to_user(&other_user_id, &event).await;
    }

    Ok(Json(conv))
}

#[derive(serde::Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub member_ids: Vec<Uuid>,
}

pub async fn create_group(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateGroupRequest>,
) -> Result<Json<crate::models::conversation::Conversation>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    let conv = conversation::create_group(&state.pool, user_id, &req.name, &req.member_ids)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 通知除创建者外的所有成员有新会话
    for member_id in &req.member_ids {
        if *member_id != user_id {
            if let Ok(Some(meta)) = conversation::get_conversation_with_meta(&state.pool, conv.id, *member_id).await {
                let event = serde_json::to_string(&crate::ws::protocol::WsServerMessage::ConversationCreated {
                    conversation: meta,
                }).unwrap();
                state.hub.send_to_user(member_id, &event).await;
            }
        }
    }

    Ok(Json(conv))
}

pub async fn get_read_receipts(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<conversation::MemberReadReceipt>>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    // 鉴权：调用方必须是该会话的成员
    let role = conversation::get_member_role(&state.pool, conversation_id, user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if role.is_none() {
        return Err((StatusCode::FORBIDDEN, "Not a member of this conversation".to_string()));
    }
    conversation::get_read_receipts(&state.pool, conversation_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn get_members(
    State(state): State<crate::api::AppState>,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<MemberWithUser>>, (StatusCode, String)> {
    conversation::get_members(&state.pool, conversation_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(serde::Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
}

pub async fn add_member(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    conversation::add_member(&state.pool, conversation_id, user_id, req.user_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            conversation::ConversationError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn remove_member(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path((conversation_id, target_user_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    conversation::remove_member(&state.pool, conversation_id, user_id, target_user_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            conversation::ConversationError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            conversation::ConversationError::OwnerCannotLeave => (StatusCode::BAD_REQUEST, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

#[derive(serde::Deserialize)]
pub struct AssignAdminRequest {
    pub user_id: Uuid,
}

pub async fn assign_admin(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<AssignAdminRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    conversation::assign_admin(&state.pool, conversation_id, user_id, req.user_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            conversation::ConversationError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

#[derive(serde::Deserialize)]
pub struct UpdateConversationRequest {
    pub name: Option<String>,
}

pub async fn update(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<UpdateConversationRequest>,
) -> Result<Json<crate::models::conversation::Conversation>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    let role = conversation::get_member_role(&state.pool, conversation_id, user_id)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    match role.as_deref() {
        Some("owner") | Some("admin") => {}
        _ => return Err((StatusCode::FORBIDDEN, "Permission denied".to_string())),
    }

    let name = req.name.ok_or((StatusCode::BAD_REQUEST, "name is required".to_string()))?;
    conversation::update_name(&state.pool, conversation_id, &name)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

fn extract_user_id(headers: &HeaderMap, jwt_secret: &str) -> Result<Uuid, (StatusCode, String)> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((StatusCode::UNAUTHORIZED, "Missing authorization header".to_string()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((StatusCode::UNAUTHORIZED, "Invalid authorization format".to_string()))?;

    use jsonwebtoken::{decode, DecodingKey, Validation};
    use crate::models::user::Claims;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))?;

    Ok(token_data.claims.sub)
}
