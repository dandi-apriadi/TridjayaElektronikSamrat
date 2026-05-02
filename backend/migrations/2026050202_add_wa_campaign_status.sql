-- Add WA campaign status tracking
ALTER TABLE wa_campaigns ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE wa_campaigns ADD COLUMN started_at DATETIME;
ALTER TABLE wa_campaigns ADD COLUMN completed_at DATETIME;
ALTER TABLE wa_campaigns ADD COLUMN paused_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_wa_campaigns_status_created_at ON wa_campaigns(status, created_at);
