-- Migration: Add bank account field to users
-- Created: 2026-04-25

ALTER TABLE users ADD COLUMN bank_account TEXT NOT NULL DEFAULT '';