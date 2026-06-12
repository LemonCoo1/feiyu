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

    let config = config::Config::from_env();

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    let app = api::router(pool, &config);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
