-- Create Product Categories Table
CREATE TABLE IF NOT EXISTS product_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial categories if empty
INSERT OR IGNORE INTO product_categories (id, name, slug) VALUES 
('cat-bike', 'Sepeda Listrik', 'bike'),
('cat-elektronik', 'Elektronik', 'elektronik'),
('cat-furnitur', 'Furnitur', 'furnitur');
