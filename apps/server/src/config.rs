use std::env;
use std::path::Path;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
struct ServerConfig {
    #[serde(default = "default_host")]
    host: String,
    #[serde(default = "default_port")]
    port: u16,
}

#[derive(Debug, Clone, Deserialize)]
struct DatabaseConfig {
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct RedisConfig {
    url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct JwtConfig {
    secret: String,
}

#[derive(Debug, Clone, Deserialize)]
struct MinioConfig {
    endpoint: String,
    access_key: String,
    secret_key: String,
    bucket: String,
    public_url: String,
}

#[derive(Debug, Clone, Deserialize)]
struct FileConfig {
    #[serde(default = "default_server")]
    server: ServerConfig,
    database: DatabaseConfig,
    redis: RedisConfig,
    jwt: JwtConfig,
    minio: MinioConfig,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub server_host: String,
    pub server_port: u16,
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,
    pub minio_public_url: String,
}

impl Config {
    /// 从 TOML 配置文件加载，环境变量优先覆盖
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| anyhow::anyhow!("读取配置文件 {:?} 失败: {}", path, e))?;
        let file: FileConfig = toml::from_str(&content)
            .map_err(|e| anyhow::anyhow!("解析配置文件 {:?} 失败: {}", path, e))?;

        Ok(Self {
            database_url: env_or("DATABASE_URL", &file.database.url),
            redis_url: env_or("REDIS_URL", &file.redis.url),
            jwt_secret: env_or("JWT_SECRET", &file.jwt.secret),
            server_host: env_or("SERVER_HOST", &file.server.host),
            server_port: env_or_parse("SERVER_PORT", file.server.port),
            minio_endpoint: env_or("MINIO_ENDPOINT", &file.minio.endpoint),
            minio_access_key: env_or("MINIO_ACCESS_KEY", &file.minio.access_key),
            minio_secret_key: env_or("MINIO_SECRET_KEY", &file.minio.secret_key),
            minio_bucket: env_or("MINIO_BUCKET", &file.minio.bucket),
            minio_public_url: env_or("MINIO_PUBLIC_URL", &file.minio.public_url),
        })
    }
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    3000
}

fn default_server() -> ServerConfig {
    ServerConfig {
        host: default_host(),
        port: default_port(),
    }
}

/// 环境变量优先，否则使用配置文件值
fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_string())
}

/// 环境变量优先，否则使用配置文件值（可解析类型）
fn env_or_parse<T: std::str::FromStr + std::fmt::Display>(key: &str, fallback: T) -> T {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(fallback)
}
