-- Cabang (branch) management table
CREATE TABLE IF NOT EXISTS cabang (
    id TEXT PRIMARY KEY,
    nama TEXT NOT NULL,
    alamat TEXT NOT NULL DEFAULT '',
    kota TEXT NOT NULL DEFAULT '',
    telepon TEXT NOT NULL DEFAULT '',
    koordinator_id TEXT DEFAULT NULL,
    koordinator_nama TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cabang_active (is_active)
);

-- Add cabang_id to users table
ALTER TABLE users ADD COLUMN cabang_id TEXT DEFAULT '' AFTER divisi;
