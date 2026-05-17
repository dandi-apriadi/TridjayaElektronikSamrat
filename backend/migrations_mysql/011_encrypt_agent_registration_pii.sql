-- Quick Win #7 (security audit 2026-05-17): broaden PII encryption coverage
-- in `agent_registrations`.
--
-- Previously the table encrypted `whatsapp` and `address` but kept `email` and
-- `full_name` in plaintext. Email + full name are PII under UU PDP and a DB
-- dump should not expose them. The application code is updated in the same
-- change set to:
--   - encrypt `email` and `full_name` before INSERT,
--   - store a deterministic SHA-256 hash of the lowercased email in
--     `email_hash` so rate-limiting / lookup-by-email keep working,
--   - decrypt on read.
--
-- Existing rows remain readable because `decrypt_pii_from_storage` returns
-- the value as-is when the `enc:v1:` prefix is absent. Backfilling existing
-- rows with encrypted values is intentionally deferred — only new rows pick
-- up the stronger protection — to avoid a destructive batch update in this
-- migration. Operators may run a one-off backfill script later if desired.

ALTER TABLE agent_registrations
    ADD COLUMN email_hash CHAR(64) NULL AFTER email;

-- Backfill hash for existing rows so the in-process rate-limit / lookup
-- helpers can match on it immediately.
UPDATE agent_registrations
    SET email_hash = LOWER(SHA2(LOWER(email), 256))
WHERE email_hash IS NULL;

CREATE INDEX idx_registrations_email_hash ON agent_registrations (email_hash);
