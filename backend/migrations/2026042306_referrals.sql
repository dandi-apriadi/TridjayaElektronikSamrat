-- Migration: Referrals Tracking
-- Created: 2026-04-23

CREATE TABLE IF NOT EXISTS referrals (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    owner_user_id TEXT NOT NULL,
    label TEXT,
    target_path TEXT NOT NULL DEFAULT '/',
    clicks INTEGER NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_owner ON referrals(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_slug ON referrals(slug);
