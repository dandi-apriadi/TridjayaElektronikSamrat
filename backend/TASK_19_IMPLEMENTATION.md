# Task 19 Implementation: Delivery and Read Receipt Tracking

## Overview

This document describes the implementation of Task 19: delivery and read receipt tracking for the WhatsApp gateway.

## Components Implemented

### 1. Baileys Bridge Status Events (`backend/baileys-bridge/src/session.js`)

**Modified:** `handleMessagesUpdate` method to emit status events for:
- **Sent** (status code 2): When message is acknowledged by WhatsApp server
- **Delivered** (status code 3): When message is delivered to recipient's device
- **Read** (status code 4): When recipient reads the message

The method emits `message_status` events with the following structure:
```javascript
{
  session_id: string,
  message_id: string,
  recipient: string,
  status: 'sent' | 'delivered' | 'read'
}
```

### 2. Status Tracker Module (`backend/src/wa_status_tracker.rs`)

**Created:** New module that handles status update events from the Baileys bridge.

**Key Features:**
- Listens for `message_status` events from bridge
- Updates `wa_recipients` table with appropriate timestamps:
  - `sent_at`: When message is sent (Requirement 10.1)
  - `delivered_at`: When delivery receipt received (Requirement 10.2)
  - `read_at`: When read receipt received (Requirement 10.3)
- Logs status transitions to `wa_dispatch_logs` for audit trail (Requirement 10.4)
- Tracks `replied_at` timestamp when recipient replies (Requirement 10.7)

**Status Update Flow:**
1. Receive `message_status` event from bridge
2. Look up recipient_id from `wa_dispatch_logs` using message_id
3. Update appropriate timestamp in `wa_recipients` table
4. Insert new entry in `wa_dispatch_logs` for audit trail

**Reply Tracking:**
- Listens for `message_received` events
- Checks if sender is a recipient in any campaign
- Updates `replied_at` timestamp if found

### 3. Event Dispatcher (`backend/src/wa_event_dispatcher.rs`)

**Created:** Event broadcaster that distributes bridge events to multiple handlers.

**Purpose:** 
- Single bridge event stream needs to be consumed by multiple handlers
- Broadcasts events to:
  - WebhookForwarder (for incoming messages)
  - WaStatusTracker (for status updates and reply tracking)
  - ChatbotEngine (for auto-replies)

**Event Routing:**
- `message_status` → StatusTracker
- `message_received` → WebhookForwarder, ChatbotEngine, StatusTracker (for reply tracking)

## Integration Guide

To integrate the status tracker into the main application, add the following to `main.rs`:

```rust
use tridjaya_backend::{
    bridge::BridgeClient,
    wa_status_tracker::WaStatusTracker,
    wa_event_dispatcher::WaEventDispatcher,
    webhook_forwarder::{WebhookForwarder, WebhookForwarderConfig},
};

// In main() function, after initializing the database pool:

// Initialize Bridge Client
let (bridge_client, bridge_event_rx) = BridgeClient::new();
let bridge_client = Arc::new(bridge_client);

// Create channels for event handlers
let (webhook_tx, webhook_rx) = mpsc::unbounded_channel();
let (status_tx, status_rx) = mpsc::unbounded_channel();

// Initialize event dispatcher
let event_dispatcher = WaEventDispatcher::new()
    .with_webhook_forwarder(webhook_tx)
    .with_status_tracker(status_tx);

// Start event dispatcher
tokio::spawn(async move {
    event_dispatcher.start(bridge_event_rx).await;
});

// Initialize and start status tracker
let status_tracker = WaStatusTracker::new(pool.clone());
tokio::spawn(async move {
    status_tracker.start(status_rx).await;
});

// Initialize and start webhook forwarder
let webhook_config = WebhookForwarderConfig::default();
let webhook_forwarder = WebhookForwarder::new(webhook_config, pool.clone());
tokio::spawn(async move {
    webhook_forwarder.start(webhook_rx).await;
});
```

## Database Schema

The implementation uses existing tables from migration `2026050203_enhance_wa_tracking.sql`:

### wa_recipients
- `sent_at DATETIME`: Timestamp when message was sent
- `delivered_at DATETIME`: Timestamp when delivery receipt received
- `read_at DATETIME`: Timestamp when read receipt received
- `replied_at DATETIME`: Timestamp when recipient replied

### wa_dispatch_logs
Used for audit trail of status transitions. Each status change creates a new log entry with:
- `status`: 'sent', 'delivered', or 'read'
- `meta`: JSON containing status transition details
- `message_id`: WhatsApp message ID for correlation

## Requirements Validation

✅ **Requirement 10.1**: Update `sent_at` timestamp when message sent
- Implemented in `update_recipient_status()` for `MessageStatus::Sent`

✅ **Requirement 10.2**: Update `delivered_at` timestamp when delivery receipt received
- Implemented in `update_recipient_status()` for `MessageStatus::Delivered`

✅ **Requirement 10.3**: Update `read_at` timestamp when read receipt received
- Implemented in `update_recipient_status()` for `MessageStatus::Read`

✅ **Requirement 10.4**: Update `wa_dispatch_logs` with status transitions for audit trail
- Implemented in `log_status_transition()`

✅ **Requirement 10.7**: Update `replied_at` timestamp when recipient replies
- Implemented in `handle_possible_reply()`

## Testing

Unit tests are included in `wa_status_tracker.rs`:
- `test_message_status_as_str()`: Verify status string conversion
- `test_message_status_from_str()`: Verify status parsing
- `test_message_status_round_trip()`: Verify round-trip conversion

## Future Enhancements

1. **Metrics Calculation** (Task 20): Calculate campaign metrics from status data
   - Delivered rate: `COUNT(delivered_at) / COUNT(sent_at)`
   - Read rate: `COUNT(read_at) / COUNT(sent_at)`
   - Reply rate: `COUNT(replied_at) / COUNT(sent_at)`

2. **Real-time Status Updates**: Emit WebSocket events for real-time dashboard updates

3. **Status Webhooks**: Allow external systems to receive status update webhooks

## Notes

- The Baileys library automatically tracks message status through WhatsApp's protocol
- Status codes are defined by WhatsApp: 0=error, 1=pending, 2=sent, 3=delivered, 4=read
- Not all messages will receive read receipts (depends on recipient's privacy settings)
- The `message_id` from Baileys is used to correlate status updates with sent messages
