/**
 * JSON-RPC Bridge Client for Baileys Node.js Process
 * 
 * This module provides a Rust client that spawns and manages Node.js child processes
 * running the Baileys WhatsApp library. Communication happens via JSON-RPC over stdin/stdout.
 * 
 * Features:
 * - Child process spawning and lifecycle management
 * - JSON-RPC request/response handling
 * - Timeout handling (30 seconds)
 * - Process crash detection and auto-restart
 * - Process pool management (max 50 concurrent processes)
 * - Structured logging for all communication
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock, Semaphore};
use tokio::time::timeout;
use tracing::{debug, error, info, warn};

/// JSON-RPC protocol version
const JSONRPC_VERSION: &str = "2.0";

/// Default timeout for JSON-RPC requests (30 seconds)
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);

/// Maximum concurrent Node.js processes
const MAX_CONCURRENT_PROCESSES: usize = 50;

/// Path to the Baileys bridge Node.js script
const BAILEYS_BRIDGE_PATH: &str = "baileys-bridge/src/index.js";

/// JSON-RPC error codes
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum JsonRpcErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    SessionNotFound = -32001,
    SessionAlreadyExists = -32002,
    ConnectionError = -32003,
    SendError = -32004,
}

/// JSON-RPC request structure
#[derive(Debug, Clone, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: serde_json::Value,
}

/// JSON-RPC response structure
#[derive(Debug, Clone, Deserialize)]
struct JsonRpcResponse {
    jsonrpc: String,
    id: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

/// JSON-RPC error structure
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct JsonRpcError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// JSON-RPC notification (event from Node.js)
#[derive(Debug, Clone, Deserialize)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    params: serde_json::Value,
}

/// Bridge client error types
#[derive(Debug, thiserror::Error)]
pub enum BridgeError {
    #[error("Process spawn failed: {0}")]
    SpawnFailed(String),
    
    #[error("Process crashed: {0}")]
    ProcessCrashed(String),
    
    #[error("Request timeout after {0:?}")]
    Timeout(Duration),
    
    #[error("JSON-RPC error: {0}")]
    JsonRpcError(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("JSON serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Process pool exhausted (max {0} processes)")]
    PoolExhausted(usize),
    
    #[error("Process not found: {0}")]
    ProcessNotFound(String),
}

pub type BridgeResult<T> = Result<T, BridgeError>;

/// Bridge process handle
struct BridgeProcess {
    session_id: String,
    child: std::process::Child,
    stdin: std::process::ChildStdin,
    response_channels: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>,
    event_tx: mpsc::UnboundedSender<BridgeEvent>,
    next_request_id: Arc<AtomicU64>,
    restart_count: usize,
}

impl BridgeProcess {
    /// Create a new bridge process
    fn new(
        session_id: String,
        child: std::process::Child,
        stdin: std::process::ChildStdin,
        stdout: tokio::process::ChildStdout,
        event_tx: mpsc::UnboundedSender<BridgeEvent>,
    ) -> Self {
        let response_channels = Arc::new(Mutex::new(HashMap::new()));
        let next_request_id = Arc::new(AtomicU64::new(1));
        
        // Spawn stdout reader task
        let response_channels_clone = response_channels.clone();
        let event_tx_clone = event_tx.clone();
        let session_id_clone = session_id.clone();
        
        tokio::spawn(async move {
            Self::read_stdout(session_id_clone, stdout, response_channels_clone, event_tx_clone).await;
        });
        
        Self {
            session_id,
            child,
            stdin,
            response_channels,
            event_tx,
            next_request_id,
            restart_count: 0,
        }
    }
    
    /// Read stdout from Node.js process and route responses/notifications
    async fn read_stdout(
        session_id: String,
        stdout: tokio::process::ChildStdout,
        response_channels: Arc<Mutex<HashMap<u64, oneshot::Sender<JsonRpcResponse>>>>,
        event_tx: mpsc::UnboundedSender<BridgeEvent>,
    ) {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    if line.trim().is_empty() {
                        continue;
                    }
                    
                    debug!(session_id = %session_id, line = %line, "Received from Node.js");
                    
                    // Try to parse as response first
                    if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&line) {
                        // Route response to waiting request
                        let mut channels = response_channels.lock().await;
                        if let Some(tx) = channels.remove(&response.id) {
                            if tx.send(response).is_err() {
                                warn!(session_id = %session_id, "Response channel closed");
                            }
                        } else {
                            warn!(session_id = %session_id, id = response.id, "No waiting request for response");
                        }
                    }
                    // Try to parse as notification (event)
                    else if let Ok(notification) = serde_json::from_str::<JsonRpcNotification>(&line) {
                        debug!(
                            session_id = %session_id,
                            method = %notification.method,
                            "Received notification"
                        );
                        
                        // Forward event to event handler
                        let event = BridgeEvent {
                            session_id: session_id.clone(),
                            event_type: notification.method,
                            data: notification.params,
                        };
                        
                        if event_tx.send(event).is_err() {
                            warn!(session_id = %session_id, "Event channel closed");
                        }
                    } else {
                        warn!(session_id = %session_id, line = %line, "Failed to parse JSON-RPC message");
                    }
                }
                Ok(None) => {
                    info!(session_id = %session_id, "Stdout stream ended (process exited)");
                    break;
                }
                Err(e) => {
                    error!(session_id = %session_id, error = %e, "Error reading stdout");
                    
                    // Notify about process crash
                    let event = BridgeEvent {
                        session_id: session_id.clone(),
                        event_type: "process_crashed".to_string(),
                        data: serde_json::json!({ "error": e.to_string() }),
                    };
                    
                    let _ = event_tx.send(event);
                    break;
                }
            }
        }
        
        info!(session_id = %session_id, "Stdout reader terminated");
    }
    
    /// Send JSON-RPC request and wait for response
    async fn send_request(
        &mut self,
        method: String,
        params: serde_json::Value,
        timeout_duration: Duration,
    ) -> BridgeResult<serde_json::Value> {
        let request_id = self.next_request_id.fetch_add(1, Ordering::SeqCst);
        
        let request = JsonRpcRequest {
            jsonrpc: JSONRPC_VERSION.to_string(),
            id: request_id,
            method: method.clone(),
            params,
        };
        
        let request_json = serde_json::to_string(&request)?;
        
        debug!(
            session_id = %self.session_id,
            method = %method,
            id = request_id,
            "Sending JSON-RPC request"
        );
        
        // Create response channel
        let (tx, rx) = oneshot::channel();
        self.response_channels.lock().await.insert(request_id, tx);
        
        // Write request to stdin
        writeln!(self.stdin, "{}", request_json)?;
        self.stdin.flush()?;
        
        // Wait for response with timeout
        match timeout(timeout_duration, rx).await {
            Ok(Ok(response)) => {
                if let Some(error) = response.error {
                    error!(
                        session_id = %self.session_id,
                        method = %method,
                        code = error.code,
                        message = %error.message,
                        "JSON-RPC error"
                    );
                    
                    Err(BridgeError::JsonRpcError(format!(
                        "{} (code: {})",
                        error.message, error.code
                    )))
                } else if let Some(result) = response.result {
                    debug!(
                        session_id = %self.session_id,
                        method = %method,
                        id = request_id,
                        "Received JSON-RPC response"
                    );
                    
                    Ok(result)
                } else {
                    Err(BridgeError::JsonRpcError(
                        "Response has neither result nor error".to_string(),
                    ))
                }
            }
            Ok(Err(_)) => {
                // Channel closed - process likely crashed
                Err(BridgeError::ProcessCrashed(
                    "Response channel closed".to_string(),
                ))
            }
            Err(_) => {
                // Timeout
                // Clean up response channel
                self.response_channels.lock().await.remove(&request_id);
                
                error!(
                    session_id = %self.session_id,
                    method = %method,
                    timeout = ?timeout_duration,
                    "Request timeout"
                );
                
                Err(BridgeError::Timeout(timeout_duration))
            }
        }
    }
    
    /// Kill the process
    fn kill(&mut self) -> BridgeResult<()> {
        info!(session_id = %self.session_id, "Killing bridge process");
        self.child.kill()?;
        Ok(())
    }
    
    /// Check if process is still alive
    fn is_alive(&mut self) -> bool {
        match self.child.try_wait() {
            Ok(Some(_)) => false, // Process exited
            Ok(None) => true,     // Process still running
            Err(_) => false,      // Error checking status
        }
    }
}

/// Bridge event (notification from Node.js)
#[derive(Debug, Clone)]
pub struct BridgeEvent {
    pub session_id: String,
    pub event_type: String,
    pub data: serde_json::Value,
}

/// Bridge client for managing Node.js Baileys processes
pub struct BridgeClient {
    processes: Arc<RwLock<HashMap<String, BridgeProcess>>>,
    event_tx: mpsc::UnboundedSender<BridgeEvent>,
    event_rx: Arc<Mutex<mpsc::UnboundedReceiver<BridgeEvent>>>,
    process_semaphore: Arc<Semaphore>,
    node_path: PathBuf,
    bridge_script_path: PathBuf,
}

impl BridgeClient {
    /// Create a new bridge client
    pub fn new() -> (Self, mpsc::UnboundedReceiver<BridgeEvent>) {
        let (event_tx, event_rx) = mpsc::unbounded_channel();
        
        // Create a dummy receiver for the client (won't be used)
        let (_dummy_tx, dummy_rx) = mpsc::unbounded_channel();
        
        let client = Self {
            processes: Arc::new(RwLock::new(HashMap::new())),
            event_tx,
            event_rx: Arc::new(Mutex::new(dummy_rx)),
            process_semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_PROCESSES)),
            node_path: PathBuf::from("node"),
            bridge_script_path: PathBuf::from(BAILEYS_BRIDGE_PATH),
        };
        
        (client, event_rx)
    }
    
    /// Spawn a new Node.js bridge process for a session
    pub async fn spawn_process(&self, session_id: String) -> BridgeResult<()> {
        // Check if process already exists
        {
            let processes = self.processes.read().await;
            if processes.contains_key(&session_id) {
                info!(session_id = %session_id, "Process already exists");
                return Ok(());
            }
        }
        
        // Acquire semaphore permit (limit concurrent processes)
        let _permit = self.process_semaphore.try_acquire()
            .map_err(|_| BridgeError::PoolExhausted(MAX_CONCURRENT_PROCESSES))?;
        
        info!(session_id = %session_id, "Spawning Node.js bridge process");
        
        // Spawn Node.js process
        let mut child = std::process::Command::new(&self.node_path)
            .arg(&self.bridge_script_path)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::inherit()) // Inherit stderr for debugging
            .spawn()
            .map_err(|e| BridgeError::SpawnFailed(e.to_string()))?;
        
        let stdin = child.stdin.take()
            .ok_or_else(|| BridgeError::SpawnFailed("Failed to capture stdin".to_string()))?;
        
        // Convert std stdout to tokio async reader
        let std_stdout = child.stdout.take()
            .ok_or_else(|| BridgeError::SpawnFailed("Failed to capture stdout".to_string()))?;
        let stdout = tokio::process::ChildStdout::from_std(std_stdout)
            .map_err(|e| BridgeError::SpawnFailed(format!("Failed to convert stdout to async: {}", e)))?;
        
        // Create bridge process
        let process = BridgeProcess::new(
            session_id.clone(),
            child,
            stdin,
            stdout,
            self.event_tx.clone(),
        );
        
        // Store process
        {
            let mut processes = self.processes.write().await;
            processes.insert(session_id.clone(), process);
        }
        
        info!(session_id = %session_id, "Bridge process spawned successfully");
        
        // Don't drop the permit - it will be released when process is removed
        std::mem::forget(_permit);
        
        Ok(())
    }
    
    /// Send a JSON-RPC request to a session's bridge process
    pub async fn send_request(
        &self,
        session_id: &str,
        method: String,
        params: serde_json::Value,
    ) -> BridgeResult<serde_json::Value> {
        self.send_request_with_timeout(session_id, method, params, DEFAULT_TIMEOUT).await
    }
    
    /// Send a JSON-RPC request with custom timeout
    pub async fn send_request_with_timeout(
        &self,
        session_id: &str,
        method: String,
        params: serde_json::Value,
        timeout_duration: Duration,
    ) -> BridgeResult<serde_json::Value> {
        let mut processes = self.processes.write().await;
        
        let process = processes.get_mut(session_id)
            .ok_or_else(|| BridgeError::ProcessNotFound(session_id.to_string()))?;
        
        // Check if process is still alive
        if !process.is_alive() {
            error!(session_id = %session_id, "Process is not alive");
            
            // Attempt restart
            drop(processes); // Release lock before restart
            self.restart_process(session_id).await?;
            
            // Re-acquire lock and get process
            processes = self.processes.write().await;
            let process = processes.get_mut(session_id)
                .ok_or_else(|| BridgeError::ProcessNotFound(session_id.to_string()))?;
            
            return process.send_request(method, params, timeout_duration).await;
        }
        
        process.send_request(method, params, timeout_duration).await
    }
    
    /// Restart a crashed process
    async fn restart_process(&self, session_id: &str) -> BridgeResult<()> {
        warn!(session_id = %session_id, "Restarting crashed process");
        
        // Remove old process
        {
            let mut processes = self.processes.write().await;
            if let Some(mut process) = processes.remove(session_id) {
                let _ = process.kill();
            }
        }
        
        // Spawn new process
        self.spawn_process(session_id.to_string()).await?;
        
        info!(session_id = %session_id, "Process restarted successfully");
        
        Ok(())
    }
    
    /// Kill and remove a process
    pub async fn kill_process(&self, session_id: &str) -> BridgeResult<()> {
        info!(session_id = %session_id, "Killing bridge process");
        
        let mut processes = self.processes.write().await;
        
        if let Some(mut process) = processes.remove(session_id) {
            process.kill()?;
            info!(session_id = %session_id, "Process killed successfully");
        } else {
            warn!(session_id = %session_id, "Process not found");
        }
        
        Ok(())
    }
    
    /// Get list of active session IDs
    pub async fn get_active_sessions(&self) -> Vec<String> {
        let processes = self.processes.read().await;
        processes.keys().cloned().collect()
    }
    
    /// Get process count
    pub async fn get_process_count(&self) -> usize {
        let processes = self.processes.read().await;
        processes.len()
    }
    
    /// Health check - verify all processes are alive
    pub async fn health_check(&self) -> HashMap<String, bool> {
        let mut processes = self.processes.write().await;
        let mut health_status = HashMap::new();
        
        for (session_id, process) in processes.iter_mut() {
            let is_alive = process.is_alive();
            health_status.insert(session_id.clone(), is_alive);
            
            if !is_alive {
                warn!(session_id = %session_id, "Process is dead during health check");
            }
        }
        
        health_status
    }
    
    /// Shutdown all processes
    pub async fn shutdown(&self) -> BridgeResult<()> {
        info!("Shutting down all bridge processes");
        
        let mut processes = self.processes.write().await;
        
        for (session_id, mut process) in processes.drain() {
            info!(session_id = %session_id, "Killing process during shutdown");
            let _ = process.kill();
        }
        
        info!("All bridge processes shut down");
        
        Ok(())
    }
}

impl Default for BridgeClient {
    fn default() -> Self {
        Self::new().0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_jsonrpc_request_serialization() {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id: 1,
            method: "test_method".to_string(),
            params: serde_json::json!({"key": "value"}),
        };
        
        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("\"jsonrpc\":\"2.0\""));
        assert!(json.contains("\"id\":1"));
        assert!(json.contains("\"method\":\"test_method\""));
    }
    
    #[test]
    fn test_jsonrpc_response_deserialization() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":{"status":"ok"}}"#;
        let response: JsonRpcResponse = serde_json::from_str(json).unwrap();
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, 1);
        assert!(response.result.is_some());
        assert!(response.error.is_none());
    }
    
    #[test]
    fn test_jsonrpc_error_deserialization() {
        let json = r#"{"jsonrpc":"2.0","id":1,"error":{"code":-32600,"message":"Invalid Request"}}"#;
        let response: JsonRpcResponse = serde_json::from_str(json).unwrap();
        
        assert_eq!(response.jsonrpc, "2.0");
        assert_eq!(response.id, 1);
        assert!(response.result.is_none());
        assert!(response.error.is_some());
        
        let error = response.error.unwrap();
        assert_eq!(error.code, -32600);
        assert_eq!(error.message, "Invalid Request");
    }
    
    #[test]
    fn test_notification_deserialization() {
        let json = r#"{"jsonrpc":"2.0","method":"message_received","params":{"text":"hello"}}"#;
        let notification: JsonRpcNotification = serde_json::from_str(json).unwrap();
        
        assert_eq!(notification.jsonrpc, "2.0");
        assert_eq!(notification.method, "message_received");
        assert!(notification.params.is_object());
    }
}
