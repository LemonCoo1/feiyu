pub mod auth;
pub mod contacts;
pub mod conversations;
pub mod messages;
pub mod users;

use axum::{
    routing::{delete, get, post},
    Router,
};
use sqlx::PgPool;

use crate::config::Config;
use crate::ws::hub::Hub;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub hub: Hub,
}

pub fn router(pool: PgPool, config: &Config) -> Router {
    let hub = Hub::new();

    let state = AppState {
        pool,
        config: config.clone(),
        hub,
    };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/conversations", get(conversations::list))
        .route("/api/conversations/direct", post(conversations::create_direct))
        .route(
            "/api/conversations/{conversation_id}/messages",
            get(messages::get_history),
        )
        .route("/api/users/{user_id}", get(users::get_user))
        .route("/api/users/search", get(users::search_users))
        .route("/api/users/profile", post(users::update_profile))
        .route("/api/contacts", get(contacts::list))
        .route("/api/contacts", post(contacts::add))
        .route("/api/contacts", delete(contacts::remove))
        .route("/api/ws", get(crate::ws::handler::ws_handler))
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
