WA-Blast Feature Plan

Overview
- Goal: Add WA-blast campaign system using Fonnte gateway with per-message delay, multi-account support, Excel bulk import (desktop), and deduplication by date window.

High-level requirements
- Configurable delay per message with jitter to reduce ban risk.
- Support multiple WhatsApp accounts (link/manage accounts with credentials/config per account).
- Desktop app for Excel import (preferred: Rust + Tauri) to validate and POST recipients to backend; web uploader fallback (SheetJS) if needed.
- Use Fonnte as gateway for sending messages.
- Deduplicate sends by checking previous sends in a configurable date window.
- Add roles: `wa_admin`, `wa_operator`, with permission checks.

Proposed DB schema (initial)
- wa_accounts
  - id (pk), name, gateway_config JSON, enabled, created_by, created_at
- wa_campaigns
  - id (pk), name, created_by, created_at, config JSON (delay_ms, jitter_ms, dedupe_days, account_strategy)
- wa_recipients
  - id (pk), campaign_id (fk), phone, variables_json, status (pending/sent/skipped/failed), last_attempt_at
- wa_dispatch_logs
  - id (pk), campaign_id, recipient_id, phone, wa_account_id, message_id, status, sent_at, meta JSON

Backend endpoints (sketch)
- POST /api/wa/accounts -> add/edit/remove WA accounts
- GET /api/wa/accounts
- POST /api/wa/campaigns -> create campaign (name + config)
- POST /api/wa/campaigns/{id}/upload -> upload recipients (bulk) (accept JSON or multipart file upload)
- POST /api/wa/campaigns/{id}/start -> start campaign (enqueues recipients)
- GET /api/wa/campaigns/{id}/status -> campaign progress & recipient list (paginated)

Dispatcher design
- Worker service (Rust background task or separate process) picks pending recipients and sends respecting:
  - per-account rate limits and campaign `delay_ms` + `jitter_ms`
  - account selection: round-robin or weight-based
  - before sending, run dedupe check: query `wa_dispatch_logs` for same phone within `dedupe_days` window; if found, mark recipient as `skipped` with reason
- Retry policy with exponential backoff for transient errors

Fonnte gateway client
- HTTP client module for Fonnte API with per-account credentials and configurable timeouts/retries
- Centralized error mapping to set recipient status

Desktop Excel import
- Option A (recommended): Rust + Tauri desktop app
  - Pros: native, Rust reuse with backend (if backend in Rust), easy file access, strong type safety
  - App: load Excel (xlsx), preview, validate phone format, preview dedupe, send to backend via bulk upload endpoint
- Option B: Web uploader using SheetJS
  - Faster to implement; good fallback

Roles & security
- Add `wa_admin` and `wa_operator` roles
  - `wa_admin`: manage accounts, campaigns, run & cancel campaigns
  - `wa_operator`: upload recipients, view campaign status
- Enforce in API route middleware

Deduplication logic
- When uploading or before sending, check `wa_dispatch_logs` for same phone with `sent_at >= now() - dedupe_days`
- If exists, mark as `skipped` and record `meta.reason = "dedupe"`

UI work
- Admin dashboard: accounts management, campaign creation, upload, monitoring, stop/pause campaign
- Campaign recipients list: paginated preview with filtering and retry controls

Testing & rollout
- Unit tests for gateway client & dedupe
- Integration tests for full flow (upload -> dispatch -> log)
- Staged rollout with low sending rates then ramp up

Timeline (suggested small milestones)
1. Create branch + DB migration files (1 day)
2. Fonnte client + small send endpoint + unit tests (2-3 days)
3. Dispatcher worker (2-3 days)
4. Desktop uploader (Rust/Tauri) or web uploader (2-5 days)
5. Admin UI pages + RBAC (2-3 days)
6. Testing, docs, deploy (2 days)

Notes & recommendations
- Prefer Rust + Tauri for native desktop if you want single-language stack and performance.
- If you need faster MVP, implement web uploader first and ship Tauri later.
- Start with conservative defaults: large delay_ms (e.g., 3000ms) + jitter to minimize block risk.

Next steps
- I will create the branch `feature/wa-blast-roles` and open the repo for implementation tasks.
- Confirm preference: `Rust/Tauri` desktop app or web uploader fallback.
