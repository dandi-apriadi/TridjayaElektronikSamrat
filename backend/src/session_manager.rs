/**
 * Session Manager for WhatsApp Gateway
 * 
 * This module manages WhatsApp account sessions including:
 * - QR code generation and pairing
 * - Session encryption and persistence
 * - Session restoration on startup
 * - Connection health monitoring
 * - Automatic reconnection with exponential backoff
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8
 */

use crate::bridge::BridgeClient;
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio::time::{interval, sleep};
use tracing::{debug, error, info, warn};

/// Session state for a WhatsApp account
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    /// Session needs QR code pairing
    NeedsPairing,
    /// QR code generated, waiting for scan
    WaitingForScan,
    /// Connected and active
    Connected,
    /// Disconnected, attempting reconnection
    Disconnected,
    /// Connection failed after max retries
    Failed,
}

impl SessionStatus {
    /// String representation that matches the values written to the
    /// `wa_accounts.status` column by [`SessionManager`].
    pub fn as_db_str(&self) -> &'static str {
        match self {
            SessionStatus::NeedsPairing => "needs_pairing",
            SessionStatus::WaitingForScan => "waiting_for_scan",
            SessionStatus::Connected => "connected",
            SessionStatus::Disconnected => "disconnected",
            SessionStatus::Failed => "failed",
        }
    }
}

/// Session state information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub account_id: String,
    pub status: SessionStatus,
    pub qr_code: Option<String>,
    pub connected_at: Option<chrono::DateTime<chrono::Utc>>,
    pub last_health_check: Option<chrono::DateTime<chrono::Utc>>,
    pub reconnect_attempts: u32,
    pub last_error: Option<String>,
}

impl SessionState {
    fn new(account_id: String) -> Self {
        Self {
            account_id,
            status: SessionStatus::NeedsPairing,
            qr_code: None,
            connected_at: None,
            last_health_check: None,
            reconnect_attempts: 0,
            last_error: None,
        }
    }
}

/// Encrypted session data stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
struct EncryptedSessionData {
    /// Base64-encoded encrypted data
    ciphertext: String,
    /// Base64-encoded nonce (12 bytes)
    nonce: String,
}

/// Session manager error types
#[derive(Debug, thiserror::Error)]
pub enum SessionError {
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    #[error("Bridge error: {0}")]
    BridgeError(#[from] crate::bridge::BridgeError),
    
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    
    #[error("Session not found: {0}")]
    SessionNotFound(String),
    
    #[error("Invalid session data: {0}")]
    InvalidSessionData(String),
    
    #[error("Session too old: {0}")]
    SessionTooOld(String),
}

pub type SessionResult<T> = Result<T, SessionError>;

/// Session Manager
pub struct SessionManager {
    /// Session states indexed by account_id
    sessions: Arc<RwLock<HashMap<String, SessionState>>>,
    /// Bridge client for communication with Node.js Baileys
    bridge: Arc<BridgeClient>,
    /// Database connection pool
    pool: SqlitePool,
    /// Encryption key derived from GATEWAY_SECRET
    encryption_key: Arc<Aes256Gcm>,
}

impl SessionManager {
    /// Create a new session manager
    pub fn new(bridge: Arc<BridgeClient>, pool: SqlitePool) -> SessionResult<Self> {
        // Derive encryption key from GATEWAY_SECRET environment variable
        let gateway_secret = std::env::var("GATEWAY_SECRET")
            .unwrap_or_else(|_| {
                warn!("GATEWAY_SECRET not set, using default (INSECURE for production!)");
                "default-gateway-secret-change-in-production".to_string()
            });
        
        // Derive 256-bit key using SHA-256
        let mut hasher = Sha256::new();
        hasher.update(gateway_secret.as_bytes());
        let key_bytes = hasher.finalize();
        
        let encryption_key = Aes256Gcm::new_from_slice(&key_bytes)
            .map_err(|e| SessionError::EncryptionError(e.to_string()))?;
        
        Ok(Self {
            sessions: Arc::new(RwLock::new(HashMap::new())),
            bridge,
            pool,
            encryption_key: Arc::new(encryption_key),
        })
    }
    
    /// Start background tasks (health monitoring, session persistence)
    pub fn start_background_tasks(self: Arc<Self>) {
        let manager = self.clone();
        tokio::spawn(async move {
            manager.health_monitor_loop().await;
        });
        
        let manager = self.clone();
        tokio::spawn(async move {
            manager.session_persistence_loop().await;
        });
    }
    
    /// Initialize session for an account (generate QR code)
    pub async fn init_session(&self, account_id: String) -> SessionResult<String> {
        info!(account_id = %account_id, "Initializing session");
        
        // Spawn bridge process if not already running
        self.bridge.spawn_process(account_id.clone()).await?;
        
        // Request QR code from bridge
        let response = self.bridge.send_request(
            &account_id,
            "init_session".to_string(),
            serde_json::json!({
                "session_id": account_id
            }),
        ).await?;
        
        // Extract QR code from response
        let qr_code = response.get("qr_code")
            .and_then(|v| v.as_str())
            .ok_or_else(|| SessionError::InvalidSessionData("Missing qr_code in response".to_string()))?
            .to_string();
        
        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            let state = sessions.entry(account_id.clone())
                .or_insert_with(|| SessionState::new(account_id.clone()));
            
            state.status = SessionStatus::WaitingForScan;
            state.qr_code = Some(qr_code.clone());
        }
        
        // Update database status
        sqlx::query(
            "UPDATE wa_accounts SET status = 'waiting_for_scan', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(&account_id)
        .execute(&self.pool)
        .await?;
        
        info!(account_id = %account_id, "QR code generated successfully");
        
        Ok(qr_code)
    }
    
    /// Handle connection event from bridge
    pub async fn handle_connection_event(&self, account_id: String) -> SessionResult<()> {
        info!(account_id = %account_id, "Connection established");
        
        let now = chrono::Utc::now();
        
        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            let state = sessions.entry(account_id.clone())
                .or_insert_with(|| SessionState::new(account_id.clone()));
            
            state.status = SessionStatus::Connected;
            state.connected_at = Some(now);
            state.reconnect_attempts = 0;
            state.last_error = None;
            state.qr_code = None;
        }
        
        // Update database status
        sqlx::query(
            "UPDATE wa_accounts SET status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(&account_id)
        .execute(&self.pool)
        .await?;
        
        // Persist session data
        self.persist_session(&account_id).await?;
        
        Ok(())
    }
    
    /// Handle disconnection event from bridge
    pub async fn handle_disconnection_event(&self, account_id: String, error: Option<String>) -> SessionResult<()> {
        warn!(account_id = %account_id, error = ?error, "Connection lost");
        
        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            if let Some(state) = sessions.get_mut(&account_id) {
                state.status = SessionStatus::Disconnected;
                state.last_error = error;
            }
        }
        
        // Update database status
        sqlx::query(
            "UPDATE wa_accounts SET status = 'disconnected', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(&account_id)
        .execute(&self.pool)
        .await?;
        
        // Attempt reconnection
        self.attempt_reconnection(account_id).await?;
        
        Ok(())
    }
    
    /// Attempt reconnection with exponential backoff
    async fn attempt_reconnection(&self, account_id: String) -> SessionResult<()> {
        const MAX_ATTEMPTS: u32 = 3;
        const BACKOFF_DELAYS: [u64; 3] = [5, 15, 45]; // seconds
        
        let attempts = {
            let sessions = self.sessions.read().await;
            sessions.get(&account_id)
                .map(|s| s.reconnect_attempts)
                .unwrap_or(0)
        };
        
        if attempts >= MAX_ATTEMPTS {
            error!(account_id = %account_id, "Max reconnection attempts reached");
            
            // Update to failed status
            {
                let mut sessions = self.sessions.write().await;
                if let Some(state) = sessions.get_mut(&account_id) {
                    state.status = SessionStatus::Failed;
                }
            }
            
            // Persist as 'failed' (not 'disconnected') so restore_all_sessions
            // — which only picks up 'connected'/'disconnected' rows — does not
            // resurrect sessions that have already exhausted all retries on
            // the next startup. Admin intervention is required to re-pair.
            sqlx::query(
                "UPDATE wa_accounts SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            )
            .bind(&account_id)
            .execute(&self.pool)
            .await?;
            
            // TODO: Generate notification for admin
            
            return Ok(());
        }
        
        // Increment attempt counter
        {
            let mut sessions = self.sessions.write().await;
            if let Some(state) = sessions.get_mut(&account_id) {
                state.reconnect_attempts += 1;
            }
        }
        
        let delay = BACKOFF_DELAYS[attempts as usize];
        info!(account_id = %account_id, attempt = attempts + 1, delay_seconds = delay, "Scheduling reconnection");
        
        // Spawn reconnection task with delay
        let manager = self.clone();
        let account_id_clone = account_id.clone();
        tokio::spawn(async move {
            sleep(Duration::from_secs(delay)).await;
            
            info!(account_id = %account_id_clone, "Attempting reconnection");
            
            match manager.reconnect_session(&account_id_clone).await {
                Ok(_) => {
                    info!(account_id = %account_id_clone, "Reconnection successful");
                }
                Err(e) => {
                    error!(account_id = %account_id_clone, error = %e, "Reconnection failed");
                    // Will retry on next disconnection event
                }
            }
        });
        
        Ok(())
    }
    
    /// Reconnect a session
    async fn reconnect_session(&self, account_id: &str) -> SessionResult<()> {
        // Try to restore session from database
        let session_data = self.load_session_from_db(account_id).await?;
        
        if let Some(data) = session_data {
            // Send restore request to bridge
            let response = self.bridge.send_request(
                account_id,
                "restore_session".to_string(),
                serde_json::json!({
                    "session_id": account_id,
                    "session_data": data
                }),
            ).await?;
            
            let success = response.get("success")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            
            if success {
                self.handle_connection_event(account_id.to_string()).await?;
                Ok(())
            } else {
                Err(SessionError::InvalidSessionData("Failed to restore session".to_string()))
            }
        } else {
            Err(SessionError::SessionNotFound(account_id.to_string()))
        }
    }
    
    /// Persist session data to database (encrypted)
    async fn persist_session(&self, account_id: &str) -> SessionResult<()> {
        debug!(account_id = %account_id, "Persisting session data");
        
        // Get session data from bridge
        let response = self.bridge.send_request(
            account_id,
            "get_session_data".to_string(),
            serde_json::json!({
                "session_id": account_id
            }),
        ).await?;
        
        let session_data = response.get("session_data")
            .ok_or_else(|| SessionError::InvalidSessionData("Missing session_data in response".to_string()))?;
        
        // Serialize session data
        let session_json = serde_json::to_string(session_data)
            .map_err(|e| SessionError::InvalidSessionData(e.to_string()))?;
        
        // Encrypt session data
        let encrypted = self.encrypt_session_data(&session_json)?;
        
        // Store in database
        let encrypted_json = serde_json::to_string(&encrypted)
            .map_err(|e| SessionError::InvalidSessionData(e.to_string()))?;
        
        sqlx::query(
            "UPDATE wa_accounts SET session_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(&encrypted_json)
        .bind(account_id)
        .execute(&self.pool)
        .await?;
        
        debug!(account_id = %account_id, "Session data persisted successfully");
        
        Ok(())
    }
    
    /// Load session data from database (decrypt)
    async fn load_session_from_db(&self, account_id: &str) -> SessionResult<Option<serde_json::Value>> {
        debug!(account_id = %account_id, "Loading session data from database");
        
        let row: Option<(Option<String>,)> = sqlx::query_as(
            "SELECT session_data FROM wa_accounts WHERE id = ?"
        )
        .bind(account_id)
        .fetch_optional(&self.pool)
        .await?;
        
        if let Some((Some(encrypted_json),)) = row {
            // Parse encrypted data
            let encrypted: EncryptedSessionData = serde_json::from_str(&encrypted_json)
                .map_err(|e| SessionError::InvalidSessionData(e.to_string()))?;
            
            // Decrypt session data
            let decrypted = self.decrypt_session_data(&encrypted)?;
            
            // Parse as JSON
            let session_data: serde_json::Value = serde_json::from_str(&decrypted)
                .map_err(|e| SessionError::InvalidSessionData(e.to_string()))?;
            
            Ok(Some(session_data))
        } else {
            Ok(None)
        }
    }
    
    /// Encrypt session data using AES-256-GCM
    fn encrypt_session_data(&self, plaintext: &str) -> SessionResult<EncryptedSessionData> {
        // Generate random nonce (12 bytes for GCM)
        let nonce_bytes = aes_gcm::aead::rand_core::RngCore::next_u64(&mut OsRng).to_le_bytes();
        let mut nonce_array = [0u8; 12];
        nonce_array[..8].copy_from_slice(&nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_array);
        
        // Encrypt
        let ciphertext = self.encryption_key
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| SessionError::EncryptionError(e.to_string()))?;
        
        Ok(EncryptedSessionData {
            ciphertext: BASE64.encode(&ciphertext),
            nonce: BASE64.encode(nonce),
        })
    }
    
    /// Decrypt session data using AES-256-GCM
    fn decrypt_session_data(&self, encrypted: &EncryptedSessionData) -> SessionResult<String> {
        // Decode base64
        let ciphertext = BASE64.decode(&encrypted.ciphertext)
            .map_err(|e| SessionError::EncryptionError(e.to_string()))?;
        
        let nonce_bytes = BASE64.decode(&encrypted.nonce)
            .map_err(|e| SessionError::EncryptionError(e.to_string()))?;
        
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        // Decrypt
        let plaintext = self.encryption_key
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|e| SessionError::EncryptionError(e.to_string()))?;
        
        String::from_utf8(plaintext)
            .map_err(|e| SessionError::EncryptionError(e.to_string()))
    }
    
    /// Restore all sessions on startup
    pub async fn restore_all_sessions(&self) -> SessionResult<()> {
        info!("Restoring sessions from database");
        
        // Get all active accounts
        let accounts: Vec<(String, Option<String>)> = sqlx::query_as(
            "SELECT id, session_data FROM wa_accounts WHERE status IN ('connected', 'disconnected')"
        )
        .fetch_all(&self.pool)
        .await?;
        
        info!(count = accounts.len(), "Found accounts to restore");
        
        for (account_id, session_data_json) in accounts {
            if let Some(_encrypted_json) = session_data_json {
                // Check session age
                let row: Option<(String,)> = sqlx::query_as(
                    "SELECT updated_at FROM wa_accounts WHERE id = ?"
                )
                .bind(&account_id)
                .fetch_optional(&self.pool)
                .await?;
                
                if let Some((updated_at,)) = row {
                    if let Ok(updated) = chrono::DateTime::parse_from_rfc3339(&updated_at) {
                        let age = chrono::Utc::now().signed_duration_since(updated.with_timezone(&chrono::Utc));
                        
                        if age.num_days() > 30 {
                            warn!(account_id = %account_id, age_days = age.num_days(), "Session too old, skipping");
                            
                            sqlx::query(
                                "UPDATE wa_accounts SET status = 'needs_pairing', session_data = NULL WHERE id = ?"
                            )
                            .bind(&account_id)
                            .execute(&self.pool)
                            .await?;
                            
                            continue;
                        }
                    }
                }
                
                // Attempt to restore session
                info!(account_id = %account_id, "Restoring session");
                
                match self.load_session_from_db(&account_id).await {
                    Ok(Some(session_data)) => {
                        // Spawn bridge process
                        if let Err(e) = self.bridge.spawn_process(account_id.clone()).await {
                            error!(account_id = %account_id, error = %e, "Failed to spawn bridge process");
                            continue;
                        }
                        
                        // Send restore request
                        match self.bridge.send_request(
                            &account_id,
                            "restore_session".to_string(),
                            serde_json::json!({
                                "session_id": account_id,
                                "session_data": session_data
                            }),
                        ).await {
                            Ok(response) => {
                                let success = response.get("success")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);
                                
                                if success {
                                    info!(account_id = %account_id, "Session restored successfully");
                                    
                                    // Update session state
                                    let mut sessions = self.sessions.write().await;
                                    let state = sessions.entry(account_id.clone())
                                        .or_insert_with(|| SessionState::new(account_id.clone()));
                                    
                                    state.status = SessionStatus::Connected;
                                    state.connected_at = Some(chrono::Utc::now());
                                } else {
                                    warn!(account_id = %account_id, "Session restoration failed");
                                    
                                    sqlx::query(
                                        "UPDATE wa_accounts SET status = 'needs_pairing' WHERE id = ?"
                                    )
                                    .bind(&account_id)
                                    .execute(&self.pool)
                                    .await?;
                                }
                            }
                            Err(e) => {
                                error!(account_id = %account_id, error = %e, "Failed to restore session");
                            }
                        }
                    }
                    Ok(None) => {
                        warn!(account_id = %account_id, "No session data found");
                    }
                    Err(e) => {
                        error!(account_id = %account_id, error = %e, "Failed to load session data");
                    }
                }
            } else {
                info!(account_id = %account_id, "No session data, marking as needs_pairing");
                
                sqlx::query(
                    "UPDATE wa_accounts SET status = 'needs_pairing' WHERE id = ?"
                )
                .bind(&account_id)
                .execute(&self.pool)
                .await?;
            }
        }
        
        info!("Session restoration complete");
        
        Ok(())
    }
    
    /// Health monitor loop (runs every 30 seconds)
    async fn health_monitor_loop(&self) {
        let mut interval = interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.check_all_sessions_health().await {
                error!(error = %e, "Health check failed");
            }
        }
    }
    
    /// Check health of all sessions
    async fn check_all_sessions_health(&self) -> SessionResult<()> {
        debug!("Running health check for all sessions");
        
        let account_ids: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions.keys().cloned().collect()
        };
        
        for account_id in account_ids {
            if let Err(e) = self.check_session_health(&account_id).await {
                warn!(account_id = %account_id, error = %e, "Health check failed for session");
            }
        }
        
        Ok(())
    }
    
    /// Check health of a single session
    async fn check_session_health(&self, account_id: &str) -> SessionResult<()> {
        // Send health check request to bridge
        let response = self.bridge.send_request(
            account_id,
            "health_check".to_string(),
            serde_json::json!({
                "session_id": account_id
            }),
        ).await?;
        
        let is_connected = response.get("connected")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);
        
        let now = chrono::Utc::now();
        
        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            if let Some(state) = sessions.get_mut(account_id) {
                state.last_health_check = Some(now);
                
                if !is_connected && state.status == SessionStatus::Connected {
                    // Connection lost
                    warn!(account_id = %account_id, "Connection lost detected during health check");
                    state.status = SessionStatus::Disconnected;
                    
                    // Trigger reconnection
                    drop(sessions); // Release lock before async call
                    self.handle_disconnection_event(account_id.to_string(), Some("Health check failed".to_string())).await?;
                }
            }
        }
        
        Ok(())
    }
    
    /// Session persistence loop (runs every 5 minutes)
    async fn session_persistence_loop(&self) {
        let mut interval = interval(Duration::from_secs(300)); // 5 minutes
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.persist_all_sessions().await {
                error!(error = %e, "Session persistence failed");
            }
        }
    }
    
    /// Persist all connected sessions
    async fn persist_all_sessions(&self) -> SessionResult<()> {
        debug!("Persisting all connected sessions");
        
        let account_ids: Vec<String> = {
            let sessions = self.sessions.read().await;
            sessions.iter()
                .filter(|(_, state)| state.status == SessionStatus::Connected)
                .map(|(id, _)| id.clone())
                .collect()
        };
        
        for account_id in account_ids {
            if let Err(e) = self.persist_session(&account_id).await {
                warn!(account_id = %account_id, error = %e, "Failed to persist session");
            }
        }
        
        Ok(())
    }
    
    /// Get session state for an account
    pub async fn get_session_state(&self, account_id: &str) -> Option<SessionState> {
        let sessions = self.sessions.read().await;
        sessions.get(account_id).cloned()
    }
    
    /// Get all session states
    pub async fn get_all_session_states(&self) -> HashMap<String, SessionState> {
        let sessions = self.sessions.read().await;
        sessions.clone()
    }
    
    /// Disconnect a session
    pub async fn disconnect_session(&self, account_id: &str) -> SessionResult<()> {
        info!(account_id = %account_id, "Disconnecting session");
        
        // Send disconnect request to bridge
        self.bridge.send_request(
            account_id,
            "disconnect".to_string(),
            serde_json::json!({
                "session_id": account_id
            }),
        ).await?;
        
        // Kill bridge process
        self.bridge.kill_process(account_id).await?;
        
        // Update session state
        {
            let mut sessions = self.sessions.write().await;
            sessions.remove(account_id);
        }
        
        // Update database
        sqlx::query(
            "UPDATE wa_accounts SET status = 'disconnected', session_data = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        )
        .bind(account_id)
        .execute(&self.pool)
        .await?;
        
        info!(account_id = %account_id, "Session disconnected successfully");
        
        Ok(())
    }
}

impl Clone for SessionManager {
    fn clone(&self) -> Self {
        Self {
            sessions: self.sessions.clone(),
            bridge: self.bridge.clone(),
            pool: self.pool.clone(),
            encryption_key: self.encryption_key.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_session_state_serialization() {
        let state = SessionState {
            account_id: "test-account".to_string(),
            status: SessionStatus::Connected,
            qr_code: None,
            connected_at: Some(chrono::Utc::now()),
            last_health_check: None,
            reconnect_attempts: 0,
            last_error: None,
        };
        
        let json = serde_json::to_string(&state).unwrap();
        let deserialized: SessionState = serde_json::from_str(&json).unwrap();
        
        assert_eq!(state.account_id, deserialized.account_id);
        assert_eq!(state.status, deserialized.status);
    }
    
    #[test]
    fn test_session_status_serialization() {
        let status = SessionStatus::Connected;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"connected\"");
        
        let deserialized: SessionStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(status, deserialized);
    }
    
    /// Test AES-256-GCM encryption/decryption round-trip
    /// Validates: Requirements 1.3, 11.2
    #[test]
    fn test_encryption_decryption_round_trip() {
        // Create a test encryption key
        let gateway_secret = "test-gateway-secret-for-encryption";
        let mut hasher = Sha256::new();
        hasher.update(gateway_secret.as_bytes());
        let key_bytes = hasher.finalize();
        let encryption_key = Aes256Gcm::new_from_slice(&key_bytes).unwrap();
        
        // Test data
        let plaintext = r#"{"session_id":"test-123","credentials":{"noiseKey":"abc123","signedIdentityKey":"def456"}}"#;
        
        // Encrypt
        let nonce_bytes = [1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let nonce = Nonce::from_slice(&nonce_bytes);
        let ciphertext = encryption_key.encrypt(nonce, plaintext.as_bytes()).unwrap();
        
        // Decrypt
        let decrypted = encryption_key.decrypt(nonce, ciphertext.as_ref()).unwrap();
        let decrypted_text = String::from_utf8(decrypted).unwrap();
        
        // Verify round-trip
        assert_eq!(plaintext, decrypted_text);
    }
    
    /// Test key derivation from GATEWAY_SECRET
    /// Validates: Requirements 1.3, 11.2
    #[test]
    fn test_key_derivation_consistency() {
        let gateway_secret = "test-gateway-secret";
        
        // Derive key twice
        let mut hasher1 = Sha256::new();
        hasher1.update(gateway_secret.as_bytes());
        let key1 = hasher1.finalize();
        
        let mut hasher2 = Sha256::new();
        hasher2.update(gateway_secret.as_bytes());
        let key2 = hasher2.finalize();
        
        // Keys should be identical
        assert_eq!(key1, key2);
        
        // Key should be 32 bytes (256 bits)
        assert_eq!(key1.len(), 32);
    }
    
    /// Test handling of corrupted encrypted data
    /// Validates: Requirements 1.3, 11.2
    #[test]
    fn test_corrupted_encrypted_data() {
        // Create a test encryption key
        let gateway_secret = "test-gateway-secret-for-encryption";
        let mut hasher = Sha256::new();
        hasher.update(gateway_secret.as_bytes());
        let key_bytes = hasher.finalize();
        let encryption_key = Aes256Gcm::new_from_slice(&key_bytes).unwrap();
        
        // Encrypt some data
        let plaintext = "test data";
        let nonce_bytes = [1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let nonce = Nonce::from_slice(&nonce_bytes);
        let mut ciphertext = encryption_key.encrypt(nonce, plaintext.as_bytes()).unwrap();
        
        // Corrupt the ciphertext
        if !ciphertext.is_empty() {
            ciphertext[0] ^= 0xFF; // Flip all bits in first byte
        }
        
        // Attempt to decrypt corrupted data
        let result = encryption_key.decrypt(nonce, ciphertext.as_ref());
        
        // Should fail
        assert!(result.is_err());
    }
    
    /// Test encryption with different nonces produces different ciphertexts
    /// Validates: Requirements 1.3, 11.2
    #[test]
    fn test_different_nonces_produce_different_ciphertexts() {
        // Create a test encryption key
        let gateway_secret = "test-gateway-secret-for-encryption";
        let mut hasher = Sha256::new();
        hasher.update(gateway_secret.as_bytes());
        let key_bytes = hasher.finalize();
        let encryption_key = Aes256Gcm::new_from_slice(&key_bytes).unwrap();
        
        let plaintext = "same plaintext";
        
        // Encrypt with first nonce
        let nonce1_bytes = [1u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let nonce1 = Nonce::from_slice(&nonce1_bytes);
        let ciphertext1 = encryption_key.encrypt(nonce1, plaintext.as_bytes()).unwrap();
        
        // Encrypt with second nonce
        let nonce2_bytes = [12u8, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
        let nonce2 = Nonce::from_slice(&nonce2_bytes);
        let ciphertext2 = encryption_key.encrypt(nonce2, plaintext.as_bytes()).unwrap();
        
        // Ciphertexts should be different
        assert_ne!(ciphertext1, ciphertext2);
        
        // But both should decrypt to the same plaintext
        let decrypted1 = encryption_key.decrypt(nonce1, ciphertext1.as_ref()).unwrap();
        let decrypted2 = encryption_key.decrypt(nonce2, ciphertext2.as_ref()).unwrap();
        
        assert_eq!(decrypted1, decrypted2);
        assert_eq!(String::from_utf8(decrypted1).unwrap(), plaintext);
    }
    
    /// Test base64 encoding/decoding in EncryptedSessionData
    /// Validates: Requirements 1.3, 11.2
    #[test]
    fn test_encrypted_session_data_serialization() {
        let encrypted = EncryptedSessionData {
            ciphertext: BASE64.encode(b"encrypted_data_here"),
            nonce: BASE64.encode(b"nonce_12byte"),
        };
        
        // Serialize to JSON
        let json = serde_json::to_string(&encrypted).unwrap();
        
        // Deserialize back
        let deserialized: EncryptedSessionData = serde_json::from_str(&json).unwrap();
        
        // Verify round-trip
        assert_eq!(encrypted.ciphertext, deserialized.ciphertext);
        assert_eq!(encrypted.nonce, deserialized.nonce);
        
        // Verify base64 decoding works
        let decoded_ciphertext = BASE64.decode(&deserialized.ciphertext).unwrap();
        let decoded_nonce = BASE64.decode(&deserialized.nonce).unwrap();
        
        assert_eq!(decoded_ciphertext, b"encrypted_data_here");
        assert_eq!(decoded_nonce, b"nonce_12byte");
    }
}
