-- Meta Pixel Tracking System: Core Tables Migration
-- Requirements: 1.1, 1.2, 2.1, 3.1, 4.1

-- pixels table: stores master Meta Pixels managed by Super Admins
-- access_token is stored encrypted (AES-256-GCM) per Requirement 1.3 / 17.7
CREATE TABLE pixels (
    id TEXT PRIMARY KEY,
    pixel_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    business_manager_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    access_token TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    config TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- pixel_admins table: maps admins to pixels with role-based permissions
-- Requirement 2.1: Super Admin assigns admins to pixels
-- Requirement 2.6: Prevent duplicate admin assignments
CREATE TABLE pixel_admins (
    id TEXT PRIMARY KEY,
    pixel_id TEXT NOT NULL REFERENCES pixels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT NOT NULL DEFAULT '{}',
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by TEXT NOT NULL REFERENCES users(id),
    UNIQUE (pixel_id, user_id)
);

-- campaigns table: marketing campaigns with UTM attribution parameters
-- Requirement 3.1: Admins create campaigns with UTM parameters
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    campaign_id TEXT UNIQUE NOT NULL,
    pixel_id TEXT NOT NULL REFERENCES pixels(id) ON DELETE CASCADE,
    admin_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    utm_admin TEXT,
    utm_content TEXT,
    utm_term TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- custom_conversions table: conversion rules defined by admins per campaign
-- Requirement 4.1: Admins define custom conversions with rules and values
CREATE TABLE custom_conversions (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    event_type TEXT NOT NULL,
    rules TEXT NOT NULL DEFAULT '{}',
    conversion_value REAL NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for pixels table
CREATE INDEX idx_pixels_pixel_id ON pixels(pixel_id);

-- Indexes for pixel_admins table
CREATE INDEX idx_pixel_admins_pixel_id ON pixel_admins(pixel_id);
CREATE INDEX idx_pixel_admins_user_id ON pixel_admins(user_id);

-- Indexes for campaigns table
CREATE INDEX idx_campaigns_pixel_id ON campaigns(pixel_id);
CREATE INDEX idx_campaigns_admin_id ON campaigns(admin_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
