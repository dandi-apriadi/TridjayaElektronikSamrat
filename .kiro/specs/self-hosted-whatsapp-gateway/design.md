# Design Document: Self-Hosted WhatsApp Gateway

## Overview

The Self-Hosted WhatsApp Gateway is a comprehensive messaging infrastructure that replaces external services (Fonnte, WhatsApp Business API) with an in-house solution built on Rust (Axum backend) and Node.js (Baileys library for WhatsApp protocol). The system provides enterprise-grade blast messaging capabilities with anti-ban features, bidirectional webhook integration with N8N, auto-reply chatbot, and multi-device session management.

### Key Design Goals

1. **High Throughput**: Handle 10,000+ messages per hour across multiple WhatsApp accounts
2. **Anti-Ban Protection**: Simulate human behavior with smart delays, typing indicators, and message variation
3. **Fault Tolerance**: Redis-based queue with retry logic, session persistence, and graceful degradation
4. **Extensibility**: Clean separation between Rust backend and Node.js WhatsApp protocol layer
5. **Observability**: Comprehensive metrics, structured logging, and health checks

### Technology Stack

- **Backend**: Rust 1.75+ with Axum 0.8 web framework
- **Database**: SQLite with SQLx for type-safe queries
- **Cache/Queue**: Redis 7+ for message queuing and caching
- **WhatsApp Protocol**: Baileys (Node.js) via JSON-RPC bridge
- **Async Runtime**: Tokio for concurrent message processing
- **Security**: AES-256-GCM encryption, Argon2id hashing, HMAC-SHA256 signatures

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "External Systems"
        WA[WhatsApp Servers]
        N8N[N8N Workflow]
        Admin[Admin Dashboard]
    end
    
    subgraph "Rust Backend (Axum)"
        API[REST API Layer]
        Auth[Authentication]
        Queue[Queue Manager]
        Blast[Blast Engine]
        Webhook[Webhook Forwarder]
        Chatbot[Chatbot Engine]
        Media[Media Handler]
        Spintax[Spintax Processor]
    end
    
    subgraph "Bridge Layer"
        Bridge[JSON-RPC Bridge]
    end
    
    subgraph "Node.js Layer"
        Baileys1[Baileys Instance 1]
        Baileys2[Baileys Instance 2]
        BaileysN[Baileys Instance N]
    end
    
    subgraph "Data Layer"
        SQLite[(SQLite DB)]
        Redis[(Redis Cache/Queue)]
    end
    
    Admin -->|HTTP| API
    N8N -->|Webhook| API
    API --> Auth
    API --> Queue
    API --> Webhook
    Queue --> Blast
    Blast --> Spintax
    Blast --> Media
    Blast --> Bridge
    Bridge -->|JSON-RPC| Baileys1
    Bridge -->|JSON-RPC| Baileys2
    Bridge -->|JSON-RPC| BaileysN
    Baileys1 <-->|WhatsApp Protocol| WA
    Baileys2 <-->|WhatsApp Protocol| WA
    BaileysN <-->|WhatsApp Protocol| WA
    Baileys1 -->|Events| Bridge
    Bridge -->|Incoming Messages| Chatbot
    Bridge -->|Incoming Messages| Webhook
    Webhook -->|HTTP POST| N8N
    API --> SQLite
    Queue --> Redis
    Blast --> SQLite
    Chatbot --> SQLite
```

### Data Flow Diagrams

#### Outbound Message Flow (Blast Campaign)

```mermaid
sequenceDiagram
    participant Admin
    participant API
    participant Queue
    participant Blast
    participant Bridge
    participant Baileys
    participant WA as WhatsApp

    Admin->>API: POST /api/wa/campaigns (create campaign)
    API->>SQLite: Insert campaign + recipients
    API-->>Admin: 201 Created {campaign_id}
    
    Admin->>API: POST /api/wa/campaigns/{id}/start
    API->>Queue: Enqueue all pending recipients
    API-->>Admin: 200 OK
    
    loop Every 10 seconds
        Blast->>Queue: Fetch batch (5 messages)
        Queue-->>Blast: Messages with account assignment
        
        loop For each message
            Blast->>Spintax: Process template
            Spintax-->>Blast: Generated message
            Blast->>Bridge: send_message(account, phone, text)
            Bridge->>Baileys: JSON-RPC request
            Baileys->>WA: WhatsApp Protocol
            WA-->>Baileys: Delivery receipt
            Baileys-->>Bridge: JSON-RPC response
            Bridge-->>Blast: Success/Failure
            Blast->>SQLite: Update recipient status
            Blast->>SQLite: Insert dispatch_log
        end
    end
```

#### Inbound Message Flow (Webhook + Chatbot)

```mermaid
sequenceDiagram
    participant WA as WhatsApp
    participant Baileys
    participant Bridge
    participant Chatbot
    participant Webhook
    participant N8N

    WA->>Baileys: Incoming message
    Baileys->>Bridge: Event: message_received
    Bridge->>Chatbot: Check auto-reply rules
    
    alt Rule matches
        Chatbot->>SQLite: Log chatbot execution
        Chatbot->>Bridge: send_message(reply)
        Bridge->>Baileys: JSON-RPC send
        Baileys->>WA: Auto-reply sent
    end
    
    Bridge->>Webhook: Forward message payload
    Webhook->>N8N: HTTP POST with HMAC signature
    N8N-->>Webhook: 200 OK
    Webhook->>SQLite: Log webhook delivery
```

## Components and Interfaces

### 1. Session Manager

**Responsibility**: Manage WhatsApp account connections, QR code pairing, session persistence, and connection health monitoring.

**Key Structures**:

```rust
pub struct SessionManager {
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    bridge: Arc<BridgeLa