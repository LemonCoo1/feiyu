use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::channel::{Channel, ChannelMessage, ChannelWithMeta, CreateChannelRequest};
use crate::services::channel;

#[derive(Deserialize)]
pub struct ChannelMessageQuery {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn create(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<Channel>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    channel::create(&state.pool, user_id, &req.name, req.description.as_deref())
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn list(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ChannelWithMeta>>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    channel::list_for_user(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn join(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    axum::extract::Path(channel_id): axum::extract::Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    channel::join(&state.pool, channel_id, user_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            channel::ChannelError::AlreadyMember => (StatusCode::CONFLICT, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn get_messages(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    axum::extract::Path(channel_id): axum::extract::Path<Uuid>,
    Query(query): Query<ChannelMessageQuery>,
) -> Result<Json<Vec<ChannelMessage>>, (StatusCode, String)> {
    let _user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    let limit = query.limit.unwrap_or(50).min(100);
    channel::get_messages(&state.pool, channel_id, query.before, limit)
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
