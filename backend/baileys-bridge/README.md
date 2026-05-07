# Baileys Bridge

Node.js bridge service that wraps the Baileys WhatsApp library and communicates with the Rust backend via JSON-RPC over stdin/stdout.

## Overview

This service provides a JSON-RPC interface for WhatsApp operations using the Baileys library. It runs as a child process spawned by the Rust backend and handles all WhatsApp protocol operations.

## Installation

```bash
cd backend/baileys-bridge
npm install
```

## Usage

The service reads JSON-RPC requests from stdin and writes responses to stdout:

```bash
node src/index.js
```

## JSON-RPC Protocol

### Request Format

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "method_name",
  "params": {
    "param1": "value1"
  }
}
```

### Response Format

Success:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "key": "value"
  }
}
```

Error:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid Request",
    "data": "Additional error details"
  }
}
```

## Supported Methods

### init_session

Initialize a WhatsApp session with optional credentials.

**Parameters:**
- `session_id` (string, required): Unique identifier for the session
- `credentials` (object, optional): Saved session credentials for restoration

**Returns:**
```json
{
  "session_id": "session_123",
  "status": "initialized",
  "requires_pairing": true
}
```

### get_qr

Get QR code for pairing a new session.

**Parameters:**
- `session_id` (string, required): Session identifier

**Returns:**
```json
{
  "session_id": "session_123",
  "qr": "base64_encoded_qr_data",
  "status": "waiting_for_pairing"
}
```

### send_message

Send a text message to a recipient.

**Parameters:**
- `session_id` (string, required): Session identifier
- `phone` (string, required): Recipient phone number in E.164 format
- `message` (string, required): Message text
- `typing_delay` (number, optional): Typing simulation delay in milliseconds

**Returns:**
```json
{
  "message_id": "msg_1234567890_abc123",
  "status": "sent",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### send_media

Send a media message (image, PDF, video) with optional caption.

**Parameters:**
- `session_id` (string, required): Session identifier
- `phone` (string, required): Recipient phone number in E.164 format
- `media_type` (string, required): Type of media - "image", "pdf", or "video"
- `media_path` (string, required): Path to media file
- `caption` (string, optional): Caption text for the media

**Returns:**
```json
{
  "message_id": "media_1234567890_abc123",
  "status": "sent",
  "media_type": "image",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### disconnect

Disconnect a WhatsApp session.

**Parameters:**
- `session_id` (string, required): Session identifier

**Returns:**
```json
{
  "session_id": "session_123",
  "status": "disconnected"
}
```

### health_check

Check service health status.

**Parameters:** None

**Returns:**
```json
{
  "status": "healthy",
  "uptime": 3600.5,
  "memory": {
    "rss": 52428800,
    "heapTotal": 20971520,
    "heapUsed": 15728640,
    "external": 1048576
  },
  "sessions": {
    "total": 5,
    "active": 3
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Error Codes

| Code | Message | Description |
|------|---------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Invalid JSON-RPC request |
| -32601 | Method not found | Method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |
| -32001 | Session not found | Session ID does not exist |
| -32002 | Session already exists | Session ID already in use |
| -32003 | Connection error | WhatsApp connection error |
| -32004 | Send error | Message send error |

## Events (Notifications)

The bridge sends JSON-RPC notifications (no response expected) for WhatsApp events:

### message_received

Emitted when an incoming message is received.

```json
{
  "jsonrpc": "2.0",
  "method": "message_received",
  "params": {
    "session_id": "session_123",
    "message_id": "msg_abc123",
    "from": "+1234567890",
    "text": "Hello",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "media_url": null
  }
}
```

### connection_update

Emitted when connection status changes.

```json
{
  "jsonrpc": "2.0",
  "method": "connection_update",
  "params": {
    "session_id": "session_123",
    "status": "connected",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### qr_updated

Emitted when a new QR code is generated.

```json
{
  "jsonrpc": "2.0",
  "method": "qr_updated",
  "params": {
    "session_id": "session_123",
    "qr": "base64_encoded_qr_data",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## Environment Variables

- `LOG_LEVEL`: Logging level (default: "info")

## Dependencies

- `@whiskeysockets/baileys`: WhatsApp Web API library
- `pino`: Fast JSON logger
- `qrcode-terminal`: QR code generation for terminal display

## Development

Run in development mode with auto-reload:

```bash
npm run dev
```

## Testing

You can test the bridge manually by sending JSON-RPC requests via stdin:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"health_check","params":{}}' | node src/index.js
```

## Architecture

```
┌─────────────────┐
│  Rust Backend   │
│   (Axum API)    │
└────────┬────────┘
         │ spawn child process
         │ JSON-RPC via stdin/stdout
         ▼
┌─────────────────┐
│ Baileys Bridge  │
│   (Node.js)     │
└────────┬────────┘
         │ WhatsApp Web Protocol
         ▼
┌─────────────────┐
│ WhatsApp Servers│
└─────────────────┘
```

## Implementation Status

- [x] JSON-RPC protocol handler
- [x] Method routing and error handling
- [x] Health check endpoint
- [ ] Baileys session management (Task 4)
- [ ] Message sending with typing simulation (Task 5)
- [ ] Incoming message handling (Task 6)
- [ ] Media message support (Task 5)
- [ ] Connection event handling (Task 4)

## Notes

- The bridge runs as a child process and communicates exclusively via stdin/stdout
- Each WhatsApp account connection runs in a separate bridge process
- The Rust backend manages process lifecycle and handles crashes
- All WhatsApp protocol operations are delegated to Baileys library
- Session credentials are encrypted by the Rust backend before storage
