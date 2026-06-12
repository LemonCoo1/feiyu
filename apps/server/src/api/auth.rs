use axum::{extract::State, http::StatusCode, Json};

use crate::models::user::{AuthResponse, LoginRequest, RegisterRequest};
use crate::services::auth::{self, AuthError};

pub async fn register(
    State(state): State<crate::api::AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::register(&state.pool, req, &state.config.jwt_secret)
        .await
        .map(Json)
        .map_err(|e| match e {
            AuthError::EmailExists => (StatusCode::CONFLICT, "Email already exists".to_string()),
            AuthError::UsernameExists => {
                (StatusCode::CONFLICT, "Username already exists".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn login(
    State(state): State<crate::api::AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::login(&state.pool, req, &state.config.jwt_secret)
        .await
        .map(Json)
        .map_err(|e| match e {
            AuthError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}
