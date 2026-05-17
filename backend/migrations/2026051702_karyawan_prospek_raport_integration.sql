ALTER TABLE raport_harian ADD COLUMN evidence_mode TEXT NOT NULL DEFAULT 'none';
ALTER TABLE raport_harian ADD COLUMN review_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE raport_harian ADD COLUMN score INT;
ALTER TABLE raport_harian ADD COLUMN reviewer_comment TEXT;
ALTER TABLE raport_harian ADD COLUMN reviewed_at DATETIME;
