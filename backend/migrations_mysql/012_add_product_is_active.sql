SET @products_has_is_active := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'is_active'
);

SET @products_add_is_active_sql := IF(
    @products_has_is_active = 0,
    'ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER stock_quantity',
    'SELECT 1'
);
PREPARE products_add_is_active_stmt FROM @products_add_is_active_sql;
EXECUTE products_add_is_active_stmt;
DEALLOCATE PREPARE products_add_is_active_stmt;

SET @products_has_active_idx := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'products'
      AND INDEX_NAME = 'idx_products_active_created'
);

SET @products_add_active_idx_sql := IF(
    @products_has_active_idx = 0,
    'CREATE INDEX idx_products_active_created ON products (is_active, created_at)',
    'SELECT 1'
);
PREPARE products_add_active_idx_stmt FROM @products_add_active_idx_sql;
EXECUTE products_add_active_idx_stmt;
DEALLOCATE PREPARE products_add_active_idx_stmt;
