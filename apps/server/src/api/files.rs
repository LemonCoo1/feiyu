use axum::body::Body;
use axum::extract::{Multipart, Path, State};
use axum::http::StatusCode;
use axum::response::Response;
use axum::Json;
use serde::Serialize;

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
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

        let stored = state
            .file_service
            .save(&file_name, &data)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(UploadResponse {
            url: format!("/api/files/{}", stored),
            filename: file_name,
        }));
    }

    Err((StatusCode::BAD_REQUEST, "No file provided".to_string()))
}

pub async fn download(
    State(state): State<crate::api::AppState>,
    Path(filename): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let path = state.file_service.get_path(&filename);
    if !path.exists() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }

    let data = tokio::fs::read(&path)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(Body::from(data))
        .unwrap())
}
