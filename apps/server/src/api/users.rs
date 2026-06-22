use axum::{
    extract::{Multipart, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::models::user::User;
use crate::models::user_settings::{UserSettings, UpdateUserSettings, ChangePasswordRequest};
use crate::services::user;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

pub async fn get_user(
    State(state): State<crate::api::AppState>,
    axum::extract::Path(user_id): axum::extract::Path<Uuid>,
) -> Result<Json<User>, (StatusCode, String)> {
    user::get_by_id(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| match e {
            user::UserError::NotFound => (StatusCode::NOT_FOUND, "User not found".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn search_users(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    user::search(&state.pool, &query.q, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn update_profile(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<User>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    user::update_profile(&state.pool, user_id, req.display_name, req.avatar_url)
        .await
        .map(Json)
        .map_err(|e| match e {
            user::UserError::NotFound => (StatusCode::NOT_FOUND, "User not found".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
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

pub async fn get_settings(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
) -> Result<Json<UserSettings>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    user::get_settings(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn update_settings(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<UpdateUserSettings>,
) -> Result<Json<UserSettings>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    user::update_settings(&state.pool, user_id, req)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn change_password(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    Json(req): Json<ChangePasswordRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    user::change_password(&state.pool, user_id, &req.old_password, &req.new_password)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            user::UserError::InvalidPassword => (StatusCode::BAD_REQUEST, "旧密码错误".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn upload_avatar(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<serde_json::Value>, (StatusCode, String)> {
    let user_id = extract_user_id(&headers, &state.config.jwt_secret)?;

    // 从 multipart 中获取文件
    let mut file_data: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut _content_type: Option<String> = None;

    let mut multipart = multipart;
    while let Some(field) = multipart.next_field().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))? {
        let name = field.name().unwrap_or("").to_string();
        if name == "file" || name == "avatar" {
            file_name = field.file_name().map(|s| s.to_string());
            _content_type = field.content_type().map(|s| s.to_string());
            file_data = Some(field.bytes().await.map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?.to_vec());
            break;
        }
    }

    let data = file_data.ok_or((StatusCode::BAD_REQUEST, "No file provided".to_string()))?;

    // 生成文件名
    let ext = file_name
        .as_ref()
        .and_then(|n| n.rsplit('.').next())
        .unwrap_or("jpg");
    let avatar_filename = format!("avatars/{}.{}", user_id, ext);

    // 上传到 MinIO
    let key = state.minio_service.save(&avatar_filename, &data)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let url = state.minio_service.get_url(&key);

    // 更新用户 avatar_url
    sqlx::query("UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2")
        .bind(&url)
        .bind(user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(serde_json::json!({ "avatar_url": url })))
}
