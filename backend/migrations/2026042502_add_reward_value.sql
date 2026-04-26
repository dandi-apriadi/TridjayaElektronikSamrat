-- Migration: Add reward value for tier-based claim payouts
-- Created: 2026-04-25

ALTER TABLE reward_tiers ADD COLUMN reward_value INTEGER NOT NULL DEFAULT 250000;

UPDATE reward_tiers
SET reward_value = CASE id
    WHEN 'silver' THEN 650000
    WHEN 'gold' THEN 1200000
    WHEN 'diamond' THEN 2400000
    ELSE reward_value
END;