ALTER TABLE products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS idx_products_active_created ON products(is_active, created_at);
