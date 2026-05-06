
# Implementation Plan: Meta Pixel Tracking System

## Overview

Implement a multi-tenant Meta Pixel tracking platform on the existing Rust/Axum + SQLite backend and React/TypeScript frontend. The system adds a `super_admin` role, pixel management, campaign tracking, Meta CAPI server-side event forwarding, analytics aggregation, and role-scoped dashboards. All new backend code lives in `backend/src/pixel/` as a dedicated module wired into the existing router. All new frontend pages follow the `frontend/src/pages/dashboard/Admin*.tsx` naming convention.

**Key constraints from codebase analysis:**
- `super_admin` role does NOT yet exist — must be added to `backend/src/auth.rs` first
- `reqwest` is already in `Cargo.toml` — only `aes-gcm` and `sha2` need to be added
- Existing `POST /api/telemetry/pixel-event` route MUST be preserved unchanged
- New pixel event endpoint is a SEPARATE route: `POST /api/pixel-events`
- `RoleGuard`, `DashboardRoot`, and `DashboardLayout` in the frontend must be extended for `super_admin`
- Requirement 13 "marketing" role maps to the existing `editor` role

---

## Tasks

### Phase 1: Database Migrations

- [x] 1. Create pixel core tables migration
  - [x] 1.1 Write migration file `backend/migrations/2026050401_pixel_core.sql`
    - Create `pixels` table: `id TEXT PK`, `pixel_id TEXT UNIQUE`, `name TEXT`, `business_manager_id TEXT`, `status TEXT DEFAULT 'active'`, `access_token TEXT` (encrypted), `created_by TEXT FK users.id`, `config TEXT DEFAULT '{}'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Create `pixel_admins` table: `id TEXT PK`, `pixel_id TEXT FK pixels.id`, `user_id TEXT FK users.id`, `permissions TEXT DEFAULT '{}'`, `assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `assigned_by TEXT FK users.id`, UNIQUE constraint on `(pixel_id, user_id)`
    - Create `campaigns` table: `id TEXT PK`, `campaign_id TEXT UNIQUE`, `pixel_id TEXT FK pixels.id`, `admin_id TEXT FK users.id`, `name TEXT`, `status TEXT DEFAULT 'active'`, `utm_source TEXT`, `utm_medium TEXT`, `utm_campaign TEXT`, `utm_admin TEXT`, `utm_content TEXT`, `utm_term TEXT`, `config TEXT DEFAULT '{}'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Create `custom_conversions` table: `id TEXT PK`, `campaign_id TEXT FK campaigns.id`, `name TEXT`, `event_type TEXT`, `rules TEXT DEFAULT '{}'`, `conversion_value REAL DEFAULT 0`, `currency TEXT DEFAULT 'USD'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Add indexes: `idx_pixels_pixel_id`, `idx_pixel_admins_pixel_id`, `idx_pixel_admins_user_id`, `idx_campaigns_pixel_id`, `idx_campaigns_admin_id`, `idx_campaigns_status`
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1_

- [x] 2. Create pixel events and conversions tables migration
  - [x] 2.1 Write migration file `backend/migrations/2026050402_pixel_events.sql`
    - Create `pixel_events` table: `id TEXT PK`, `event_id TEXT UNIQUE`, `pixel_id TEXT FK pixels.id`, `campaign_id TEXT FK campaigns.id NULLABLE`, `user_id TEXT FK users.id NULLABLE`, `event_type TEXT`, `event_source_url TEXT`, `referrer_url TEXT`, `user_agent TEXT`, `ip_address TEXT` (hashed), `fbp TEXT`, `fbc TEXT`, `user_data TEXT DEFAULT '{}'`, `custom_data TEXT DEFAULT '{}'`, `utm_params TEXT DEFAULT '{}'`, `sent_to_meta INTEGER DEFAULT 0`, `meta_event_id TEXT`, `retry_count INTEGER DEFAULT 0`, `error_message TEXT`, `event_time DATETIME`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Create `conversions` table: `id TEXT PK`, `event_id TEXT FK pixel_events.id`, `campaign_id TEXT FK campaigns.id`, `custom_conversion_id TEXT FK custom_conversions.id NULLABLE`, `conversion_type TEXT`, `conversion_value REAL DEFAULT 0`, `currency TEXT DEFAULT 'USD'`, `order_id TEXT`, `custom_data TEXT DEFAULT '{}'`, `conversion_time DATETIME`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Add indexes: `idx_pixel_events_pixel_id`, `idx_pixel_events_campaign_id`, `idx_pixel_events_event_id`, `idx_pixel_events_event_time`, `idx_pixel_events_sent_to_meta`, `idx_pixel_events_fbp`, `idx_conversions_campaign_id`, `idx_conversions_event_id`
    - _Requirements: 5.1, 7.1, 9.1, 17.1, 17.2, 17.3_

- [x] 3. Create analytics and audit tables migration
  - [x] 3.1 Write migration file `backend/migrations/2026050403_pixel_analytics.sql`
    - Create `pixel_analytics` table: `id TEXT PK`, `pixel_id TEXT FK pixels.id`, `period_type TEXT`, `period_start DATE`, `period_end DATE`, `total_events INTEGER DEFAULT 0`, `unique_users INTEGER DEFAULT 0`, `page_views INTEGER DEFAULT 0`, `add_to_carts INTEGER DEFAULT 0`, `purchases INTEGER DEFAULT 0`, `leads INTEGER DEFAULT 0`, `total_revenue REAL DEFAULT 0`, `currency TEXT DEFAULT 'USD'`, `metrics TEXT DEFAULT '{}'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, UNIQUE on `(pixel_id, period_type, period_start)`
    - Create `campaign_analytics` table: `id TEXT PK`, `campaign_id TEXT FK campaigns.id`, `period_type TEXT`, `period_start DATE`, `period_end DATE`, `total_events INTEGER DEFAULT 0`, `unique_users INTEGER DEFAULT 0`, `conversions INTEGER DEFAULT 0`, `conversion_rate REAL DEFAULT 0`, `total_revenue REAL DEFAULT 0`, `currency TEXT DEFAULT 'USD'`, `cost_per_conversion REAL`, `roas REAL`, `metrics TEXT DEFAULT '{}'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`, UNIQUE on `(campaign_id, period_type, period_start)`
    - Create `pixel_audit_logs` table: `id TEXT PK`, `user_id TEXT FK users.id NULLABLE`, `action_type TEXT`, `resource_type TEXT`, `resource_id TEXT`, `old_value TEXT`, `new_value TEXT`, `ip_address TEXT`, `user_agent TEXT`, `metadata TEXT DEFAULT '{}'`, `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`
    - Add indexes: `idx_pixel_analytics_pixel_period`, `idx_campaign_analytics_campaign_period`, `idx_pixel_audit_logs_user_id`, `idx_pixel_audit_logs_resource`, `idx_pixel_audit_logs_created_at`
    - _Requirements: 10.1, 10.2, 10.3, 16.1, 16.5_


### Phase 2: Backend — Auth & Core Infrastructure

- [x] 4. Add SuperAdmin role to backend auth and extend AppState
  - [x] 4.1 Add `SuperAdmin` variant to `Role` enum in `backend/src/auth.rs`
    - Add `SuperAdmin` variant to the `Role` enum after `WaOperator`
    - Add `"super_admin"` arm to `Display` impl: `Self::SuperAdmin => write!(f, "super_admin")`
    - Add `"super_admin" | "superadmin"` arm to `FromStr` impl
    - Add helper method `pub fn can_manage_pixels(&self) -> bool` returning `matches!(self, Self::SuperAdmin)`
    - _Requirements: 1.7, 2.1_
  - [x] 4.2 Extend `AppState` in `backend/src/state.rs` with pixel-related fields
    - Add `pub pixel_meta_attempts: Arc<RwLock<HashMap<String, Vec<DateTime<Utc>>>>>` for per-pixel Meta CAPI rate limiting
    - Add `pub analytics_job_running: Arc<std::sync::atomic::AtomicBool>` to prevent concurrent analytics runs
    - Add `pub last_analytics_run: Arc<RwLock<Option<DateTime<Utc>>>>` to track last successful aggregation
    - Add `pub last_retry_run: Arc<RwLock<Option<DateTime<Utc>>>>` to track last retry job run
    - Initialize all new fields in `AppState::new()` with appropriate defaults
    - Update `cleanup_expired_sessions` to also clean up stale `pixel_meta_attempts` entries older than 60 seconds
    - _Requirements: 18.6, 19.5, 25.5, 25.6_
  - [x] 4.3 Add `aes-gcm = "0.10"` and `sha2 = "0.10"` to `backend/Cargo.toml` dependencies
    - Add under `[dependencies]`: `aes-gcm = { version = "0.10", features = ["aes"] }` and `sha2 = "0.10"`
    - Do NOT add `reqwest` — it is already present
    - _Requirements: 17.7_

- [x] 5. Create pixel module scaffold and crypto utilities
  - [x] 5.1 Create `backend/src/pixel/mod.rs` declaring submodules
    - Declare: `pub mod crypto;`, `pub mod models;`, `pub mod handlers;`, `pub mod campaign_handlers;`, `pub mod event_handlers;`, `pub mod analytics_handlers;`, `pub mod analytics_job;`, `pub mod meta_capi;`
    - Add `pub mod pixel;` to `backend/src/lib.rs`
    - _Requirements: 17.7_
  - [x] 5.2 Create `backend/src/pixel/crypto.rs` with AES-256-GCM token encryption
    - Implement `pub fn encrypt_token(plaintext: &str, key: &[u8; 32]) -> Result<String, CryptoError>` using `aes-gcm` with a random 96-bit nonce; encode output as `base64(nonce || ciphertext)`
    - Implement `pub fn decrypt_token(encoded: &str, key: &[u8; 32]) -> Result<String, CryptoError>` reversing the above
    - Implement `pub fn hash_pii(value: &str) -> String` using `sha2::Sha256`; return lowercase hex digest
    - Read encryption key from `PIXEL_ENCRYPTION_KEY` env var (32-byte hex); fall back to a dev-only default with a `tracing::warn!`
    - _Requirements: 1.3, 17.1, 17.2, 17.3, 17.4, 17.7_
  - [x] 5.3 Create `backend/src/pixel/models.rs` with all pixel domain structs
    - Define `PixelRecord`, `PixelAdminRecord`, `CampaignRecord`, `CustomConversionRecord`, `PixelEventRecord`, `ConversionRecord`, `PixelAnalyticsRecord`, `CampaignAnalyticsRecord`, `AuditLogRecord` — all deriving `sqlx::FromRow`, `serde::Serialize`, `Clone`
    - Define request/response DTOs: `CreatePixelRequest`, `UpdatePixelRequest`, `AssignAdminRequest`, `CreateCampaignRequest`, `UpdateCampaignRequest`, `CreateCustomConversionRequest`, `PixelEventRequest`, `TestEventRequest`
    - _Requirements: 1.1, 3.1, 4.1, 5.1_


### Phase 3: Backend — Pixel Management CRUD

- [x] 6. Implement pixel management handlers
  - [x] 6.1 Create `backend/src/pixel/handlers.rs` with Super Admin pixel CRUD
    - Implement `pub async fn create_pixel(State, HeaderMap, Json<CreatePixelRequest>) -> Result<ResponseBody, AppError>`
      - Authorize with `Role::SuperAdmin` only
      - Validate `pixel_id` uniqueness in `pixels` table
      - Encrypt `access_token` using `crypto::encrypt_token`
      - Insert into `pixels` table with `uuid::Uuid::new_v4()` as `id`
      - Write audit log entry to `pixel_audit_logs` with `action_type = "pixel.created"`
      - _Requirements: 1.1, 1.2, 1.3, 16.1_
    - Implement `pub async fn list_pixels(State, HeaderMap) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Query pixels with assigned admin count and total event count via LEFT JOIN subqueries
      - Return list with status, assigned_admins_count, total_events
      - _Requirements: 1.6_
    - Implement `pub async fn get_pixel(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Return pixel record (do NOT include decrypted access_token in response)
      - _Requirements: 1.6, 20.4_
    - Implement `pub async fn update_pixel(State, HeaderMap, Path<String>, Json<UpdatePixelRequest>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Allow updating `name`, `business_manager_id`, `status`, `access_token` (re-encrypt if provided), `config`
      - Write audit log with `old_value` and `new_value` JSON
      - _Requirements: 1.4, 1.5, 16.1, 20.2, 21.2_
    - Implement `pub async fn delete_pixel(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Write audit log entry before deletion
      - _Requirements: 1.7, 16.1_
  - [x] 6.2 Write unit tests for pixel CRUD handlers
    - Test `create_pixel` rejects duplicate `pixel_id`
    - Test `update_pixel` writes audit log with correct old/new values
    - Test unauthorized roles receive 403
    - _Requirements: 1.2, 1.7, 16.1_

- [x] 7. Implement admin assignment handlers
  - [x] 7.1 Create admin assignment functions in `backend/src/pixel/handlers.rs`
    - Implement `pub async fn assign_admin(State, HeaderMap, Path<String>, Json<AssignAdminRequest>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Validate target user exists and has `role = 'admin'`
      - Check for duplicate assignment (UNIQUE constraint on `pixel_id, user_id`)
      - Insert into `pixel_admins` with `assigned_by = current_user.id`
      - Write audit log with `action_type = "admin.assigned"`
      - _Requirements: 2.1, 2.2, 2.4, 2.6, 16.2_
    - Implement `pub async fn revoke_admin(State, HeaderMap, Path<(String, String)>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Delete from `pixel_admins` where `pixel_id = ? AND user_id = ?`
      - Write audit log with `action_type = "admin.revoked"`
      - _Requirements: 2.3, 16.2_
    - Implement `pub async fn list_pixel_admins(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Return assigned admins with permissions and assignment date
      - _Requirements: 2.5_
  - [x] 7.2 Write unit tests for admin assignment
    - Test assigning non-admin user returns validation error
    - Test duplicate assignment returns conflict error
    - Test revoke removes record and writes audit log
    - _Requirements: 2.2, 2.6, 16.2_

- [x] 8. Register pixel routes in the main router
  - [x] 8.1 Add pixel routes to `backend/src/routes.rs`
    - Add the following routes (do NOT modify or remove existing `/api/telemetry/pixel-event`):
      - `POST /api/pixels` → `pixel::handlers::create_pixel`
      - `GET /api/pixels` → `pixel::handlers::list_pixels`
      - `GET /api/pixels/{id}` → `pixel::handlers::get_pixel`
      - `PATCH /api/pixels/{id}` → `pixel::handlers::update_pixel`
      - `DELETE /api/pixels/{id}` → `pixel::handlers::delete_pixel`
      - `POST /api/pixels/{id}/admins` → `pixel::handlers::assign_admin`
      - `DELETE /api/pixels/{id}/admins/{user_id}` → `pixel::handlers::revoke_admin`
      - `GET /api/pixels/{id}/admins` → `pixel::handlers::list_pixel_admins`
    - Add `use crate::pixel;` import at the top of `routes.rs`
    - _Requirements: 1.7, 2.1, 2.3_


### Phase 4: Backend — Campaign & Custom Conversion Management

- [x] 9. Implement campaign management handlers
  - [x] 9.1 Create `backend/src/pixel/campaign_handlers.rs` with Admin campaign CRUD
    - Implement `pub async fn create_campaign(State, HeaderMap, Json<CreateCampaignRequest>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Validate admin has access to the specified `pixel_id` via `pixel_admins` table
      - Generate unique `campaign_id` using `uuid::Uuid::new_v4().to_string()`
      - Set `utm_admin` to a unique identifier for attribution (e.g., `admin_{user_id_prefix}`)
      - Insert into `campaigns` table
      - Write audit log with `action_type = "campaign.created"`
      - _Requirements: 3.1, 3.2, 3.3, 16.3_
    - Implement `pub async fn list_campaigns(State, HeaderMap) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Return only campaigns for pixels the admin has access to (JOIN with `pixel_admins`)
      - Support query param `?status=active|paused|completed` for filtering
      - _Requirements: 3.5, 23.6_
    - Implement `pub async fn get_campaign(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`; verify admin owns or has access to the campaign's pixel
      - _Requirements: 3.5_
    - Implement `pub async fn update_campaign(State, HeaderMap, Path<String>, Json<UpdateCampaignRequest>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Allow updating `name`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `status`
      - Validate status transitions: `active ↔ paused`, `active/paused → completed`; reject updates when status is `completed`
      - Write audit log with `action_type = "campaign.updated"`
      - _Requirements: 3.4, 3.6, 16.3, 23.1, 23.2, 23.3_
    - Implement `pub async fn delete_campaign(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Reject deletion if any `pixel_events` rows reference this `campaign_id`
      - Write audit log with `action_type = "campaign.deleted"`
      - _Requirements: 3.7, 16.3_
  - [x] 9.2 Write unit tests for campaign handlers
    - Test admin cannot access campaigns for pixels they are not assigned to
    - Test delete is rejected when events exist
    - Test status transition from `completed` is rejected
    - _Requirements: 3.2, 3.5, 3.7, 23.3_

- [x] 10. Implement custom conversion handlers
  - [x] 10.1 Create custom conversion functions in `backend/src/pixel/campaign_handlers.rs`
    - Implement `pub async fn create_custom_conversion(State, HeaderMap, Path<String>, Json<CreateCustomConversionRequest>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`; verify admin owns the campaign
      - Validate `rules` JSON contains at least one of `url_filter` or `param_match` keys
      - Insert into `custom_conversions` table
      - Write audit log with `action_type = "custom_conversion.created"`
      - _Requirements: 4.1, 4.2, 16.4_
    - Implement `pub async fn list_custom_conversions(State, HeaderMap, Path<String>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`; return conversions for the specified campaign
      - _Requirements: 4.4_
    - Implement `pub async fn update_custom_conversion(State, HeaderMap, Path<(String, String)>, Json) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`; allow updating `rules`, `conversion_value`, `currency`, `name`
      - Write audit log with `action_type = "custom_conversion.updated"`
      - _Requirements: 4.5, 16.4_
    - Implement `pub async fn delete_custom_conversion(State, HeaderMap, Path<(String, String)>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Set `custom_conversion_id = NULL` on existing `conversions` rows (preserve historical records)
      - Write audit log with `action_type = "custom_conversion.deleted"`
      - _Requirements: 4.6, 16.4_
  - [x] 10.2 Write unit tests for custom conversion handlers
    - Test `rules` validation rejects empty JSON object
    - Test delete preserves historical conversion records (sets FK to NULL)
    - _Requirements: 4.2, 4.6_

- [x] 11. Register campaign and conversion routes
  - [x] 11.1 Add campaign and conversion routes to `backend/src/routes.rs`
    - Add routes:
      - `POST /api/campaigns` → `pixel::campaign_handlers::create_campaign`
      - `GET /api/campaigns` → `pixel::campaign_handlers::list_campaigns`
      - `GET /api/campaigns/{id}` → `pixel::campaign_handlers::get_campaign`
      - `PATCH /api/campaigns/{id}` → `pixel::campaign_handlers::update_campaign`
      - `DELETE /api/campaigns/{id}` → `pixel::campaign_handlers::delete_campaign`
      - `POST /api/campaigns/{id}/conversions` → `pixel::campaign_handlers::create_custom_conversion`
      - `GET /api/campaigns/{id}/conversions` → `pixel::campaign_handlers::list_custom_conversions`
      - `PATCH /api/campaigns/{campaign_id}/conversions/{conversion_id}` → `pixel::campaign_handlers::update_custom_conversion`
      - `DELETE /api/campaigns/{campaign_id}/conversions/{conversion_id}` → `pixel::campaign_handlers::delete_custom_conversion`
    - _Requirements: 3.1, 4.1_

- [x] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


### Phase 5: Backend — Event Tracking & Meta CAPI Integration

- [x] 13. Implement pixel event ingestion endpoint
  - [x] 13.1 Create `backend/src/pixel/event_handlers.rs` with the new pixel event endpoint
    - Implement `pub async fn receive_pixel_event(State, HeaderMap, Json<PixelEventRequest>) -> Result<ResponseBody, AppError>`
      - This is a PUBLIC endpoint (no auth required) at `POST /api/pixel-events`
      - Apply rate limiting using `state.pixel_meta_attempts` — max 100 requests/minute per IP (Requirement 19.7)
      - Validate `pixel_id` exists and status is `"active"`; reject with 404 if inactive (Requirement 1.5)
      - Generate unique `event_id` using `format!("{}-{}", Utc::now().timestamp_millis(), Uuid::new_v4().simple())`
      - Check for duplicate `event_id` in `pixel_events` table; return 409 if duplicate (Requirement 7.3)
      - Hash `ip_address` using `crypto::hash_pii` before storage (Requirement 17.1)
      - Hash `email` and `phone` fields inside `user_data` JSON using `crypto::hash_pii` (Requirements 17.2, 17.3)
      - Extract all UTM params from `event_source_url` query string and store as JSON in `utm_params`
      - Match event to campaign by looking up `utm_admin` value in `campaigns` table (Requirement 8.1)
      - Insert into `pixel_events` table
      - Spawn async task to call `meta_capi::send_event` (non-blocking, Requirement 6.1)
      - If event is `Purchase` or `Lead`, spawn async task to create conversion record (Requirement 9.1, 9.2)
      - Check custom conversion rules for the matched campaign and create conversion records if matched (Requirement 4.3)
      - Return success within 100ms (Requirement 18.1)
      - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 7.1, 7.3, 8.1, 8.2, 8.3, 17.1, 17.2, 17.3, 18.1, 19.7_
  - [x] 13.2 Write property test for event_id uniqueness and deduplication
    - **Property 1: Event deduplication — no two stored events share the same event_id**
    - **Validates: Requirements 7.1, 7.3**
  - [x] 13.3 Write property test for PII hashing
    - **Property 2: PII hashing is one-way — hashed IP/email/phone never equals the plaintext input**
    - **Validates: Requirements 17.1, 17.2, 17.3, 17.4**

- [x] 14. Implement Meta CAPI integration
  - [x] 14.1 Create `backend/src/pixel/meta_capi.rs` with Meta Conversions API client
    - Implement `pub async fn send_event(pool: &SqlitePool, event_id: &str, pixel_id: &str, access_token_encrypted: &str) -> Result<(), MetaCapiError>`
      - Decrypt `access_token` using `crypto::decrypt_token`
      - Build Meta CAPI payload per the design: `event_name`, `event_time`, `event_id`, `event_source_url`, `action_source = "website"`, `user_data` (hashed), `custom_data`
      - POST to `https://graph.facebook.com/v19.0/{pixel_id}/events` using the existing `reqwest` client
      - On success: update `pixel_events` SET `sent_to_meta = 1`, `meta_event_id = ?` WHERE `event_id = ?`
      - On error: update `pixel_events` SET `error_message = ?`, `retry_count = retry_count + 1` WHERE `event_id = ?`
      - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.7, 17.5, 17.6_
    - Implement `pub async fn send_test_event(pixel_id: &str, access_token_encrypted: &str, event: &PixelEventRequest, test_event_code: &str) -> Result<Value, MetaCapiError>`
      - POST to `https://graph.facebook.com/v19.0/{pixel_id}/events` with `test_event_code` query param
      - Return the raw Meta API response JSON for display to the admin
      - Do NOT write to `pixel_events` table (Requirement 15.6)
      - _Requirements: 15.1, 15.2, 15.3, 15.4_
  - [x] 14.2 Write unit tests for Meta CAPI client
    - Test `send_event` correctly sets `sent_to_meta = 1` on success
    - Test `send_event` increments `retry_count` on error
    - Test `send_test_event` does not insert into `pixel_events`
    - _Requirements: 6.3, 6.4, 15.6_

- [x] 15. Implement retry background job for failed Meta CAPI events
  - [x] 15.1 Add retry logic to `backend/src/pixel/meta_capi.rs`
    - Implement `pub async fn retry_failed_events(pool: &SqlitePool) -> Result<(), MetaCapiError>`
      - Query `pixel_events` WHERE `sent_to_meta = 0 AND retry_count < 3` ORDER BY `created_at ASC` LIMIT 100
      - For each event, call `send_event` with exponential backoff delay: `2^retry_count` seconds (1s, 2s, 4s)
      - After 3 failures, log error with `tracing::error!` and leave `retry_count = 3` as terminal state (Requirement 6.6)
      - Update `last_retry_run` in `AppState` on completion
      - _Requirements: 6.5, 6.6, 19.1, 19.2_
  - [x] 15.2 Register retry job in `backend/src/main.rs`
    - Spawn a `tokio::task` that calls `pixel::meta_capi::retry_failed_events` every 60 seconds
    - Log start and completion time of each run (Requirement 25.1)
    - _Requirements: 19.1, 25.1, 25.2_

- [x] 16. Register event tracking and test event routes
  - [x] 16.1 Add event routes to `backend/src/routes.rs`
    - Add routes (preserving existing `/api/telemetry/pixel-event` unchanged):
      - `POST /api/pixel-events` → `pixel::event_handlers::receive_pixel_event` (public, no auth)
      - `POST /api/pixel-events/test` → `pixel::event_handlers::send_test_event` (requires `Role::Admin`)
    - _Requirements: 5.1, 15.1, 15.5_


### Phase 6: Backend — Analytics Aggregation & Background Jobs

- [x] 17. Implement analytics aggregation job
  - [x] 17.1 Create `backend/src/pixel/analytics_job.rs` with the aggregation logic
    - Implement `pub async fn run_analytics_aggregation(pool: &SqlitePool, state: &AppState) -> Result<(), AnalyticsError>`
      - Check `state.analytics_job_running` AtomicBool; if already `true`, log warning and return early (Requirement 25.5)
      - Set `analytics_job_running = true` at start; set to `false` in a `defer`-style pattern (use `scopeguard` or explicit finally block)
      - Log start time with `tracing::info!`
      - For each `period_type` in `["hourly", "daily", "weekly", "monthly"]`:
        - Compute `period_start` and `period_end` for the current period
        - Aggregate `pixel_analytics`: COUNT events, COUNT DISTINCT fbp/user_id, SUM by event_type, SUM revenue from conversions
        - Aggregate `campaign_analytics`: COUNT events, COUNT DISTINCT fbp/user_id, COUNT conversions, conversion_rate = conversions/total_events, SUM revenue
        - Use `INSERT OR REPLACE` (SQLite UPSERT) on the UNIQUE constraint `(pixel_id/campaign_id, period_type, period_start)`
        - Update `updated_at = CURRENT_TIMESTAMP`
      - Update `state.last_analytics_run` with current timestamp on success
      - Log completion time; warn if duration exceeds 5 minutes (Requirement 25.3)
      - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 25.1, 25.3, 25.5, 25.6_
  - [x] 17.2 Write property test for analytics aggregation correctness
    - **Property 3: Analytics total_events equals COUNT of raw pixel_events for the same pixel and period**
    - **Validates: Requirements 10.2, 10.6**
  - [x] 17.3 Register analytics job in `backend/src/main.rs`
    - Spawn a `tokio::task` that calls `pixel::analytics_job::run_analytics_aggregation` every 5 minutes
    - Log job start and end; log error with stack trace on failure (Requirement 25.2)
    - _Requirements: 10.1, 25.1, 25.2, 25.6_

- [x] 18. Implement health check endpoint with job status
  - [x] 18.1 Add pixel system health info to the existing `/health` endpoint in `backend/src/routes.rs`
    - Extend the `health` handler to include:
      - `analytics_job_running: bool` from `state.analytics_job_running`
      - `last_analytics_run: Option<String>` from `state.last_analytics_run`
      - `last_retry_run: Option<String>` from `state.last_retry_run`
    - _Requirements: 25.4_


### Phase 7: Backend — Analytics API Endpoints

- [x] 19. Implement Super Admin analytics endpoints
  - [x] 19.1 Create `backend/src/pixel/analytics_handlers.rs` with Super Admin analytics
    - Implement `pub async fn get_super_admin_dashboard(State, HeaderMap, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Accept query params: `period_type` (default `"daily"`), `start_date`, `end_date`
      - Query `pixel_analytics` for all pixels within the date range
      - Query `campaign_analytics` for all campaigns within the date range
      - Include real-time event count from last hour: `SELECT COUNT(*) FROM pixel_events WHERE event_time > datetime('now', '-1 hour')`
      - Return within 500ms (Requirement 18.3)
      - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.6, 18.3_
    - Implement `pub async fn get_pixel_analytics(State, HeaderMap, Path<String>, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Return `pixel_analytics` rows for the specified pixel and date range
      - _Requirements: 11.2, 11.4_
    - Implement `pub async fn get_audit_logs(State, HeaderMap, Query<AuditQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::SuperAdmin`
      - Accept filter params: `action_type`, `resource_type`, `user_id`, `start_date`, `end_date`
      - Query `pixel_audit_logs` with filters applied
      - _Requirements: 16.6_

- [x] 20. Implement Admin analytics endpoints
  - [x] 20.1 Add Admin analytics functions to `backend/src/pixel/analytics_handlers.rs`
    - Implement `pub async fn get_admin_dashboard(State, HeaderMap, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`
      - Return `campaign_analytics` only for campaigns the admin created (`admin_id = current_user.id`)
      - Include conversion funnel data: PageView → AddToCart → Purchase counts per campaign
      - Include top campaigns ranked by `conversion_rate DESC`
      - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
    - Implement `pub async fn get_campaign_analytics(State, HeaderMap, Path<String>, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Admin`; verify admin owns the campaign
      - Return `campaign_analytics` rows for the specified campaign and date range
      - _Requirements: 12.3, 12.4_

- [x] 21. Implement role-based analytics endpoints for Agent/Sales/Editor
  - [x] 21.1 Add role-scoped analytics functions to `backend/src/pixel/analytics_handlers.rs`
    - Implement `pub async fn get_agent_pixel_analytics(State, HeaderMap, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Agent`
      - Return campaign-level metrics only (no pixel-level) for events where `pixel_events.user_id = current_user.id`
      - _Requirements: 13.1, 13.4, 13.5_
    - Implement `pub async fn get_sales_pixel_analytics(State, HeaderMap, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Sales`
      - Return campaign-level metrics for campaigns tagged with `utm_admin` matching the sales user's identifier
      - _Requirements: 13.2, 13.4, 13.5_
    - Implement `pub async fn get_editor_pixel_analytics(State, HeaderMap, Query<AnalyticsQuery>) -> Result<ResponseBody, AppError>`
      - Authorize `Role::Editor` (maps to "marketing" role in requirements)
      - Return campaign-level metrics for all campaigns the editor has been granted view permission on via `pixel_admins.permissions`
      - _Requirements: 13.3, 13.4, 13.5_
  - [x] 21.2 Register all analytics routes in `backend/src/routes.rs`
    - Add routes:
      - `GET /api/pixel-analytics/super-admin` → `pixel::analytics_handlers::get_super_admin_dashboard`
      - `GET /api/pixel-analytics/pixels/{id}` → `pixel::analytics_handlers::get_pixel_analytics`
      - `GET /api/pixel-analytics/audit-logs` → `pixel::analytics_handlers::get_audit_logs`
      - `GET /api/pixel-analytics/admin` → `pixel::analytics_handlers::get_admin_dashboard`
      - `GET /api/pixel-analytics/campaigns/{id}` → `pixel::analytics_handlers::get_campaign_analytics`
      - `GET /api/pixel-analytics/agent` → `pixel::analytics_handlers::get_agent_pixel_analytics`
      - `GET /api/pixel-analytics/sales` → `pixel::analytics_handlers::get_sales_pixel_analytics`
      - `GET /api/pixel-analytics/editor` → `pixel::analytics_handlers::get_editor_pixel_analytics`
    - _Requirements: 11.1, 12.1, 13.1, 13.2, 13.3_

- [x] 22. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


### Phase 8: Frontend — Auth & Navigation Extension

- [x] 23. Extend frontend auth and navigation for super_admin role
  - [x] 23.1 Update `RoleGuard` in `frontend/src/App.tsx` to accept `'super_admin'`
    - Change the `role` prop type from `'admin' | 'agent' | 'sales'` to `'admin' | 'agent' | 'sales' | 'super_admin'`
    - _Requirements: 1.7_
  - [x] 23.2 Update `DashboardRoot` in `frontend/src/App.tsx` to redirect `super_admin` to `/dashboard/super-admin`
    - Add `user?.role === 'super_admin'` branch: redirect to `/dashboard/super-admin`
    - Keep existing `admin`, `sales`, `agent` branches unchanged
    - _Requirements: 1.7_
  - [x] 23.3 Add `superAdminSections` to `DashboardLayout.tsx` in `frontend/src/components/layout/DashboardLayout.tsx`
    - Import `Cpu`, `BarChart2`, `Link2`, `FlaskConical` (or equivalent) from `lucide-react` for pixel nav icons
    - Define `superAdminSections` with:
      - Section "Pixel Management": items for "Pixels Overview" (`/dashboard/super-admin`), "Manage Pixels" (`/dashboard/super-admin/pixels`), "Audit Logs" (`/dashboard/super-admin/audit-logs`)
      - Section "Analytics": items for "Platform Analytics" (`/dashboard/super-admin/analytics`)
    - Update `navSections` selector: add `user?.role === 'super_admin' ? superAdminSections :` before existing ternary
    - Update `quickActions` for `super_admin`: show "Pixels" and "Analytics" quick links
    - Update `notificationsPath` for `super_admin`: use `/dashboard/admin/notifications` (reuse admin notifications)
    - _Requirements: 1.6, 11.1_
  - [x] 23.4 Add `super_admin` dashboard routes to `frontend/src/App.tsx`
    - Add lazy imports for new super admin pages (to be created in Phase 9)
    - Add routes under `/dashboard`:
      - `path="super-admin"` with `RoleGuard role="super_admin"`
      - `path="super-admin/pixels"` with `RoleGuard role="super_admin"`
      - `path="super-admin/pixels/new"` with `RoleGuard role="super_admin"`
      - `path="super-admin/pixels/:id"` with `RoleGuard role="super_admin"`
      - `path="super-admin/analytics"` with `RoleGuard role="super_admin"`
      - `path="super-admin/audit-logs"` with `RoleGuard role="super_admin"`
    - _Requirements: 1.6, 11.1_


### Phase 9: Frontend — Super Admin Pixel Management UI

- [x] 24. Create Super Admin pixel list and detail pages
  - [x] 24.1 Create `frontend/src/pages/dashboard/SuperAdminDashboard.tsx`
    - Display summary cards: total pixels, total admins assigned, total events (last 24h), total revenue
    - Fetch from `GET /api/pixel-analytics/super-admin?period_type=daily`
    - Show real-time event count from last hour
    - _Requirements: 11.1, 11.6_
  - [x] 24.2 Create `frontend/src/pages/dashboard/SuperAdminPixelsPage.tsx`
    - Fetch pixel list from `GET /api/pixels`
    - Display table with columns: Pixel ID, Name, Business Manager, Status, Assigned Admins, Total Events, Actions
    - "New Pixel" button navigating to `/dashboard/super-admin/pixels/new`
    - Status badge (active = green, inactive = yellow, suspended = red)
    - Per-row actions: Edit, Assign Admin, Deactivate/Activate
    - _Requirements: 1.6, 2.5_
  - [x] 24.3 Create `frontend/src/pages/dashboard/SuperAdminPixelFormPage.tsx`
    - Form fields: Pixel ID, Name, Business Manager ID, Access Token (masked input), Status, Config (domain verification, event priorities)
    - On submit: `POST /api/pixels` (create) or `PATCH /api/pixels/{id}` (edit)
    - Show assigned admins list with "Assign Admin" and "Revoke" actions calling `POST /api/pixels/{id}/admins` and `DELETE /api/pixels/{id}/admins/{user_id}`
    - Validate admin user exists before assignment (search users by email)
    - Display domain verification instructions (static text per Requirement 20.5)
    - Display event priority configuration (drag-and-drop list of 8 events per Requirement 21.4)
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 20.5, 21.1, 21.4_
  - [x] 24.4 Create `frontend/src/pages/dashboard/SuperAdminAnalyticsPage.tsx`
    - Date range picker (default: last 7 days)
    - Period type selector: hourly / daily / weekly / monthly
    - Charts: total events over time (line chart), event type breakdown (bar chart), revenue by campaign (bar chart)
    - Pixel-level metrics table: pixel name, total events, unique users, purchases, leads, revenue
    - Campaign metrics table across all pixels
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_
  - [x] 24.5 Create `frontend/src/pages/dashboard/SuperAdminAuditLogsPage.tsx`
    - Fetch from `GET /api/pixel-analytics/audit-logs` with filter params
    - Filter controls: action_type dropdown, resource_type dropdown, user search, date range
    - Table: timestamp, user, action, resource type, resource ID, old/new value diff
    - _Requirements: 16.6_

- [x] 25. Create Admin pixel campaign management pages
  - [x] 25.1 Create `frontend/src/pages/dashboard/AdminPixelCampaignsPage.tsx`
    - Fetch campaigns from `GET /api/campaigns`
    - Display table: Campaign Name, Pixel, Status, UTM Admin, Total Events, Conversions, Revenue, Actions
    - Status filter tabs: All / Active / Paused / Completed
    - "New Campaign" button navigating to campaign form
    - Per-row actions: Edit, Pause/Resume, View Analytics
    - _Requirements: 3.5, 23.5, 23.6_
  - [x] 25.2 Create `frontend/src/pages/dashboard/AdminPixelCampaignFormPage.tsx`
    - Form fields: Campaign Name, Pixel (dropdown of assigned pixels), UTM Source, UTM Medium, UTM Campaign, UTM Admin (auto-filled), UTM Content, UTM Term
    - On submit: `POST /api/campaigns` or `PATCH /api/campaigns/{id}`
    - Custom Conversions section: list existing conversions with add/edit/delete
    - Tracking URL preview: auto-generate URL with UTM params appended (Requirement 14)
    - Copy-to-clipboard button for generated URL
    - _Requirements: 3.1, 3.6, 4.1, 14.1, 14.2, 14.3, 14.4, 14.5_


### Phase 10: Frontend — Admin Campaign Management UI

- [x] 26. Add Admin pixel routes to App.tsx
  - [x] 26.1 Add lazy imports and routes for Admin pixel pages in `frontend/src/App.tsx`
    - Add lazy imports for `AdminPixelCampaignsPage` and `AdminPixelCampaignFormPage`
    - Add routes under `/dashboard`:
      - `path="admin/pixel-campaigns"` with `RoleGuard role="admin"`
      - `path="admin/pixel-campaigns/new"` with `RoleGuard role="admin"`
      - `path="admin/pixel-campaigns/:id"` with `RoleGuard role="admin"`
    - _Requirements: 3.1, 3.5_
  - [x] 26.2 Add "Pixel Campaigns" nav item to `adminSections` in `DashboardLayout.tsx`
    - Add to the "Operasional" section: `{ label: 'Pixel Campaigns', icon: BarChart2, path: '/dashboard/admin/pixel-campaigns' }`
    - Import `BarChart2` from `lucide-react` if not already imported
    - _Requirements: 3.5_

- [x] 27. Create Admin analytics dashboard page
  - [x] 27.1 Create `frontend/src/pages/dashboard/AdminPixelAnalyticsPage.tsx`
    - Fetch from `GET /api/pixel-analytics/admin` with date range and campaign filter params
    - Date range picker and campaign selector dropdown
    - Conversion funnel visualization: PageView → AddToCart → InitiateCheckout → Purchase (funnel chart or step bars)
    - Campaign performance table: name, events, conversions, conversion rate, revenue, ROAS
    - Top campaigns ranked by conversion rate
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_
  - [x] 27.2 Add `AdminPixelAnalyticsPage` route and nav item
    - Add lazy import and route `path="admin/pixel-analytics"` with `RoleGuard role="admin"` in `App.tsx`
    - Add nav item to `adminSections` "Utama" section: `{ label: 'Pixel Analytics', icon: TrendingUp, path: '/dashboard/admin/pixel-analytics' }`
    - _Requirements: 12.1_

- [x] 28. Create Agent and Sales analytics pages
  - [x] 28.1 Create `frontend/src/pages/dashboard/AgentPixelAnalyticsPage.tsx`
    - Fetch from `GET /api/pixel-analytics/agent`
    - Display campaign-level metrics only (no pixel-level data)
    - Show events attributed to the agent's user_id
    - _Requirements: 13.1, 13.4, 13.5_
  - [x] 28.2 Create `frontend/src/pages/dashboard/SalesPixelAnalyticsPage.tsx`
    - Fetch from `GET /api/pixel-analytics/sales`
    - Display campaign-level metrics for campaigns tagged with the sales user's identifier
    - _Requirements: 13.2, 13.4, 13.5_
  - [x] 28.3 Add routes and nav items for Agent and Sales analytics pages
    - Add lazy imports and routes in `App.tsx`:
      - `path="agent/pixel-analytics"` with `RoleGuard role="agent"`
      - `path="sales/pixel-analytics"` with `RoleGuard role="sales"`
    - Add nav items to `agentSections` and `salesSections` in `DashboardLayout.tsx`:
      - Agent "Penjualan" section: `{ label: 'Pixel Analytics', icon: BarChart3, path: '/dashboard/agent/pixel-analytics' }`
      - Sales "Operasional" section: `{ label: 'Pixel Analytics', icon: BarChart3, path: '/dashboard/sales/pixel-analytics' }`
    - _Requirements: 13.1, 13.2_


### Phase 11: Frontend — Analytics Dashboards

- [x] 29. Create shared analytics components
  - [x] 29.1 Create `frontend/src/components/pixel/ConversionFunnel.tsx`
    - Props: `{ pageViews: number, addToCarts: number, checkouts: number, purchases: number }`
    - Render a step-down funnel visualization using CSS or a lightweight chart library already in the project
    - Show drop-off percentage between each step
    - _Requirements: 12.5_
  - [x] 29.2 Create `frontend/src/components/pixel/MetricsCard.tsx`
    - Reusable card component for displaying a single metric with label, value, and optional trend indicator
    - Props: `{ label: string, value: string | number, trend?: number, currency?: string }`
    - _Requirements: 11.2, 12.2_
  - [x] 29.3 Create `frontend/src/components/pixel/CampaignTable.tsx`
    - Reusable table for campaign analytics rows
    - Columns configurable via props; supports sorting by conversion_rate, revenue, total_events
    - _Requirements: 12.6_

- [x] 30. Create multi-currency revenue display
  - [x] 30.1 Update analytics pages to group and display revenue by currency
    - In `SuperAdminAnalyticsPage`, `AdminPixelAnalyticsPage`: group revenue totals by currency code
    - Display as `IDR 1,500,000 / USD 100` format when multiple currencies present
    - Default to USD when currency is absent
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [x] 31. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.


### Phase 12: Frontend — Pixel Event Tester & URL Generator

- [x] 32. Create Pixel Event Tester page
  - [x] 32.1 Create `frontend/src/pages/dashboard/AdminPixelEventTesterPage.tsx`
    - Campaign selector dropdown (fetches from `GET /api/campaigns`)
    - Event type selector: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Lead, CompleteRegistration
    - Dynamic form fields based on event type:
      - All events: `event_source_url`, `user_agent`
      - Purchase: `value`, `currency`, `order_id`, `content_ids`
      - Lead: `lead_id`
    - Optional fields: `fbp`, `fbc`, `email` (for user_data hashing test), `phone`
    - `test_event_code` input field (required for test mode)
    - "Send Test Event" button: POST to `POST /api/pixel-events/test`
    - Display raw Meta API response JSON in a code block
    - Display validation errors from Meta in a highlighted error section
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_
  - [x] 32.2 Add route and nav item for Pixel Event Tester
    - Add lazy import and route `path="admin/pixel-tester"` with `RoleGuard role="admin"` in `App.tsx`
    - Add nav item to `adminSections` "Operasional" section: `{ label: 'Pixel Tester', icon: FlaskConical, path: '/dashboard/admin/pixel-tester' }`
    - Import `FlaskConical` from `lucide-react`
    - _Requirements: 15.5_

- [x] 33. Create Tracking URL Generator component
  - [x] 33.1 Create `frontend/src/components/pixel/TrackingUrlGenerator.tsx`
    - Props: `{ campaign: CampaignRecord }`
    - Base URL input field (the landing page URL to append UTM params to)
    - Auto-populate UTM fields from campaign: utm_source, utm_medium, utm_campaign, utm_admin
    - Optional fields: utm_content, utm_term
    - URL-encode all parameter values (Requirement 14.3)
    - Live preview of the generated URL
    - "Copy URL" button with clipboard API and visual feedback
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 33.2 Embed `TrackingUrlGenerator` in `AdminPixelCampaignFormPage.tsx`
    - Show the generator in a collapsible section below the campaign form fields
    - Only show when editing an existing campaign (not on create)
    - _Requirements: 14.1, 14.4_


### Phase 13: Testing & Verification

- [x] 34. Property-based tests for crypto utilities
  - [x] 34.1 Write property test for AES-256-GCM token encryption round-trip
    - **Property 4: Encrypt-then-decrypt round-trip — for any plaintext string, `decrypt(encrypt(plaintext)) == plaintext`**
    - **Validates: Requirements 1.3, 17.7**
    - Write in `backend/src/pixel/crypto.rs` using `proptest` or `quickcheck`
  - [x] 34.2 Write property test for SHA-256 PII hashing determinism
    - **Property 5: PII hashing is deterministic — `hash_pii(x) == hash_pii(x)` for all inputs**
    - **Validates: Requirements 17.1, 17.2, 17.3**

- [x] 35. Property-based tests for campaign attribution
  - [x] 35.1 Write property test for UTM parameter extraction
    - **Property 6: UTM extraction completeness — all UTM params present in a URL are captured in the stored `utm_params` JSON**
    - **Validates: Requirements 5.4, 8.5**
  - [x] 35.2 Write property test for campaign attribution matching
    - **Property 7: Attribution consistency — an event with `utm_admin = X` is always attributed to the campaign whose `utm_admin = X`, never to a different campaign**
    - **Validates: Requirements 8.1, 8.2, 8.4**

- [x] 36. Property-based tests for analytics correctness
  - [x] 36.1 Write property test for conversion rate calculation
    - **Property 8: Conversion rate bounds — `conversion_rate` is always in `[0.0, 1.0]` and equals `conversions / total_events` when `total_events > 0`**
    - **Validates: Requirements 10.7**
  - [x] 36.2 Write property test for unique user counting
    - **Property 9: Unique user count never exceeds total event count for the same pixel and period**
    - **Validates: Requirements 10.6**

- [x] 37. Integration tests for event ingestion pipeline
  - [x] 37.1 Write integration test for the full event ingestion flow
    - Test: POST to `/api/pixel-events` → event stored in DB → Meta CAPI called asynchronously → `sent_to_meta = 1` after job runs
    - Test: duplicate `event_id` returns 409
    - Test: inactive pixel returns 404
    - _Requirements: 5.1, 5.5, 6.1, 6.3, 7.3_
  - [x] 37.2 Write integration test for retry job
    - Test: event with `retry_count = 2` is retried; after 3 failures `retry_count = 3` and no further retries
    - _Requirements: 6.5, 6.6_

- [x] 38. Integration tests for RBAC enforcement
  - [x] 38.1 Write integration tests for role-based access control
    - Test: `admin` role cannot call `POST /api/pixels` (returns 403)
    - Test: `super_admin` role cannot call `POST /api/campaigns` (returns 403)
    - Test: `agent` role calling `/api/pixel-analytics/agent` returns only their own data
    - Test: `editor` role calling `/api/pixel-analytics/editor` returns only permitted campaigns
    - _Requirements: 1.7, 3.2, 13.1, 13.3_

- [x] 39. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 12, 22, 31, and 39 ensure incremental validation
- The existing `POST /api/telemetry/pixel-event` route at `backend/src/routes.rs` MUST NOT be modified — it writes to `telemetry_events` and is used by existing telemetry stats
- The new pixel event endpoint is `POST /api/pixel-events` (separate route)
- `reqwest` is already in `Cargo.toml`; only `aes-gcm` and `sha2` need to be added
- Requirement 13 "marketing" role maps to the existing `editor` role in this codebase
- All frontend pixel pages follow the `Admin*.tsx` / `SuperAdmin*.tsx` naming convention in `frontend/src/pages/dashboard/`
- Migration files use the next available sequence: `2026050401`, `2026050402`, `2026050403`
