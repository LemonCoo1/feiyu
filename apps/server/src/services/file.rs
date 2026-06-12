use std::path::PathBuf;
use uuid::Uuid;

#[derive(Clone)]
pub struct FileService {
    pub upload_dir: PathBuf,
}

impl FileService {
    pub fn new(upload_dir: &str) -> Self {
        let dir = PathBuf::from(upload_dir);
        std::fs::create_dir_all(&dir).ok();
        Self { upload_dir: dir }
    }

    pub async fn save(&self, filename: &str, data: &[u8]) -> Result<String, std::io::Error> {
        let ext = std::path::Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let stored_name = format!("{}.{}", Uuid::new_v4(), ext);
        let path = self.upload_dir.join(&stored_name);
        tokio::fs::write(&path, data).await?;
        Ok(stored_name)
    }

    pub fn get_path(&self, stored_name: &str) -> PathBuf {
        self.upload_dir.join(stored_name)
    }
}
