# Task 21: Bomber Feature Implementation

## Overview
Implemented the Bomber feature with cooldown protection for the self-hosted WhatsApp gateway. This feature allows sending repeated messages to a single recipient for testing purposes, with built-in safeguards to prevent abuse.

## Requirements Validated
- **8.1**: Bomber mode support for single recipient multiple sends
- **8.2**: Bomber config validation (target phone, message, repeat count max 50, interval seconds)
- **8.3**: Minimum interval enforcement (10 seconds between repetitions)
- **8.4**: Cooldown enforcement (1 hour per target phone after execution)
- **8.5**: Cooldown rejection with error 'cooldown_active'
- **8.6**: Bomber execution logging to wa_bomber_logs table
- **8.7**: Admin override for cooldown protection
- **8.8**: Permission check for 'wa_bomber' permission

## Implementation Details

### 1. Created `backend/src/bomber.rs`
New module implementing the bomber feature with:

#### BomberEngine Struct
- Manages bomber execution lifecycle
- Integrates with BridgeClient for message sending
- Uses Redis for cooldown tracking
- Logs executions to SQLite database

#### Key Components
- **BomberRequest**: Request payload with validation
  - account_id: WhatsApp account to use
  - target_phone: E.164 format phone number
  - message: Message text
  - repeat_count: 1-50 repetitions
  - interval_seconds: Minimum 10 seconds
  - override_cooldown: Admin-only flag

- **BomberResponse**: Success response
  - bomber_id: Unique execution ID
  - account_id: Account used
  - target_phone: Target number
  - repeat_count: Number of repetitions
  - interval_seconds: Interval between sends
  - estimated_completion_time: ISO8601 timestamp

- **CooldownErrorResponse**: Cooldown active response
  - target_phone: Target number
  - cooldown_expires_at: ISO8601 expiration time
  - remaining_seconds: Time remaining

#### Validation Logic
```rust
pub fn validate_config(config: &BomberRequest) -> Result<(), AppError>
```
- Repeat count: 1-50 (Requirement 8.2)
- Interval: Minimum 10 seconds (Requirement 8.3)
- Phone format: E.164 validation
- Message: Non-empty check

#### Cooldown Management
```rust
pub async fn check_cooldown(&mut self, target_phone: &str) -> Result<Option<CooldownErrorResponse>, AppError>
async fn set_cooldown(&mut self, target_phone: &str) -> Result<(), AppError>
```
- Redis key: `bomber:cooldown:{target_phone}`
- TTL: 3600 seconds (1 hour) (Requirement 8.4)
- Returns remaining time if active (Requirement 8.5)

#### Execution Logic
```rust
pub async fn execute_bomber(&mut self, config: BomberRequest, user_id: String, is_admin: bool) -> Result<BomberResponse, AppError>
```
1. Validate configuration
2. Check account exists and is connected
3. Check cooldown (unless admin override) (Requirement 8.7)
4. Log to wa_bomber_logs table (Requirement 8.6)
5. Spawn async task for execution
6. Set cooldown
7. Return response immediately

#### Background Task
```rust
async fn execute_bomber_task(...)
```
- Sends messages sequentially with interval delays
- Continues on individual message failures
- Logs success/failure counts
- Runs asynchronously without blocking API response

### 2. Updated `backend/src/response.rs`
Added new error variant for cooldown:

```rust
#[error("cooldown active")]
CooldownActive {
    target_phone: String,
    cooldown_expires_at: String,
    remaining_seconds: i64,
}
```

Custom response format matching spec:
```json
{
  "error": "cooldown_active",
  "message": "Target phone masih dalam cooldown period",
  "data": {
    "targetPhone": "+628123456789",
    "cooldownExpiresAt": "2026-05-05T11:00:00Z",
    "remainingSeconds": 1800
  }
}
```

### 3. Updated `backend/src/lib.rs`
Added bomber module to public exports:
```rust
pub mod bomber;
```

### 4. Updated `backend/src/api_routes.rs`
Added bomber endpoint and permission checking:

#### Permission Check Function
```rust
fn check_permission(token: &ApiTokenRecord, permission: &str) -> Result<(), AppError>
```
- Parses permissions JSON array from API token
- Checks for specific permission (Requirement 8.8)
- Returns Forbidden error if missing

#### Bomber Endpoint
```rust
async fn execute_bomber(State(state): State<AppState>, headers: HeaderMap, Json(payload): Json<BomberRequest>) -> Result<axum::response::Response, AppError>
```

**Endpoint**: `POST /api/wa/bomber`

**Authentication**: Bearer token (wa_api_tokens)

**Permission Required**: `wa_bomber` (Requirement 8.8)

**Rate Limit**: 100 requests per minute per API token

**Request Body**:
```json
{
  "accountId": "account-uuid",
  "targetPhone": "+628123456789",
  "message": "Test message",
  "repeatCount": 10,
  "intervalSeconds": 15,
  "overrideCooldown": false
}
```

**Success Response** (200 OK):
```json
{
  "success": true,
  "message": "Bomber execution berhasil dimulai",
  "data": {
    "bomberId": "bomber-uuid",
    "accountId": "account-uuid",
    "targetPhone": "+628123456789",
    "repeatCount": 10,
    "intervalSeconds": 15,
    "estimatedCompletionTime": "2026-05-05T10:05:00Z"
  }
}
```

**Cooldown Error Response** (429 Too Many Requests):
```json
{
  "error": "cooldown_active",
  "message": "Target phone masih dalam cooldown period",
  "data": {
    "targetPhone": "+628123456789",
    "cooldownExpiresAt": "2026-05-05T11:00:00Z",
    "remainingSeconds": 1800
  }
}
```

**Validation Error Response** (400 Bad Request):
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "Repeat count cannot exceed 50"
  ]
}
```

**Permission Error Response** (403 Forbidden):
```json
{
  "success": false,
  "message": "Access denied",
  "errors": []
}
```

#### Endpoint Logic
1. Verify API token authentication
2. Check wa_bomber permission (Requirement 8.8)
3. Check rate limit (100 req/min)
4. Get user role for admin check
5. Create Redis connection for cooldown
6. Create BridgeClient for message sending
7. Initialize BomberEngine
8. Execute bomber (validates, checks cooldown, spawns task)
9. Audit log the execution
10. Return success response

#### Admin Override
- Checks user role: `admin` or `wa_admin`
- Only admins can set `overrideCooldown: true`
- Non-admins always subject to cooldown (Requirement 8.7)

### 5. Database Integration
Uses existing `wa_bomber_logs` table from migration `2026050501_wa_gateway_core.sql`:

```sql
CREATE TABLE IF NOT EXISTS wa_bomber_logs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    target_phone TEXT NOT NULL,
    message TEXT NOT NULL,
    repeat_count INTEGER NOT NULL,
    executed_by TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES wa_accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (executed_by) REFERENCES users(id) ON DELETE CASCADE
);
```

Logs include:
- Unique bomber ID
- Account used
- Target phone
- Message sent
- Repeat count
- User who executed
- Timestamp

### 6. Redis Integration
Uses Redis for cooldown tracking:

**Key Format**: `bomber:cooldown:{target_phone}`
**TTL**: 3600 seconds (1 hour)
**Value**: "1" (presence indicates cooldown active)

Operations:
- `TTL` command to check remaining time
- `SETEX` command to set cooldown with expiration

### 7. Bridge Integration
Uses existing BridgeClient to send messages:

```rust
bridge_client.send_request(
    &account_id,
    "send_message".to_string(),
    serde_json::json!({
        "phone": target_phone,
        "message": message,
    })
).await
```

Continues execution even if individual messages fail, logging errors.

## Testing

### Unit Tests
Created 6 unit tests in `bomber.rs`:

1. **test_validate_config_valid**: Valid configuration passes
2. **test_validate_config_repeat_count_zero**: Rejects zero repeat count
3. **test_validate_config_repeat_count_exceeds_max**: Rejects count > 50
4. **test_validate_config_interval_too_short**: Rejects interval < 10s
5. **test_validate_config_invalid_phone**: Rejects invalid phone format
6. **test_validate_config_empty_message**: Rejects empty message

**Test Results**: All 6 tests pass ✅

### Manual Testing Checklist
To test the implementation:

1. **Create API Token with wa_bomber permission**:
```sql
INSERT INTO wa_api_tokens (id, user_id, token_hash, name, permissions, expires_at)
VALUES (
  'token-123',
  'user-id',
  '$argon2id$...',  -- Hash of actual token
  'Bomber Test Token',
  '["wa_bomber"]',
  NULL
);
```

2. **Test Valid Request**:
```bash
curl -X POST http://localhost:3000/api/wa/bomber \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-uuid",
    "targetPhone": "+628123456789",
    "message": "Test message",
    "repeatCount": 5,
    "intervalSeconds": 10
  }'
```

Expected: 200 OK with bomber_id and estimated completion time

3. **Test Cooldown (immediate retry)**:
```bash
# Same request as above
```

Expected: 429 Too Many Requests with cooldown details

4. **Test Validation Errors**:
```bash
# Repeat count > 50
curl -X POST http://localhost:3000/api/wa/bomber \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-uuid",
    "targetPhone": "+628123456789",
    "message": "Test",
    "repeatCount": 51,
    "intervalSeconds": 10
  }'
```

Expected: 400 Bad Request with validation error

5. **Test Permission Denied**:
```bash
# Use token without wa_bomber permission
curl -X POST http://localhost:3000/api/wa/bomber \
  -H "Authorization: Bearer TOKEN_WITHOUT_PERMISSION" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

Expected: 403 Forbidden

6. **Test Admin Override**:
```bash
# Admin user with overrideCooldown: true
curl -X POST http://localhost:3000/api/wa/bomber \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "accountId": "account-uuid",
    "targetPhone": "+628123456789",
    "message": "Test",
    "repeatCount": 5,
    "intervalSeconds": 10,
    "overrideCooldown": true
  }'
```

Expected: 200 OK even if cooldown active (admin only)

7. **Verify Database Logging**:
```sql
SELECT * FROM wa_bomber_logs ORDER BY created_at DESC LIMIT 10;
```

Expected: Bomber execution logged with all details

8. **Verify Redis Cooldown**:
```bash
redis-cli TTL bomber:cooldown:+628123456789
```

Expected: Remaining seconds (up to 3600)

## Edge Cases Handled

1. **Account Not Found**: Returns validation error
2. **Account Not Connected**: Returns validation error with status
3. **Invalid Phone Format**: Returns validation error (E.164 required)
4. **Empty Message**: Returns validation error
5. **Repeat Count Out of Range**: Returns validation error (1-50)
6. **Interval Too Short**: Returns validation error (min 10s)
7. **Cooldown Active**: Returns 429 with cooldown details
8. **Admin Override**: Bypasses cooldown check
9. **Non-Admin Override Attempt**: Ignores override flag
10. **Individual Message Failure**: Continues with remaining messages
11. **Bridge Connection Error**: Logs error, continues execution
12. **Redis Connection Error**: Returns internal server error
13. **Database Error**: Returns internal server error
14. **Missing Permission**: Returns 403 Forbidden
15. **Expired Token**: Returns 401 Unauthorized

## Security Considerations

1. **Permission-Based Access**: Only users with wa_bomber permission can use feature
2. **Cooldown Protection**: Prevents abuse with 1-hour cooldown per target
3. **Rate Limiting**: 100 requests per minute per API token
4. **Admin-Only Override**: Only admin/wa_admin roles can bypass cooldown
5. **Validation**: Strict input validation prevents malicious payloads
6. **Audit Logging**: All executions logged with user ID
7. **Token Authentication**: Argon2id-hashed tokens required
8. **Token Expiration**: Expired tokens rejected

## Performance Characteristics

1. **Async Execution**: Bomber runs in background, API responds immediately
2. **Non-Blocking**: Does not block other API requests
3. **Redis Caching**: Fast cooldown checks with O(1) TTL lookup
4. **Minimal Database Load**: Single insert per execution
5. **Graceful Degradation**: Continues on individual message failures
6. **Resource Limits**: Max 50 messages per execution prevents resource exhaustion

## Files Modified

1. **backend/src/bomber.rs** (NEW): Core bomber implementation
2. **backend/src/response.rs**: Added CooldownActive error variant
3. **backend/src/lib.rs**: Added bomber module export
4. **backend/src/api_routes.rs**: Added bomber endpoint and permission check

## Dependencies Used

- **redis**: Cooldown tracking with TTL
- **sqlx**: Database logging
- **tokio**: Async task spawning
- **serde**: JSON serialization
- **chrono**: Timestamp handling
- **uuid**: Unique ID generation
- **regex**: Phone number validation
- **tracing**: Logging

## Compilation Status

✅ **Code compiles successfully** with only warnings (unused imports, unused fields in test code)

✅ **All unit tests pass** (6/6 tests)

## Next Steps

1. **Integration Testing**: Test with actual WhatsApp accounts and Redis
2. **Load Testing**: Verify performance under concurrent bomber executions
3. **Monitoring**: Add metrics for bomber execution success/failure rates
4. **Documentation**: Update API documentation with bomber endpoint
5. **Frontend Integration**: Create UI for bomber feature (if needed)

## Conclusion

Task 21 has been successfully implemented with all requirements validated. The bomber feature provides a safe, controlled way to send repeated messages for testing purposes, with robust safeguards against abuse through cooldown protection, permission checks, and validation.
