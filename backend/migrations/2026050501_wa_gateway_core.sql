-- Migration: WhatsApp Gateway Core Tables
-- Created: 2026-05-05
-- Purpose: Add webhook management, chatbot rules, API tokens, and enhanced logging for self-hosted WhatsApp gateway

-- Add session and rate limiting columns to wa_accounts
ALTER TABLE wa_accounts ADD COLUMN session_data TEXT;
ALTER TABLE wa_accounts ADD COLUMN hourly_send_count INTEGER DEFAULT 0;
ALTER TABLE wa_accounts ADD COLUMN daily_send_count INTEGER DEFAULT 0;
ALTER TABLE wa_accounts ADD COLUMN last_reset_at TIMESTAMP;

-- Create wa_webhooks table for N8N integration
CREATE TABLE IF NOT EXISTS wa_webhooks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    retry_config TEXT, -- JSON: {max_retries, backoff_multiplier, timeout_ms}
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
);

-- Create wa_chatbot_rules table for auto-reply functionality
CREATE TABLE IF NOT EXISTS wa_chatbot_rules (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    match_mode TEXT NOT NULL, -- exact/contains/starts_with/ends_with/regex
    reply_template TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    cooldown_seconds INTEGER DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
);

-- Create wa_webhook_logs table for webhook delivery tracking
CREATE TABLE IF NOT EXISTS wa_webhook_logs (
    id TEXT PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON
    response_status INTEGER,
    response_body TEXT,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (webhook_id) REFERENCES wa_webhooks(id) ON DELETE CASCADE
);

-- Create wa_bomber_logs table for bomber feature tracking
CREATE TABLE IF NOT EXISTS wa_bomber_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    target_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    repeat_count INTEGER NOT NULL,
    executed_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Create wa_api_tokens table for N8N API authentication
CREATE TABLE IF NOT EXISTS wa_api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    permissions TEXT, -- JSON array: ["wa_send", "wa_webhook_manage", "wa_bomber"]
    expires_at DATETIME,
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create wa_chatbot_logs table for chatbot execution tracking
CREATE TABLE IF NOT EXISTS wa_chatbot_logs (
    id TEXT PRIMARY KEY,
    rule_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    sender_phone TEXT NOT NULL,
    matched_keyword TEXT NOT NULL,
    reply_sent TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES wa_chatbot_rules(id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_wa_webhooks_account 
ON wa_webhooks(account_id);

CREATE INDEX IF NOT EXISTS idx_wa_chatbot_rules_account_priority 
ON wa_chatbot_rules(account_id, priority ASC, enabled);

CREATE INDEX IF NOT EXISTS idx_wa_api_tokens_hash 
ON wa_api_tokens(token_hash);

CREATE INDEX IF NOT EXISTS idx_wa_webhook_logs_created 
ON wa_webhook_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_dispatch_logs_created 
ON wa_dispatch_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_bomber_logs_target_created 
ON wa_bomber_logs(target_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_chatbot_logs_rule_created 
ON wa_chatbot_logs(rule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_chatbot_logs_sender_created 
ON wa_chatbot_logs(sender_phone, created_at DESC);
