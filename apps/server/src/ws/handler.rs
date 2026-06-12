use axum::extract::ws::{Message, WebSocket};
use axum::extract::State as AxumState;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;
use futures::{SinkExt, StreamExt};
use sqlx::PgPool;
use uuid::Uuid;

use super::hub::Hub;
use super::protocol::{WsClientMessage, WsServerMessage};
use crate::api::AppState;
use crate::models::message::Message as DbMessage;

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    AxumState(state): AxumState<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.pool, state.hub, state.config.jwt_secret))
}

async fn handle_socket(mut socket: WebSocket, pool: PgPool, hub: Hub, jwt_secret: String) {
    let mut user_id: Option<Uuid> = None;
    let mut rx = None;

    // First message must be auth.token
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<WsClientMessage>(&text) {
                Ok(WsClientMessage::AuthToken { token }) => {
                    match validate_jwt(&token, &jwt_secret) {
                        Ok(uid) => {
                            user_id = Some(uid);
                            let receiver = hub.connect(uid).await;
                            rx = Some(receiver);

                            let ok = serde_json::to_string(&WsServerMessage::AuthOk {
                                user_id: uid,
                            })
                            .unwrap();
                            let _ = socket.send(Message::Text(ok.into())).await;
                            break;
                        }
                        Err(e) => {
                            let err = serde_json::to_string(&WsServerMessage::AuthError {
                                message: e.to_string(),
                            })
                            .unwrap();
                            let _ = socket.send(Message::Text(err.into())).await;
                            let _ = socket.close().await;
                            return;
                        }
                    }
                }
                _ => {
                    let err = serde_json::to_string(&WsServerMessage::AuthError {
                        message: "Expected auth.token message".to_string(),
                    })
                    .unwrap();
                    let _ = socket.send(Message::Text(err.into())).await;
                    let _ = socket.close().await;
                    return;
                }
            }
        }
    }

    let user_id = match user_id {
        Some(id) => id,
        None => return,
    };

    let mut rx = rx.unwrap();

    // Split socket for concurrent read/write
    let (mut sender, mut receiver) = socket.split();

    // Spawn task to forward hub messages to this socket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from this client
    let recv_task = {
        let hub = hub.clone();
        let pool = pool.clone();
        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                if let Message::Text(text) = msg {
                    handle_client_message(&text, user_id, &pool, &hub).await;
                }
            }
        })
    };

    // Wait for either task to finish (disconnect)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Cleanup
    hub.disconnect(&user_id).await;
}

async fn handle_client_message(text: &str, user_id: Uuid, pool: &PgPool, hub: &Hub) {
    let msg: WsClientMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return,
    };

    match msg {
        WsClientMessage::MessageSend {
            conversation_id,
            content_type,
            content,
            client_msg_id,
        } => {
            let result = sqlx::query_as::<_, DbMessage>(
                r#"
                INSERT INTO messages (id, conversation_id, sender_id, content_type, content)
                VALUES (gen_random_uuid(), $1, $2, $3, $4)
                RETURNING *
                "#,
            )
            .bind(conversation_id)
            .bind(user_id)
            .bind(&content_type)
            .bind(&content)
            .fetch_one(pool)
            .await;

            match result {
                Ok(db_msg) => {
                    // Send ACK to sender
                    let ack = serde_json::to_string(&WsServerMessage::MessageAck {
                        client_msg_id: client_msg_id.clone(),
                        server_msg_id: db_msg.id,
                        conversation_id,
                    })
                    .unwrap();
                    hub.send_to_user(&user_id, &ack).await;

                    // Deliver to other members
                    let deliver = serde_json::to_string(&WsServerMessage::MessageDeliver {
                        message: db_msg,
                        conversation_id,
                    })
                    .unwrap();
                    hub.send_to_conversation(&conversation_id, &user_id, &deliver).await;
                }
                Err(e) => {
                    tracing::error!("Failed to save message: {}", e);
                }
            }
        }
        WsClientMessage::MessageRead {
            conversation_id,
            message_id,
        } => {
            let _ = sqlx::query(
                r#"
                INSERT INTO read_receipts (user_id, conversation_id, last_read_message_id, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, conversation_id)
                DO UPDATE SET last_read_message_id = $3, updated_at = NOW()
                "#,
            )
            .bind(user_id)
            .bind(conversation_id)
            .bind(message_id)
            .execute(pool)
            .await;
        }
        WsClientMessage::TypingStart { conversation_id } => {
            let typing = serde_json::to_string(&WsServerMessage::TypingStart {
                user_id,
                conversation_id,
            })
            .unwrap();
            hub.send_to_conversation(&conversation_id, &user_id, &typing).await;
        }
        WsClientMessage::TypingStop { conversation_id } => {
            let typing = serde_json::to_string(&WsServerMessage::TypingStop {
                user_id,
                conversation_id,
            })
            .unwrap();
            hub.send_to_conversation(&conversation_id, &user_id, &typing).await;
        }
        _ => {}
    }
}

fn validate_jwt(token: &str, secret: &str) -> Result<Uuid, jsonwebtoken::errors::Error> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use crate::models::user::Claims;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims.sub)
}
