# Implementation Plan: Self-Hosted WhatsApp Gateway

## Overview

This implementation plan converts the Self-Hosted WhatsApp Gateway design into executable coding tasks. The system replaces external WhatsApp services (Fonnte, WhatsApp Business API) with an in-house solution using Rust (Axum backend) and Node.js (Baileys for WhatsApp protocol).

**Architecture**: Hybrid Rust + Node.js system with JSON-RPC bridge
- **Rust**: Backend API, queue management, database, business logic
- **Node.js**: Baileys library for WhatsApp Web protocol handling

**Key Features**: Anti-ban blast messaging, Redis queue, webhook integration, auto-reply chatbot, session management, media support

## Tasks

### Phase 1: Database Schema and Core Infrastructure

- [x] 1. Create database migrations for WhatsApp gateway tables
  - Create migration file `backend/migrations/2026050501_wa_gateway_core.sql`
  - Add tables: `wa_webhooks`, `wa_chatbot_rules`, `wa_webhook_logs`, `wa_bomber_logs`, `wa_api_tokens`, `wa_chatbot_logs`
  - Add columns to `wa_accounts`: `session_data TEXT`, `hourly_send_count INTEGER DEFAULT 0`, `daily_send_count INTEGER DEFAULT 0`, `last_reset_at TIMESTAMP`
  - Create indexes: `idx_wa_webhooks_account`, `idx_wa_chatbot_rules_account_priority`, `idx_wa_api_tokens_hash`, `idx_wa_webhook_logs_created`, `idx_wa_dispatch_logs_created`
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8_

- [x] 2. Implement Redis connection manager and queue primitives
  - Create `backend/src/redis_manager.rs` with `RedisManager` struct
  - Implement connection pooling with `redis::aio::ConnectionManager`
  - Implement queue operations: `enqueue`, `dequeue_batch`, `requeue_with_retry`, `get_queue_depth`
  - Implement sorted set operations for priority queues
  - Add queue partitioning by account_id for load balancing
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 2.1 Write unit tests for Redis queue operations
  - Test enqueue/dequeue atomicity
  - Test priority queue ordering
  - Test retry logic with exponential backoff
  - Test queue partitioning across accounts
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

### Phase 2: Node.js Baileys Bridge Layer

- [x] 3. Create Node.js Baileys wrapper service
  - Create directory `backend/baileys-bridge/` with `package.json`
  - Add dependencies: `@whiskeysockets/baileys`, `pino` (logger), `qrcode-terminal`
  - Create `backend/baileys-bridge/src/index.js` as main entry point
  - Implement JSON-RPC protocol handler for stdin/stdout communication
  - Implement message types: `init_session`, `send_message`, `get_qr`, `disconnect`, `health_check`, `send_media`
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 4. Implement Baileys session management in Node.js
  - Create `backend/baileys-bridge/src/session.js` with `BaileysSession` class
  - Implement QR code generation and pairing flow
  - Implement session state serialization/deserialization
  - Implement connection event handlers: `connection.update`, `creds.update`, `messages.upsert`
  - Implement multi-device protocol support
  - Implement reconnection logic with exponential backoff
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 5. Implement message sending in Baileys bridge
  - Create `backend/baileys-bridge/src/sender.js` with message sending functions
  - Implement text message sending with typing simulation
  - Implement media message sending (image, PDF, video) with caption support
  - Implement delivery and read receipt tracking
  - Implement error handling for failed sends
  - _Requirements: 3.2, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 6. Implement incoming message handler in Baileys bridge
  - Create `backend/baileys-bridge/src/receiver.js` for incoming messages
  - Parse incoming message events from Baileys
  - Extract message metadata: sender, text, timestamp, media_url, message_id
  - Forward events to Rust backend via JSON-RPC response
  - Handle group messages vs direct messages
  - _Requirements: 5.1, 5.2, 6.1_

### Phase 3: Rust Bridge Client and Session Manager

- [x] 7. Implement Rust JSON-RPC bridge client
  - Create `backend/src/bridge/mod.rs` with `BridgeClient` struct
  - Implement child process spawning for Node.js Baileys instances
  - Implement JSON-RPC request/response handling via stdin/stdout
  - Implement timeout handling (30 seconds) for requests
  - Implement process crash detection and auto-restart
  - Implement process pool management (max 50 concurrent processes)
  - Add structured logging for all JSON-RPC communication
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

- [x] 7.1 Write unit tests for bridge client
  - Test JSON-RPC request serialization
  - Test timeout handling
  - Test process crash recovery
  - Mock Node.js process for testing
  - _Requirements: 12.3, 12.4, 12.5_

- [x] 8. Implement Session Manager in Rust
  - Create `backend/src/session_manager.rs` with `SessionManager` struct
  - Implement session state tracking with `Arc<RwLock<HashMap<String, SessionState>>>`
  - Implement QR code generation endpoint via bridge
  - Implement session encryption using AES-256-GCM with `aes-gcm` crate
  - Implement session persistence to `wa_accounts.session_data` column
  - Implement session restoration on startup
  - Implement connection health monitoring (every 30 seconds)
  - Implement reconnection logic with exponential backoff (5s, 15s, 45s)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

- [x] 8.1 Write unit tests for session encryption
  - Test AES-256-GCM encryption/decryption round-trip
  - Test key derivation from GATEWAY_SECRET
  - Test handling of corrupted encrypted data
  - _Requirements: 1.3, 11.2_

### Phase 4: Spintax Processor and Message Templating

- [x] 9. Implement Spintax parser and processor
  - Create `backend/src/spintax.rs` with `SpintaxProcessor` struct
  - Implement parser for `{option1|option2|option3}` syntax
  - Implement nested spintax support (max depth 3)
  - Implement random option selection with `rand` crate
  - Implement variable replacement for `{{variable_name}}` format
  - Implement syntax validation with descriptive error messages
  - Implement parsed tree caching for performance
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 9.1 Write property test for spintax round-trip consistency
  - **Property 1: Parsing valid spintax never fails**
  - **Validates: Requirements 4.1, 4.2**
  - Generate random valid spintax strings
  - Assert parsing succeeds for all valid inputs
  - Assert generated messages contain only valid options

- [x] 9.2 Write unit tests for spintax processor
  - Test simple spintax: `{Hello|Hi|Hey}` produces one of three options
  - Test nested spintax: `{Hello {world|friend}|Hi there}`
  - Test variable replacement: `{{name}}` replaced with actual value
  - Test syntax error detection: mismatched braces
  - Test whitespace preservation
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

### Phase 5: Media Handler

- [x] 10. Implement Media Handler for file processing
  - Create `backend/src/media_handler.rs` with `MediaHandler` struct
  - Implement media type validation: image (JPEG, PNG, WebP), PDF, video (MP4)
  - Implement file size validation: 16MB (image), 100MB (PDF), 64MB (video)
  - Implement media download from URL with authentication headers
  - Implement video thumbnail generation using `image` crate
  - Implement Redis caching for downloaded media (TTL 1 hour)
  - Implement error handling for download failures and corrupt files
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

- [x] 10.1 Write unit tests for media validation
  - Test file size limits enforcement
  - Test MIME type validation
  - Test magic bytes verification
  - Test handling of corrupt files
  - _Requirements: 7.1, 7.2, 7.6_

### Phase 6: Queue Manager and Blast Engine

- [x] 11. Implement Queue Manager with Redis integration
  - Create `backend/src/queue_manager.rs` with `QueueManager` struct
  - Implement campaign enqueue: read recipients from database, push to Redis sorted set
  - Implement priority queue support: high, normal, low
  - Implement atomic dequeue with Lua script for preventing duplicates
  - Implement retry logic: re-enqueue with incremented retry count and exponential backoff
  - Implement max retry limit (3 attempts) before marking as permanently failed
  - Implement queue metrics: depth, processing rate, error rate
  - Implement backpressure detection (queue depth > 10000)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [x] 12. Implement Blast Engine with anti-ban features
  - Create `backend/src/blast_engine.rs` with `BlastEngine` struct
  - Implement worker pool with configurable size (default 10 workers)
  - Implement batch processing: fetch 5 messages per worker iteration
  - Implement smart delay: random 5-15 seconds between messages from same account
  - Implement typing simulation: 1-3 seconds before actual send
  - Implement rate limiting: max 20 messages per minute per account
  - Implement daily limit enforcement: max 1000 messages per account per day
  - Implement round-robin account distribution
  - Implement message order randomization within batch
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_

- [x] 13. Integrate Blast Engine with Spintax and Media Handler
  - Modify `BlastEngine` to call `SpintaxProcessor` for message generation
  - Integrate `MediaHandler` for media message campaigns
  - Implement message composition: text + media + caption
  - Update `wa_recipients` status after each send attempt
  - Insert dispatch logs to `wa_dispatch_logs` table
  - Update campaign status to 'completed' when all recipients processed
  - _Requirements: 3.1, 3.2, 4.5, 7.5, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8_

- [x] 13.1 Write integration tests for blast engine
  - Test end-to-end campaign execution with mock bridge
  - Test rate limiting enforcement
  - Test retry logic for failed sends
  - Test campaign completion detection
  - _Requirements: 3.3, 3.4, 3.6, 3.7_

### Phase 7: Webhook System

- [x] 14. Implement Webhook Forwarder
  - Create `backend/src/webhook_forwarder.rs` with `WebhookForwarder` struct
  - Implement incoming message event handler
  - Implement JSON payload construction: sender, message, timestamp, media_url, message_id, account_id
  - Implement HMAC-SHA256 signature generation using `sha2` crate
  - Implement HTTP POST with timeout (10 seconds)
  - Implement retry logic: max 3 attempts with exponential backoff (2s, 6s, 18s)
  - Implement webhook logging to `wa_webhook_logs` table
  - Implement message batching: collect messages in 500ms window, send as array
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_

- [x] 14.1 Write unit tests for webhook signature
  - Test HMAC-SHA256 signature generation
  - Test signature verification
  - Test handling of invalid signatures
  - _Requirements: 5.3_

- [x] 15. Implement Webhook Config Management API
  - Create `backend/src/routes/webhook_routes.rs`
  - Implement `POST /api/wa/webhooks` - create webhook config
  - Implement `GET /api/wa/webhooks` - list webhooks with pagination
  - Implement `PATCH /api/wa/webhooks/{id}` - update webhook config
  - Implement `DELETE /api/wa/webhooks/{id}` - delete webhook config
  - Implement webhook URL validation with test HTTP request
  - Implement secret key generation (random 32 bytes, base64 encoded)
  - Implement secret key masking in responses (show last 4 chars only)
  - Add authentication and permission check: `wa_webhook_manage`
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

### Phase 8: Chatbot Engine

- [x] 16. Implement Chatbot Engine with keyword matching
  - Create `backend/src/chatbot_engine.rs` with `ChatbotEngine` struct
  - Implement rule matching: exact, contains, starts_with, ends_with, regex
  - Implement priority-based rule selection (lowest priority number wins)
  - Implement variable replacement in reply template using regex captured groups
  - Implement cooldown tracking per sender per rule
  - Implement auto-reply sending via bridge (2 second target)
  - Implement chatbot execution logging to `wa_chatbot_logs` table
  - Execute chatbot rules before webhook forwarding for fast response
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

- [x] 16.1 Write unit tests for keyword matching
  - Test exact match mode
  - Test contains mode
  - Test regex mode with captured groups
  - Test priority-based rule selection
  - Test cooldown enforcement
  - _Requirements: 6.2, 6.3, 6.7_

- [x] 17. Implement Chatbot Rule Management API
  - Create `backend/src/routes/chatbot_routes.rs`
  - Implement `POST /api/wa/chatbot-rules` - create rule
  - Implement `GET /api/wa/chatbot-rules` - list rules with filter by account_id
  - Implement `PATCH /api/wa/chatbot-rules/{id}` - update rule
  - Implement `DELETE /api/wa/chatbot-rules/{id}` - delete rule
  - Implement regex syntax validation for regex match mode
  - Implement unique constraint check: (account_id, keyword, match_mode)
  - Implement `PATCH /api/wa/chatbot-rules/bulk` - bulk enable/disable
  - Implement rule statistics: total matches, last matched, avg response time
  - Add authentication and permission check: `wa_chatbot_manage`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_

### Phase 9: Two-Way API for N8N Integration

- [x] 18. Implement outbound message API for N8N
  - Create `backend/src/routes/api_routes.rs`
  - Implement `POST /api/wa/send` endpoint
  - Implement Bearer token authentication from `wa_api_tokens` table
  - Implement token hash verification using Argon2id
  - Implement token expiration check
  - Implement request validation: account_id, target phone, message, media_url (optional), priority
  - Enqueue message to Redis with priority 'high'
  - Return response: message_id, estimated_send_time (within 500ms)
  - Implement rate limiting: 100 requests per minute per API token
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 18.1 Write integration tests for N8N API
  - Test authentication with valid/invalid tokens
  - Test rate limiting enforcement
  - Test message enqueue and response
  - Test error handling for invalid account_id
  - _Requirements: 9.2, 9.3, 9.7, 9.8_

### Phase 10: Message Status Tracking

- [x] 19. Implement delivery and read receipt tracking
  - Modify Baileys bridge to emit status update events: sent, delivered, read
  - Implement event handler in Rust to update `wa_recipients` table
  - Update `sent_at` timestamp when message sent
  - Update `delivered_at` timestamp when delivery receipt received
  - Update `read_at` timestamp when read receipt received
  - Update `replied_at` timestamp when recipient replies
  - Update `wa_dispatch_logs` with status transitions for audit trail
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_

- [x] 20. Implement campaign metrics calculation
  - Create `backend/src/campaign_metrics.rs` with metrics calculation functions
  - Calculate metrics: total_sent, delivered_rate, read_rate, reply_rate
  - Implement `GET /api/wa/campaigns/{id}/metrics` endpoint
  - Aggregate metrics per hour and store to `wa_campaign_metrics` table
  - Implement real-time metrics calculation from `wa_recipients` table
  - _Requirements: 10.5, 10.6, 10.8_

### Phase 11: Bomber Feature

- [x] 21. Implement Bomber feature with cooldown protection
  - Create `backend/src/bomber.rs` with `BomberEngine` struct
  - Implement `POST /api/wa/bomber` endpoint
  - Validate bomber config: target phone, message, repeat count (max 50), interval (min 10s)
  - Implement cooldown tracking: 1 hour per target phone
  - Check cooldown before execution, reject if active
  - Implement bomber execution: send message N times with interval delay
  - Log bomber execution to `wa_bomber_logs` table
  - Implement admin override for cooldown (check user role)
  - Add permission check: `wa_bomber` permission required
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

### Phase 12: Security and Input Validation

- [x] 22. Implement comprehensive input validation
  - Create `backend/src/validation.rs` with validation functions
  - Implement phone number validation: E.164 format regex
  - Implement message text sanitization: remove control characters
  - Implement webhook URL validation: parse and check HTTP(S) scheme
  - Implement file upload validation: magic bytes, extension, MIME type consistency
  - Implement SQL injection pattern detection in inputs
  - Use parameterized queries for all database operations (already done via SQLx)
  - _Requirements: 15.1, 15.2, 15.3, 15.6, 15.7, 15.8_

- [x] 23. Implement API token management and rate limiting
  - Create `backend/src/api_tokens.rs` with token management functions
  - Implement token generation with Argon2id hashing
  - Implement token validation and expiration check
  - Implement rate limiting per IP address: 100 requests per minute
  - Use Redis for rate limit counters with sliding window
  - Implement rate limiting per API token: 100 requests per minute
  - _Requirements: 15.4, 15.5, 9.8_

- [x] 23.1 Write unit tests for input validation
  - Test phone number validation with valid/invalid formats
  - Test SQL injection pattern detection
  - Test URL validation
  - _Requirements: 15.1, 15.3, 15.7_

### Phase 13: Campaign Config Parser and Pretty Printer

- [x] 24. Implement campaign config parser and validator
  - Create `backend/src/campaign_config.rs` with parser functions
  - Define config schema: message_template, delay_config, spintax_enabled, media_config
  - Implement JSON parser with serde
  - Implement validation: required fields, delay ranges (5000-30000ms), media type enum
  - Implement spintax syntax validation when spintax_enabled=true
  - Return descriptive errors for missing or invalid fields
  - _Requirements: 16.1, 16.2, 16.5, 16.6, 16.7_

- [x] 25. Implement campaign config pretty printer
  - Implement JSON formatter with 2-space indentation
  - Implement special character escaping per RFC 8259
  - _Requirements: 16.3, 16.8_

- [x] 25.1 Write property test for config round-trip consistency
  - **Property 2: Parse → Pretty Print → Parse produces equivalent object**
  - **Validates: Requirements 16.4**
  - Generate random valid campaign configs
  - Assert parse → pretty print → parse = original

### Phase 14: Resource Cleanup and Memory Management

- [ ] 26. Implement cleanup jobs and resource management
  - Create `backend/src/cleanup.rs` with cleanup job scheduler
  - Implement hourly cleanup job using Tokio interval
  - Delete `wa_webhook_logs` older than 7 days
  - Delete `wa_dispatch_logs` older than 30 days for completed campaigns
  - Cleanup Redis expired cache entries every 6 hours
  - Close idle WhatsApp connections (unused for 2 hours)
  - Cleanup temporary media files after campaign completion or 24 hours
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.8_

- [ ] 27. Implement graceful shutdown
  - Implement shutdown signal handler (SIGTERM, SIGINT)
  - Drain message queue: wait for in-flight messages to complete
  - Close all WhatsApp connections gracefully
  - Flush logs and close database connections
  - Complete shutdown within 30 seconds timeout
  - _Requirements: 19.6_

### Phase 15: Monitoring and Observability

- [ ] 28. Implement metrics endpoint and health checks
  - Create `backend/src/metrics.rs` with Prometheus metrics
  - Track metrics: messages_sent_total, messages_failed_total, queue_depth, active_connections, api_request_duration_seconds
  - Implement `GET /api/wa/metrics` endpoint in Prometheus format
  - Implement `GET /api/wa/health` endpoint with status: healthy, degraded, unhealthy
  - Check database connection, Redis connection, active sessions for health status
  - Return HTTP 503 when health status is 'unhealthy'
  - _Requirements: 20.1, 20.2, 20.7, 20.8_

- [ ] 29. Implement structured logging
  - Configure tracing-subscriber with JSON formatter
  - Log all errors with ERROR level including context: account_id, campaign_id, recipient_id, error_message
  - Log performance warnings when message processing > 5 seconds
  - Include correlation_id in all logs for request tracing
  - _Requirements: 20.3, 20.4, 20.5, 20.6_

### Phase 16: API Routes Integration and Main Server

- [ ] 30. Integrate all route modules into main server
  - Modify `backend/src/routes.rs` to include new route modules
  - Mount webhook routes: `/api/wa/webhooks/*`
  - Mount chatbot routes: `/api/wa/chatbot-rules/*`
  - Mount API routes: `/api/wa/send`, `/api/wa/bomber`
  - Mount metrics routes: `/api/wa/metrics`, `/api/wa/health`
  - Mount campaign routes: `/api/wa/campaigns/*` (if not exists)
  - Mount session routes: `/api/wa/sessions/*` for QR code and connection management
  - Add CORS configuration for N8N integration
  - _Requirements: 9.1, 15.1, 17.1, 18.1, 20.1, 20.7_

- [ ] 31. Update main.rs to initialize all components
  - Initialize `RedisManager` and connect to Redis
  - Initialize `SessionManager` and restore sessions on startup
  - Initialize `QueueManager` with Redis connection
  - Initialize `BlastEngine` and spawn worker pool
  - Initialize `WebhookForwarder` and register event handlers
  - Initialize `ChatbotEngine` and register event handlers
  - Start cleanup job scheduler
  - Start session health monitoring job
  - Start daily send count reset job (runs at midnight UTC)
  - _Requirements: 1.4, 2.1, 11.4, 14.1, 19.1_

### Phase 17: Testing and Documentation

- [ ] 32. Checkpoint - Ensure all tests pass
  - Run `cargo test` to execute all unit tests
  - Run `cargo test --test integration_tests` for integration tests
  - Fix any failing tests
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 33. Write end-to-end integration test
  - Create `backend/tests/e2e_gateway_test.rs`
  - Test full campaign flow: create campaign → start → process → complete
  - Test webhook delivery for incoming messages
  - Test chatbot auto-reply
  - Test N8N API send message
  - Mock Baileys bridge for testing
  - _Requirements: 3.1, 5.1, 6.1, 9.1_

- [ ] 34. Create README documentation for gateway setup
  - Create `backend/baileys-bridge/README.md`
  - Document Node.js setup: `npm install`, environment variables
  - Document Baileys bridge JSON-RPC protocol
  - Document QR code pairing process
  - Create `backend/docs/GATEWAY_SETUP.md`
  - Document Redis setup and configuration
  - Document environment variables: `GATEWAY_SECRET`, `REDIS_URL`
  - Document API endpoints with examples
  - Document webhook signature verification for N8N

- [ ] 35. Final checkpoint - End-to-end testing
  - Test QR code pairing with real WhatsApp account
  - Test sending blast campaign with 10 recipients
  - Test incoming message webhook delivery
  - Test chatbot auto-reply
  - Test N8N API integration
  - Verify metrics endpoint returns correct data
  - Verify health check endpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at major milestones
- Property tests validate universal correctness properties from design
- Unit tests validate specific examples and edge cases
- The implementation uses Rust for backend and Node.js for Baileys WhatsApp protocol
- Redis is required for queue management and caching
- All sensitive data (session credentials, API tokens) must be encrypted/hashed
- Rate limiting and anti-ban features are critical for avoiding WhatsApp bans
- Graceful shutdown ensures no message loss during deployments
