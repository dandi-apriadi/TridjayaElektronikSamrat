-- Migration: Telemetry Events & Analytics

-- Store raw telemetry data stream
CREATE TABLE IF NOT EXISTS telemetry_events (
    id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,          -- 'page_view', 'click', 'whatsapp_click', 'pixel_event'
    path TEXT NOT NULL,                -- The URL path accessed
    source TEXT,                       -- Source of click/visit (e.g., 'Referral Link', 'Promo Page')
    session_id TEXT,                   -- Anonymous tracking session identity
    metadata JSON DEFAULT '{}',        -- Extra args (e.g. element ID clicked, component name)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optimize analytics aggregation by grouping time components
CREATE INDEX IF NOT EXISTS idx_telemetry_event_type ON telemetry_events(event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_created_at ON telemetry_events(created_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_path ON telemetry_events(path);
