-- Migration: Agent & Reward System
-- Created: 2026-04-23

-- Agent Registration Submissions
CREATE TABLE IF NOT EXISTS agent_registrations (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    province TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT,
    preferred_products TEXT, -- Store as JSON array string
    status TEXT NOT NULL DEFAULT 'pending', -- pending, reviewed, approved, rejected
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reward Tiers Configuration
CREATE TABLE IF NOT EXISTS reward_tiers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    threshold_points INTEGER NOT NULL,
    icon TEXT,
    color TEXT,
    benefits TEXT, -- Store as JSON array string
    is_active BOOLEAN DEFAULT 1
);

-- Agent Performance Stats
-- Linked to users.id where role = 'Agent'
CREATE TABLE IF NOT EXISTS agent_stats (
    user_id TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    monthly_growth REAL DEFAULT 0.0,
    current_tier_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(current_tier_id) REFERENCES reward_tiers(id)
);

-- Master Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT
);

-- Agent Achievements mapping
CREATE TABLE IF NOT EXISTS agent_achievements (
    agent_id TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, achievement_id),
    FOREIGN KEY(agent_id) REFERENCES users(id),
    FOREIGN KEY(achievement_id) REFERENCES achievements(id)
);

-- Reward Claims Tracking
CREATE TABLE IF NOT EXISTS reward_claims (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    tier_id TEXT NOT NULL,
    reward_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, cancelled
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY(agent_id) REFERENCES users(id),
    FOREIGN KEY(tier_id) REFERENCES reward_tiers(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_stats_points ON agent_stats(points DESC);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON agent_registrations(email);
