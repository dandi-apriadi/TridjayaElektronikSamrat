CREATE TABLE IF NOT EXISTS app_settings (
    setting_key VARCHAR(128) PRIMARY KEY,
    setting_value JSON NOT NULL,
    updated_by VARCHAR(64) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_app_settings_updated_by (updated_by),
    CONSTRAINT fk_app_settings_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO app_settings (setting_key, setting_value)
VALUES ('jobdesk_report_settings', JSON_OBJECT('startTime', '08:00', 'endTime', '18:00', 'updatedAt', NULL))
ON DUPLICATE KEY UPDATE setting_value = setting_value;
