-- Create WA Accounts table
CREATE TABLE IF NOT EXISTS wa_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gateway_config TEXT, -- JSON
    enabled BOOLEAN NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create WA Campaigns table
CREATE TABLE IF NOT EXISTS wa_campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    config TEXT -- JSON (delay_ms, jitter_ms, dedupe_days, account_strategy)
);

-- Create WA Recipients table
CREATE TABLE IF NOT EXISTS wa_recipients (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    variables_json TEXT, -- JSON
    status TEXT NOT NULL DEFAULT 'pending', -- pending/sent/skipped/failed
    last_attempt_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create WA Dispatch Logs table
CREATE TABLE IF NOT EXISTS wa_dispatch_logs (
    id TEXT PRIMARY KEY,
    campaign_id TEXT,
    recipient_id TEXT,
    phone TEXT NOT NULL,
    wa_account_id TEXT,
    message_id TEXT,
    status TEXT,
    sent_at DATETIME,
    meta TEXT, -- JSON
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index to speed up dedupe checks
CREATE INDEX IF NOT EXISTS idx_wa_dispatch_logs_phone_sent_at ON wa_dispatch_logs(phone, sent_at);
CREATE INDEX IF NOT EXISTS idx_wa_recipients_campaign_status ON wa_recipients(campaign_id, status);
