CREATE TABLE IF NOT EXISTS off_requests (
    id TEXT PRIMARY KEY,
    karyawan_id TEXT NOT NULL,
    karyawan_nama TEXT NOT NULL DEFAULT '',
    cabang TEXT NOT NULL DEFAULT '',
    divisi TEXT NOT NULL DEFAULT '',
    tanggal DATE NOT NULL,
    alasan TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewer_id TEXT,
    reviewer_nama TEXT,
    reviewer_comment TEXT,
    reviewed_at DATETIME,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
