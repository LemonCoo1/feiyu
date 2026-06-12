use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;

use crate::models::user::{AuthResponse, LoginRequest, RegisterRequest};
use crate::services::auth::{self, AuthError};

#[derive(Clone)]
pub struct AuthState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

pub async fn register(
    State(state): State<AuthState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::register(&state.pool, req, &state.jwt_secret)
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
    State(state): State<AuthState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::login(&state.pool, req, &state.jwt_secret)
        .await
        .map(Json)
        .map_err(|e| match e {
            AuthError::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string())
            }
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}
