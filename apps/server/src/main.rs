use std::path::PathBuf;
use tracing_subscriber::EnvFilter;

mod api;
mod config;
mod db;
mod models;
mod services;
mod ws;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse()?))
        .init();

    // 解析 --config 参数，默认 config.toml
    let config_path = parse_config_path();
    let config = config::Config::load(&config_path)?;
    tracing::info!("配置已加载: {:?}", config_path);

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    // 自动执行数据库迁移（迁移在编译期嵌入二进制）
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database migrations applied");

    // 确保 MinIO bucket 存在
    let minio = services::minio::MinioService::new(
        &config.minio_endpoint,
        &config.minio_access_key,
        &config.minio_secret_key,
        &config.minio_bucket,
        &config.minio_public_url,
    )?;
    minio.ensure_bucket().await?;
    tracing::info!("MinIO bucket '{}' ready", &config.minio_bucket);

    let app = api::router(pool, &config);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn parse_config_path() -> PathBuf {
    let args: Vec<String> = std::env::args().collect();
    for i in 0..args.len() {
        if args[i] == "--config" && i + 1 < args.len() {
            return PathBuf::from(&args[i + 1]);
        }
    }
    PathBuf::from("config.toml")
}
