-- Keep historical jobdesk snapshots stable when an employee changes division.
-- Old unique key used only (karyawan_id, tanggal, jobdesk_index), so a same-day
-- division transfer could overwrite jobdesk index 0 from the previous division.
-- New key includes divisi so old rows remain historical and new division input
-- can start from its own jobdesk index set.

SET @has_old_raport_unique := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'raport_harian'
      AND INDEX_NAME = 'uk_raport_karyawan_tanggal_job'
);
SET @drop_old_raport_unique_sql := IF(
    @has_old_raport_unique > 0,
    'ALTER TABLE raport_harian DROP INDEX uk_raport_karyawan_tanggal_job',
    'SELECT 1'
);
PREPARE drop_old_raport_unique_stmt FROM @drop_old_raport_unique_sql;
EXECUTE drop_old_raport_unique_stmt;
DEALLOCATE PREPARE drop_old_raport_unique_stmt;

SET @has_new_raport_unique := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'raport_harian'
      AND INDEX_NAME = 'uk_raport_karyawan_tanggal_divisi_job'
);
SET @add_new_raport_unique_sql := IF(
    @has_new_raport_unique = 0,
    'ALTER TABLE raport_harian ADD UNIQUE KEY uk_raport_karyawan_tanggal_divisi_job (karyawan_id, tanggal, divisi, jobdesk_index)',
    'SELECT 1'
);
PREPARE add_new_raport_unique_stmt FROM @add_new_raport_unique_sql;
EXECUTE add_new_raport_unique_stmt;
DEALLOCATE PREPARE add_new_raport_unique_stmt;

SET @has_raport_divisi_lookup_index := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'raport_harian'
      AND INDEX_NAME = 'idx_raport_karyawan_tanggal_divisi'
);
SET @add_raport_divisi_lookup_index_sql := IF(
    @has_raport_divisi_lookup_index = 0,
    'CREATE INDEX idx_raport_karyawan_tanggal_divisi ON raport_harian (karyawan_id, tanggal, divisi)',
    'SELECT 1'
);
PREPARE add_raport_divisi_lookup_index_stmt FROM @add_raport_divisi_lookup_index_sql;
EXECUTE add_raport_divisi_lookup_index_stmt;
DEALLOCATE PREPARE add_raport_divisi_lookup_index_stmt;
