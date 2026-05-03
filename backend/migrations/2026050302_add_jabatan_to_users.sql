-- Add jabatan (position/title) column to users table
-- jabatan is a display-only title, separate from role which controls system access
-- Valid jabatan values for sales role: kepala_cabang, supervisor, koordinator, sales
ALTER TABLE users ADD COLUMN jabatan TEXT NOT NULL DEFAULT '';
