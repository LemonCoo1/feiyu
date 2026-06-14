-- 群聊群主与管理权限
-- conversations 表新增 owner_id
ALTER TABLE conversations ADD COLUMN owner_id UUID REFERENCES users(id);

-- conversation_members 表新增 role（参考 channel_members 的 role 模式）
ALTER TABLE conversation_members ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'member';

-- 为已有群聊回填 owner_id（取第一个加入的成员）
UPDATE conversations SET owner_id = (
    SELECT user_id FROM conversation_members
    WHERE conversation_id = conversations.id
    ORDER BY joined_at ASC LIMIT 1
) WHERE type = 'group';

-- 为已有群聊的 owner 回填 role
UPDATE conversation_members SET role = 'owner'
WHERE (conversation_id, user_id) IN (
    SELECT id, owner_id FROM conversations WHERE type = 'group' AND owner_id IS NOT NULL
);
