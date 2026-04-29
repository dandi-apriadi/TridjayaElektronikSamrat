ALTER TABLE job_listings ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE job_listings ADD COLUMN deadline TEXT;

CREATE TABLE IF NOT EXISTS job_applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    job_title TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    education TEXT,
    major TEXT,
    experience TEXT,
    cover_letter TEXT,
    linked_in TEXT,
    portfolio_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    applied_at TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES job_listings(id) ON DELETE CASCADE
);
