-- Database kontak blast per user
-- Setiap user bisa menyimpan kontak mereka sendiri untuk digunakan di campaign blast
CREATE TABLE IF NOT EXISTS wa_blast_contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    labels TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_wa_blast_contacts_user_id ON wa_blast_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_wa_blast_contacts_phone ON wa_blast_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_wa_blast_contacts_name ON wa_blast_contacts(name);
