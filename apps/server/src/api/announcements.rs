use axum::{
    extract::{State, Path},
    http::{HeaderMap, StatusCode},
    Json,
};
use uuid::Uuid;
use crate::models::announcement::{CreateAnnouncementRequest, UpdateAnnouncementRequest};
use crate::services::announcement;

fn extract_user_id(headers: &HeaderMap, jwt_secret: &str) -> Result<Uuid, (StatusCode, String)> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use crate::models::user::Claims;
    let token = headers
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or((StatusCode::UNAUTHORIZED, "Missing token".to_string()))?;
    decode::<Claims>(token, &DecodingKey::from_secret(jwt_secret.as_bytes()), &Validation::default())
        .map(|data| data.claims.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid token".to_string()))
}

pub async fn create(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
    Json(req): Json<CreateAnnouncementRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    announcement::create(&state.pool, conversation_id, user_id, req)
        .await
        .map(|a| Json(serde_json::json!(a)))
        .map_err(|e| match e {
            announcement::AnnouncementError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn list(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(conversation_id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>, (StatusCode, String)> {
    let _user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    announcement::list(&state.pool, conversation_id)
        .await
        .map(|v| Json(v.into_iter().map(|a| serde_json::json!(a)).collect()))
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn update(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(announcement_id): Path<Uuid>,
    Json(req): Json<UpdateAnnouncementRequest>,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    announcement::update(&state.pool, announcement_id, user_id, req)
        .await
        .map(|a| Json(serde_json::json!(a)))
        .map_err(|e| match e {
            announcement::AnnouncementError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn remove(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Path(announcement_id): Path<Uuid>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    announcement::delete(&state.pool, announcement_id, user_id)
        .await
        .map(|_| StatusCode::NO_CONTENT)
        .map_err(|e| match e {
            announcement::AnnouncementError::PermissionDenied => (StatusCode::FORBIDDEN, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}
