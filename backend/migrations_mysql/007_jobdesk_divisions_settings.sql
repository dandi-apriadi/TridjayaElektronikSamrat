INSERT INTO app_settings (setting_key, setting_value)
VALUES ('jobdesk_divisions', JSON_OBJECT('divisions', JSON_ARRAY(), 'updatedAt', NULL))
ON DUPLICATE KEY UPDATE setting_value = setting_value;
