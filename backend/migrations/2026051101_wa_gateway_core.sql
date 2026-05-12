-- ============================================
-- WA GATEWAY CORE - Phase 1 Implementation
-- Database Schema Extensions for Self-Hosted Gateway
-- 
-- NOTE: Some tables (wa_webhooks, wa_webhook_logs) already exist
-- from migration 2026050501. This migration only creates NEW tables
-- and safely adds columns to existing ones.
-- ============================================

-- ============================================
-- 1. CONTACTS MANAGEMENT (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_contacts (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    profile_pic_url TEXT,
    about TEXT,
    labels TEXT,
    is_blocked BOOLEAN DEFAULT 0,
    is_group BOOLEAN DEFAULT 0,
    group_id TEXT,
    metadata TEXT,
    last_chat_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON wa_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_name ON wa_contacts(name);

-- ============================================
-- 2. MESSAGE HISTORY (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    contact_id TEXT,
    direction TEXT NOT NULL,
    message_type TEXT NOT NULL,
    content TEXT,
    media_url TEXT,
    media_mime_type TEXT,
    media_size INTEGER,
    media_filename TEXT,
    status TEXT,
    wa_message_id TEXT,
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    failed_at DATETIME,
    error_message TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_contact ON wa_messages(contact_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_session ON wa_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_status ON wa_messages(status);
CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_id ON wa_messages(wa_message_id);

-- ============================================
-- 3. MESSAGE TEMPLATES (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    content TEXT NOT NULL,
    variables TEXT,
    media_url TEXT,
    media_type TEXT,
    is_active BOOLEAN DEFAULT 1,
    usage_count INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_category ON wa_templates(category);
CREATE INDEX IF NOT EXISTS idx_wa_templates_active ON wa_templates(is_active);

-- ============================================
-- 4. AUTO-REPLY RULES (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_autoreply_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    trigger_value TEXT NOT NULL,
    response_type TEXT NOT NULL,
    response_content TEXT NOT NULL,
    template_id TEXT,
    is_active BOOLEAN DEFAULT 1,
    cooldown_seconds INTEGER DEFAULT 60,
    match_count INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_autoreply_active ON wa_autoreply_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_wa_autoreply_priority ON wa_autoreply_rules(priority DESC);

-- ============================================
-- 5. SESSION HEALTH MONITORING (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_session_health (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    status TEXT NOT NULL,
    qr_code TEXT,
    qr_expires_at DATETIME,
    last_ping_at DATETIME,
    last_error TEXT,
    restart_count INTEGER DEFAULT 0,
    metrics TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_session_health_status ON wa_session_health(status);
CREATE INDEX IF NOT EXISTS idx_wa_session_health_session ON wa_session_health(session_id);

-- ============================================
-- 6. SKIP wa_webhooks - already exists from 2026050501
-- 7. SKIP wa_webhook_logs - already exists from 2026050501
-- ============================================

-- ============================================
-- 8. MESSAGE QUEUE (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_message_queue (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    message_type TEXT NOT NULL,
    content TEXT,
    media_path TEXT,
    media_url TEXT,
    template_id TEXT,
    template_variables TEXT,
    priority INTEGER DEFAULT 5,
    status TEXT DEFAULT 'queued',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at DATETIME,
    processed_at DATETIME,
    error_message TEXT,
    wa_message_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_queue_status ON wa_message_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_wa_queue_session ON wa_message_queue(session_id, status);
CREATE INDEX IF NOT EXISTS idx_wa_queue_priority ON wa_message_queue(priority DESC, created_at);

-- ============================================
-- 9. API KEYS (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_api_keys (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT NOT NULL,
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT 1,
    last_used_at DATETIME,
    expires_at DATETIME,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wa_api_keys_hash ON wa_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_wa_api_keys_active ON wa_api_keys(is_active);

-- ============================================
-- 10. GATEWAY STATS (NEW TABLE)
-- ============================================

CREATE TABLE IF NOT EXISTS wa_gateway_stats (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_messages_sent INTEGER DEFAULT 0,
    total_messages_received INTEGER DEFAULT 0,
    total_messages_delivered INTEGER DEFAULT 0,
    total_messages_read INTEGER DEFAULT 0,
    total_messages_failed INTEGER DEFAULT 0,
    active_sessions INTEGER DEFAULT 0,
    new_contacts INTEGER DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    webhooks_triggered INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ALTER EXISTING wa_accounts TABLE
-- (credentials, phone_number, status, etc.)
-- ============================================

ALTER TABLE wa_accounts ADD COLUMN credentials TEXT;
ALTER TABLE wa_accounts ADD COLUMN phone_number TEXT;
ALTER TABLE wa_accounts ADD COLUMN status TEXT DEFAULT 'disconnected';
ALTER TABLE wa_accounts ADD COLUMN last_connected_at DATETIME;
ALTER TABLE wa_accounts ADD COLUMN last_error TEXT;
ALTER TABLE wa_accounts ADD COLUMN message_count_today INTEGER DEFAULT 0;
ALTER TABLE wa_accounts ADD COLUMN last_message_at DATETIME;
ALTER TABLE wa_accounts ADD COLUMN metadata TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_accounts_status ON wa_accounts(status);

-- ============================================
-- DEFAULT DATA
-- ============================================

INSERT OR IGNORE INTO wa_autoreply_rules (id, name, trigger_type, trigger_value, response_type, response_content, priority, created_by)
VALUES (
    'default_welcome',
    'Welcome Message',
    'always',
    '*',
    'text',
    'Terima kasih telah menghubungi kami! Tim customer service kami akan segera membalas pesan Anda.',
    0,
    'system'
);

INSERT OR IGNORE INTO wa_templates (id, name, category, content, variables, created_by)
VALUES (
    'sample_order_notification',
    'Order Notification',
    'notification',
    'Halo {{customer_name}}, pesanan Anda #{{order_id}} dengan total {{total_amount}} sedang diproses. Estimasi pengiriman: {{delivery_date}}. Terima kasih!',
    '["customer_name", "order_id", "total_amount", "delivery_date"]',
    'system'
);
