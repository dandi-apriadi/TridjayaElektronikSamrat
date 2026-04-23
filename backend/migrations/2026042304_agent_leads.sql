-- Migration: Agent Leads (Prospek)
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    interested_product TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Follow Up', -- Follow Up, Negosiasi, Closed Won, Closed Lost
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(agent_id) REFERENCES users(id)
);
