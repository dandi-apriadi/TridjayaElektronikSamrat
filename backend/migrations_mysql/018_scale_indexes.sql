SET @has_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'telemetry_events'
      AND INDEX_NAME = 'idx_telemetry_created_event'
);
SET @sql := IF(
    @has_index = 0,
    'CREATE INDEX idx_telemetry_created_event ON telemetry_events (created_at, event_type)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'agent_registrations'
      AND INDEX_NAME = 'idx_registrations_status_submitted'
);
SET @sql := IF(
    @has_index = 0,
    'CREATE INDEX idx_registrations_status_submitted ON agent_registrations (status, submitted_at)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'idx_users_created_at'
);
SET @sql := IF(
    @has_index = 0,
    'CREATE INDEX idx_users_created_at ON users (created_at)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'wa_recipients'
      AND INDEX_NAME = 'idx_wa_recipients_campaign_status_created'
);
SET @sql := IF(
    @has_index = 0,
    'CREATE INDEX idx_wa_recipients_campaign_status_created ON wa_recipients (campaign_id, status, created_at)',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
