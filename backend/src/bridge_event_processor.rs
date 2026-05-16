use crate::bridge::BridgeEvent;
/**
 * Bridge Event Processor
 *
 * Consumes events from the Baileys bridge (via BridgeClient event_rx channel)
 * and persists them to the database. This is the glue between the Node.js
 * WhatsApp bridge and the Rust backend state.
 *
 * Events handled:
 * - qr_generated      → store QR in wa_session_health
 * - connected          → update wa_accounts status, phone_number
 * - disconnected       → update wa_accounts status
 * - reconnecting       → update wa_accounts status
 * - reconnect_failed   → update wa_accounts status + error
 * - message_received   → insert into wa_messages (inbound)
 * - message_status     → update wa_recipients / wa_messages delivery status
 * - creds_updated      → store encrypted credentials in wa_accounts
 * - process_crashed    → update wa_accounts status + error
 */
use sqlx::MySqlPool;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

pub async fn run(pool: MySqlPool, mut event_rx: mpsc::UnboundedReceiver<BridgeEvent>) {
    info!("Bridge event processor started");

    while let Some(event) = event_rx.recv().await {
        debug!(
            session_id = %event.session_id,
            event_type = %event.event_type,
            "Processing bridge event"
        );

        if let Err(e) = handle_event(&pool, &event).await {
            error!(
                session_id = %event.session_id,
                event_type = %event.event_type,
                error = %e,
                "Failed to process bridge event"
            );
        }
    }

    warn!("Bridge event processor stopped (event channel closed)");
}

async fn handle_event(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    match event.event_type.as_str() {
        "qr_generated" => handle_qr_generated(pool, event).await,
        "connected" => handle_connected(pool, event).await,
        "disconnected" => handle_disconnected(pool, event).await,
        "reconnecting" => handle_reconnecting(pool, event).await,
        "reconnect_failed" => handle_reconnect_failed(pool, event).await,
        "message_received" => handle_message_received(pool, event).await,
        "message_status" => handle_message_status(pool, event).await,
        "creds_updated" => handle_creds_updated(pool, event).await,
        "process_crashed" => handle_process_crashed(pool, event).await,
        other => {
            debug!(event_type = %other, "Unknown bridge event, ignoring");
            Ok(())
        }
    }
}

fn normalize_wa_phone(value: &str) -> Option<String> {
    let without_jid = value
        .split('@')
        .next()
        .unwrap_or(value)
        .split(':')
        .next()
        .unwrap_or(value);
    let digits: String = without_jid
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect();

    if digits.is_empty() {
        return None;
    }

    if digits.starts_with("62") {
        Some(digits)
    } else if let Some(stripped) = digits.strip_prefix('0') {
        Some(format!("62{}", stripped))
    } else if digits.starts_with('8') {
        Some(format!("62{}", digits))
    } else {
        Some(digits)
    }
}

/// Store QR code in wa_session_health for the frontend to poll
async fn handle_qr_generated(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let qr = event.data.get("qr").and_then(|v| v.as_str()).unwrap_or("");
    let session_id = &event.session_id;

    info!(session_id = %session_id, "QR code generated");

    // Upsert: delete existing health row for this session, then insert fresh
    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, qr_code, qr_expires_at, updated_at)
         VALUES (?, ?, 'qr_ready', ?, DATE_ADD(NOW(), INTERVAL 2 MINUTE), CURRENT_TIMESTAMP)",
    )
    .bind(&id)
    .bind(session_id)
    .bind(qr)
    .execute(pool)
    .await?;

    sqlx::query("UPDATE wa_accounts SET status = 'qr_ready' WHERE id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Session connected — update status and phone number
async fn handle_connected(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let phone = event.data.get("phone").and_then(|v| v.as_str());

    info!(session_id = %session_id, phone = ?phone, "Session connected");

    sqlx::query(
        "UPDATE wa_accounts SET status = 'connected', phone_number = COALESCE(?, phone_number), last_connected_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?"
    )
    .bind(phone)
    .bind(session_id)
    .execute(pool)
    .await?;

    // Update session health
    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, qr_code, updated_at)
         VALUES (?, ?, 'connected', NULL, CURRENT_TIMESTAMP)",
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(session_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Session disconnected
async fn handle_disconnected(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let reason = event
        .data
        .get("reason")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    warn!(session_id = %session_id, reason = %reason, "Session disconnected");

    sqlx::query("UPDATE wa_accounts SET status = 'disconnected', last_error = ? WHERE id = ?")
        .bind(reason)
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, last_error, updated_at)
         VALUES (?, ?, 'disconnected', ?, CURRENT_TIMESTAMP)",
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(session_id)
    .bind(reason)
    .execute(pool)
    .await?;

    Ok(())
}

/// Session reconnecting
async fn handle_reconnecting(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let attempt = event
        .data
        .get("attempt")
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    info!(session_id = %session_id, attempt = attempt, "Session reconnecting");

    sqlx::query("UPDATE wa_accounts SET status = 'reconnecting' WHERE id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Reconnect failed
async fn handle_reconnect_failed(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let error_msg = event
        .data
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("reconnect failed");

    error!(session_id = %session_id, error = %error_msg, "Reconnect failed");

    sqlx::query("UPDATE wa_accounts SET status = 'error', last_error = ? WHERE id = ?")
        .bind(error_msg)
        .bind(session_id)
        .execute(pool)
        .await?;

    // Get current restart count before replacing
    let current_count: i32 = sqlx::query_scalar(
        "SELECT COALESCE(restart_count, 0) FROM wa_session_health WHERE session_id = ?",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);

    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, last_error, restart_count, updated_at)
         VALUES (?, ?, 'error', ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(session_id)
    .bind(error_msg)
    .bind(current_count + 1)
    .execute(pool)
    .await?;

    Ok(())
}

/// Incoming WhatsApp message — store in wa_messages
async fn handle_message_received(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let data = &event.data;

    let message_id = data
        .get("message_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let sender = data.get("sender").and_then(|v| v.as_str()).unwrap_or("");
    let text = data.get("text").and_then(|v| v.as_str());
    let timestamp = data.get("timestamp").and_then(|v| v.as_i64());

    debug!(
        session_id = %session_id,
        message_id = %message_id,
        sender = %sender,
        "Incoming message received"
    );

    // Upsert contact
    let contact_phone = sender.replace("@s.whatsapp.net", "").replace("@g.us", "");
    let is_group = sender.ends_with("@g.us");
    let contact_id = uuid::Uuid::new_v4().to_string();

    sqlx::query(
        "INSERT INTO wa_contacts (id, phone, is_group, last_chat_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE last_chat_at = CURRENT_TIMESTAMP",
    )
    .bind(&contact_id)
    .bind(&contact_phone)
    .bind(is_group)
    .execute(pool)
    .await?;

    // Get actual contact_id (could be the one we just inserted or existing)
    let actual_contact: Option<(String,)> =
        sqlx::query_as("SELECT id FROM wa_contacts WHERE phone = ?")
            .bind(&contact_phone)
            .fetch_optional(pool)
            .await?;

    let contact_id_ref = actual_contact.as_ref().map(|c| c.0.as_str());

    // Store message
    let msg_id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT IGNORE INTO wa_messages (id, session_id, contact_id, direction, message_type, content, status, wa_message_id, sent_at, created_at)
         VALUES (?, ?, ?, 'inbound', 'text', ?, 'received', ?, FROM_UNIXTIME(?), CURRENT_TIMESTAMP)"
    )
    .bind(&msg_id)
    .bind(session_id)
    .bind(contact_id_ref)
    .bind(text)
    .bind(message_id)
    .bind(timestamp)
    .execute(pool)
    .await?;

    // Update account message count
    sqlx::query(
        "UPDATE wa_accounts SET message_count_today = message_count_today + 1, last_message_at = CURRENT_TIMESTAMP WHERE id = ?"
    )
    .bind(session_id)
    .execute(pool)
    .await?;

    if let Some(normalized_sender) = normalize_wa_phone(sender) {
        sqlx::query(
            "UPDATE wa_recipients
             SET replied_at = COALESCE(replied_at, CURRENT_TIMESTAMP)
             WHERE replied_at IS NULL
               AND (
                 phone = ?
                 OR replace(replace(replace(replace(replace(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
               )",
        )
        .bind(&normalized_sender)
        .bind(&normalized_sender)
        .execute(pool)
        .await?;
    }

    Ok(())
}

/// Message delivery status update (sent/delivered/read)
async fn handle_message_status(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let data = &event.data;
    let message_id = data
        .get("message_id")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let status = data.get("status").and_then(|v| v.as_str()).unwrap_or("");

    debug!(
        message_id = %message_id,
        status = %status,
        "Message status update"
    );

    // Update wa_messages table
    match status {
        "sent" => {
            sqlx::query(
                "UPDATE wa_messages SET status = 'sent', sent_at = COALESCE(sent_at, CURRENT_TIMESTAMP) WHERE wa_message_id = ?"
            )
            .bind(message_id)
            .execute(pool)
            .await?;
        }
        "delivered" => {
            sqlx::query(
                "UPDATE wa_messages SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP WHERE wa_message_id = ?"
            )
            .bind(message_id)
            .execute(pool)
            .await?;
        }
        "read" => {
            sqlx::query(
                "UPDATE wa_messages SET status = 'read', read_at = CURRENT_TIMESTAMP WHERE wa_message_id = ?"
            )
            .bind(message_id)
            .execute(pool)
            .await?;
        }
        _ => {
            debug!(status = %status, "Unknown message status, ignoring");
        }
    }

    // Also update wa_recipients if this message belongs to a campaign
    // The wa_message_id is stored in wa_dispatch_logs.message_id
    if status == "delivered" || status == "read" {
        let column = if status == "delivered" {
            "delivered_at"
        } else {
            "read_at"
        };
        let query = format!(
            "UPDATE wa_recipients SET {} = COALESCE({}, CURRENT_TIMESTAMP)
             WHERE id IN (SELECT recipient_id FROM wa_dispatch_logs WHERE message_id = ?)",
            column, column
        );
        let result = sqlx::query(&query).bind(message_id).execute(pool).await?;

        if result.rows_affected() == 0 {
            if let Some(recipient) = data
                .get("recipient")
                .and_then(|value| value.as_str())
                .and_then(normalize_wa_phone)
            {
                let fallback_query = format!(
                    "UPDATE wa_recipients
                     SET {} = COALESCE({}, CURRENT_TIMESTAMP)
                     WHERE id = (
                       SELECT recipient_id
                       FROM wa_dispatch_logs
                       WHERE replace(replace(replace(replace(replace(phone, '+', ''), '-', ''), ' ', ''), '(', ''), ')', '') = ?
                         AND status = 'success'
                       ORDER BY created_at DESC
                       LIMIT 1
                     )",
                    column, column
                );
                sqlx::query(&fallback_query)
                    .bind(&recipient)
                    .execute(pool)
                    .await?;
            }
        }
    }

    Ok(())
}

/// Credentials updated — store encrypted in wa_accounts
async fn handle_creds_updated(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let credentials = event
        .data
        .get("credentials")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    debug!(session_id = %session_id, "Credentials updated");

    // TODO: Encrypt credentials before storage using PIXEL_ENCRYPTION_KEY
    // For now store as-is (should be encrypted in production)
    sqlx::query("UPDATE wa_accounts SET credentials = ? WHERE id = ?")
        .bind(credentials)
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Bridge process crashed
async fn handle_process_crashed(pool: &MySqlPool, event: &BridgeEvent) -> Result<(), sqlx::Error> {
    let session_id = &event.session_id;
    let error_msg = event
        .data
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("process crashed");

    error!(session_id = %session_id, error = %error_msg, "Bridge process crashed");

    sqlx::query("UPDATE wa_accounts SET status = 'error', last_error = ? WHERE id = ?")
        .bind(error_msg)
        .bind(session_id)
        .execute(pool)
        .await?;

    let crash_count: i32 = sqlx::query_scalar(
        "SELECT COALESCE(restart_count, 0) FROM wa_session_health WHERE session_id = ?",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?
    .unwrap_or(0);

    sqlx::query("DELETE FROM wa_session_health WHERE session_id = ?")
        .bind(session_id)
        .execute(pool)
        .await?;

    sqlx::query(
        "INSERT INTO wa_session_health (id, session_id, status, last_error, restart_count, updated_at)
         VALUES (?, ?, 'error', ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&uuid::Uuid::new_v4().to_string())
    .bind(session_id)
    .bind(error_msg)
    .bind(crash_count + 1)
    .execute(pool)
    .await?;

    Ok(())
}
