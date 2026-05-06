-- Meta Pixel Tracking System: Analytics and Audit Tables Migration
-- Requirements: 10.1, 10.2, 10.3, 16.1, 16.5

-- pixel_analytics table: stores aggregated analytics per pixel per period
-- Requirement 10.2: Aggregated metrics for total_events, unique_users, page_views, etc.
-- Requirement 10.4: Supports period_types: hourly, daily, weekly, monthly
CREATE TABLE pixel_analytics (
    id TEXT PRIMARY KEY,
    pixel_id TEXT NOT NULL REFERENCES pixels(id),
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_events INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    page_views INTEGER NOT NULL DEFAULT 0,
    add_to_carts INTEGER NOT NULL DEFAULT 0,
    purchases INTEGER NOT NULL DEFAULT 0,
    leads INTEGER NOT NULL DEFAULT 0,
    total_revenue REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    metrics TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pixel_id, period_type, period_start)
);

-- campaign_analytics table: stores aggregated analytics per campaign per period
-- Requirement 10.3: Aggregated metrics for conversions, conversion_rate, total_revenue, ROAS
-- Requirement 10.7: conversion_rate = conversions / total_events
CREATE TABLE campaign_analytics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id),
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_events INTEGER NOT NULL DEFAULT 0,
    unique_users INTEGER NOT NULL DEFAULT 0,
    conversions INTEGER NOT NULL DEFAULT 0,
    conversion_rate REAL NOT NULL DEFAULT 0,
    total_revenue REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    cost_per_conversion REAL,
    roas REAL,
    metrics TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (campaign_id, period_type, period_start)
);

-- pixel_audit_logs table: immutable audit trail for all system actions
-- Requirement 16.1: Logs pixel create/update/delete with action_type, resource_type, resource_id, old_value, new_value, user_id, ip_address, user_agent
-- Requirement 16.5: Immutable records — no updates or deletes
-- user_id is NULLABLE to support system-initiated actions (no authenticated user)
CREATE TABLE pixel_audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action_type TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for pixel_analytics table
-- Requirement 18.5: Proper indexing for query performance at scale
CREATE INDEX idx_pixel_analytics_pixel_period ON pixel_analytics(pixel_id, period_type, period_start);

-- Indexes for campaign_analytics table
CREATE INDEX idx_campaign_analytics_campaign_period ON campaign_analytics(campaign_id, period_type, period_start);

-- Indexes for pixel_audit_logs table
-- Requirement 16.6: Support filtering by user_id, resource_type, resource_id, and date range
CREATE INDEX idx_pixel_audit_logs_user_id ON pixel_audit_logs(user_id);
CREATE INDEX idx_pixel_audit_logs_resource ON pixel_audit_logs(resource_type, resource_id);
CREATE INDEX idx_pixel_audit_logs_created_at ON pixel_audit_logs(created_at);
