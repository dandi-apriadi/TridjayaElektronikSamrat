-- Migration: Add last login tracking to users
-- Created: 2026-04-25

ALTER TABLE users ADD COLUMN last_login DATETIME;