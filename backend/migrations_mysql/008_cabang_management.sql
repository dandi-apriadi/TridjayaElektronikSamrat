CREATE TABLE IF NOT EXISTS cabang (
    id VARCHAR(64) PRIMARY KEY,
    nama VARCHAR(255) NOT NULL,
    alamat TEXT NOT NULL,
    kota VARCHAR(255) NOT NULL DEFAULT '',
    telepon VARCHAR(64) NOT NULL DEFAULT '',
    koordinator_id VARCHAR(64) NULL,
    koordinator_nama VARCHAR(255) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cabang_active (is_active),
    INDEX idx_cabang_kota (kota)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @users_has_cabang_id := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'cabang_id'
);
SET @users_add_cabang_id_sql := IF(
    @users_has_cabang_id = 0,
    'ALTER TABLE users ADD COLUMN cabang_id VARCHAR(64) NOT NULL DEFAULT '''' AFTER divisi',
    'SELECT 1'
);
PREPARE users_add_cabang_id_stmt FROM @users_add_cabang_id_sql;
EXECUTE users_add_cabang_id_stmt;
DEALLOCATE PREPARE users_add_cabang_id_stmt;
