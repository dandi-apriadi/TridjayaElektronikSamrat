CREATE TABLE IF NOT EXISTS role_settings (
    role VARCHAR(64) PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    level INT NOT NULL DEFAULT 100,
    dashboard_path VARCHAR(255) NOT NULL DEFAULT '',
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO role_settings (role, label, level, dashboard_path, description, is_active) VALUES
    ('admin', 'Admin', 10, '/dashboard/admin', 'Akses penuh untuk pengaturan sistem, user, katalog, dan operasional.', TRUE),
    ('owner', 'Owner', 20, '/dashboard/owner', 'Monitoring bisnis, performa cabang, omset, target, dan laporan strategis.', TRUE),
    ('pic_raport', 'PIC Raport', 30, '/dashboard/pic-raport', 'Menilai raport harian semua cabang, memberi komentar, menolak bukti jobdesk, dan mengelola master divisi/jobdesk.', TRUE),
    ('operator', 'Operator', 40, '/dashboard/admin/wa/campaigns', 'Operasional kampanye, WA blast, katalog, konten, dan pixel campaign.', TRUE),
    ('sales', 'Sales', 50, '/dashboard/sales', 'Akses sales untuk prospek, referral, knowledge, dan jadwal pengiriman.', TRUE),
    ('karyawan', 'Karyawan', 60, '/dashboard/karyawan', 'Akses karyawan untuk prospek harian, raport harian, dan history raport.', TRUE),
    ('agent', 'Agent', 70, '/dashboard/agent', 'Akses agent untuk product knowledge, referral, prospek, dan komisi.', TRUE)
ON DUPLICATE KEY UPDATE
    label = VALUES(label),
    level = VALUES(level),
    dashboard_path = VALUES(dashboard_path),
    description = VALUES(description),
    is_active = VALUES(is_active);

SET @users_role_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'idx_users_role'
);
SET @users_role_index_sql := IF(
    @users_role_index_exists = 0,
    'CREATE INDEX idx_users_role ON users(role)',
    'SELECT 1'
);
PREPARE users_role_index_stmt FROM @users_role_index_sql;
EXECUTE users_role_index_stmt;
DEALLOCATE PREPARE users_role_index_stmt;

UPDATE users
SET role = 'pic_raport'
WHERE LOWER(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_')) = 'pic_raport';
