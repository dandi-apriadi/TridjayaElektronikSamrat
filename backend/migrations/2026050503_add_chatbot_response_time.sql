-- Migration: Add response_time_ms to wa_chatbot_logs
-- Created: 2026-05-05
-- Purpose: Track chatbot auto-reply response time for statistics

ALTER TABLE wa_chatbot_logs ADD COLUMN response_time_ms INTEGER;
