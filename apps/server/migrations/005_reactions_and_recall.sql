-- 表情回应表
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_reactions_message ON message_reactions(message_id);

-- 消息撤回字段
ALTER TABLE messages ADD COLUMN IF NOT EXISTS recalled BOOLEAN NOT NULL DEFAULT FALSE;
