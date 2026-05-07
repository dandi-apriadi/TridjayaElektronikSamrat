-- Add sent_at column to wa_recipients for tracking when message was sent
ALTER TABLE wa_recipients ADD COLUMN sent_at DATETIME;

-- Create wa_campaign_metrics table for hourly aggregated metrics
CREATE TABLE IF NOT EXISTS wa_campaign_metrics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    hour_timestamp DATETIME NOT NULL, -- Start of the hour (e.g., 2024-05-05 14:00:00)
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_delivered INTEGER NOT NULL DEFAULT 0,
    total_read INTEGER NOT NULL DEFAULT 0,
    total_replied INTEGER NOT NULL DEFAULT 0,
    delivered_rate REAL, -- Percentage (0-100)
    read_rate REAL, -- Percentage (0-100)
    reply_rate REAL, -- Percentage (0-100)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
);

-- Index for efficient campaign metrics queries
CREATE INDEX IF NOT EXISTS idx_wa_campaign_metrics_campaign_hour 
    ON wa_campaign_metrics(campaign_id, hour_timestamp);

-- Index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_wa_campaign_metrics_hour 
    ON wa_campaign_metrics(hour_timestamp);
