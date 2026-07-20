use anyhow::Result;
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::Region;

#[derive(Clone)]
pub struct MinioService {
    bucket: Box<Bucket>,
    bucket_name: String,
    region: Region,
    credentials: Credentials,
    public_url: String,
}

impl MinioService {
    pub fn new(
        endpoint: &str,
        access_key: &str,
        secret_key: &str,
        bucket_name: &str,
        public_url: &str,
    ) -> Result<Self> {
        let credentials = Credentials::new(Some(access_key), Some(secret_key), None, None, None)?;

        let region = Region::Custom {
            region: "us-east-1".to_string(),
            endpoint: endpoint.to_string(),
        };

        let mut bucket = Bucket::new(bucket_name, region.clone(), credentials.clone())?;
        // MinIO 使用 path-style URL
        bucket.set_path_style();

        Ok(Self {
            bucket,
            bucket_name: bucket_name.to_string(),
            region,
            credentials,
            public_url: public_url.trim_end_matches('/').to_string(),
        })
    }

    /// 确保 bucket 存在，不存在则创建
    pub async fn ensure_bucket(&self) -> Result<()> {
        if !self.bucket.exists().await? {
            tracing::info!("MinIO bucket '{}' not found, creating...", self.bucket_name);
            match Bucket::create(
                &self.bucket_name,
                self.region.clone(),
                self.credentials.clone(),
                s3::BucketConfiguration::default(),
            )
            .await
            {
                Ok(resp) => tracing::info!("MinIO bucket '{}' created (HTTP {})", self.bucket_name, resp.response_code),
                Err(e) => tracing::warn!("Failed to create bucket '{}': {}", self.bucket_name, e),
            }
        }
        Ok(())
    }

    /// 上传文件到 MinIO，使用传入的 filename 作为 object key（保留路径前缀）。
    /// 调用方负责保证 key 的唯一性（例如带 UUID 或 user_id）。
    pub async fn save(&self, filename: &str, data: &[u8]) -> Result<String> {
        let key = filename.to_string();

        let content_type = guess_mime(filename);
        self.bucket
            .put_object_with_content_type(&key, data, content_type)
            .await?;

        tracing::info!("[MinIO 上传] filename={}, key={}, size={}bytes", filename, key, data.len());
        Ok(key)
    }

    /// 返回公开可访问的下载 URL
    pub fn get_url(&self, key: &str) -> String {
        format!("{}/{}", self.public_url, key)
    }

    /// 从 MinIO 读取文件内容
    pub async fn get_bytes(&self, key: &str) -> Result<Vec<u8>> {
        let response = self.bucket.get_object(key).await?;
        Ok(response.bytes().to_vec())
    }
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
