/**
 * WA Gateway - Template Handlers
 */
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use chrono::Utc;

use crate::response::{json_created, json_ok, AppError, ResponseBody};
use crate::state::AppState;

use super::super::models::{
    CreateTemplateRequest, ListQueryParams, PaginatedResponse, PaginationInfo, TemplateResponse,
};
use super::generate_id;

pub async fn list_templates(
    State(state): State<AppState>,
    Query(params): Query<ListQueryParams>,
) -> Result<ResponseBody, AppError> {
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_templates WHERE is_active = 1")
        .fetch_one(&state.pool)
        .await
        .unwrap_or(0);

    let rows: Vec<(String, String, Option<String>, String, Option<String>, Option<String>, Option<String>, Option<bool>, Option<i64>, String)> = sqlx::query_as(
        "SELECT id, name, category, content, variables, media_url, media_type, is_active, usage_count, created_at FROM wa_templates WHERE is_active = 1 ORDER BY name LIMIT ? OFFSET ?"
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;

    let templates: Vec<TemplateResponse> = rows
        .into_iter()
        .map(|r| TemplateResponse {
            id: r.0,
            name: r.1,
            category: r.2,
            content: r.3,
            variables: r
                .4
                .and_then(|v| serde_json::from_str(&v).ok())
                .unwrap_or_default(),
            media_url: r.5,
            media_type: r.6,
            is_active: r.7.unwrap_or(true),
            usage_count: r.8.unwrap_or(0) as i32,
            created_at: Utc::now(),
        })
        .collect();

    Ok(json_ok(
        "Templates retrieved",
        PaginatedResponse {
            data: templates,
            pagination: PaginationInfo {
                page,
                per_page,
                total,
                total_pages: (total as f64 / per_page as f64).ceil() as i64,
            },
        },
    ))
}

pub async fn get_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    let row: Option<(String, String, Option<String>, String, Option<String>, Option<String>, Option<String>, Option<bool>, Option<i64>, String)> = sqlx::query_as(
        "SELECT id, name, category, content, variables, media_url, media_type, is_active, usage_count, created_at FROM wa_templates WHERE id = ? AND is_active = 1"
    )
    .bind(&id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;
    let row = row.ok_or(AppError::NotFound)?;

    Ok(json_ok(
        "Template retrieved",
        TemplateResponse {
            id: row.0,
            name: row.1,
            category: row.2,
            content: row.3,
            variables: row
                .4
                .and_then(|v| serde_json::from_str(&v).ok())
                .unwrap_or_default(),
            media_url: row.5,
            media_type: row.6,
            is_active: row.7.unwrap_or(true),
            usage_count: row.8.unwrap_or(0) as i32,
            created_at: Utc::now(),
        },
    ))
}

pub async fn create_template(
    State(state): State<AppState>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<ResponseBody, AppError> {
    let id = generate_id();
    let now = Utc::now().naive_utc();

    sqlx::query(
        "INSERT INTO wa_templates (id, name, category, content, variables, media_url, media_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&req.name)
    .bind(&req.category)
    .bind(&req.content)
    .bind(serde_json::to_value(&req.variables.unwrap_or_default()).ok())
    .bind(&req.media_url)
    .bind(&req.media_type)
    .bind(now)
    .bind(now)
    .execute(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;

    Ok(json_created(
        "Template created",
        serde_json::json!({"id": id}),
    ))
}

pub async fn update_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(req): Json<CreateTemplateRequest>,
) -> Result<ResponseBody, AppError> {
    sqlx::query(
        "UPDATE wa_templates SET name = ?, category = ?, content = ?, variables = ?, media_url = ?, media_type = ?, updated_at = ? WHERE id = ?"
    )
    .bind(&req.name)
    .bind(&req.category)
    .bind(&req.content)
    .bind(serde_json::to_value(&req.variables.unwrap_or_default()).ok())
    .bind(&req.media_url)
    .bind(&req.media_type)
    .bind(Utc::now().naive_utc())
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| { tracing::error!("DB error: {}", e); AppError::Internal })?;

    Ok(json_ok("Template updated", serde_json::json!({"id": id})))
}

pub async fn delete_template(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<ResponseBody, AppError> {
    sqlx::query("UPDATE wa_templates SET is_active = 0 WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error: {}", e);
            AppError::Internal
        })?;

    Ok(axum::http::StatusCode::NO_CONTENT.into_response())
}
