# Webhook Config Management API Implementation

## Overview

This document describes the implementation of Task 15: Webhook Config Management API for the self-hosted WhatsApp gateway.

## Implementation Details

### File Structure

- **`backend/src/wa_webhook_handlers.rs`**: Main implementation file containing all webhook management handlers
- **`backend/src/routes.rs`**: Updated to include webhook routes
- **`backend/src/lib.rs`**: Updated to export the wa_webhook_handlers module
- **`backend/tests/webhook_routes_test.rs`**: Unit tests for webhook functionality

### API Endpoints

#### 1. POST /api/wa/webhooks - Create Webhook Config

**Authentication**: Requires `Admin` or `WaAdmin` role

**Request Body**:
```json
{
  "accountId": "string",
  "webhookUrl": "string",
  "enabled": true,
  "retryConfig": {
    "maxRetries": 3,
    "backoffMultiplier": 3.0,
    "timeoutMs": 10000
  }
}
```

**Features**:
- Validates webhook URL format (HTTP/HTTPS only)
- Tests webhook URL accessibility with a test HTTP request
- Generates random 32-byte secret key (base64 encoded)
- Validates account_id exists in wa_accounts table
- Validates retry config parameters

**Response**:
```json
{
  "success": true,
  "message": "Webhook berhasil dibuat",
  "data": {
    "webhook": {
      "id": "uuid",
      "accountId": "string",
      "webhookUrl": "string",
      "secretKeyMasked": "****abcd",
      "enabled": true,
      "retryConfig": {...},
      "createdAt": "timestamp",
      "updatedAt": null
    }
  }
}
```

#### 2. GET /api/wa/webhooks - List Webhooks

**Authentication**: Requires `Admin`, `WaAdmin`, or `WaOperator` role

**Query Parameters**:
- `page` (default: 1): Page number for pagination
- `limit` (default: 50, max: 100): Items per page
- `accountId` (optional): Filter by account ID

**Features**:
- Pagination support
- Optional filtering by account_id
- Secret keys are masked (shows only last 4 characters)

**Response**:
```json
{
  "success": true,
  "message": "Webhooks berhasil diambil",
  "data": {
    "webhooks": [...],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 100,
      "totalPages": 2
    }
  }
}
```

#### 3. PATCH /api/wa/webhooks/{id} - Update Webhook Config

**Authentication**: Requires `Admin` or `WaAdmin` role

**Request Body** (all fields optional):
```json
{
  "webhookUrl": "string",
  "enabled": true,
  "retryConfig": {...}
}
```

**Features**:
- Validates webhook URL if provided
- Tests webhook URL accessibility if URL is updated
- Validates retry config if provided
- Updates only provided fields
- Returns error if no fields to update

#### 4. DELETE /api/wa/webhooks/{id} - Delete Webhook Config

**Authentication**: Requires `Admin` or `WaAdmin` role

**Features**:
- Deletes webhook configuration
- Cascade deletes associated webhook logs (via database foreign key)
- Returns 404 if webhook not found

## Security Features

### 1. Secret Key Generation
- Generates cryptographically secure 32-byte random keys
- Base64 encoded for storage and transmission
- Used for HMAC-SHA256 signature verification in webhook payloads

### 2. Secret Key Masking
- Secret keys are never returned in full via API
- Only last 4 characters are shown (e.g., "****abcd")
- Full secret key is only stored in database

### 3. URL Validation
- Validates URL format using reqwest::Url parser
- Only allows HTTP and HTTPS schemes
- Rejects invalid URLs, FTP, file://, etc.

### 4. URL Accessibility Testing
- Sends test HTTP POST request to webhook URL
- Accepts both 2xx and 4xx responses (endpoint is reachable)
- Rejects if endpoint is unreachable or returns 5xx
- 5-second timeout to prevent hanging

### 5. Authentication & Authorization
- All endpoints require Bearer token authentication
- Role-based access control:
  - Create/Update/Delete: `Admin` or `WaAdmin` only
  - List: `Admin`, `WaAdmin`, or `WaOperator`

### 6. Input Validation
- Validates retry config parameters:
  - max_retries: 0-10
  - backoff_multiplier: 1.0-10.0
  - timeout_ms: 1000-60000
- Validates account_id exists before creating webhook
- Validates webhook_id exists before updating/deleting

## Database Schema

The implementation uses the `wa_webhooks` table created in migration `2026050501_wa_gateway_core.sql`:

```sql
CREATE TABLE IF NOT EXISTS wa_webhooks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    secret_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT 1,
    retry_config TEXT, -- JSON: {max_retries, backoff_multiplier, timeout_ms}
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE
);
```

## Requirements Coverage

This implementation satisfies all requirements from Requirement 17:

- ✅ **17.1**: POST /api/wa/webhooks endpoint implemented
- ✅ **17.2**: GET /api/wa/webhooks with pagination implemented
- ✅ **17.3**: PATCH /api/wa/webhooks/{id} endpoint implemented
- ✅ **17.4**: DELETE /api/wa/webhooks/{id} endpoint implemented
- ✅ **17.5**: Random secret_key generation (32 bytes, base64 encoded)
- ✅ **17.6**: Webhook URL validation with test HTTP request
- ✅ **17.7**: Authentication and permission check (wa_webhook_manage via Admin/WaAdmin roles)
- ✅ **17.8**: Secret key masking in responses (show last 4 chars only)

## Error Handling

The implementation provides comprehensive error handling:

- **400 Bad Request**: Invalid input (URL format, retry config, missing fields)
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Webhook or account not found
- **500 Internal Server Error**: Database or system errors

All errors return structured JSON responses with descriptive error messages in Indonesian.

## Testing

Unit tests are provided in `backend/tests/webhook_routes_test.rs`:

- Test authentication requirement
- Test URL validation
- Test secret key masking
- Test secret key generation length

Integration tests are marked as `#[ignore]` until test database setup is complete.

## Dependencies

All required dependencies are already present in `backend/Cargo.toml`:

- `reqwest`: HTTP client for webhook URL testing
- `base64`: Secret key encoding
- `rand`: Cryptographically secure random number generation
- `serde_json`: JSON serialization
- `sqlx`: Database operations
- `axum`: Web framework

## Compilation Status

✅ Code compiles successfully with `cargo check`
✅ No compilation errors
⚠️ Minor warnings about unused imports (not critical)

## Next Steps

1. Run integration tests with test database
2. Test webhook creation with real WhatsApp accounts
3. Verify webhook URL testing works with various endpoints
4. Test pagination with large datasets
5. Verify secret key masking in all response scenarios
