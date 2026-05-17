SET @users_has_divisi := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'divisi'
);
SET @users_add_divisi_sql := IF(
    @users_has_divisi = 0,
    'ALTER TABLE users ADD COLUMN divisi VARCHAR(255) NOT NULL DEFAULT '''' AFTER jabatan',
    'SELECT 1'
);
PREPARE users_add_divisi_stmt FROM @users_add_divisi_sql;
EXECUTE users_add_divisi_stmt;
DEALLOCATE PREPARE users_add_divisi_stmt;

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

CREATE TABLE IF NOT EXISTS prospek_harian (
    id VARCHAR(64) PRIMARY KEY,
    karyawan_id VARCHAR(64) NOT NULL,
    tanggal DATE NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    divisi VARCHAR(255) NOT NULL,
    nama_prospek VARCHAR(255) NOT NULL,
    nomor_hp VARCHAR(64) NOT NULL DEFAULT '',
    alamat VARCHAR(255) NOT NULL DEFAULT '',
    keterangan_prospek TEXT NOT NULL,
    status_prospek VARCHAR(64) NOT NULL DEFAULT 'tanya_tanya',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prospek_karyawan (karyawan_id),
    INDEX idx_prospek_tanggal (tanggal),
    INDEX idx_prospek_cabang (cabang),
    INDEX idx_prospek_divisi (divisi),
    CONSTRAINT fk_prospek_harian_karyawan FOREIGN KEY (karyawan_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS raport_harian (
    id VARCHAR(64) PRIMARY KEY,
    karyawan_id VARCHAR(64) NOT NULL,
    tanggal DATE NOT NULL,
    cabang VARCHAR(255) NOT NULL,
    divisi VARCHAR(255) NOT NULL,
    jobdesk_index INT NOT NULL,
    jobdesk_label VARCHAR(255) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_raport_karyawan_tanggal_job (karyawan_id, tanggal, jobdesk_index),
    INDEX idx_raport_karyawan (karyawan_id),
    INDEX idx_raport_tanggal (tanggal),
    INDEX idx_raport_cabang (cabang),
    CONSTRAINT fk_raport_harian_karyawan FOREIGN KEY (karyawan_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
