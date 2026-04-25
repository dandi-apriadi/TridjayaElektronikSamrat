-- Migration: Add Photo Columns to Agent Registrations
-- Created: 2026-04-25

ALTER TABLE agent_registrations ADD COLUMN profile_photo TEXT;
ALTER TABLE agent_registrations ADD COLUMN ktp_photo TEXT;
