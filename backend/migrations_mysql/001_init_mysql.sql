-- Unified MySQL 8 schema for Tridjaya backend.
-- This replaces the incremental SQLite migrations in backend/migrations.

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar VARCHAR(1024) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    bank_account VARCHAR(255) NOT NULL DEFAULT '',
    last_login DATETIME NULL,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp VARCHAR(64) NOT NULL DEFAULT '',
    referral_slug VARCHAR(255) NOT NULL DEFAULT '',
    jabatan VARCHAR(255) NOT NULL DEFAULT '',
    INDEX idx_users_referral_slug (referral_slug),
    INDEX idx_users_whatsapp (whatsapp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    subcategory VARCHAR(255) NULL,
    price DECIMAL(15,2) NOT NULL,
    price_installment DECIMAL(15,2) NULL,
    dp_min DECIMAL(15,2) NULL,
    image VARCHAR(2048) NOT NULL,
    images LONGTEXT NULL,
    badge VARCHAR(255) NULL,
    badge_text VARCHAR(255) NULL,
    short_desc TEXT NULL,
    description LONGTEXT NULL,
    specs LONGTEXT NULL,
    stock VARCHAR(64) DEFAULT 'available',
    colors LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    highlights LONGTEXT NULL,
    selling_points LONGTEXT NULL,
    objections LONGTEXT NULL,
    rating DOUBLE NULL,
    review TEXT NULL,
    ratings LONGTEXT NULL,
    stock_quantity DOUBLE NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promos (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255) NULL,
    description TEXT NULL,
    discount INT NULL,
    original_price DOUBLE NULL,
    promo_price DOUBLE NULL,
    image VARCHAR(2048) NOT NULL,
    badge VARCHAR(255) NULL,
    valid_until VARCHAR(64) NULL,
    category VARCHAR(255) NULL,
    variant VARCHAR(255) NULL,
    product_ids LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blog_posts (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    excerpt TEXT NULL,
    content LONGTEXT NULL,
    author VARCHAR(255) NULL,
    author_role VARCHAR(255) NULL,
    author_image VARCHAR(2048) NULL,
    hero_image VARCHAR(2048) NULL,
    category VARCHAR(255) NULL,
    tags LONGTEXT NULL,
    published_at VARCHAR(64) NULL,
    read_time INT NULL,
    featured BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_listings (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    department VARCHAR(255) NULL,
    location VARCHAR(255) NULL,
    type VARCHAR(255) NULL,
    level VARCHAR(255) NULL,
    description LONGTEXT NULL,
    requirements LONGTEXT NULL,
    benefits LONGTEXT NULL,
    posted_at VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    deadline VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_registrations (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(64) NOT NULL,
    province VARCHAR(255) NOT NULL,
    city VARCHAR(255) NOT NULL,
    address TEXT NULL,
    preferred_products LONGTEXT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    profile_photo VARCHAR(2048) NULL,
    ktp_photo VARCHAR(2048) NULL,
    INDEX idx_registrations_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reward_tiers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    threshold_points INT NOT NULL,
    icon VARCHAR(255) NULL,
    color VARCHAR(64) NULL,
    benefits LONGTEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    reward_value INT NOT NULL DEFAULT 250000
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_stats (
    user_id VARCHAR(64) PRIMARY KEY,
    points INT DEFAULT 0,
    sales_count INT DEFAULT 0,
    monthly_growth DOUBLE DEFAULT 0,
    current_tier_id VARCHAR(64) NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_agent_stats_points (points DESC),
    CONSTRAINT fk_agent_stats_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_stats_tier FOREIGN KEY (current_tier_id) REFERENCES reward_tiers(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS achievements (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    icon VARCHAR(255) NULL,
    color VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_achievements (
    agent_id VARCHAR(64) NOT NULL,
    achievement_id VARCHAR(64) NOT NULL,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (agent_id, achievement_id),
    CONSTRAINT fk_agent_achievements_agent FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_agent_achievements_achievement FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reward_claims (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    tier_id VARCHAR(64) NOT NULL,
    reward_name VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    CONSTRAINT fk_reward_claims_agent FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_reward_claims_tier FOREIGN KEY (tier_id) REFERENCES reward_tiers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_content (
    id VARCHAR(64) PRIMARY KEY,
    page VARCHAR(255) NOT NULL,
    section VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(64) NOT NULL,
    interested_product VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'Follow Up',
    notes TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_leads_agent FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS telemetry_events (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(255) NOT NULL,
    path VARCHAR(2048) NOT NULL,
    source VARCHAR(255) NULL,
    session_id VARCHAR(255) NULL,
    metadata LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_telemetry_event_type (event_type),
    INDEX idx_telemetry_created_at (created_at),
    INDEX idx_telemetry_path (path(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
    id VARCHAR(64) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    owner_user_id VARCHAR(64) NOT NULL,
    label VARCHAR(255) NULL,
    target_path VARCHAR(2048) NOT NULL DEFAULT '/',
    clicks INT NOT NULL DEFAULT 0,
    leads INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_referrals_owner (owner_user_id),
    INDEX idx_referrals_slug (slug),
    CONSTRAINT fk_referrals_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS partners (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(2048) NOT NULL,
    website_url VARCHAR(2048) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_partners_active_order (is_active, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    recipient_user_id VARCHAR(64) NOT NULL,
    type VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NULL,
    action_path VARCHAR(2048) NULL,
    entity_id VARCHAR(64) NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at DATETIME NULL,
    INDEX idx_notifications_recipient_created (recipient_user_id, created_at DESC),
    INDEX idx_notifications_recipient_unread (recipient_user_id, is_read, created_at DESC),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_tokens_user (user_id),
    CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    token VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email_verification_tokens_user (user_id),
    CONSTRAINT fk_email_verification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_categories (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_applications (
    id VARCHAR(64) PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    job_title VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    address TEXT NULL,
    education VARCHAR(255) NULL,
    major VARCHAR(255) NULL,
    experience TEXT NULL,
    cover_letter TEXT NULL,
    linked_in VARCHAR(2048) NULL,
    portfolio_url VARCHAR(2048) NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    applied_at VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_job_applications_job FOREIGN KEY (job_id) REFERENCES job_listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_delivery_schedules (
    id VARCHAR(64) PRIMARY KEY,
    sales_user_id VARCHAR(64) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    payment_status VARCHAR(64) NOT NULL,
    address TEXT NOT NULL,
    sales_name VARCHAR(255) NOT NULL,
    sender_branch VARCHAR(255) NOT NULL,
    referral_slug VARCHAR(255) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sales_delivery_schedules_sales_user (sales_user_id),
    INDEX idx_sales_delivery_schedules_created_at (created_at),
    INDEX idx_sales_delivery_schedules_referral_slug (referral_slug),
    CONSTRAINT fk_sales_delivery_user FOREIGN KEY (sales_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_targets (
    id VARCHAR(64) PRIMARY KEY,
    sales_user_id VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    target_units INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_targets_user FOREIGN KEY (sales_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_performance (
    id VARCHAR(64) PRIMARY KEY,
    sales_user_id VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    sales_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    sales_units INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_sales_performance_user FOREIGN KEY (sales_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_accounts (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    gateway_config LONGTEXT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    session_data LONGTEXT NULL,
    hourly_send_count INT DEFAULT 0,
    daily_send_count INT DEFAULT 0,
    last_reset_at DATETIME NULL,
    credentials LONGTEXT NULL,
    phone_number VARCHAR(64) NULL,
    phone VARCHAR(64) NULL,
    status VARCHAR(64) DEFAULT 'disconnected',
    last_connected_at DATETIME NULL,
    last_error TEXT NULL,
    message_count_today INT DEFAULT 0,
    last_message_at DATETIME NULL,
    metadata LONGTEXT NULL,
    user_id VARCHAR(64) NULL,
    INDEX idx_wa_accounts_status (status),
    INDEX idx_wa_accounts_created_by (created_by),
    INDEX idx_wa_accounts_user_id (user_id),
    CONSTRAINT fk_wa_accounts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_campaigns (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    config LONGTEXT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'draft',
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    paused_at DATETIME NULL,
    INDEX idx_wa_campaigns_status_created_at (status, created_at),
    CONSTRAINT fk_wa_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_recipients (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    variables_json LONGTEXT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'pending',
    last_attempt_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME NULL,
    read_at DATETIME NULL,
    replied_at DATETIME NULL,
    last_error TEXT NULL,
    lead_id VARCHAR(64) NULL,
    sent_at DATETIME NULL,
    INDEX idx_wa_recipients_campaign_status (campaign_id, status),
    CONSTRAINT fk_wa_recipients_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_dispatch_logs (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NULL,
    recipient_id VARCHAR(64) NULL,
    phone VARCHAR(64) NOT NULL,
    wa_account_id VARCHAR(64) NULL,
    message_id VARCHAR(255) NULL,
    status VARCHAR(64) NULL,
    sent_at DATETIME NULL,
    meta LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_dispatch_logs_phone_sent_at (phone, sent_at),
    INDEX idx_wa_dispatch_logs_created (created_at DESC),
    CONSTRAINT fk_wa_dispatch_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_dispatch_recipient FOREIGN KEY (recipient_id) REFERENCES wa_recipients(id) ON DELETE SET NULL,
    CONSTRAINT fk_wa_dispatch_account FOREIGN KEY (wa_account_id) REFERENCES wa_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_webhooks (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    webhook_url VARCHAR(2048) NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    retry_config LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    INDEX idx_wa_webhooks_account (account_id),
    CONSTRAINT fk_wa_webhooks_account FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_chatbot_rules (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    match_mode VARCHAR(64) NOT NULL,
    reply_template TEXT NOT NULL,
    priority INT NOT NULL DEFAULT 100,
    cooldown_seconds INT DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    INDEX idx_wa_chatbot_rules_account_priority (account_id, priority ASC, enabled),
    CONSTRAINT fk_wa_chatbot_rules_account FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_webhook_logs (
    id VARCHAR(64) PRIMARY KEY,
    webhook_id VARCHAR(64) NOT NULL,
    payload LONGTEXT NOT NULL,
    response_status INT NULL,
    response_body TEXT NULL,
    attempt_number INT NOT NULL DEFAULT 1,
    error_message TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_webhook_logs_created (created_at DESC),
    CONSTRAINT fk_wa_webhook_logs_webhook FOREIGN KEY (webhook_id) REFERENCES wa_webhooks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_bomber_logs (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    target_phone VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    repeat_count INT NOT NULL,
    executed_by VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_bomber_logs_target_created (target_phone, created_at DESC),
    CONSTRAINT fk_wa_bomber_account FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_bomber_user FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_api_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    permissions LONGTEXT NULL,
    expires_at DATETIME NULL,
    last_used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    token_prefix VARCHAR(64) NULL,
    INDEX idx_wa_api_tokens_hash (token_hash),
    INDEX idx_wa_api_tokens_prefix (token_prefix),
    CONSTRAINT fk_wa_api_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_chatbot_logs (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    account_id VARCHAR(64) NOT NULL,
    sender_phone VARCHAR(64) NOT NULL,
    matched_keyword VARCHAR(255) NOT NULL,
    reply_sent TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INT NULL,
    INDEX idx_wa_chatbot_logs_rule_created (rule_id, created_at DESC),
    INDEX idx_wa_chatbot_logs_sender_created (sender_phone, created_at DESC),
    CONSTRAINT fk_wa_chatbot_logs_rule FOREIGN KEY (rule_id) REFERENCES wa_chatbot_rules(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_chatbot_logs_account FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_contacts (
    id VARCHAR(64) PRIMARY KEY,
    phone VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NULL,
    profile_pic_url VARCHAR(2048) NULL,
    about TEXT NULL,
    labels LONGTEXT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    is_group BOOLEAN DEFAULT FALSE,
    group_id VARCHAR(64) NULL,
    metadata LONGTEXT NULL,
    last_chat_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wa_contacts_phone (phone),
    INDEX idx_wa_contacts_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_messages (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    contact_id VARCHAR(64) NULL,
    direction VARCHAR(64) NOT NULL,
    message_type VARCHAR(64) NOT NULL,
    content LONGTEXT NULL,
    media_url VARCHAR(2048) NULL,
    media_mime_type VARCHAR(255) NULL,
    media_size BIGINT NULL,
    media_filename VARCHAR(255) NULL,
    status VARCHAR(64) NULL,
    wa_message_id VARCHAR(255) NULL,
    sent_at DATETIME NULL,
    delivered_at DATETIME NULL,
    read_at DATETIME NULL,
    failed_at DATETIME NULL,
    error_message TEXT NULL,
    metadata LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_messages_contact (contact_id, created_at),
    INDEX idx_wa_messages_session (session_id, created_at),
    INDEX idx_wa_messages_status (status),
    INDEX idx_wa_messages_wa_id (wa_message_id),
    CONSTRAINT fk_wa_messages_session FOREIGN KEY (session_id) REFERENCES wa_accounts(id) ON DELETE CASCADE,
    CONSTRAINT fk_wa_messages_contact FOREIGN KEY (contact_id) REFERENCES wa_contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255) NULL,
    content TEXT NOT NULL,
    variables LONGTEXT NULL,
    media_url VARCHAR(2048) NULL,
    media_type VARCHAR(64) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    usage_count INT DEFAULT 0,
    created_by VARCHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wa_templates_category (category),
    INDEX idx_wa_templates_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_autoreply_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(64) NOT NULL,
    trigger_value VARCHAR(255) NOT NULL,
    response_type VARCHAR(64) NOT NULL,
    response_content TEXT NOT NULL,
    template_id VARCHAR(64) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    cooldown_seconds INT DEFAULT 60,
    match_count INT DEFAULT 0,
    priority INT DEFAULT 0,
    created_by VARCHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wa_autoreply_active (is_active),
    INDEX idx_wa_autoreply_priority (priority DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_session_health (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    status VARCHAR(64) NOT NULL,
    qr_code LONGTEXT NULL,
    qr_expires_at DATETIME NULL,
    last_ping_at DATETIME NULL,
    last_error TEXT NULL,
    restart_count INT DEFAULT 0,
    metrics LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_wa_session_health_status (status),
    INDEX idx_wa_session_health_session (session_id),
    CONSTRAINT fk_wa_session_health_session FOREIGN KEY (session_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_message_queue (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    message_type VARCHAR(64) NOT NULL,
    content LONGTEXT NULL,
    media_path VARCHAR(2048) NULL,
    media_url VARCHAR(2048) NULL,
    template_id VARCHAR(64) NULL,
    template_variables LONGTEXT NULL,
    priority INT DEFAULT 5,
    status VARCHAR(64) DEFAULT 'queued',
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    scheduled_at DATETIME NULL,
    processed_at DATETIME NULL,
    error_message TEXT NULL,
    wa_message_id VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_queue_status (status, scheduled_at),
    INDEX idx_wa_queue_session (session_id, status),
    INDEX idx_wa_queue_priority (priority DESC, created_at),
    CONSTRAINT fk_wa_queue_session FOREIGN KEY (session_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_api_keys (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    permissions LONGTEXT NOT NULL,
    rate_limit INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at DATETIME NULL,
    expires_at DATETIME NULL,
    created_by VARCHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wa_api_keys_hash (key_hash),
    INDEX idx_wa_api_keys_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_gateway_stats (
    id VARCHAR(64) PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    total_messages_sent INT DEFAULT 0,
    total_messages_received INT DEFAULT 0,
    total_messages_delivered INT DEFAULT 0,
    total_messages_read INT DEFAULT 0,
    total_messages_failed INT DEFAULT 0,
    active_sessions INT DEFAULT 0,
    new_contacts INT DEFAULT 0,
    api_calls INT DEFAULT 0,
    webhooks_triggered INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_campaign_metrics (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL,
    hour_timestamp DATETIME NOT NULL,
    total_sent INT NOT NULL DEFAULT 0,
    total_delivered INT NOT NULL DEFAULT 0,
    total_read INT NOT NULL DEFAULT 0,
    total_replied INT NOT NULL DEFAULT 0,
    delivered_rate DOUBLE NULL,
    read_rate DOUBLE NULL,
    reply_rate DOUBLE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_campaign_metrics_campaign_hour (campaign_id, hour_timestamp),
    INDEX idx_wa_campaign_metrics_hour (hour_timestamp),
    CONSTRAINT fk_wa_campaign_metrics_campaign FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wa_blast_contacts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL DEFAULT '',
    labels TEXT NULL,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_blast_contacts_user_phone (user_id, phone),
    INDEX idx_wa_blast_contacts_user_id (user_id),
    INDEX idx_wa_blast_contacts_phone (phone),
    INDEX idx_wa_blast_contacts_name (name),
    CONSTRAINT fk_wa_blast_contacts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixels (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    business_manager_id VARCHAR(255) NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'active',
    access_token TEXT NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    config LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pixels_pixel_id (pixel_id),
    CONSTRAINT fk_pixels_created_by FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_admins (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    permissions LONGTEXT NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by VARCHAR(64) NOT NULL,
    UNIQUE KEY uq_pixel_admins_pixel_user (pixel_id, user_id),
    INDEX idx_pixel_admins_pixel_id (pixel_id),
    INDEX idx_pixel_admins_user_id (user_id),
    CONSTRAINT fk_pixel_admins_pixel FOREIGN KEY (pixel_id) REFERENCES pixels(id) ON DELETE CASCADE,
    CONSTRAINT fk_pixel_admins_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pixel_admins_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(255) UNIQUE NOT NULL,
    pixel_id VARCHAR(64) NOT NULL,
    admin_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(64) NOT NULL DEFAULT 'active',
    utm_source VARCHAR(255) NULL,
    utm_medium VARCHAR(255) NULL,
    utm_campaign VARCHAR(255) NULL,
    utm_admin VARCHAR(255) NULL,
    utm_content VARCHAR(255) NULL,
    utm_term VARCHAR(255) NULL,
    config LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_campaigns_pixel_id (pixel_id),
    INDEX idx_campaigns_admin_id (admin_id),
    INDEX idx_campaigns_status (status),
    CONSTRAINT fk_campaigns_pixel FOREIGN KEY (pixel_id) REFERENCES pixels(id) ON DELETE CASCADE,
    CONSTRAINT fk_campaigns_admin FOREIGN KEY (admin_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_conversions (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    rules LONGTEXT NOT NULL,
    conversion_value DOUBLE NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_custom_conversions_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_events (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    pixel_id VARCHAR(64) NOT NULL,
    campaign_id VARCHAR(64) NULL,
    user_id VARCHAR(64) NULL,
    event_type VARCHAR(255) NOT NULL,
    event_source_url VARCHAR(2048) NULL,
    referrer_url VARCHAR(2048) NULL,
    user_agent TEXT NULL,
    ip_address VARCHAR(255) NULL,
    fbp VARCHAR(255) NULL,
    fbc VARCHAR(255) NULL,
    user_data LONGTEXT NOT NULL,
    custom_data LONGTEXT NOT NULL,
    utm_params LONGTEXT NOT NULL,
    sent_to_meta BOOLEAN NOT NULL DEFAULT FALSE,
    meta_event_id VARCHAR(255) NULL,
    retry_count INT NOT NULL DEFAULT 0,
    error_message TEXT NULL,
    event_time DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pixel_events_pixel_id (pixel_id),
    INDEX idx_pixel_events_campaign_id (campaign_id),
    INDEX idx_pixel_events_event_id (event_id),
    INDEX idx_pixel_events_event_time (event_time),
    INDEX idx_pixel_events_sent_to_meta (sent_to_meta),
    INDEX idx_pixel_events_fbp (fbp),
    CONSTRAINT fk_pixel_events_pixel FOREIGN KEY (pixel_id) REFERENCES pixels(id),
    CONSTRAINT fk_pixel_events_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_pixel_events_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS conversions (
    id VARCHAR(64) PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL,
    campaign_id VARCHAR(64) NOT NULL,
    custom_conversion_id VARCHAR(64) NULL,
    conversion_type VARCHAR(255) NOT NULL,
    conversion_value DOUBLE NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    order_id VARCHAR(255) NULL,
    custom_data LONGTEXT NOT NULL,
    conversion_time DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_conversions_campaign_id (campaign_id),
    INDEX idx_conversions_event_id (event_id),
    CONSTRAINT fk_conversions_event FOREIGN KEY (event_id) REFERENCES pixel_events(id),
    CONSTRAINT fk_conversions_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    CONSTRAINT fk_conversions_custom FOREIGN KEY (custom_conversion_id) REFERENCES custom_conversions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_analytics (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NOT NULL,
    period_type VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_events INT NOT NULL DEFAULT 0,
    unique_users INT NOT NULL DEFAULT 0,
    page_views INT NOT NULL DEFAULT 0,
    add_to_carts INT NOT NULL DEFAULT 0,
    purchases INT NOT NULL DEFAULT 0,
    leads INT NOT NULL DEFAULT 0,
    total_revenue DOUBLE NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    metrics LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pixel_analytics_pixel_period (pixel_id, period_type, period_start),
    INDEX idx_pixel_analytics_pixel_period (pixel_id, period_type, period_start),
    CONSTRAINT fk_pixel_analytics_pixel FOREIGN KEY (pixel_id) REFERENCES pixels(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS campaign_analytics (
    id VARCHAR(64) PRIMARY KEY,
    campaign_id VARCHAR(64) NOT NULL,
    period_type VARCHAR(64) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_events INT NOT NULL DEFAULT 0,
    unique_users INT NOT NULL DEFAULT 0,
    conversions INT NOT NULL DEFAULT 0,
    conversion_rate DOUBLE NOT NULL DEFAULT 0,
    total_revenue DOUBLE NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    cost_per_conversion DOUBLE NULL,
    roas DOUBLE NULL,
    metrics LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_campaign_analytics_campaign_period (campaign_id, period_type, period_start),
    INDEX idx_campaign_analytics_campaign_period (campaign_id, period_type, period_start),
    CONSTRAINT fk_campaign_analytics_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NULL,
    action_type VARCHAR(255) NOT NULL,
    resource_type VARCHAR(255) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    old_value LONGTEXT NULL,
    new_value LONGTEXT NULL,
    ip_address VARCHAR(255) NULL,
    user_agent TEXT NULL,
    metadata LONGTEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pixel_audit_logs_user_id (user_id),
    INDEX idx_pixel_audit_logs_resource (resource_type, resource_id),
    INDEX idx_pixel_audit_logs_created_at (created_at),
    CONSTRAINT fk_pixel_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_campaigns (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    pixel_id VARCHAR(64) NULL,
    config LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_trackers (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    config LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_goals (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NULL,
    name VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    config LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_daily_stats (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NULL,
    stat_date DATE NOT NULL,
    metrics LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pixel_daily_stats_pixel_date (pixel_id, stat_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pixel_hourly_stats (
    id VARCHAR(64) PRIMARY KEY,
    pixel_id VARCHAR(64) NULL,
    stat_hour DATETIME NOT NULL,
    metrics LONGTEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pixel_hourly_stats_pixel_hour (pixel_id, stat_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_hero_slides (
    id VARCHAR(64) PRIMARY KEY,
    eyebrow VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    accent VARCHAR(255) NOT NULL DEFAULT '',
    copy TEXT NULL,
    href VARCHAR(2048) NOT NULL DEFAULT '/',
    cta VARCHAR(255) NOT NULL DEFAULT 'Lihat Produk',
    bg_image_url VARCHAR(2048) NOT NULL,
    product_image_url VARCHAR(2048) NOT NULL,
    product_alt VARCHAR(255) NOT NULL DEFAULT '',
    icon_key VARCHAR(64) NOT NULL DEFAULT 'bike',
    price VARCHAR(255) NOT NULL DEFAULT '',
    old_price VARCHAR(255) NOT NULL DEFAULT '',
    detail_line VARCHAR(255) NOT NULL DEFAULT '',
    metrics LONGTEXT NULL,
    specs LONGTEXT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_landing_hero_slides_active_order (is_active, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_category_panels (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    copy TEXT NULL,
    href VARCHAR(2048) NOT NULL DEFAULT '/',
    image_url VARCHAR(2048) NOT NULL,
    tags LONGTEXT NULL,
    tone VARCHAR(64) NOT NULL DEFAULT 'blue',
    icon_key VARCHAR(64) NOT NULL DEFAULT 'package',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_landing_category_panels_active_order (is_active, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_smart_ride (
    id VARCHAR(64) PRIMARY KEY,
    eyebrow VARCHAR(255) NOT NULL DEFAULT '',
    title VARCHAR(255) NOT NULL,
    copy TEXT NULL,
    main_image_url VARCHAR(2048) NOT NULL,
    main_image_alt VARCHAR(255) NOT NULL DEFAULT '',
    overlay_title VARCHAR(255) NOT NULL DEFAULT '',
    overlay_copy TEXT NULL,
    stats LONGTEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_smart_ride_features (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    image_url VARCHAR(2048) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_landing_smart_ride_features_active_order (is_active, sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_testimonials (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NULL,
    quote TEXT NOT NULL,
    image_url VARCHAR(2048) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_faq (
    id VARCHAR(64) PRIMARY KEY,
    question VARCHAR(500) NOT NULL,
    answer TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS landing_footer_links (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    href VARCHAR(2048) NOT NULL,
    group_key VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_price_markups (
    id VARCHAR(64) PRIMARY KEY,
    scope VARCHAR(64) NOT NULL,
    target_value VARCHAR(255) NULL,
    markup_type VARCHAR(64) NOT NULL,
    markup_value DOUBLE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product_price_markups_scope (scope, target_value, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_sessions (
    token VARCHAR(512) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    role VARCHAR(64) NOT NULL DEFAULT 'agent',
    expires_at VARCHAR(64) NOT NULL,
    remember BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_refresh_sessions_user_id (user_id),
    INDEX idx_refresh_sessions_expires_at (expires_at),
    CONSTRAINT fk_refresh_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO product_categories (id, name, slug) VALUES
('cat-bike', 'Sepeda Listrik', 'bike'),
('cat-elektronik', 'Elektronik', 'elektronik'),
('cat-furnitur', 'Furnitur', 'furnitur');

INSERT IGNORE INTO site_content (id, page, section, content) VALUES
('home-hero', 'home', 'hero', JSON_OBJECT(
    'title', 'Solusi Gaya Hidup Modern & Berkelanjutan di Sulawesi',
    'subtitle', 'Nikmati kenyamanan rumah dengan teknologi elektronik premium dan mobilitas hijau masa depan.'
)),
('about-story', 'about', 'story', JSON_OBJECT(
    'title', 'Lebih dari Sekadar Bisnis',
    'body', 'Didirikan pada tahun 2010 di Makassar, Tridjaya Samrat bermula sebagai toko elektronik sederhana dengan visi untuk menyediakan akses mudah bagi masyarakat lokal terhadap teknologi berkualitas.'
));

INSERT IGNORE INTO wa_autoreply_rules
    (id, name, trigger_type, trigger_value, response_type, response_content, priority, created_by)
VALUES
    ('default_welcome', 'Welcome Message', 'always', '*', 'text', 'Terima kasih telah menghubungi kami! Tim customer service kami akan segera membalas pesan Anda.', 0, 'system');

INSERT IGNORE INTO wa_templates
    (id, name, category, content, variables, created_by)
VALUES
    ('sample_order_notification', 'Order Notification', 'notification', 'Halo {{customer_name}}, pesanan Anda #{{order_id}} dengan total {{total_amount}} sedang diproses. Estimasi pengiriman: {{delivery_date}}. Terima kasih!', JSON_ARRAY('customer_name', 'order_id', 'total_amount', 'delivery_date'), 'system');
