use chrono::Utc;
use jsonwebtoken::{encode, EncodingKey, Header};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{AuthResponse, Claims, LoginRequest, RegisterRequest, User};

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Email already exists")]
    EmailExists,
    #[error("Username already exists")]
    UsernameExists,
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("Bcrypt error: {0}")]
    Bcrypt(#[from] bcrypt::BcryptError),
}

pub async fn register(
    pool: &PgPool,
    req: RegisterRequest,
    jwt_secret: &str,
) -> Result<AuthResponse, AuthError> {
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
    )
    .bind(&req.email)
    .fetch_one(pool)
    .await?;
    if existing {
        return Err(AuthError::EmailExists);
    }

    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)",
    )
    .bind(&req.username)
    .fetch_one(pool)
    .await?;
    if existing {
        return Err(AuthError::UsernameExists);
    }

    let password_hash = bcrypt::hash(&req.password, 10)?;
    let user_id = Uuid::new_v4();
    let now = Utc::now();

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash, display_name, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'offline', $6, $6)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&req.username)
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.display_name)
    .bind(now)
    .fetch_one(pool)
    .await?;

    let token = generate_token(user_id, jwt_secret)?;
    Ok(AuthResponse { token, user })
}

pub async fn login(
    pool: &PgPool,
    req: LoginRequest,
    jwt_secret: &str,
) -> Result<AuthResponse, AuthError> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(pool)
        .await?
        .ok_or(AuthError::InvalidCredentials)?;

    let valid = bcrypt::verify(&req.password, &user.password_hash)?;
    if !valid {
        return Err(AuthError::InvalidCredentials);
    }

    let token = generate_token(user.id, jwt_secret)?;
    Ok(AuthResponse { token, user })
}

fn generate_token(user_id: Uuid, secret: &str) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id,
        iat: now,
        exp: now + 86400 * 7,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}
