CREATE TABLE IF NOT EXISTS product_price_markups (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('all', 'category', 'product')),
    target_value TEXT,
    markup_type TEXT NOT NULL CHECK (markup_type IN ('amount', 'percent')),
    markup_value REAL NOT NULL CHECK (markup_value >= 0),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (scope = 'all' AND target_value IS NULL)
        OR (scope IN ('category', 'product') AND target_value IS NOT NULL AND length(trim(target_value)) > 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_product_price_markups_scope
    ON product_price_markups(scope, target_value, is_active);
