use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsClientMessage {
    #[serde(rename = "auth.token")]
    AuthToken { token: String },

    #[serde(rename = "message.send")]
    MessageSend {
        conversation_id: Uuid,
        content_type: String,
        content: serde_json::Value,
        client_msg_id: String,
    },

    #[serde(rename = "message.read")]
    MessageRead {
        conversation_id: Uuid,
        message_id: Uuid,
    },

    #[serde(rename = "typing.start")]
    TypingStart { conversation_id: Uuid },

    #[serde(rename = "typing.stop")]
    TypingStop { conversation_id: Uuid },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsServerMessage {
    #[serde(rename = "auth.ok")]
    AuthOk { user_id: Uuid },

    #[serde(rename = "auth.error")]
    AuthError { message: String },

    #[serde(rename = "message.deliver")]
    MessageDeliver {
        message: crate::models::message::Message,
        conversation_id: Uuid,
    },

    #[serde(rename = "message.ack")]
    MessageAck {
        client_msg_id: String,
        server_msg_id: Uuid,
        conversation_id: Uuid,
    },

    #[serde(rename = "presence.update")]
    PresenceUpdate {
        user_id: Uuid,
        status: String,
    },

    #[serde(rename = "typing.start")]
    TypingStart {
        user_id: Uuid,
        conversation_id: Uuid,
    },

    #[serde(rename = "typing.stop")]
    TypingStop {
        user_id: Uuid,
        conversation_id: Uuid,
    },
}
