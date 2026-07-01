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

    #[serde(rename = "channel.message.send")]
    ChannelMessageSend {
        channel_id: Uuid,
        content_type: String,
        content: serde_json::Value,
        parent_message_id: Option<Uuid>,
        client_msg_id: String,
    },

    #[serde(rename = "typing.start")]
    TypingStart { conversation_id: Uuid },

    #[serde(rename = "typing.stop")]
    TypingStop { conversation_id: Uuid },

    #[serde(rename = "ping")]
    Ping,

    #[serde(rename = "reaction.add")]
    ReactionAdd {
        message_id: Uuid,
        emoji: String,
    },

    #[serde(rename = "reaction.remove")]
    ReactionRemove {
        message_id: Uuid,
        emoji: String,
    },

    #[serde(rename = "message.recall")]
    MessageRecall { message_id: Uuid },
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

    #[serde(rename = "channel.message.deliver")]
    ChannelMessageDeliver {
        message: crate::models::channel::ChannelMessage,
        channel_id: Uuid,
    },

    #[serde(rename = "channel.message.ack")]
    ChannelMessageAck {
        client_msg_id: String,
        server_msg_id: Uuid,
        channel_id: Uuid,
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

    #[serde(rename = "message.read")]
    MessageReadNotify {
        user_id: Uuid,
        conversation_id: Uuid,
        message_id: Uuid,
    },

    #[serde(rename = "pong")]
    Pong,

    #[serde(rename = "reaction.update")]
    ReactionUpdate {
        message_id: Uuid,
        user_id: Uuid,
        emoji: String,
        action: String,
    },

    #[serde(rename = "conversation.created")]
    ConversationCreated {
        conversation: crate::models::conversation::ConversationWithMeta,
    },

    #[serde(rename = "message.recalled")]
    MessageRecalled {
        message_id: Uuid,
        conversation_id: Uuid,
        user_id: Uuid,
    },
}
