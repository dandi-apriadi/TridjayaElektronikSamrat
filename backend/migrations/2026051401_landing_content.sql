CREATE TABLE IF NOT EXISTS landing_hero_slides (
    id TEXT PRIMARY KEY,
    eyebrow TEXT NOT NULL,
    title TEXT NOT NULL,
    accent TEXT NOT NULL DEFAULT '',
    copy TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '/',
    cta TEXT NOT NULL DEFAULT 'Lihat Produk',
    bg_image_url TEXT NOT NULL,
    product_image_url TEXT NOT NULL,
    product_alt TEXT NOT NULL DEFAULT '',
    icon_key TEXT NOT NULL DEFAULT 'bike',
    price TEXT NOT NULL DEFAULT '',
    old_price TEXT NOT NULL DEFAULT '',
    detail_line TEXT NOT NULL DEFAULT '',
    metrics TEXT NOT NULL DEFAULT '[]',
    specs TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_landing_hero_slides_active_order
ON landing_hero_slides (is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS landing_category_panels (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    copy TEXT NOT NULL DEFAULT '',
    href TEXT NOT NULL DEFAULT '/',
    image_url TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]',
    tone TEXT NOT NULL DEFAULT 'blue',
    icon_key TEXT NOT NULL DEFAULT 'package',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_landing_category_panels_active_order
ON landing_category_panels (is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS landing_smart_ride (
    id TEXT PRIMARY KEY,
    eyebrow TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL,
    copy TEXT NOT NULL DEFAULT '',
    main_image_url TEXT NOT NULL,
    main_image_alt TEXT NOT NULL DEFAULT '',
    overlay_title TEXT NOT NULL DEFAULT '',
    overlay_copy TEXT NOT NULL DEFAULT '',
    stats TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS landing_smart_ride_features (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_landing_smart_ride_features_active_order
ON landing_smart_ride_features (is_active, sort_order, created_at);
