SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospek_harian' AND COLUMN_NAME = 'karyawan_nama');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE prospek_harian ADD COLUMN karyawan_nama VARCHAR(255) NOT NULL DEFAULT '''' AFTER karyawan_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospek_harian' AND COLUMN_NAME = 'no_whatsapp');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE prospek_harian ADD COLUMN no_whatsapp VARCHAR(64) NOT NULL DEFAULT '''' AFTER nama_prospek', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospek_harian' AND COLUMN_NAME = 'minat_barang');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE prospek_harian ADD COLUMN minat_barang VARCHAR(255) NOT NULL DEFAULT '''' AFTER no_whatsapp', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prospek_harian' AND COLUMN_NAME = 'keterangan_fincoy');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE prospek_harian ADD COLUMN keterangan_fincoy VARCHAR(255) NOT NULL DEFAULT '''' AFTER status_prospek', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE prospek_harian SET no_whatsapp = nomor_hp WHERE no_whatsapp = '' AND nomor_hp IS NOT NULL;
UPDATE prospek_harian SET minat_barang = alamat WHERE minat_barang = '' AND alamat IS NOT NULL;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'karyawan_nama');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN karyawan_nama VARCHAR(255) NOT NULL DEFAULT '''' AFTER karyawan_id', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'jobdesk_text');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN jobdesk_text TEXT NULL AFTER jobdesk_label', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'is_done');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN is_done BOOLEAN NOT NULL DEFAULT FALSE AFTER jobdesk_text', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'evidence_mode');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN evidence_mode VARCHAR(32) NOT NULL DEFAULT ''none'' AFTER is_done', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'bukti_url');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN bukti_url TEXT NULL AFTER evidence_mode', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'catatan');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN catatan TEXT NULL AFTER bukti_url', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'review_status');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN review_status VARCHAR(32) NOT NULL DEFAULT ''pending'' AFTER catatan', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'score');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN score INT NULL AFTER review_status', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'reviewer_comment');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN reviewer_comment TEXT NULL AFTER score', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'raport_harian' AND COLUMN_NAME = 'reviewed_at');
SET @ddl := IF(@has_col = 0, 'ALTER TABLE raport_harian ADD COLUMN reviewed_at DATETIME NULL AFTER reviewer_comment', 'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE raport_harian SET jobdesk_text = jobdesk_label WHERE (jobdesk_text IS NULL OR jobdesk_text = '') AND jobdesk_label IS NOT NULL;
UPDATE raport_harian SET is_done = completed WHERE completed IS NOT NULL;
