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
use crate::models::channel::ChannelMessage as DbChannelMessage;
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

                            // Update user status to online and broadcast to contacts
                            let _ = crate::services::user::update_status(&pool, uid, "online").await;
                            let contact_ids = crate::services::contact::get_contact_ids(&pool, uid).await.unwrap_or_default();
                            let presence = serde_json::to_string(&WsServerMessage::PresenceUpdate {
                                user_id: uid,
                                status: "online".to_string(),
                            })
                            .unwrap();
                            for cid in &contact_ids {
                                hub.send_to_user(cid, &presence).await;
                            }

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

    // Update user status to offline and broadcast to contacts
    let _ = crate::services::user::update_status(&pool, user_id, "offline").await;
    let contact_ids = crate::services::contact::get_contact_ids(&pool, user_id).await.unwrap_or_default();
    let presence = serde_json::to_string(&WsServerMessage::PresenceUpdate {
        user_id,
        status: "offline".to_string(),
    })
    .unwrap();
    for cid in &contact_ids {
        hub.send_to_user(cid, &presence).await;
    }
}

async fn handle_client_message(text: &str, user_id: Uuid, pool: &PgPool, hub: &Hub) {
    tracing::debug!("[WS] 收到消息: user_id={}, raw={}", user_id, text);
    let msg: WsClientMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("[WS] 消息反序列化失败: user_id={}, error={}, raw={}", user_id, e, text);
            return;
        }
    };

    match msg {
        WsClientMessage::MessageSend {
            conversation_id,
            content_type,
            content,
            client_msg_id,
        } => {
            tracing::info!("[消息发送] user_id={}, conv={}, content_type={}, content={}", user_id, conversation_id, content_type, content);
            // Ensure conversation members are registered in the hub
            let members = crate::services::conversation::get_members(pool, conversation_id)
                .await
                .unwrap_or_default();
            if !members.is_empty() {
                let member_ids: Vec<Uuid> = members.iter().map(|m| m.user_id).collect();
                hub.register_conversation(conversation_id, member_ids).await;
            }

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
                    tracing::info!("[消息保存成功] msg_id={}, content_type={}, content={}", db_msg.id, db_msg.content_type, db_msg.content);

                    // Send ACK to sender
                    let ack = serde_json::to_string(&WsServerMessage::MessageAck {
                        client_msg_id: client_msg_id.clone(),
                        server_msg_id: db_msg.id,
                        conversation_id,
                    })
                    .unwrap();
                    hub.send_to_user(&user_id, &ack).await;

                    // Deliver to all members including sender
                    let deliver = serde_json::to_string(&WsServerMessage::MessageDeliver {
                        message: db_msg,
                        conversation_id,
                    })
                    .unwrap();
                    let members = crate::services::conversation::get_members(pool, conversation_id)
                        .await
                        .unwrap_or_default();
                    tracing::info!("[消息投递] 投递给 {} 个成员", members.len());
                    for mid in &members {
                        hub.send_to_user(&mid.user_id, &deliver).await;
                    }
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

            // 通知同会话其他成员
            let notify = serde_json::to_string(&WsServerMessage::MessageReadNotify {
                user_id,
                conversation_id,
                message_id,
            })
            .unwrap();
            hub.send_to_conversation(&conversation_id, &user_id, &notify).await;
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
        WsClientMessage::Ping => {
            let pong = serde_json::to_string(&WsServerMessage::Pong).unwrap();
            hub.send_to_user(&user_id, &pong).await;
        }
        WsClientMessage::ChannelMessageSend {
            channel_id,
            content_type,
            content,
            parent_message_id,
            client_msg_id,
        } => {
            let result = sqlx::query_as::<_, DbChannelMessage>(
                r#"
                INSERT INTO channel_messages (id, channel_id, sender_id, content_type, content, parent_message_id)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
                RETURNING *
                "#,
            )
            .bind(channel_id)
            .bind(user_id)
            .bind(&content_type)
            .bind(&content)
            .bind(parent_message_id)
            .fetch_one(pool)
            .await;

            match result {
                Ok(db_msg) => {
                    let ack = serde_json::to_string(&WsServerMessage::ChannelMessageAck {
                        client_msg_id: client_msg_id.clone(),
                        server_msg_id: db_msg.id,
                        channel_id,
                    })
                    .unwrap();
                    hub.send_to_user(&user_id, &ack).await;

                    let deliver = serde_json::to_string(&WsServerMessage::ChannelMessageDeliver {
                        message: db_msg,
                        channel_id,
                    })
                    .unwrap();
                    // Broadcast to all channel members including sender
                    let member_ids = crate::services::channel::get_member_ids(pool, channel_id)
                        .await
                        .unwrap_or_default();
                    for mid in &member_ids {
                        hub.send_to_user(mid, &deliver).await;
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to save channel message: {}", e);
                }
            }
        }
        WsClientMessage::ReactionAdd { message_id, emoji } => {
            // 查询 message 所属会话
            if let Ok(Some(msg)) = sqlx::query_as::<_, DbMessage>(
                "SELECT * FROM messages WHERE id = $1",
            )
            .bind(message_id)
            .fetch_optional(pool)
            .await
            {
                let _ = crate::services::reaction::add(pool, message_id, user_id, &emoji).await;
                let update = serde_json::to_string(&WsServerMessage::ReactionUpdate {
                    message_id,
                    user_id,
                    emoji: emoji.clone(),
                    action: "add".to_string(),
                })
                .unwrap();
                hub.send_to_conversation(&msg.conversation_id, &user_id, &update)
                    .await;
                hub.send_to_user(&user_id, &update).await;
            }
        }
        WsClientMessage::ReactionRemove { message_id, emoji } => {
            if let Ok(Some(msg)) = sqlx::query_as::<_, DbMessage>(
                "SELECT * FROM messages WHERE id = $1",
            )
            .bind(message_id)
            .fetch_optional(pool)
            .await
            {
                let _ = crate::services::reaction::remove(pool, message_id, user_id, &emoji).await;
                let update = serde_json::to_string(&WsServerMessage::ReactionUpdate {
                    message_id,
                    user_id,
                    emoji: emoji.clone(),
                    action: "remove".to_string(),
                })
                .unwrap();
                hub.send_to_conversation(&msg.conversation_id, &user_id, &update)
                    .await;
                hub.send_to_user(&user_id, &update).await;
            }
        }
        WsClientMessage::MessageRecall { message_id } => {
            // 查消息，验证是自己的消息且在 2 分钟内
            if let Ok(Some(msg)) = sqlx::query_as::<_, DbMessage>(
                "SELECT * FROM messages WHERE id = $1 AND sender_id = $2",
            )
            .bind(message_id)
            .bind(user_id)
            .fetch_optional(pool)
            .await
            {
                // 检查 2 分钟限制
                let now = chrono::Utc::now();
                let elapsed = now.signed_duration_since(msg.created_at);
                if elapsed.num_seconds() <= 120 {
                    let _ = sqlx::query("UPDATE messages SET recalled = TRUE WHERE id = $1")
                        .bind(message_id)
                        .execute(pool)
                        .await;
                    let notify = serde_json::to_string(&WsServerMessage::MessageRecalled {
                        message_id,
                        conversation_id: msg.conversation_id,
                        user_id,
                    })
                    .unwrap();
                    // 广播给所有成员（包括发送者自己）
                    let members =
                        crate::services::conversation::get_members(pool, msg.conversation_id)
                            .await
                            .unwrap_or_default();
                    for mid in &members {
                        hub.send_to_user(&mid.user_id, &notify).await;
                    }
                    tracing::info!("[消息撤回] msg_id={}, user_id={}, 已广播给 {} 个成员", message_id, user_id, members.len());
                } else {
                    tracing::warn!("[消息撤回] 超过2分钟限制: msg_id={}, elapsed={}s", message_id, elapsed.num_seconds());
                }
            }
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
