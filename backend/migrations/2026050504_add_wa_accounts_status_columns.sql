-- Migration: Add session status / updated_at to wa_accounts
-- Purpose: SessionManager and CleanupManager already write/read these
--          columns ('connected', 'waiting_for_scan', 'disconnected',
--          'needs_pairing', 'failed') and stamp updated_at on every
--          connection event. The columns were missing from the original
--          schema, which made the corresponding queries fail at runtime.

ALTER TABLE wa_accounts ADD COLUMN status TEXT NOT NULL DEFAULT 'disconnected';
ALTER TABLE wa_accounts ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Speed up periodic idle-connection cleanup which filters by status + updated_at.
CREATE INDEX IF NOT EXISTS idx_wa_accounts_status_updated_at
    ON wa_accounts(status, updated_at);
