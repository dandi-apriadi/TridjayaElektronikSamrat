-- Migration: Add support tickets for agent help center
-- Created: 2026-04-26

CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_agent_created
ON support_tickets(agent_id, created_at DESC);
