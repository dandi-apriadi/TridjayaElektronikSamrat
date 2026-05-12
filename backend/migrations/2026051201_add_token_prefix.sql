-- Add token_prefix column to wa_api_tokens for O(1) token lookup.
-- Instead of loading all tokens and verifying Argon2 hash one-by-one (O(N)),
-- we store a SHA-256 prefix of the plain token that can be queried via index,
-- then verify only the single matching row with Argon2.
ALTER TABLE wa_api_tokens ADD COLUMN token_prefix TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_api_tokens_prefix
ON wa_api_tokens(token_prefix);
