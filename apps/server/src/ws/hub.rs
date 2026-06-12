use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

#[derive(Clone)]
pub struct Hub {
    /// user_id -> broadcast sender
    user_channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<String>>>>,
    /// conversation_id -> set of user_ids
    conversation_members: Arc<RwLock<HashMap<Uuid, Vec<Uuid>>>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            user_channels: Arc::new(RwLock::new(HashMap::new())),
            conversation_members: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn connect(&self, user_id: Uuid) -> broadcast::Receiver<String> {
        let mut channels = self.user_channels.write().await;
        if let Some(tx) = channels.get(&user_id) {
            return tx.subscribe();
        }
        let (tx, rx) = broadcast::channel(256);
        channels.insert(user_id, tx);
        rx
    }

    pub async fn disconnect(&self, user_id: &Uuid) {
        let mut channels = self.user_channels.write().await;
        channels.remove(user_id);
    }

    pub async fn send_to_user(&self, user_id: &Uuid, msg: &str) {
        let channels = self.user_channels.read().await;
        if let Some(tx) = channels.get(user_id) {
            let _ = tx.send(msg.to_string());
        }
    }

    pub async fn send_to_conversation(&self, conversation_id: &Uuid, sender_id: &Uuid, msg: &str) {
        let members = self.conversation_members.read().await;
        if let Some(user_ids) = members.get(conversation_id) {
            for uid in user_ids {
                if uid != sender_id {
                    self.send_to_user(uid, msg).await;
                }
            }
        }
    }

    pub async fn register_conversation(&self, conversation_id: Uuid, user_ids: Vec<Uuid>) {
        let mut members = self.conversation_members.write().await;
        members.insert(conversation_id, user_ids);
    }
}
