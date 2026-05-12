/**
 * WA Gateway - Contact Handlers
 */

use axum::{
    extract::{State, Query, Path},
    response::IntoResponse,
    Json,
};
use chrono::Utc;

use crate::state::AppState;
use crate::response::{json_ok, json_created, AppError, ResponseBody};

use super::{generate_id, normalize_phone};
use super::super::models::{ContactResponse, CreateContactRequest, ListQueryParams, PaginatedResponse, PaginationInfo};

pub async fn list_contacts(
    State(state): State<AppState>,
    Query(params): Query<ListQueryParams>,
) -> Result<ResponseBody, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;
    
    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_contacts")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);
    
    let rows: Vec<(String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<bool>, Option<bool>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, phone, name, profile_pic_url, about, labels, is_blocked, is_group, last_chat_at, created_at FROM wa_contacts ORDER BY updated_at DESC LIMIT ? OFFSET ?"
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    
    let contacts: Vec<ContactResponse> = rows.into_iter().map(|r| ContactResponse {
        id: r.0,
        phone: r.1,
        name: r.2,
        profile_pic_url: r.3,
        about: r.4,
        labels: r.5.and_then(|v| serde_json::from_str(&v).ok()).unwrap_or_default(),
        is_blocked: r.6.unwrap_or(false),
        is_group: r.7.unwrap_or(false),
        last_chat_at: None,
        created_at: Utc::now(),
    }).collect();
    
    Ok(json_ok("Contacts retrieved", PaginatedResponse {
        data: contacts,
        pagination: PaginationInfo {
            page,
            per_page,
            total,
            total_pages: (total as f64 / per_page as f64).ceil() as i64,
        },
    }))
}

pub async fn get_contact(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let row: Option<(String, String, Option<String>, Option<String>, Option<String>, Option<String>, Option<bool>, Option<bool>, Option<String>, String)> = sqlx::query_as(
        "SELECT id, phone, name, profile_pic_url, about, labels, is_blocked, is_group, last_chat_at, created_at FROM wa_contacts WHERE id = ?"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    let row = row.ok_or(AppError::NotFound)?;
    
    Ok(json_ok("Contact retrieved", ContactResponse {
        id: row.0,
        phone: row.1,
        name: row.2,
        profile_pic_url: row.3,
        about: row.4,
        labels: row.5.and_then(|v| serde_json::from_str(&v).ok()).unwrap_or_default(),
        is_blocked: row.6.unwrap_or(false),
        is_group: row.7.unwrap_or(false),
        last_chat_at: None,
        created_at: Utc::now(),
    }))
}

pub async fn create_contact(
    State(state): State<AppState>,
    Json(req): Json<CreateContactRequest>,
) -> Result<ResponseBody, AppError> {
    let id = generate_id();
    let phone = normalize_phone(&req.phone)?;
    let now = Utc::now().naive_utc();
    
    sqlx::query(
        "INSERT INTO wa_contacts (id, phone, name, labels, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&phone)
    .bind(&req.name)
    .bind(serde_json::to_value(&req.labels.unwrap_or_default()).ok())
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    
    Ok(json_created("Contact created", serde_json::json!({"id": id, "phone": phone})))
}

pub async fn update_contact(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreateContactRequest>,
) -> Result<ResponseBody, AppError> {
    let phone = normalize_phone(&req.phone)?;
    
    sqlx::query(
        "UPDATE wa_contacts SET phone = ?, name = ?, labels = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&phone)
    .bind(&req.name)
    .bind(serde_json::to_value(&req.labels.unwrap_or_default()).ok())
    .bind(Utc::now().naive_utc())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    
    Ok(json_ok("Contact updated", serde_json::json!({"id": id})))
}

pub async fn delete_contact(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    sqlx::query("DELETE FROM wa_contacts WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    
    Ok(axum::http::StatusCode::NO_CONTENT.into_response())
}

pub async fn sync_contacts(
    State(_state): State<AppState>,
) -> Result<ResponseBody, AppError> {
    Ok(json_ok("Sync started", serde_json::json!({
        "status": "syncing",
        "message": "Contact sync is being processed"
    })))
}
