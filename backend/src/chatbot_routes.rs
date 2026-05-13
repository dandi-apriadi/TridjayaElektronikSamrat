use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatbotRuleRequest {
    pub account_id: String,
    pub keyword: String,
    pub match_mode: String, // exact/contains/starts_with/ends_with/regex
    pub reply_template: String,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default)]
    pub cooldown_seconds: i32,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatbotRuleRequest {
    pub keyword: Option<String>,
    pub match_mode: Option<String>,
    pub reply_template: Option<String>,
    pub priority: Option<i32>,
    pub cooldown_seconds: Option<i32>,
    pub enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateChatbotRulesRequest {
    pub rule_ids: Vec<String>,
    pub enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatbotRuleResponse {
    pub id: String,
    pub account_id: String,
    pub keyword: String,
    pub match_mode: String,
    pub reply_template: String,
    pub priority: i32,
    pub cooldown_seconds: i32,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub statistics: Option<RuleStatistics>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleStatistics {
    pub total_matches: i64,
    pub last_matched_at: Option<String>,
    pub avg_response_time_ms: Option<f64>,
}

#[derive(Deserialize)]
pub struct ListChatbotRulesQuery {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_limit")]
    pub limit: i64,
    pub account_id: Option<String>,
}

// ============================================================================
// Default Values
// ============================================================================

fn default_enabled() -> bool {
    true
}

fn default_priority() -> i32 {
    100
}

fn default_page() -> i64 {
    1
}

fn default_limit() -> i64 {
    50
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validate match mode
fn validate_match_mode(mode: &str) -> Result<(), AppError> {
    match mode {
        "exact" | "contains" | "starts_with" | "ends_with" | "regex" => Ok(()),
        _ => Err(AppError::Validation {
            errors: vec![format!(
                "Match mode tidak valid: '{}'. Harus salah satu dari: exact, contains, starts_with, ends_with, regex",
                mode
            )],
        }),
    }
}

/// Validate regex syntax for regex match mode
fn validate_regex_syntax(pattern: &str) -> Result<(), AppError> {
    match Regex::new(pattern) {
        Ok(_) => Ok(()),
        Err(e) => Err(AppError::Validation {
            errors: vec![format!("Regex syntax tidak valid: {}", e)],
        }),
    }
}

/// Validate keyword is not empty
fn validate_keyword(keyword: &str) -> Result<(), AppError> {
    let trimmed = keyword.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Keyword tidak boleh kosong".to_string()],
        });
    }
    Ok(())
}

/// Validate reply template is not empty
fn validate_reply_template(template: &str) -> Result<(), AppError> {
    let trimmed = template.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Reply template tidak boleh kosong".to_string()],
        });
    }
    Ok(())
}

/// Validate priority is reasonable
fn validate_priority(priority: i32) -> Result<(), AppError> {
    if priority < 0 || priority > 10000 {
        return Err(AppError::Validation {
            errors: vec!["Priority harus antara 0 dan 10000".to_string()],
        });
    }
    Ok(())
}

/// Validate cooldown is reasonable
fn validate_cooldown(cooldown: i32) -> Result<(), AppError> {
    if cooldown < 0 || cooldown > 86400 {
        return Err(AppError::Validation {
            errors: vec!["Cooldown harus antara 0 dan 86400 detik (24 jam)".to_string()],
        });
    }
    Ok(())
}

/// Check if a rule with the same (account_id, keyword, match_mode) already exists
async fn check_unique_constraint(
    state: &AppState,
    account_id: &str,
    keyword: &str,
    match_mode: &str,
    exclude_id: Option<&str>,
) -> Result<(), AppError> {
    let exists: bool = if let Some(id) = exclude_id {
        sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM wa_chatbot_rules 
             WHERE account_id = ? AND keyword = ? AND match_mode = ? AND id != ?)",
        )
        .bind(account_id)
        .bind(keyword)
        .bind(match_mode)
        .bind(id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking unique constraint: {}", e);
            AppError::Internal
        })?
    } else {
        sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM wa_chatbot_rules 
             WHERE account_id = ? AND keyword = ? AND match_mode = ?)",
        )
        .bind(account_id)
        .bind(keyword)
        .bind(match_mode)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking unique constraint: {}", e);
            AppError::Internal
        })?
    };

    if exists {
        return Err(AppError::Validation {
            errors: vec![format!(
                "Rule dengan account_id '{}', keyword '{}', dan match_mode '{}' sudah ada",
                account_id, keyword, match_mode
            )],
        });
    }

    Ok(())
}

// ============================================================================
// Route Handlers
// ============================================================================

/// POST /api/wa/chatbot-rules - Create chatbot rule
pub async fn create_chatbot_rule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateChatbotRuleRequest>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_chatbot_manage
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    // Validate inputs
    validate_keyword(&payload.keyword)?;
    validate_match_mode(&payload.match_mode)?;
    validate_reply_template(&payload.reply_template)?;
    validate_priority(payload.priority)?;
    validate_cooldown(payload.cooldown_seconds)?;

    // Validate regex syntax if match_mode is regex
    if payload.match_mode == "regex" {
        validate_regex_syntax(&payload.keyword)?;
    }

    // Verify account exists
    let account_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM wa_accounts WHERE id = ?)")
            .bind(&payload.account_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking account: {}", e);
                AppError::Internal
            })?;

    if !account_exists {
        return Err(AppError::Validation {
            errors: vec!["Account ID tidak ditemukan".to_string()],
        });
    }

    // Check unique constraint: (account_id, keyword, match_mode)
    check_unique_constraint(
        &state,
        &payload.account_id,
        &payload.keyword,
        &payload.match_mode,
        None,
    )
    .await?;

    // Generate rule ID
    let rule_id = uuid::Uuid::new_v4().to_string();

    // Insert chatbot rule
    sqlx::query(
        "INSERT INTO wa_chatbot_rules 
         (id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
    )
    .bind(&rule_id)
    .bind(&payload.account_id)
    .bind(&payload.keyword)
    .bind(&payload.match_mode)
    .bind(&payload.reply_template)
    .bind(payload.priority)
    .bind(payload.cooldown_seconds)
    .bind(payload.enabled)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error creating chatbot rule: {}", e);
        AppError::Internal
    })?;

    // Fetch created rule
    let rule = fetch_chatbot_rule_by_id(&state, &rule_id, false).await?;

    state.audit("wa.chatbot_rule.created", Some(&rule_id)).await;

    Ok(json_ok(
        "Chatbot rule berhasil dibuat",
        json!({ "rule": rule }),
    ))
}

/// GET /api/wa/chatbot-rules - List chatbot rules with filter by account_id
pub async fn list_chatbot_rules(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<ListChatbotRulesQuery>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_chatbot_manage
    let _user = authorize(
        &state,
        &headers,
        &[Role::Admin, Role::WaAdmin, Role::WaOperator],
    )
    .await?;

    let limit = query.limit.min(100).max(1);
    let offset = (query.page.max(1) - 1) * limit;

    // Build query based on filters
    let (rules, total): (Vec<ChatbotRuleResponse>, i64) = if let Some(account_id) = query.account_id
    {
        let rows = sqlx::query_as::<_, (String, String, String, String, String, i32, i32, bool, String, Option<String>)>(
            "SELECT id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled, created_at, updated_at
             FROM wa_chatbot_rules
             WHERE account_id = ?
             ORDER BY priority ASC, created_at DESC
             LIMIT ? OFFSET ?"
        )
        .bind(&account_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing chatbot rules: {}", e);
            AppError::Internal
        })?;

        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM wa_chatbot_rules WHERE account_id = ?")
                .bind(&account_id)
                .fetch_one(&state.pool)
                .await
                .map_err(|e| {
                    tracing::error!("DB error counting chatbot rules: {}", e);
                    AppError::Internal
                })?;

        let mut rules = Vec::new();
        for (
            id,
            account_id,
            keyword,
            match_mode,
            reply_template,
            priority,
            cooldown_seconds,
            enabled,
            created_at,
            updated_at,
        ) in rows
        {
            let statistics = fetch_rule_statistics(&state, &id).await.ok();
            rules.push(ChatbotRuleResponse {
                id,
                account_id,
                keyword,
                match_mode,
                reply_template,
                priority,
                cooldown_seconds,
                enabled,
                created_at,
                updated_at,
                statistics,
            });
        }

        (rules, total)
    } else {
        let rows = sqlx::query_as::<_, (String, String, String, String, String, i32, i32, bool, String, Option<String>)>(
            "SELECT id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled, created_at, updated_at
             FROM wa_chatbot_rules
             ORDER BY priority ASC, created_at DESC
             LIMIT ? OFFSET ?"
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error listing chatbot rules: {}", e);
            AppError::Internal
        })?;

        let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_chatbot_rules")
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error counting chatbot rules: {}", e);
                AppError::Internal
            })?;

        let mut rules = Vec::new();
        for (
            id,
            account_id,
            keyword,
            match_mode,
            reply_template,
            priority,
            cooldown_seconds,
            enabled,
            created_at,
            updated_at,
        ) in rows
        {
            let statistics = fetch_rule_statistics(&state, &id).await.ok();
            rules.push(ChatbotRuleResponse {
                id,
                account_id,
                keyword,
                match_mode,
                reply_template,
                priority,
                cooldown_seconds,
                enabled,
                created_at,
                updated_at,
                statistics,
            });
        }

        (rules, total)
    };

    let total_pages = (total as f64 / limit as f64).ceil() as i64;

    Ok(json_ok(
        "Chatbot rules berhasil diambil",
        json!({
            "rules": rules,
            "pagination": {
                "page": query.page,
                "limit": limit,
                "total": total,
                "total_pages": total_pages
            }
        }),
    ))
}

/// PATCH /api/wa/chatbot-rules/{id} - Update chatbot rule
pub async fn update_chatbot_rule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateChatbotRuleRequest>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_chatbot_manage
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    // Verify rule exists and get current account_id
    let current_rule: Option<(String, String, String)> =
        sqlx::query_as("SELECT account_id, keyword, match_mode FROM wa_chatbot_rules WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking chatbot rule: {}", e);
                AppError::Internal
            })?;

    let (account_id, current_keyword, current_match_mode) =
        current_rule.ok_or(AppError::NotFound)?;

    // Validate inputs if provided
    if let Some(ref keyword) = payload.keyword {
        validate_keyword(keyword)?;
    }
    if let Some(ref match_mode) = payload.match_mode {
        validate_match_mode(match_mode)?;
    }
    if let Some(ref reply_template) = payload.reply_template {
        validate_reply_template(reply_template)?;
    }
    if let Some(priority) = payload.priority {
        validate_priority(priority)?;
    }
    if let Some(cooldown) = payload.cooldown_seconds {
        validate_cooldown(cooldown)?;
    }

    // Determine final keyword and match_mode for unique constraint check
    let final_keyword = payload.keyword.as_ref().unwrap_or(&current_keyword);
    let final_match_mode = payload.match_mode.as_ref().unwrap_or(&current_match_mode);

    // Validate regex syntax if match_mode is regex
    if final_match_mode == "regex" {
        validate_regex_syntax(final_keyword)?;
    }

    // Check unique constraint if keyword or match_mode changed
    if payload.keyword.is_some() || payload.match_mode.is_some() {
        check_unique_constraint(
            &state,
            &account_id,
            final_keyword,
            final_match_mode,
            Some(&id),
        )
        .await?;
    }

    // Build update query dynamically
    let mut updates = Vec::new();
    let mut query_str = "UPDATE wa_chatbot_rules SET ".to_string();

    if payload.keyword.is_some() {
        updates.push("keyword = ?");
    }
    if payload.match_mode.is_some() {
        updates.push("match_mode = ?");
    }
    if payload.reply_template.is_some() {
        updates.push("reply_template = ?");
    }
    if payload.priority.is_some() {
        updates.push("priority = ?");
    }
    if payload.cooldown_seconds.is_some() {
        updates.push("cooldown_seconds = ?");
    }
    if payload.enabled.is_some() {
        updates.push("enabled = ?");
    }

    if updates.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Tidak ada field yang diupdate".to_string()],
        });
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    query_str.push_str(&updates.join(", "));
    query_str.push_str(" WHERE id = ?");

    // Execute update with dynamic binding
    let mut query = sqlx::query(&query_str);

    if let Some(keyword) = &payload.keyword {
        query = query.bind(keyword);
    }
    if let Some(match_mode) = &payload.match_mode {
        query = query.bind(match_mode);
    }
    if let Some(reply_template) = &payload.reply_template {
        query = query.bind(reply_template);
    }
    if let Some(priority) = payload.priority {
        query = query.bind(priority);
    }
    if let Some(cooldown) = payload.cooldown_seconds {
        query = query.bind(cooldown);
    }
    if let Some(enabled) = payload.enabled {
        query = query.bind(enabled);
    }

    query = query.bind(&id);

    query.execute(&state.pool).await.map_err(|e| {
        tracing::error!("DB error updating chatbot rule: {}", e);
        AppError::Internal
    })?;

    // Fetch updated rule
    let rule = fetch_chatbot_rule_by_id(&state, &id, true).await?;

    state.audit("wa.chatbot_rule.updated", Some(&id)).await;

    Ok(json_ok(
        "Chatbot rule berhasil diupdate",
        json!({ "rule": rule }),
    ))
}

/// DELETE /api/wa/chatbot-rules/{id} - Delete chatbot rule
pub async fn delete_chatbot_rule(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_chatbot_manage
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    // Delete rule (cascade will delete logs)
    let result = sqlx::query("DELETE FROM wa_chatbot_rules WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error deleting chatbot rule: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    state.audit("wa.chatbot_rule.deleted", Some(&id)).await;

    Ok(json_ok(
        "Chatbot rule berhasil dihapus",
        json!({ "deleted": true }),
    ))
}

/// PATCH /api/wa/chatbot-rules/bulk - Bulk enable/disable rules
pub async fn bulk_update_chatbot_rules(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BulkUpdateChatbotRulesRequest>,
) -> Result<axum::response::Response, AppError> {
    // Check permission: wa_chatbot_manage
    let _user = authorize(&state, &headers, &[Role::Admin, Role::WaAdmin]).await?;

    if payload.rule_ids.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Rule IDs tidak boleh kosong".to_string()],
        });
    }

    if payload.rule_ids.len() > 100 {
        return Err(AppError::Validation {
            errors: vec!["Maksimal 100 rules dapat diupdate sekaligus".to_string()],
        });
    }

    // Build placeholders for IN clause
    let placeholders = payload
        .rule_ids
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");
    let query_str = format!(
        "UPDATE wa_chatbot_rules SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id IN ({})",
        placeholders
    );

    // Execute bulk update
    let mut query = sqlx::query(&query_str).bind(payload.enabled);
    for rule_id in &payload.rule_ids {
        query = query.bind(rule_id);
    }

    let result = query.execute(&state.pool).await.map_err(|e| {
        tracing::error!("DB error bulk updating chatbot rules: {}", e);
        AppError::Internal
    })?;

    let updated_count = result.rows_affected();

    state
        .audit(
            "wa.chatbot_rule.bulk_updated",
            Some(&format!("count={}", updated_count)),
        )
        .await;

    Ok(json_ok(
        "Chatbot rules berhasil diupdate",
        json!({
            "updated_count": updated_count,
            "enabled": payload.enabled
        }),
    ))
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn fetch_chatbot_rule_by_id(
    state: &AppState,
    id: &str,
    include_statistics: bool,
) -> Result<ChatbotRuleResponse, AppError> {
    let row = sqlx::query_as::<_, (String, String, String, String, String, i32, i32, bool, String, Option<String>)>(
        "SELECT id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled, created_at, updated_at
         FROM wa_chatbot_rules
         WHERE id = ?
         LIMIT 1"
    )
    .bind(id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching chatbot rule: {}", e);
        AppError::Internal
    })?
    .ok_or(AppError::NotFound)?;

    let (
        id,
        account_id,
        keyword,
        match_mode,
        reply_template,
        priority,
        cooldown_seconds,
        enabled,
        created_at,
        updated_at,
    ) = row;

    let statistics = if include_statistics {
        fetch_rule_statistics(state, &id).await.ok()
    } else {
        None
    };

    Ok(ChatbotRuleResponse {
        id,
        account_id,
        keyword,
        match_mode,
        reply_template,
        priority,
        cooldown_seconds,
        enabled,
        created_at,
        updated_at,
        statistics,
    })
}

async fn fetch_rule_statistics(
    state: &AppState,
    rule_id: &str,
) -> Result<RuleStatistics, AppError> {
    // Get total matches, last matched timestamp, and average response time
    let stats: Option<(i64, Option<String>, Option<f64>)> = sqlx::query_as(
        "SELECT COUNT(*) as total, MAX(created_at) as last_matched, AVG(response_time_ms) as avg_response_time
         FROM wa_chatbot_logs
         WHERE rule_id = ?"
    )
    .bind(rule_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching rule statistics: {}", e);
        AppError::Internal
    })?;

    let (total_matches, last_matched_at, avg_response_time_ms) = stats.unwrap_or((0, None, None));

    Ok(RuleStatistics {
        total_matches,
        last_matched_at,
        avg_response_time_ms,
    })
}
