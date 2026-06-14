pub mod auth;
pub mod channels;
pub mod contacts;
pub mod conversations;
pub mod files;
pub mod messages;
pub mod users;

use axum::{
    routing::{delete, get, patch, post, put},
    Router,
    extract::DefaultBodyLimit,
};
use tower_http::cors::{Any, CorsLayer};
use sqlx::PgPool;

use crate::config::Config;
use crate::services::minio::MinioService;
use crate::ws::hub::Hub;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub hub: Hub,
    pub minio_service: MinioService,
}

pub fn router(pool: PgPool, config: &Config) -> Router {
    let hub = Hub::new();
    let minio_service = MinioService::new(
        &config.minio_endpoint,
        &config.minio_access_key,
        &config.minio_secret_key,
        &config.minio_bucket,
        &config.minio_public_url,
    )
    .expect("Failed to initialize MinIO service");

    let state = AppState {
        pool,
        config: config.clone(),
        hub,
        minio_service,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/conversations", get(conversations::list))
        .route("/api/conversations/direct", post(conversations::create_direct))
        .route("/api/conversations/group", post(conversations::create_group))
        .route(
            "/api/conversations/{conversation_id}/messages",
            get(messages::get_history),
        )
        .route(
            "/api/conversations/{conversation_id}/members",
            get(conversations::get_members)
                .post(conversations::add_member),
        )
        .route(
            "/api/conversations/{conversation_id}/members/{user_id}",
            delete(conversations::remove_member),
        )
        .route(
            "/api/conversations/{conversation_id}/members/{user_id}/role",
            put(conversations::assign_admin),
        )
        .route(
            "/api/conversations/{conversation_id}",
            patch(conversations::update),
        )
        .route("/api/messages/search", get(messages::search_messages))
        .route("/api/users/{user_id}", get(users::get_user))
        .route("/api/users/search", get(users::search_users))
        .route("/api/users/profile", post(users::update_profile))
        .route("/api/users/settings", get(users::get_settings).put(users::update_settings))
        .route("/api/users/change-password", post(users::change_password))
        .route("/api/contacts", get(contacts::list))
        .route("/api/contacts", post(contacts::add))
        .route("/api/contacts", delete(contacts::remove))
        .route("/api/channels", post(channels::create))
        .route("/api/channels", get(channels::list))
        .route("/api/channels/{channel_id}/join", post(channels::join))
        .route("/api/channels/{channel_id}/messages", get(channels::get_messages))
        .route("/api/files/upload", post(files::upload))
        .route("/api/files/{filename}", get(files::download))
        .route("/api/ws", get(crate::ws::handler::ws_handler))
        .layer(cors)
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024)) // 50MB
        .with_state(state)
}

async fn health() -> &'static str {
    "ok"
}
