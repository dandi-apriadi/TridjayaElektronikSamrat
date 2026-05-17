-- Add divisi column to users table for karyawan role
ALTER TABLE users ADD COLUMN divisi TEXT DEFAULT '' AFTER jabatan;

-- Prospek harian table
CREATE TABLE IF NOT EXISTS prospek_harian (
    id TEXT PRIMARY KEY,
    karyawan_id TEXT NOT NULL,
    karyawan_nama TEXT NOT NULL,
    divisi TEXT NOT NULL,
    cabang TEXT NOT NULL,
    tanggal DATE NOT NULL,
    nama_prospek TEXT NOT NULL,
    no_whatsapp TEXT NOT NULL,
    minat_barang TEXT NOT NULL,
    keterangan_prospek TEXT NOT NULL DEFAULT '',
    status_prospek TEXT NOT NULL DEFAULT 'tanya_tanya',
    keterangan_fincoy TEXT NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prospek_karyawan (karyawan_id),
    INDEX idx_prospek_tanggal (tanggal),
    INDEX idx_prospek_cabang (cabang),
    INDEX idx_prospek_divisi (divisi)
);

-- Raport harian table (checklist jobdesk per karyawan per hari)
CREATE TABLE IF NOT EXISTS raport_harian (
    id TEXT PRIMARY KEY,
    karyawan_id TEXT NOT NULL,
    karyawan_nama TEXT NOT NULL,
    divisi TEXT NOT NULL,
    cabang TEXT NOT NULL,
    tanggal DATE NOT NULL,
    jobdesk_index INT NOT NULL,
    jobdesk_text TEXT NOT NULL,
    is_done BOOLEAN NOT NULL DEFAULT 0,
    bukti_url TEXT DEFAULT '',
    catatan TEXT DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_raport_karyawan_tanggal_job (karyawan_id, tanggal, jobdesk_index),
    INDEX idx_raport_karyawan (karyawan_id),
    INDEX idx_raport_tanggal (tanggal),
    INDEX idx_raport_cabang (cabang)
);
