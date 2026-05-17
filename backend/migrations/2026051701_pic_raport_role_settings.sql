CREATE TABLE IF NOT EXISTS role_settings (
    role TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 100,
    dashboard_path TEXT NOT NULL DEFAULT '',
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO role_settings (role, label, level, dashboard_path, description, is_active) VALUES
    ('admin', 'Admin', 10, '/dashboard/admin', 'Akses penuh untuk pengaturan sistem, user, katalog, dan operasional.', 1),
    ('owner', 'Owner', 20, '/dashboard/owner', 'Monitoring bisnis, performa cabang, omset, target, dan laporan strategis.', 1),
    ('pic_raport', 'PIC Raport', 30, '/dashboard/pic-raport', 'Menilai raport harian semua cabang, memberi komentar, menolak bukti jobdesk, dan mengelola master divisi/jobdesk.', 1),
    ('operator', 'Operator', 40, '/dashboard/admin/wa/campaigns', 'Operasional kampanye, WA blast, katalog, konten, dan pixel campaign.', 1),
    ('sales', 'Sales', 50, '/dashboard/sales', 'Akses sales untuk prospek, referral, knowledge, dan jadwal pengiriman.', 1),
    ('karyawan', 'Karyawan', 60, '/dashboard/karyawan', 'Akses karyawan untuk prospek harian, raport harian, dan history raport.', 1),
    ('agent', 'Agent', 70, '/dashboard/agent', 'Akses agent untuk product knowledge, referral, prospek, dan komisi.', 1);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

UPDATE users
SET role = 'pic_raport'
WHERE LOWER(REPLACE(REPLACE(TRIM(role), '-', '_'), ' ', '_')) = 'pic_raport';
