-- Enhance wa_recipients with tracking columns
ALTER TABLE wa_recipients ADD COLUMN delivered_at DATETIME;
ALTER TABLE wa_recipients ADD COLUMN read_at DATETIME;
ALTER TABLE wa_recipients ADD COLUMN replied_at DATETIME;
ALTER TABLE wa_recipients ADD COLUMN last_error TEXT;
ALTER TABLE wa_recipients ADD COLUMN lead_id TEXT; -- Optional reference to leads table
