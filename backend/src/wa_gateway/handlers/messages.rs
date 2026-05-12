/**
 * WA Gateway - Message Handlers
 * 
 * Send messages, view history, track status
 */

use axum::{
    extract::{State, Query, Path, Multipart},
    Json,
};
use chrono::Utc;

use crate::state::AppState;
use crate::response::{json_ok, AppError, ResponseBody};
use crate::bridge::BridgeClient;

use super::{generate_id, normalize_phone};
use super::super::models::{
    SendMessageRequest, SendTemplateRequest, SendMessageResponse,
    ListQueryParams, PaginatedResponse, PaginationInfo
};

/// Send a single message
pub async fn send_message(
    State(state): State<AppState>,
    Json(req): Json<SendMessageRequest>,
) -> Result<ResponseBody, AppError> {
    let phone = normalize_phone(&req.to)?;
    
    // Validate session
    let session_status: Option<String> = sqlx::query_scalar(
        "SELECT status FROM wa_accounts WHERE id = ?"
    )
    .bind(&req.session_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    
    let status = session_status.ok_or(AppError::NotFound)?;
    if status != "connected" {
        return Err(AppError::Validation {
            errors: vec![format!("Session not connected (status: {})", status)],
        });
    }
    
    let message_id = generate_id();
    let msg_type = req.message_type.clone().unwrap_or_else(|| "text".to_string());
    let content = req.content.clone().unwrap_or_default();
    
    // Queue the message
    sqlx::query(
        r#"
        INSERT INTO wa_message_queue (id, session_id, phone, message_type, content, priority, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)
        "#
    )
    .bind(&message_id)
    .bind(&req.session_id)
    .bind(&phone)
    .bind(&msg_type)
    .bind(&content)
    .bind(req.priority.unwrap_or(5))
    .bind(Utc::now().naive_utc())
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    
    // Spawn async send task
    let session_id = req.session_id.clone();
    let bridge = state.bridge_client.clone();
    let pool = state.pool.clone();
    let msg_id = message_id.clone();
    let typing_delay = req.typing_delay.unwrap_or(0);
    
    tokio::spawn(async move {
        match send_via_bridge(&bridge, &session_id, &phone, &content, typing_delay).await {
            Ok(wa_id) => {
                // Update queue status
                let _ = sqlx::query(
                    "UPDATE wa_message_queue SET status = 'sent', wa_message_id = ?, processed_at = ? WHERE id = ?"
                )
                .bind(&wa_id)
                .bind(Utc::now().naive_utc())
                .bind(&msg_id)
                .execute(&pool)
                .await;
                
                // Add to history
                let _ = sqlx::query(
                    "INSERT INTO wa_messages (id, session_id, direction, message_type, content, status, wa_message_id, sent_at, created_at) VALUES (?, ?, 'outbound', ?, ?, 'sent', ?, ?, ?)"
                )
                .bind(generate_id())
                .bind(&session_id)
                .bind(&msg_type)
                .bind(&content)
                .bind(&wa_id)
                .bind(Utc::now().naive_utc())
                .bind(Utc::now().naive_utc())
                .execute(&pool)
                .await;
            }
            Err(e) => {
                let _ = sqlx::query(
                    "UPDATE wa_message_queue SET status = 'failed', error_message = ? WHERE id = ?"
                )
                .bind(e.to_string())
                .bind(&msg_id)
                .execute(&pool)
                .await;
            }
        }
    });
    
    Ok(json_ok("Message queued", SendMessageResponse {
        message_id,
        status: "queued".to_string(),
        wa_message_id: None,
        estimated_delivery: Some(Utc::now()),
        queue_position: None,
    }))
}

/// Send using template
pub async fn send_template(
    State(state): State<AppState>,
    Json(req): Json<SendTemplateRequest>,
) -> Result<ResponseBody, AppError> {
    // Get template
    let template: Option<(String, Option<String>)> = sqlx::query_as(
        "SELECT content, variables FROM wa_templates WHERE id = ? AND is_active = 1"
    )
    .bind(&req.template_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    let template = template.ok_or(AppError::NotFound)?;
    
    // Render template
    let mut content = template.0;
    let vars: Vec<String> = serde_json::from_str(&template.1.unwrap_or_else(|| "[]".to_string()))
        .unwrap_or_default();
    
    for var in vars {
        if let Some(val) = req.variables.get(&var) {
            content = content.replace(&format!("{{{{{}}}", var), val);
        }
    }
    
    // Send as normal message
    let send_req = SendMessageRequest {
        session_id: req.session_id,
        to: req.to,
        message_type: Some("text".to_string()),
        content: Some(content),
        media_url: None,
        template_id: None,
        variables: None,
        typing_delay: req.typing_delay,
        priority: None,
        scheduled_at: None,
    };
    
    send_message(State(state), Json(send_req)).await
}

/// Send media with upload
pub async fn send_media(
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<ResponseBody, AppError> {
    let mut session_id = None;
    let mut to = None;
    let mut caption = None;
    let mut media_type = None;
    let mut file_data = None;
    
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        tracing::error!("Multipart error: {}", e);
        AppError::Internal
    })? {
        match field.name().unwrap_or("") {
            "session_id" => session_id = Some(field.text().await.map_err(|e| { tracing::error!("Field error: {}", e); AppError::Internal })?),
            "to" => to = Some(field.text().await.map_err(|e| { tracing::error!("Field error: {}", e); AppError::Internal })?),
            "caption" => caption = Some(field.text().await.map_err(|e| { tracing::error!("Field error: {}", e); AppError::Internal })?),
            "type" => media_type = Some(field.text().await.map_err(|e| { tracing::error!("Field error: {}", e); AppError::Internal })?),
            "file" => {
                let data = field.bytes().await.map_err(|e| { tracing::error!("Field error: {}", e); AppError::Internal })?;
                file_data = Some(data);
            }
            _ => {}
        }
    }
    
    let session_id = session_id.ok_or_else(|| AppError::Validation { errors: vec!["session_id required".to_string()] })?;
    let to = to.ok_or_else(|| AppError::Validation { errors: vec!["to required".to_string()] })?;
    let phone = normalize_phone(&to)?;
    let media_type = media_type.unwrap_or_else(|| "image".to_string());
    
    // Save file
    let media_path = if let Some(data) = file_data {
        let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "./uploads".to_string());
        let file_id = generate_id();
        let file_path = format!("{}/wa_media/{}.bin", uploads_dir, file_id);
        
        tokio::fs::create_dir_all(format!("{}/wa_media", uploads_dir)).await
            .map_err(|e| { tracing::error!("FS error: {}", e); AppError::Internal })?;
        
        tokio::fs::write(&file_path, data).await
            .map_err(|e| { tracing::error!("Failed to save: {}", e); AppError::Internal })?;
        
        Some(file_path)
    } else {
        None
    };
    
    let msg_id = generate_id();
    let caption_str = caption.unwrap_or_default();
    
    sqlx::query(
        "INSERT INTO wa_message_queue (id, session_id, phone, message_type, content, media_path, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)"
    )
    .bind(&msg_id)
    .bind(&session_id)
    .bind(&phone)
    .bind(&media_type)
    .bind(&caption_str)
    .bind(media_path)
    .bind(Utc::now().naive_utc())
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    
    Ok(json_ok("Media queued", serde_json::json!({
        "message_id": msg_id,
        "status": "queued"
    })))
}

/// Bulk send
pub async fn bulk_send(
    State(state): State<AppState>,
    Json(reqs): Json<Vec<SendMessageRequest>>,
) -> Result<ResponseBody, AppError> {
    let mut results = Vec::new();
    
    for req in reqs {
        let phone = match normalize_phone(&req.to) {
            Ok(p) => p,
            Err(e) => {
                results.push(serde_json::json!({
                    "status": "failed",
                    "error": e.to_string()
                }));
                continue;
            }
        };
        
        let msg_id = generate_id();
        let content = req.content.clone().unwrap_or_default();
        
        let result = sqlx::query(
            "INSERT INTO wa_message_queue (id, session_id, phone, message_type, content, status, created_at) VALUES (?, ?, ?, ?, ?, 'queued', ?)"
        )
        .bind(&msg_id)
        .bind(&req.session_id)
        .bind(&phone)
        .bind(req.message_type.clone().unwrap_or_else(|| "text".to_string()))
        .bind(&content)
        .bind(Utc::now().naive_utc())
        .execute(&state.pool)
        .await;
        
        match result {
            Ok(_) => results.push(serde_json::json!({
                "message_id": msg_id,
                "status": "queued"
            })),
            Err(e) => results.push(serde_json::json!({
                "status": "failed",
                "error": e.to_string()
            })),
        }
    }
    
    Ok(json_ok("Bulk send queued", serde_json::json!({
        "total": results.len(),
        "results": results
    })))
}

/// List message history
pub async fn list_messages(
    State(state): State<AppState>,
    Query(params): Query<ListQueryParams>,
) -> Result<ResponseBody, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;
    
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_messages")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    
    let rows: Vec<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, session_id, contact_id, direction, message_type, content, media_url, status, sent_at, delivered_at, read_at, created_at FROM wa_messages ORDER BY created_at DESC LIMIT ? OFFSET ?"
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    
    let messages: Vec<serde_json::Value> = rows.into_iter().map(|r| serde_json::json!({
        "id": r.0, "session_id": r.1, "contact_id": r.2, "direction": r.3,
        "message_type": r.4, "content": r.5, "media_url": r.6, "status": r.7,
        "sent_at": r.8, "delivered_at": r.9, "read_at": r.10, "created_at": r.11
    })).collect();
    
    Ok(json_ok("Messages retrieved", PaginatedResponse {
        data: messages,
        pagination: PaginationInfo {
            page,
            per_page,
            total,
            total_pages: (total as f64 / per_page as f64).ceil() as i64,
        },
    }))
}

/// Get single message
pub async fn get_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let row: Option<(String, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, session_id, contact_id, direction, message_type, content, media_url, status, sent_at, delivered_at, read_at, created_at FROM wa_messages WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    let row = row.ok_or(AppError::NotFound)?;
    
    Ok(json_ok("Message retrieved", serde_json::json!({
        "id": row.0, "session_id": row.1, "contact_id": row.2, "direction": row.3,
        "message_type": row.4, "content": row.5, "media_url": row.6, "status": row.7,
        "sent_at": row.8, "delivered_at": row.9, "read_at": row.10, "created_at": row.11
    })))
}

/// Retry failed message
pub async fn retry_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let result = sqlx::query(
        "UPDATE wa_message_queue SET status = 'queued', retry_count = retry_count + 1 WHERE id = ?"
    )
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error: {}", e);
        AppError::Internal
    })?;
    
    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    
    Ok(json_ok("Message queued for retry", serde_json::json!({"message_id": id})))
}

// Internal helper to send via bridge
async fn send_via_bridge(
    bridge: &BridgeClient,
    session_id: &str,
    phone: &str,
    content: &str,
    typing_delay: u64,
) -> Result<String, crate::bridge::BridgeError> {
    let params = serde_json::json!({
        "session_id": session_id,
        "phone": phone,
        "message": content,
        "typing_delay": typing_delay
    });
    
    let result = bridge.send_request(
        session_id,
        "send_message".to_string(),
        params
    ).await?;
    
    Ok(result["message_id"].as_str().unwrap_or("").to_string())
}
