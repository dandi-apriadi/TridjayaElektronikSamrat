-- Quick Win #3 (security audit 2026-05-17): hash refresh tokens at rest.
--
-- Previously `refresh_sessions.token` stored the raw UUID that is also placed
-- in the user's HttpOnly cookie. A database leak would therefore allow an
-- attacker to impersonate every active user until their refresh window
-- expired.
--
-- This migration:
--   1. Adds a `token_hash` column (SHA-256 of the raw token, hex-encoded).
--   2. Backfills existing rows.
--   3. Switches the primary key from `token` to `token_hash`.
--   4. Drops the plaintext `token` column once the application code starts
--      writing only hashes.
--
-- The application code in `auth.rs` is updated in the same change set to:
--   - hash any token before INSERT / SELECT / DELETE,
--   - lookup rows by `token_hash` only.
--
-- Existing in-memory sessions continue to work; only the DB persistence layer
-- changes.

ALTER TABLE refresh_sessions
    ADD COLUMN token_hash CHAR(64) NOT NULL DEFAULT '' AFTER token;

UPDATE refresh_sessions
    SET token_hash = LOWER(SHA2(token, 256))
WHERE token_hash = '';

-- Replace the PK without losing any rows.
ALTER TABLE refresh_sessions DROP PRIMARY KEY;
ALTER TABLE refresh_sessions ADD PRIMARY KEY (token_hash);

-- The plaintext token column is no longer needed.
ALTER TABLE refresh_sessions DROP COLUMN token;
