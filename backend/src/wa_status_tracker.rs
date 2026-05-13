/**
 * WhatsApp Message Status Tracker
 *
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.7**
 *
 * This module implements message status tracking for delivery and read receipts:
 * - Handles status update events from Baileys bridge (sent, delivered, read)
 * - Updates wa_recipients table with timestamps
 * - Updates wa_dispatch_logs with status transitions for audit trail
 * - Tracks replied_at timestamp when recipient replies
 */
use crate::bridge::BridgeEvent;
use sqlx::SqlitePool;
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

/// Message status types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageStatus {
    Sent,
    Delivered,
    Read,
}

impl MessageStatus {
    /// Convert status to string for database storage
    pub fn as_str(&self) -> &'static str {
        match self {
            MessageStatus::Sent => "sent",
            MessageStatus::Delivered => "delivered",
            MessageStatus::Read => "read",
        }
    }

    /// Parse status from string
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "sent" => Some(MessageStatus::Sent),
            "delivered" => Some(MessageStatus::Delivered),
            "read" => Some(MessageStatus::Read),
            _ => None,
        }
    }
}

/// Status update event data
#[derive(Debug, Clone)]
pub struct StatusUpdate {
    pub session_id: String,
    pub message_id: String,
    pub recipient: String,
    pub status: MessageStatus,
}

/// WhatsApp Status Tracker
pub struct WaStatusTracker {
    pool: SqlitePool,
}

impl WaStatusTracker {
    /// Create a new status tracker
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    /// Start the status tracker event loop
    ///
    /// **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    pub async fn start(&self, mut event_rx: mpsc::UnboundedReceiver<BridgeEvent>) {
        info!("Starting WhatsApp Status Tracker");

        // Process incoming events
        while let Some(event) = event_rx.recv().await {
            match event.event_type.as_str() {
                "message_status" => {
                    if let Err(e) = self.handle_status_update(event).await {
                        error!("Error handling status update: {}", e);
                    }
                }
                "message_received" => {
                    // Check if this is a reply to a sent message
                    if let Err(e) = self.handle_possible_reply(event).await {
                        error!("Error handling possible reply: {}", e);
                    }
                }
                _ => {
                    // Ignore other event types
                }
            }
        }

        info!("WhatsApp Status Tracker stopped");
    }

    /// Handle message status update event
    ///
    /// **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    async fn handle_status_update(
        &self,
        event: BridgeEvent,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        debug!(
            session_id = %event.session_id,
            event_type = %event.event_type,
            "Handling status update event"
        );

        // Parse event data
        let message_id = event.data["message_id"]
            .as_str()
            .ok_or("Missing message_id field")?
            .to_string();

        let recipient = event.data["recipient"]
            .as_str()
            .ok_or("Missing recipient field")?
            .to_string();

        let status_str = event.data["status"]
            .as_str()
            .ok_or("Missing status field")?;

        let status = MessageStatus::from_str(status_str)
            .ok_or_else(|| format!("Invalid status: {}", status_str))?;

        let status_update = StatusUpdate {
            session_id: event.session_id.clone(),
            message_id: message_id.clone(),
            recipient: recipient.clone(),
            status,
        };

        // Update recipient status in database
        self.update_recipient_status(&status_update).await?;

        // Log status transition to dispatch logs
        self.log_status_transition(&status_update).await?;

        info!(
            session_id = %event.session_id,
            message_id = %message_id,
            recipient = %recipient,
            status = %status.as_str(),
            "Status update processed"
        );

        Ok(())
    }

    /// Update recipient status in wa_recipients table
    ///
    /// **Validates: Requirements 10.1, 10.2, 10.3**
    async fn update_recipient_status(
        &self,
        update: &StatusUpdate,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Find recipient by message_id in dispatch logs
        let recipient_id: Option<String> = sqlx::query_scalar(
            "SELECT recipient_id FROM wa_dispatch_logs 
             WHERE message_id = ? 
             LIMIT 1",
        )
        .bind(&update.message_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(recipient_id) = recipient_id {
            // Update timestamp based on status
            match update.status {
                MessageStatus::Sent => {
                    // Update sent_at timestamp (Requirement 10.1)
                    sqlx::query(
                        "UPDATE wa_recipients 
                         SET sent_at = CURRENT_TIMESTAMP, status = 'sent'
                         WHERE id = ?",
                    )
                    .bind(&recipient_id)
                    .execute(&self.pool)
                    .await?;

                    debug!(
                        recipient_id = %recipient_id,
                        "Updated sent_at timestamp"
                    );
                }
                MessageStatus::Delivered => {
                    // Update delivered_at timestamp (Requirement 10.2)
                    sqlx::query(
                        "UPDATE wa_recipients 
                         SET delivered_at = CURRENT_TIMESTAMP
                         WHERE id = ?",
                    )
                    .bind(&recipient_id)
                    .execute(&self.pool)
                    .await?;

                    debug!(
                        recipient_id = %recipient_id,
                        "Updated delivered_at timestamp"
                    );
                }
                MessageStatus::Read => {
                    // Update read_at timestamp (Requirement 10.3)
                    sqlx::query(
                        "UPDATE wa_recipients 
                         SET read_at = CURRENT_TIMESTAMP
                         WHERE id = ?",
                    )
                    .bind(&recipient_id)
                    .execute(&self.pool)
                    .await?;

                    debug!(
                        recipient_id = %recipient_id,
                        "Updated read_at timestamp"
                    );
                }
            }
        } else {
            warn!(
                message_id = %update.message_id,
                "No recipient found for message_id in dispatch logs"
            );
        }

        Ok(())
    }

    /// Log status transition to wa_dispatch_logs for audit trail
    ///
    /// **Validates: Requirements 10.4**
    async fn log_status_transition(
        &self,
        update: &StatusUpdate,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Find campaign_id and recipient_id from existing dispatch log
        let existing_log: Option<(String, String, String)> = sqlx::query_as(
            "SELECT campaign_id, recipient_id, phone 
             FROM wa_dispatch_logs 
             WHERE message_id = ? 
             LIMIT 1",
        )
        .bind(&update.message_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some((campaign_id, recipient_id, phone)) = existing_log {
            // Insert new dispatch log entry for status transition
            let log_id = Uuid::new_v4().to_string();
            let meta = serde_json::json!({
                "status_transition": update.status.as_str(),
                "previous_message_id": update.message_id
            });

            sqlx::query(
                "INSERT INTO wa_dispatch_logs 
                 (id, campaign_id, recipient_id, phone, wa_account_id, status, meta, message_id, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
            )
            .bind(&log_id)
            .bind(&campaign_id)
            .bind(&recipient_id)
            .bind(&phone)
            .bind(&update.session_id)
            .bind(update.status.as_str())
            .bind(meta.to_string())
            .bind(&update.message_id)
            .execute(&self.pool)
            .await?;

            debug!(
                log_id = %log_id,
                message_id = %update.message_id,
                status = %update.status.as_str(),
                "Logged status transition to dispatch logs"
            );
        } else {
            warn!(
                message_id = %update.message_id,
                "No existing dispatch log found for message_id"
            );
        }

        Ok(())
    }

    /// Handle possible reply from recipient
    ///
    /// **Validates: Requirements 10.7**
    async fn handle_possible_reply(
        &self,
        event: BridgeEvent,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Extract sender from incoming message
        let sender = event.data["sender"]
            .as_str()
            .ok_or("Missing sender field")?
            .to_string();

        // Check if this sender is a recipient in any campaign
        // Update replied_at timestamp if found
        let result = sqlx::query(
            "UPDATE wa_recipients 
             SET replied_at = CURRENT_TIMESTAMP
             WHERE phone = ? AND replied_at IS NULL",
        )
        .bind(&sender)
        .execute(&self.pool)
        .await?;

        if result.rows_affected() > 0 {
            info!(
                sender = %sender,
                rows_affected = result.rows_affected(),
                "Updated replied_at timestamp for recipient"
            );
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_status_as_str() {
        assert_eq!(MessageStatus::Sent.as_str(), "sent");
        assert_eq!(MessageStatus::Delivered.as_str(), "delivered");
        assert_eq!(MessageStatus::Read.as_str(), "read");
    }

    #[test]
    fn test_message_status_from_str() {
        assert_eq!(MessageStatus::from_str("sent"), Some(MessageStatus::Sent));
        assert_eq!(
            MessageStatus::from_str("delivered"),
            Some(MessageStatus::Delivered)
        );
        assert_eq!(MessageStatus::from_str("read"), Some(MessageStatus::Read));
        assert_eq!(MessageStatus::from_str("invalid"), None);
    }

    #[test]
    fn test_message_status_round_trip() {
        let statuses = vec![
            MessageStatus::Sent,
            MessageStatus::Delivered,
            MessageStatus::Read,
        ];

        for status in statuses {
            let str_repr = status.as_str();
            let parsed = MessageStatus::from_str(str_repr);
            assert_eq!(parsed, Some(status));
        }
    }
}
