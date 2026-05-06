-- Meta Pixel Tracking System: Pixel Events and Conversions Tables Migration
-- Requirements: 5.1, 7.1, 9.1, 17.1, 17.2, 17.3

-- pixel_events table: stores all tracked pixel events
-- ip_address is stored hashed (SHA-256) per Requirements 17.1, 17.4
-- user_data stores hashed email/phone per Requirements 17.2, 17.3
-- event_id is unique for deduplication with Meta per Requirement 7.1
CREATE TABLE pixel_events (
    id TEXT PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    pixel_id TEXT NOT NULL REFERENCES pixels(id),
    campaign_id TEXT REFERENCES campaigns(id),
    user_id TEXT REFERENCES users(id),
    event_type TEXT NOT NULL,
    event_source_url TEXT,
    referrer_url TEXT,
    user_agent TEXT,
    ip_address TEXT,
    fbp TEXT,
    fbc TEXT,
    user_data TEXT NOT NULL DEFAULT '{}',
    custom_data TEXT NOT NULL DEFAULT '{}',
    utm_params TEXT NOT NULL DEFAULT '{}',
    sent_to_meta INTEGER NOT NULL DEFAULT 0,
    meta_event_id TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    event_time DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- conversions table: stores conversion records linked to pixel events and campaigns
-- Requirement 9.1: Purchase events create conversion records
-- Requirement 9.2: Lead events create conversion records
-- Requirement 9.4: Conversions are linked to campaigns via campaign_id
CREATE TABLE conversions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES pixel_events(id),
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    custom_conversion_id TEXT REFERENCES custom_conversions(id),
    conversion_type TEXT NOT NULL,
    conversion_value REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    order_id TEXT,
    custom_data TEXT NOT NULL DEFAULT '{}',
    conversion_time DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for pixel_events table
-- Requirement 18.5: Proper indexing for query performance at scale
CREATE INDEX idx_pixel_events_pixel_id ON pixel_events(pixel_id);
CREATE INDEX idx_pixel_events_campaign_id ON pixel_events(campaign_id);
CREATE INDEX idx_pixel_events_event_id ON pixel_events(event_id);
CREATE INDEX idx_pixel_events_event_time ON pixel_events(event_time);
CREATE INDEX idx_pixel_events_sent_to_meta ON pixel_events(sent_to_meta);
CREATE INDEX idx_pixel_events_fbp ON pixel_events(fbp);

-- Indexes for conversions table
CREATE INDEX idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX idx_conversions_event_id ON conversions(event_id);
