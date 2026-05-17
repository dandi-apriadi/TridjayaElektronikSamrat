UPDATE users
SET role = 'admin-sales'
WHERE LOWER(REPLACE(role, '_', '-')) = 'sales';

DELETE FROM role_settings
WHERE role = 'sales'
  AND EXISTS (
      SELECT 1 FROM (SELECT role FROM role_settings WHERE role = 'admin-sales') AS existing_admin_sales
  );

UPDATE role_settings
SET role = 'admin-sales',
    label = 'Admin Sales',
    description = 'Akses admin-sales untuk prospek, referral, knowledge, dan jadwal pengiriman.'
WHERE role = 'sales';

INSERT INTO role_settings (role, label, level, dashboard_path, description, is_active)
SELECT 'admin-sales', 'Admin Sales', 50, '/dashboard/sales',
       'Akses admin-sales untuk prospek, referral, knowledge, dan jadwal pengiriman.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM role_settings WHERE role = 'admin-sales');

UPDATE users
SET jabatan = CASE
    WHEN LOWER(COALESCE(jabatan, '')) = 'sales' THEN 'sales'
    WHEN LOWER(COALESCE(divisi, '')) LIKE '%sales%' THEN 'sales'
    ELSE 'non_sales'
END
WHERE LOWER(role) = 'karyawan'
  AND (jabatan IS NULL OR jabatan = '' OR LOWER(jabatan) IN ('koordinator', 'supervisor', 'kepala_cabang'));

SET @has_prospek_target := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prospek_harian'
      AND COLUMN_NAME = 'target_kategori'
);
SET @add_prospek_target_sql := IF(
    @has_prospek_target = 0,
    'ALTER TABLE prospek_harian ADD COLUMN target_kategori VARCHAR(32) NOT NULL DEFAULT ''non_sales'' AFTER divisi',
    'SELECT 1'
);
PREPARE add_prospek_target_stmt FROM @add_prospek_target_sql;
EXECUTE add_prospek_target_stmt;
DEALLOCATE PREPARE add_prospek_target_stmt;

UPDATE prospek_harian p
LEFT JOIN users u ON u.id = p.karyawan_id
SET p.target_kategori = CASE
    WHEN LOWER(COALESCE(u.jabatan, '')) = 'sales' THEN 'sales'
    WHEN LOWER(COALESCE(p.divisi, '')) LIKE '%sales%' THEN 'sales'
    ELSE 'non_sales'
END
WHERE p.target_kategori IS NULL
   OR p.target_kategori = ''
   OR (@has_prospek_target = 0 AND p.target_kategori = 'non_sales');

SET @has_raport_target := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'raport_harian'
      AND COLUMN_NAME = 'target_kategori'
);
SET @add_raport_target_sql := IF(
    @has_raport_target = 0,
    'ALTER TABLE raport_harian ADD COLUMN target_kategori VARCHAR(32) NOT NULL DEFAULT ''non_sales'' AFTER divisi',
    'SELECT 1'
);
PREPARE add_raport_target_stmt FROM @add_raport_target_sql;
EXECUTE add_raport_target_stmt;
DEALLOCATE PREPARE add_raport_target_stmt;

UPDATE raport_harian r
LEFT JOIN users u ON u.id = r.karyawan_id
SET r.target_kategori = CASE
    WHEN LOWER(COALESCE(u.jabatan, '')) = 'sales' THEN 'sales'
    WHEN LOWER(COALESCE(r.divisi, '')) LIKE '%sales%' THEN 'sales'
    ELSE 'non_sales'
END
WHERE r.target_kategori IS NULL
   OR r.target_kategori = ''
   OR (@has_raport_target = 0 AND r.target_kategori = 'non_sales');

SET @has_idx_prospek_target := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prospek_harian'
      AND INDEX_NAME = 'idx_prospek_tanggal_target'
);
SET @idx_prospek_target_sql := IF(
    @has_idx_prospek_target = 0,
    'CREATE INDEX idx_prospek_tanggal_target ON prospek_harian (tanggal, target_kategori)',
    'SELECT 1'
);
PREPARE idx_prospek_target_stmt FROM @idx_prospek_target_sql;
EXECUTE idx_prospek_target_stmt;
DEALLOCATE PREPARE idx_prospek_target_stmt;
