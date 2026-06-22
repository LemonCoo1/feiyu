use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use uuid::Uuid;

use crate::models::reaction::{AddReactionRequest, ReactionGroup};
use crate::services::reaction;

pub async fn add_reaction(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(message_id): Path<Uuid>,
    Json(req): Json<AddReactionRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    reaction::add(&state.pool, message_id, user_id, &req.emoji)
        .await
        .map(|r| Json(serde_json::json!(r)))
        .map_err(|e| match e {
            reaction::ReactionError::AlreadyExists => (StatusCode::CONFLICT, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn remove_reaction(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path((message_id, emoji)): Path<(Uuid, String)>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    reaction::remove(&state.pool, message_id, user_id, &emoji)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn get_reactions(
    State(state): State<crate::api::AppState>,
    Path(message_id): Path<Uuid>,
) -> Result<Json<Vec<ReactionGroup>>, (StatusCode, String)> {
    reaction::get_by_message(&state.pool, message_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

fn extract_user_id(headers: &HeaderMap, jwt_secret: &str) -> Result<Uuid, (StatusCode, String)> {
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing authorization header".to_string(),
        ))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Invalid authorization format".to_string(),
        ))?;

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
