use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use axum::Json;
use serde::Serialize;
use uuid::Uuid;

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
}

fn guess_mime(filename: &str) -> &'static str {
    let ext = std::path::Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "pdf" => "application/pdf",
        "json" => "application/json",
        "txt" => "text/plain",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "application/javascript",
        _ => "application/octet-stream",
    }
}

pub async fn upload(
    State(state): State<crate::api::AppState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?
    {
        let file_name = field
            .file_name()
            .unwrap_or("unknown")
            .to_string();
        let data = field
            .bytes()
            .await
            .map_err(|e| (StatusCode::BAD_REQUEST, e.to_string()))?;

        // 生成唯一 key，保留原扩展名
        let ext = std::path::Path::new(&file_name)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let key = format!("{}.{}", Uuid::new_v4(), ext);

        let key = state
            .minio_service
            .save(&key, &data)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        tracing::info!("[文件上传] filename={}, size={}bytes, key={}", file_name, data.len(), key);

        return Ok(Json(UploadResponse {
            url: format!("/api/files/{}", key),
            filename: file_name,
        }));
    }

    Err((StatusCode::BAD_REQUEST, "No file provided".to_string()))
}

/// 代理下载：当 MinIO 不可公开访问时，通过服务端中转
pub async fn download(
    State(state): State<crate::api::AppState>,
    Path(key): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let data = state
        .minio_service
        .get_bytes(&key)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Response::builder()
        .header("Content-Type", guess_mime(&key))
        .body(Body::from(data))
        .unwrap())
}
