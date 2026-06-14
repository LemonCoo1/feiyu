-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    -- 通知设置
    notify_message BOOLEAN NOT NULL DEFAULT true,
    notify_sound BOOLEAN NOT NULL DEFAULT true,
    notify_desktop BOOLEAN NOT NULL DEFAULT true,
    notify_dnd BOOLEAN NOT NULL DEFAULT false,
    notify_dnd_start TIME,
    notify_dnd_end TIME,
    -- 隐私设置
    privacy_add_me VARCHAR(20) NOT NULL DEFAULT 'everyone',
    privacy_online_visible BOOLEAN NOT NULL DEFAULT true,
    privacy_read_receipt BOOLEAN NOT NULL DEFAULT true,
    -- 聊天设置
    chat_send_key VARCHAR(20) NOT NULL DEFAULT 'enter',
    chat_font_size VARCHAR(20) NOT NULL DEFAULT 'medium',
    -- 外观
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    -- 语言
    language VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
    -- 两步验证
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
