# Requirements Document: Self-Hosted WhatsApp Gateway

## Introduction

Sistem Self-Hosted WhatsApp Gateway adalah solusi mandiri yang menggantikan WhatsApp Business API (Official) dan layanan Fonnte eksternal. Sistem ini menyediakan kemampuan gateway WhatsApp penuh yang terintegrasi langsung ke dalam backend Rust DandStore, mendukung blast messaging anti-ban, webhook bidirectional dengan N8N, auto-reply chatbot, dan session management multi-device.

Sistem ini dirancang untuk menangani ribuan pesan blast secara concurrent dengan smart queue management, rate limiting, dan simulasi perilaku manusia untuk menghindari deteksi spam oleh WhatsApp.

## Glossary

- **Gateway_System**: Sistem self-hosted WhatsApp gateway yang mengelola koneksi WhatsApp, pengiriman pesan, dan webhook
- **Session_Manager**: Komponen yang mengelola autentikasi WhatsApp, QR code generation, dan persistence credentials
- **Blast_Engine**: Komponen yang mengelola pengiriman pesan massal dengan anti-ban features (smart delay, typing simulation, spintax)
- **Webhook_Forwarder**: Komponen yang meneruskan pesan masuk ke N8N secara real-time
- **Chatbot_Engine**: Komponen yang menangani auto-reply berdasarkan keyword matching
- **Media_Handler**: Komponen yang mengelola pengiriman media (image, PDF, video)
- **Queue_Manager**: Komponen Redis-based yang mengelola antrian pesan untuk dispatching
- **Spintax_Processor**: Komponen yang memproses template spintax untuk variasi pesan otomatis
- **WhatsApp_Account**: Akun WhatsApp yang terhubung ke gateway (stored in wa_accounts table)
- **Campaign**: Kampanye blast messaging (stored in wa_campaigns table)
- **Recipient**: Penerima pesan dalam campaign (stored in wa_recipients table)
- **Dispatch_Log**: Log pengiriman pesan dengan status tracking (stored in wa_dispatch_logs table)
- **Webhook_Config**: Konfigurasi webhook per user/account (stored in wa_webhooks table)
- **Chatbot_Rule**: Rule auto-reply dengan keyword matching (stored in wa_chatbot_rules table)
- **N8N**: Platform workflow automation yang menerima dan mengirim pesan melalui gateway
- **Baileys**: Library Node.js non-official untuk WhatsApp Web API
- **Bridge_Layer**: Layer komunikasi antara Rust backend dan Node.js Baileys library

## Requirements

### Requirement 1: Session Management dan QR Code Pairing

**User Story:** Sebagai administrator, saya ingin menghubungkan akun WhatsApp melalui QR code dan mempertahankan session, sehingga gateway dapat beroperasi tanpa perlu re-authentication berulang kali.

#### Acceptance Criteria

1. WHEN administrator meminta QR code untuk pairing, THE Session_Manager SHALL generate QR code dalam waktu 5 detik
2. WHEN QR code di-scan oleh WhatsApp mobile, THE Session_Manager SHALL establish connection dan menyimpan credentials dalam waktu 10 detik
3. THE Session_Manager SHALL encrypt session credentials menggunakan AES-256-GCM sebelum menyimpan ke database
4. WHEN gateway restart, THE Session_Manager SHALL restore session dari encrypted credentials tanpa memerlukan QR code baru
5. THE Session_Manager SHALL monitor connection status setiap 30 detik dan update status di wa_accounts table
6. WHEN connection terputus, THE Session_Manager SHALL attempt reconnection maksimal 3 kali dengan exponential backoff (5s, 15s, 45s)
7. IF reconnection gagal setelah 3 attempts, THEN THE Session_Manager SHALL set account status menjadi 'disconnected' dan generate notification
8. THE Session_Manager SHALL support multi-device WhatsApp protocol untuk kompatibilitas dengan WhatsApp versi terbaru

### Requirement 2: Smart Queue Management dengan Redis

**User Story:** Sebagai sistem, saya ingin mengelola antrian pesan blast menggunakan Redis, sehingga pengiriman dapat di-scale secara horizontal dan fault-tolerant.

#### Acceptance Criteria

1. WHEN campaign dimulai, THE Queue_Manager SHALL enqueue semua pending recipients ke Redis sorted set dengan priority score
2. THE Queue_Manager SHALL partition queue berdasarkan WhatsApp_Account untuk load balancing
3. WHEN worker mengambil message dari queue, THE Queue_Manager SHALL implement atomic pop operation untuk mencegah duplicate processing
4. THE Queue_Manager SHALL maintain separate queues untuk priority levels: high, normal, low
5. IF message processing gagal, THEN THE Queue_Manager SHALL re-enqueue message dengan retry count dan exponential backoff delay
6. THE Queue_Manager SHALL limit retry maksimal 3 kali per message sebelum marking sebagai permanently failed
7. THE Queue_Manager SHALL expose queue metrics (depth, processing rate, error rate) melalui Redis keys untuk monitoring
8. WHEN queue depth melebihi 10000 messages, THE Queue_Manager SHALL trigger backpressure signal untuk throttle campaign creation

### Requirement 3: Anti-Ban Blast Engine dengan Smart Delay

**User Story:** Sebagai pengguna blast, saya ingin mengirim ribuan pesan tanpa di-ban oleh WhatsApp, sehingga campaign dapat berjalan sampai selesai dengan success rate tinggi.

#### Acceptance Criteria

1. THE Blast_Engine SHALL implement random delay antara 5 hingga 15 detik antar pengiriman pesan dari account yang sama
2. WHEN mengirim pesan, THE Blast_Engine SHALL simulate typing indicator selama 1 hingga 3 detik sebelum mengirim pesan aktual
3. THE Blast_Engine SHALL implement rate limiting maksimal 20 pesan per menit per WhatsApp_Account
4. WHEN rate limit tercapai, THE Blast_Engine SHALL queue remaining messages dengan delay hingga rate limit window reset
5. THE Blast_Engine SHALL distribute messages across multiple WhatsApp_Account menggunakan round-robin strategy
6. THE Blast_Engine SHALL track hourly send count per account dan enforce daily limit 1000 pesan per account
7. IF account mencapai daily limit, THEN THE Blast_Engine SHALL mark account sebagai 'rate_limited' hingga midnight UTC
8. THE Blast_Engine SHALL randomize message order dalam batch untuk menghindari sequential pattern detection

### Requirement 4: Spintax Support untuk Variasi Pesan

**User Story:** Sebagai content creator, saya ingin menggunakan spintax syntax untuk membuat variasi pesan otomatis, sehingga setiap recipient menerima pesan yang sedikit berbeda dan menghindari spam detection.

#### Acceptance Criteria

1. THE Spintax_Processor SHALL parse spintax syntax format `{option1|option2|option3}` dalam message template
2. WHEN processing message untuk recipient, THE Spintax_Processor SHALL randomly select satu option dari setiap spintax group
3. THE Spintax_Processor SHALL support nested spintax hingga kedalaman 3 level
4. THE Spintax_Processor SHALL support variable replacement format `{{variable_name}}` dari recipient variables_json
5. THE Spintax_Processor SHALL generate unique message variation untuk setiap recipient dalam campaign
6. IF spintax syntax invalid (mismatched braces), THEN THE Spintax_Processor SHALL return error message dengan posisi syntax error
7. THE Spintax_Processor SHALL preserve whitespace dan formatting dalam generated message
8. THE Spintax_Processor SHALL cache parsed spintax tree untuk campaign template untuk performance optimization

### Requirement 5: Webhook System untuk N8N Integration

**User Story:** Sebagai automation engineer, saya ingin semua pesan masuk diteruskan ke N8N secara real-time, sehingga saya dapat membangun workflow automation berdasarkan incoming messages.

#### Acceptance Criteria

1. WHEN pesan masuk diterima dari WhatsApp, THE Webhook_Forwarder SHALL forward pesan ke configured webhook URL dalam waktu 1 detik
2. THE Webhook_Forwarder SHALL send JSON payload berisi: sender phone, message text, timestamp ISO8601, media_url (jika ada), message_id, account_id
3. THE Webhook_Forwarder SHALL include HMAC-SHA256 signature di header X-Webhook-Signature untuk webhook authentication
4. THE Webhook_Forwarder SHALL implement timeout 10 detik untuk webhook HTTP request
5. IF webhook request gagal (timeout atau non-2xx status), THEN THE Webhook_Forwarder SHALL retry maksimal 3 kali dengan exponential backoff (2s, 6s, 18s)
6. THE Webhook_Forwarder SHALL log failed webhook attempts ke wa_webhook_logs table dengan error details
7. THE Webhook_Forwarder SHALL support configurable webhook URL per WhatsApp_Account
8. THE Webhook_Forwarder SHALL batch multiple incoming messages dalam 500ms window dan send sebagai array untuk efficiency

### Requirement 6: Auto-Reply Chatbot dengan Keyword Matching

**User Story:** Sebagai customer service manager, saya ingin setup auto-reply rules berdasarkan keywords, sehingga pertanyaan umum dapat dijawab otomatis tanpa melalui N8N.

#### Acceptance Criteria

1. WHEN incoming message diterima, THE Chatbot_Engine SHALL check message text terhadap active Chatbot_Rule untuk WhatsApp_Account tersebut
2. THE Chatbot_Engine SHALL support keyword matching modes: exact match, contains, starts_with, ends_with, regex
3. WHEN multiple rules match, THE Chatbot_Engine SHALL execute rule dengan priority tertinggi (lowest priority number)
4. THE Chatbot_Engine SHALL send auto-reply message dalam waktu 2 detik setelah incoming message
5. THE Chatbot_Engine SHALL support variable replacement dalam reply template menggunakan captured groups dari regex match
6. THE Chatbot_Engine SHALL log auto-reply execution ke wa_chatbot_logs table dengan matched rule_id dan response
7. IF rule memiliki cooldown setting, THEN THE Chatbot_Engine SHALL skip auto-reply jika sender sudah menerima reply dari rule tersebut dalam cooldown period
8. THE Chatbot_Engine SHALL process rules sebelum forwarding ke webhook untuk fast response time

### Requirement 7: Media Support untuk Image, PDF, dan Video

**User Story:** Sebagai marketer, saya ingin mengirim media files (image, PDF, video) dalam blast campaign, sehingga saya dapat mengirim promotional materials yang lebih engaging.

#### Acceptance Criteria

1. THE Media_Handler SHALL support media types: image (JPEG, PNG, WebP), PDF, video (MP4)
2. THE Media_Handler SHALL validate file size maksimal 16MB untuk image, 100MB untuk PDF, 64MB untuk video
3. WHEN campaign includes media, THE Media_Handler SHALL download media dari URL atau read dari local path sebelum sending
4. THE Media_Handler SHALL generate thumbnail untuk video files sebelum sending
5. THE Media_Handler SHALL include caption text dengan media message jika provided dalam campaign config
6. IF media download gagal atau file corrupt, THEN THE Media_Handler SHALL mark recipient sebagai 'failed' dengan error 'media_error'
7. THE Media_Handler SHALL cache downloaded media dalam Redis dengan TTL 1 jam untuk reuse dalam campaign
8. THE Media_Handler SHALL support media URL dengan authentication headers untuk private storage

### Requirement 8: Bomber Feature dengan Cooldown Protection

**User Story:** Sebagai tester, saya ingin mengirim pesan berulang ke nomor tertentu untuk testing, tetapi dengan cooldown protection untuk mencegah abuse.

#### Acceptance Criteria

1. THE Blast_Engine SHALL support bomber mode untuk mengirim message ke single recipient multiple times
2. THE Blast_Engine SHALL accept bomber config: target phone, message, repeat count (maksimal 50), interval seconds
3. THE Blast_Engine SHALL enforce minimum interval 10 detik antar repetisi dalam bomber mode
4. THE Blast_Engine SHALL enforce cooldown 1 jam per target phone setelah bomber execution selesai
5. IF bomber request untuk target phone dalam cooldown period, THEN THE Blast_Engine SHALL reject request dengan error 'cooldown_active'
6. THE Blast_Engine SHALL log bomber executions ke wa_bomber_logs table dengan target, count, dan timestamp
7. WHERE user role adalah 'admin', THE Blast_Engine SHALL allow override cooldown protection
8. THE Blast_Engine SHALL limit bomber feature hanya untuk users dengan permission 'wa_bomber'

### Requirement 9: Two-Way N8N Integration API

**User Story:** Sebagai N8N workflow, saya ingin mengirim pesan WhatsApp melalui gateway API, sehingga saya dapat membangun automated responses dan notifications.

#### Acceptance Criteria

1. THE Gateway_System SHALL expose REST API endpoint POST /api/wa/send untuk outgoing messages dari N8N
2. THE Gateway_System SHALL require API authentication menggunakan Bearer token di Authorization header
3. THE Gateway_System SHALL validate API token terhadap wa_api_tokens table dan check token expiration
4. WHEN API request diterima, THE Gateway_System SHALL enqueue message ke Queue_Manager dengan priority 'high'
5. THE Gateway_System SHALL return response dengan message_id dan estimated_send_time dalam waktu 500ms
6. THE Gateway_System SHALL support request payload: account_id, target phone, message text, media_url (optional), priority
7. IF account_id tidak valid atau disconnected, THEN THE Gateway_System SHALL return HTTP 400 dengan error 'invalid_account'
8. THE Gateway_System SHALL rate limit API requests ke 100 requests per minute per API token

### Requirement 10: Message Status Tracking (Sent, Delivered, Read)

**User Story:** Sebagai campaign manager, saya ingin melihat status detail setiap pesan (sent, delivered, read), sehingga saya dapat mengukur engagement rate campaign.

#### Acceptance Criteria

1. WHEN pesan berhasil dikirim, THE Gateway_System SHALL update wa_recipients.status menjadi 'sent' dan set sent_at timestamp
2. WHEN delivery receipt diterima dari WhatsApp, THE Gateway_System SHALL update wa_recipients.delivered_at timestamp
3. WHEN read receipt diterima dari WhatsApp, THE Gateway_System SHALL update wa_recipients.read_at timestamp
4. THE Gateway_System SHALL update wa_dispatch_logs dengan status transitions untuk audit trail
5. THE Gateway_System SHALL calculate campaign metrics: total sent, delivered rate, read rate, reply rate
6. THE Gateway_System SHALL expose API endpoint GET /api/wa/campaigns/{id}/metrics untuk retrieve campaign metrics
7. IF recipient membalas pesan, THEN THE Gateway_System SHALL update wa_recipients.replied_at timestamp
8. THE Gateway_System SHALL aggregate metrics per hour dan store ke wa_campaign_metrics table untuk historical analysis

### Requirement 11: Session Persistence dan Recovery

**User Story:** Sebagai system administrator, saya ingin session WhatsApp tetap aktif setelah server restart, sehingga tidak perlu re-scan QR code setiap kali deployment.

#### Acceptance Criteria

1. THE Session_Manager SHALL serialize session state ke JSON format setiap 5 menit
2. THE Session_Manager SHALL encrypt serialized session menggunakan AES-256-GCM dengan key derived dari GATEWAY_SECRET environment variable
3. THE Session_Manager SHALL store encrypted session di wa_accounts.session_data column
4. WHEN Gateway_System startup, THE Session_Manager SHALL restore semua active sessions dari database
5. IF session restoration gagal untuk account, THEN THE Session_Manager SHALL set account status 'needs_pairing' dan skip restoration
6. THE Session_Manager SHALL validate session age dan reject sessions older than 30 days
7. THE Session_Manager SHALL implement session health check setiap 60 detik dan re-save jika state berubah
8. THE Session_Manager SHALL cleanup orphaned session files dari filesystem setiap 24 jam

### Requirement 12: Rust-Node.js Bridge Architecture

**User Story:** Sebagai developer, saya ingin mengintegrasikan Baileys (Node.js library) dengan Rust backend, sehingga saya dapat memanfaatkan Baileys untuk WhatsApp protocol handling.

#### Acceptance Criteria

1. THE Bridge_Layer SHALL spawn Node.js child process untuk setiap WhatsApp_Account connection
2. THE Bridge_Layer SHALL communicate dengan Node.js process melalui stdin/stdout menggunakan JSON-RPC protocol
3. THE Bridge_Layer SHALL implement message types: init_session, send_message, get_qr, disconnect, health_check
4. WHEN Node.js process crashes, THE Bridge_Layer SHALL detect crash dalam 5 detik dan restart process
5. THE Bridge_Layer SHALL implement timeout 30 detik untuk JSON-RPC requests dan return error jika timeout
6. THE Bridge_Layer SHALL forward WhatsApp events (message, status update, connection change) dari Node.js ke Rust event handlers
7. THE Bridge_Layer SHALL limit maksimal 50 concurrent Node.js processes untuk resource management
8. THE Bridge_Layer SHALL log all JSON-RPC communication ke debug log level untuk troubleshooting

### Requirement 13: Database Schema Extensions

**User Story:** Sebagai sistem, saya ingin menyimpan webhook configs dan chatbot rules dalam database, sehingga konfigurasi dapat dikelola melalui API dan persisted.

#### Acceptance Criteria

1. THE Gateway_System SHALL create table wa_webhooks dengan columns: id, account_id, webhook_url, secret_key, enabled, retry_config, created_at
2. THE Gateway_System SHALL create table wa_chatbot_rules dengan columns: id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled, created_at
3. THE Gateway_System SHALL create table wa_webhook_logs dengan columns: id, webhook_id, payload, response_status, response_body, attempt_number, created_at
4. THE Gateway_System SHALL create table wa_bomber_logs dengan columns: id, account_id, target_phone, message, repeat_count, executed_by, created_at
5. THE Gateway_System SHALL create table wa_api_tokens dengan columns: id, user_id, token_hash, name, permissions, expires_at, created_at
6. THE Gateway_System SHALL add column session_data TEXT ke wa_accounts untuk encrypted session storage
7. THE Gateway_System SHALL add column hourly_send_count INTEGER dan daily_send_count INTEGER ke wa_accounts untuk rate limiting
8. THE Gateway_System SHALL create indexes untuk performance: idx_wa_webhooks_account, idx_wa_chatbot_rules_account_priority, idx_wa_api_tokens_hash

### Requirement 14: Concurrent Message Processing

**User Story:** Sebagai sistem, saya ingin memproses ribuan pesan secara concurrent, sehingga campaign besar dapat diselesaikan dalam waktu reasonable.

#### Acceptance Criteria

1. THE Blast_Engine SHALL spawn worker pool dengan configurable size (default 10 workers)
2. WHEN worker available, THE Blast_Engine SHALL fetch batch 5 messages dari Queue_Manager untuk processing
3. THE Blast_Engine SHALL process messages dalam batch secara parallel menggunakan Tokio async tasks
4. THE Blast_Engine SHALL implement semaphore untuk limit concurrent sends per account ke maksimal 3
5. THE Blast_Engine SHALL implement connection pooling untuk WhatsApp connections dengan pool size 20
6. THE Blast_Engine SHALL monitor worker health dan restart crashed workers dalam 10 detik
7. THE Blast_Engine SHALL expose metrics endpoint untuk monitoring: active workers, queue depth, messages per second
8. WHEN system load tinggi (CPU > 80%), THE Blast_Engine SHALL reduce worker pool size untuk prevent overload

### Requirement 15: Security dan Input Validation

**User Story:** Sebagai security engineer, saya ingin semua input divalidasi dan credentials di-encrypt, sehingga sistem aman dari injection attacks dan data breaches.

#### Acceptance Criteria

1. THE Gateway_System SHALL validate phone numbers menggunakan regex pattern untuk format internasional (E.164)
2. THE Gateway_System SHALL sanitize message text untuk remove control characters dan potential injection payloads
3. THE Gateway_System SHALL validate webhook URLs menggunakan URL parser dan reject non-HTTP(S) schemes
4. THE Gateway_System SHALL hash API tokens menggunakan Argon2id sebelum storage di wa_api_tokens table
5. THE Gateway_System SHALL implement rate limiting per IP address: 100 requests per minute untuk API endpoints
6. THE Gateway_System SHALL validate file uploads untuk media: check magic bytes, file extension, dan MIME type consistency
7. IF SQL injection pattern detected dalam input, THEN THE Gateway_System SHALL reject request dengan HTTP 400 dan log security event
8. THE Gateway_System SHALL use parameterized queries untuk semua database operations untuk prevent SQL injection

### Requirement 16: Parser dan Pretty Printer untuk Campaign Config

**User Story:** Sebagai developer, saya ingin parse dan format campaign configuration JSON, sehingga config dapat divalidasi dan di-display dengan readable format.

#### Acceptance Criteria

1. THE Gateway_System SHALL implement parser untuk campaign config JSON schema dengan fields: message_template, delay_config, spintax_enabled, media_config
2. WHEN campaign config di-parse, THE Parser SHALL validate required fields dan return descriptive error untuk missing atau invalid fields
3. THE Gateway_System SHALL implement pretty printer untuk format campaign config JSON dengan indentation 2 spaces
4. FOR ALL valid campaign config objects, parsing kemudian pretty printing kemudian parsing SHALL produce equivalent object (round-trip property)
5. THE Parser SHALL validate delay_config.min_delay >= 5000 dan delay_config.max_delay <= 30000 milliseconds
6. THE Parser SHALL validate media_config.type dalam allowed values: 'image', 'pdf', 'video', 'none'
7. IF spintax_enabled true, THEN THE Parser SHALL validate message_template contains valid spintax syntax
8. THE Pretty_Printer SHALL escape special characters dalam JSON strings sesuai RFC 8259 specification

### Requirement 17: Webhook Config Management API

**User Story:** Sebagai administrator, saya ingin mengelola webhook configurations melalui API, sehingga saya dapat setup dan update webhook URLs tanpa direct database access.

#### Acceptance Criteria

1. THE Gateway_System SHALL expose API endpoint POST /api/wa/webhooks untuk create webhook config
2. THE Gateway_System SHALL expose API endpoint GET /api/wa/webhooks untuk list webhook configs dengan pagination
3. THE Gateway_System SHALL expose API endpoint PATCH /api/wa/webhooks/{id} untuk update webhook config
4. THE Gateway_System SHALL expose API endpoint DELETE /api/wa/webhooks/{id} untuk delete webhook config
5. WHEN webhook config created, THE Gateway_System SHALL generate random secret_key untuk HMAC signature
6. THE Gateway_System SHALL validate webhook_url accessibility dengan test HTTP request sebelum saving config
7. THE Gateway_System SHALL require authentication dan check user permission 'wa_webhook_manage' untuk webhook API endpoints
8. THE Gateway_System SHALL return webhook config dengan masked secret_key (show only last 4 characters) untuk security

### Requirement 18: Chatbot Rule Management API

**User Story:** Sebagai customer service manager, saya ingin mengelola chatbot rules melalui API, sehingga saya dapat setup auto-reply rules tanpa developer assistance.

#### Acceptance Criteria

1. THE Gateway_System SHALL expose API endpoint POST /api/wa/chatbot-rules untuk create chatbot rule
2. THE Gateway_System SHALL expose API endpoint GET /api/wa/chatbot-rules untuk list rules dengan filter by account_id
3. THE Gateway_System SHALL expose API endpoint PATCH /api/wa/chatbot-rules/{id} untuk update rule
4. THE Gateway_System SHALL expose API endpoint DELETE /api/wa/chatbot-rules/{id} untuk delete rule
5. WHEN rule dengan match_mode 'regex' created, THE Gateway_System SHALL validate regex syntax dan return error jika invalid
6. THE Gateway_System SHALL enforce unique constraint untuk (account_id, keyword, match_mode) untuk prevent duplicate rules
7. THE Gateway_System SHALL support bulk enable/disable rules melalui PATCH /api/wa/chatbot-rules/bulk endpoint
8. THE Gateway_System SHALL return rule statistics: total matches, last matched timestamp, average response time

### Requirement 19: Resource Cleanup dan Memory Management

**User Story:** Sebagai system administrator, saya ingin sistem membersihkan resources yang tidak terpakai, sehingga tidak terjadi memory leaks dan disk space exhaustion.

#### Acceptance Criteria

1. THE Gateway_System SHALL implement cleanup job yang berjalan setiap 1 jam untuk remove expired data
2. THE Gateway_System SHALL delete wa_webhook_logs older than 7 days untuk prevent table bloat
3. THE Gateway_System SHALL delete wa_dispatch_logs older than 30 days untuk campaigns yang sudah completed
4. THE Gateway_System SHALL cleanup Redis cache entries dengan expired TTL setiap 6 jam
5. THE Gateway_System SHALL close idle WhatsApp connections yang tidak digunakan selama 2 jam
6. THE Gateway_System SHALL implement graceful shutdown: drain message queue, close connections, flush logs dalam waktu 30 detik
7. THE Gateway_System SHALL monitor memory usage dan trigger garbage collection jika memory usage > 80%
8. THE Gateway_System SHALL cleanup temporary media files dari filesystem setelah campaign completed atau 24 jam (whichever earlier)

### Requirement 20: Monitoring dan Observability

**User Story:** Sebagai DevOps engineer, saya ingin monitoring metrics dan logs untuk troubleshooting, sehingga saya dapat detect dan resolve issues dengan cepat.

#### Acceptance Criteria

1. THE Gateway_System SHALL expose metrics endpoint GET /api/wa/metrics dalam Prometheus format
2. THE Gateway_System SHALL track metrics: messages_sent_total, messages_failed_total, queue_depth, active_connections, api_request_duration_seconds
3. THE Gateway_System SHALL log semua errors dengan level ERROR dan include context: account_id, campaign_id, recipient_id, error_message
4. THE Gateway_System SHALL log performance warnings jika message processing time > 5 seconds
5. THE Gateway_System SHALL implement structured logging dengan JSON format untuk easy parsing
6. THE Gateway_System SHALL include correlation_id dalam logs untuk trace request flow across components
7. THE Gateway_System SHALL expose health check endpoint GET /api/wa/health yang return status: healthy, degraded, unhealthy
8. WHEN critical error terjadi (database connection lost, Redis unavailable), THE Gateway_System SHALL set health status 'unhealthy' dan return HTTP 503

