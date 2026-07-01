use axum::{extract::State, http::{HeaderMap, StatusCode}, Json};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::user::User;
use crate::services::contact;

#[derive(Deserialize)]
pub struct AddContactRequest {
    pub contact_id: Uuid,
}

pub async fn list(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    contact::list_contacts(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn add(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<AddContactRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    contact::add_contact(&state.pool, user_id, req.contact_id)
        .await
        .map(|_| StatusCode::CREATED)
        .map_err(|e| match e {
            contact::ContactError::CannotAddSelf => (StatusCode::BAD_REQUEST, e.to_string()),
            contact::ContactError::AlreadyExists => (StatusCode::CONFLICT, e.to_string()),
            contact::ContactError::UserNotFound => (StatusCode::NOT_FOUND, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn remove(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<AddContactRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    contact::remove_contact(&state.pool, user_id, req.contact_id)
        .await
        .map(|_| StatusCode::OK)
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
