pub mod auth;

use axum::{routing::{get, post}, Router};
use sqlx::PgPool;

use crate::config::Config;

pub fn router(pool: PgPool, config: &Config) -> Router {
    let auth_state = auth::AuthState {
        pool: pool.clone(),
        jwt_secret: config.jwt_secret.clone(),
    };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .with_state(auth_state)
}

async fn health() -> &'static str {
    "ok"
}
