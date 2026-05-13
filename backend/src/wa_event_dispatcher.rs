/**
 * WhatsApp Event Dispatcher
 *
 * This module broadcasts bridge events to multiple handlers:
 * - WebhookForwarder (for incoming messages)
 * - WaStatusTracker (for status updates)
 * - ChatbotEngine (for auto-replies)
 */
use crate::bridge::BridgeEvent;
use tokio::sync::mpsc;
use tracing::{debug, error, info};

/// Event dispatcher that broadcasts events to multiple handlers
pub struct WaEventDispatcher {
    /// Senders for different event handlers
    webhook_tx: Option<mpsc::UnboundedSender<BridgeEvent>>,
    status_tx: Option<mpsc::UnboundedSender<BridgeEvent>>,
    chatbot_tx: Option<mpsc::UnboundedSender<BridgeEvent>>,
}

impl WaEventDispatcher {
    /// Create a new event dispatcher
    pub fn new() -> Self {
        Self {
            webhook_tx: None,
            status_tx: None,
            chatbot_tx: None,
        }
    }

    /// Register webhook forwarder channel
    pub fn with_webhook_forwarder(mut self, tx: mpsc::UnboundedSender<BridgeEvent>) -> Self {
        self.webhook_tx = Some(tx);
        self
    }

    /// Register status tracker channel
    pub fn with_status_tracker(mut self, tx: mpsc::UnboundedSender<BridgeEvent>) -> Self {
        self.status_tx = Some(tx);
        self
    }

    /// Register chatbot engine channel
    pub fn with_chatbot_engine(mut self, tx: mpsc::UnboundedSender<BridgeEvent>) -> Self {
        self.chatbot_tx = Some(tx);
        self
    }

    /// Start the event dispatcher loop
    pub async fn start(&self, mut bridge_event_rx: mpsc::UnboundedReceiver<BridgeEvent>) {
        info!("Starting WhatsApp Event Dispatcher");

        while let Some(event) = bridge_event_rx.recv().await {
            debug!(
                session_id = %event.session_id,
                event_type = %event.event_type,
                "Dispatching event"
            );

            // Broadcast to all registered handlers
            self.broadcast_event(event).await;
        }

        info!("WhatsApp Event Dispatcher stopped");
    }

    /// Broadcast event to all registered handlers
    async fn broadcast_event(&self, event: BridgeEvent) {
        // Send to webhook forwarder (for incoming messages)
        if event.event_type == "message_received" {
            if let Some(ref tx) = self.webhook_tx {
                if let Err(e) = tx.send(event.clone()) {
                    error!("Failed to send event to webhook forwarder: {}", e);
                }
            }
        }

        // Send to status tracker (for status updates)
        if event.event_type == "message_status" {
            if let Some(ref tx) = self.status_tx {
                if let Err(e) = tx.send(event.clone()) {
                    error!("Failed to send event to status tracker: {}", e);
                }
            }
        }

        // Send to chatbot engine (for incoming messages)
        if event.event_type == "message_received" {
            if let Some(ref tx) = self.chatbot_tx {
                if let Err(e) = tx.send(event.clone()) {
                    error!("Failed to send event to chatbot engine: {}", e);
                }
            }
        }

        // Also send incoming messages to status tracker for reply tracking
        if event.event_type == "message_received" {
            if let Some(ref tx) = self.status_tx {
                if let Err(e) = tx.send(event) {
                    error!("Failed to send incoming message to status tracker: {}", e);
                }
            }
        }
    }
}

impl Default for WaEventDispatcher {
    fn default() -> Self {
        Self::new()
    }
}
