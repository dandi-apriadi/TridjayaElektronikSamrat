SET @cabang_has_koordinator_id := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cabang'
      AND COLUMN_NAME = 'koordinator_id'
);
SET @cabang_drop_koordinator_id_sql := IF(
    @cabang_has_koordinator_id = 1,
    'ALTER TABLE cabang DROP COLUMN koordinator_id',
    'SELECT 1'
);
PREPARE cabang_drop_koordinator_id_stmt FROM @cabang_drop_koordinator_id_sql;
EXECUTE cabang_drop_koordinator_id_stmt;
DEALLOCATE PREPARE cabang_drop_koordinator_id_stmt;

SET @cabang_has_koordinator_nama := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cabang'
      AND COLUMN_NAME = 'koordinator_nama'
);
SET @cabang_drop_koordinator_nama_sql := IF(
    @cabang_has_koordinator_nama = 1,
    'ALTER TABLE cabang DROP COLUMN koordinator_nama',
    'SELECT 1'
);
PREPARE cabang_drop_koordinator_nama_stmt FROM @cabang_drop_koordinator_nama_sql;
EXECUTE cabang_drop_koordinator_nama_stmt;
DEALLOCATE PREPARE cabang_drop_koordinator_nama_stmt;
