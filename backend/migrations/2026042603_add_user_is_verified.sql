-- Add is_verified column to users table
ALTER TABLE users ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT 0;
