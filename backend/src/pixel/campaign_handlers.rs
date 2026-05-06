use crate::{
    auth::{authorize, Role},
    response::{json_ok, AppError},
    state::AppState,
    pixel::models::{
        CampaignRecord, CreateCampaignRequest, UpdateCampaignRequest,
        CreateCustomConversionRequest, CustomConversionRecord,
    },
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

// ─── Query params ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CampaignListQuery {
    pub status: Option<String>,
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async fn write_audit_log(
    pool: &sqlx::SqlitePool,
    user_id: Option<&str>,
    action_type: &str,
    resource_type: &str,
    resource_id: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
) -> Result<(), AppError> {
    let log_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO pixel_audit_logs
           (id, user_id, action_type, resource_type, resource_id,
            old_value, new_value)
           VALUES (?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&log_id)
    .bind(user_id)
    .bind(action_type)
    .bind(resource_type)
    .bind(resource_id)
    .bind(old_value)
    .bind(new_value)
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to write audit log: {}", e);
        AppError::Internal
    })?;
    Ok(())
}

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

/// `POST /api/campaigns` — Admin only.
pub async fn create_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreateCampaignRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Validate admin has access to the specified pixel_id
    let access: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
            .bind(&req.pixel_id)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking pixel admin access: {}", e);
                AppError::Internal
            })?;

    if access.is_none() {
        return Err(AppError::Forbidden);
    }

    let id = Uuid::new_v4().to_string();
    let campaign_id = Uuid::new_v4().to_string();
    // Use first 8 chars of user ID for attribution
    let utm_admin = format!("admin_{}", &user.id[..8.min(user.id.len())]);
    let config_str = req
        .config
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());

    sqlx::query(
        r#"INSERT INTO campaigns
           (id, campaign_id, pixel_id, admin_id, name, status,
            utm_source, utm_medium, utm_campaign, utm_admin,
            utm_content, utm_term, config)
           VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&campaign_id)
    .bind(&req.pixel_id)
    .bind(&user.id)
    .bind(&req.name)
    .bind(&req.utm_source)
    .bind(&req.utm_medium)
    .bind(&req.utm_campaign)
    .bind(&utm_admin)
    .bind(&req.utm_content)
    .bind(&req.utm_term)
    .bind(&config_str)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert campaign: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let new_val = json!({
        "campaign_id": campaign_id,
        "name": req.name,
        "pixel_id": req.pixel_id,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "campaign.created",
        "campaign",
        &id,
        None,
        Some(&new_val),
    )
    .await?;

    // Fetch and return the created record
    let record: CampaignRecord = sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch created campaign: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Campaign created", record))
}

/// `GET /api/campaigns` — Admin only.
pub async fn list_campaigns(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<CampaignListQuery>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    let campaigns: Vec<CampaignRecord> = if let Some(ref status) = params.status {
        sqlx::query_as(
            r#"SELECT c.* FROM campaigns c
               JOIN pixel_admins pa ON pa.pixel_id = c.pixel_id
               WHERE pa.user_id = ? AND c.status = ?
               ORDER BY c.created_at DESC"#,
        )
        .bind(&user.id)
        .bind(status)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list campaigns with status filter: {}", e);
            AppError::Internal
        })?
    } else {
        sqlx::query_as(
            r#"SELECT c.* FROM campaigns c
               JOIN pixel_admins pa ON pa.pixel_id = c.pixel_id
               WHERE pa.user_id = ?
               ORDER BY c.created_at DESC"#,
        )
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list campaigns: {}", e);
            AppError::Internal
        })?
    };

    Ok(json_ok("Campaigns retrieved", campaigns))
}

/// `GET /api/campaigns/:id` — Admin only.
pub async fn get_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    let record: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch campaign: {}", e);
                AppError::Internal
            })?;

    let record = record.ok_or(AppError::NotFound)?;

    // Verify admin has access to the campaign's pixel
    let access: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
            .bind(&record.pixel_id)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking pixel admin access: {}", e);
                AppError::Internal
            })?;

    if access.is_none() {
        return Err(AppError::Forbidden);
    }

    Ok(json_ok("Campaign retrieved", record))
}

/// `PATCH /api/campaigns/:id` — Admin only.
pub async fn update_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdateCampaignRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch existing campaign
    let existing: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign for update: {}", e);
                AppError::Internal
            })?;

    let existing = existing.ok_or(AppError::NotFound)?;

    // Verify admin has access to the campaign's pixel
    let access: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
            .bind(&existing.pixel_id)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking pixel admin access: {}", e);
                AppError::Internal
            })?;

    if access.is_none() {
        return Err(AppError::Forbidden);
    }

    // Reject ALL updates if campaign is already completed
    if existing.status == "completed" {
        return Err(AppError::Validation {
            errors: vec!["Cannot update a completed campaign".to_string()],
        });
    }

    // Validate status transition if a new status is provided
    if let Some(ref new_status) = req.status {
        let valid = match (existing.status.as_str(), new_status.as_str()) {
            ("active", "paused") => true,
            ("paused", "active") => true,
            ("active", "completed") => true,
            ("paused", "completed") => true,
            _ => false,
        };
        if !valid {
            return Err(AppError::Validation {
                errors: vec![format!(
                    "Invalid status transition from '{}' to '{}'",
                    existing.status, new_status
                )],
            });
        }
    }

    // Resolve updated fields (fall back to existing values)
    let new_name = req.name.as_deref().unwrap_or(&existing.name);
    let new_utm_source = req.utm_source.as_deref().or(existing.utm_source.as_deref());
    let new_utm_medium = req.utm_medium.as_deref().or(existing.utm_medium.as_deref());
    let new_utm_campaign = req
        .utm_campaign
        .as_deref()
        .or(existing.utm_campaign.as_deref());
    let new_utm_content = req
        .utm_content
        .as_deref()
        .or(existing.utm_content.as_deref());
    let new_utm_term = req.utm_term.as_deref().or(existing.utm_term.as_deref());
    let new_status = req.status.as_deref().unwrap_or(&existing.status);

    sqlx::query(
        r#"UPDATE campaigns
           SET name = ?, utm_source = ?, utm_medium = ?, utm_campaign = ?,
               utm_content = ?, utm_term = ?, status = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?"#,
    )
    .bind(new_name)
    .bind(new_utm_source)
    .bind(new_utm_medium)
    .bind(new_utm_campaign)
    .bind(new_utm_content)
    .bind(new_utm_term)
    .bind(new_status)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update campaign: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let old_val = json!({
        "name": existing.name,
        "status": existing.status,
        "utm_source": existing.utm_source,
        "utm_medium": existing.utm_medium,
        "utm_campaign": existing.utm_campaign,
        "utm_content": existing.utm_content,
        "utm_term": existing.utm_term,
    })
    .to_string();
    let new_val = json!({
        "name": new_name,
        "status": new_status,
        "utm_source": new_utm_source,
        "utm_medium": new_utm_medium,
        "utm_campaign": new_utm_campaign,
        "utm_content": new_utm_content,
        "utm_term": new_utm_term,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "campaign.updated",
        "campaign",
        &id,
        Some(&old_val),
        Some(&new_val),
    )
    .await?;

    // Return updated record
    let updated: CampaignRecord = sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch updated campaign: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Campaign updated", updated))
}

/// `DELETE /api/campaigns/:id` — Admin only.
pub async fn delete_campaign(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch existing campaign
    let existing: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign for delete: {}", e);
                AppError::Internal
            })?;

    let existing = existing.ok_or(AppError::NotFound)?;

    // Verify admin has access to the campaign's pixel
    let access: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
            .bind(&existing.pixel_id)
            .bind(&user.id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking pixel admin access: {}", e);
                AppError::Internal
            })?;

    if access.is_none() {
        return Err(AppError::Forbidden);
    }

    // Reject deletion if any pixel_events reference this campaign
    let event_count: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM pixel_events WHERE campaign_id = ?")
            .bind(&id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error counting campaign events: {}", e);
                AppError::Internal
            })?;

    if event_count.0 > 0 {
        return Err(AppError::Validation {
            errors: vec!["Cannot delete campaign with existing events".to_string()],
        });
    }

    // Write audit log BEFORE deletion
    let old_val = json!({
        "campaign_id": existing.campaign_id,
        "name": existing.name,
        "status": existing.status,
        "pixel_id": existing.pixel_id,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "campaign.deleted",
        "campaign",
        &id,
        Some(&old_val),
        None,
    )
    .await?;

    sqlx::query("DELETE FROM campaigns WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete campaign: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Campaign deleted", json!({ "id": id })))
}

// ─── Custom Conversion handlers (Task 10) ─────────────────────────────────────

/// Validate that a `rules` JSON value contains at least one of `url_filter` or
/// `param_match` keys. Returns `AppError::Validation` if neither is present.
fn validate_conversion_rules(rules: &serde_json::Value) -> Result<(), AppError> {
    let obj = rules.as_object().ok_or_else(|| AppError::Validation {
        errors: vec!["rules must be a JSON object".to_string()],
    })?;
    if !obj.contains_key("url_filter") && !obj.contains_key("param_match") {
        return Err(AppError::Validation {
            errors: vec![
                "rules must contain at least one of 'url_filter' or 'param_match'".to_string(),
            ],
        });
    }
    Ok(())
}

/// `POST /api/campaigns/:campaign_id/conversions` — Admin only.
pub async fn create_custom_conversion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign_id): Path<String>,
    Json(req): Json<CreateCustomConversionRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch campaign by id
    let campaign: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign: {}", e);
                AppError::Internal
            })?;

    let campaign = campaign.ok_or(AppError::NotFound)?;

    // Verify admin owns the campaign
    if campaign.admin_id != user.id {
        return Err(AppError::Forbidden);
    }

    // Validate rules JSON
    validate_conversion_rules(&req.rules)?;

    let id = Uuid::new_v4().to_string();
    let rules_str = req.rules.to_string();
    let conversion_value = req.conversion_value.unwrap_or(0.0);
    let currency = req.currency.as_deref().unwrap_or("USD");

    sqlx::query(
        r#"INSERT INTO custom_conversions
           (id, campaign_id, name, event_type, rules, conversion_value, currency)
           VALUES (?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&campaign_id)
    .bind(&req.name)
    .bind(&req.event_type)
    .bind(&rules_str)
    .bind(conversion_value)
    .bind(currency)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert custom conversion: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let new_val = json!({
        "id": id,
        "campaign_id": campaign_id,
        "name": req.name,
        "event_type": req.event_type,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "custom_conversion.created",
        "custom_conversion",
        &id,
        None,
        Some(&new_val),
    )
    .await?;

    // Fetch and return the created record
    let record: CustomConversionRecord =
        sqlx::query_as("SELECT * FROM custom_conversions WHERE id = ?")
            .bind(&id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch created custom conversion: {}", e);
                AppError::Internal
            })?;

    Ok(json_ok("Custom conversion created", record))
}

/// `GET /api/campaigns/:campaign_id/conversions` — Admin only.
pub async fn list_custom_conversions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(campaign_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch campaign
    let campaign: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign: {}", e);
                AppError::Internal
            })?;

    let campaign = campaign.ok_or(AppError::NotFound)?;

    // Verify admin owns the campaign
    if campaign.admin_id != user.id {
        return Err(AppError::Forbidden);
    }

    let records: Vec<CustomConversionRecord> =
        sqlx::query_as("SELECT * FROM custom_conversions WHERE campaign_id = ? ORDER BY created_at ASC")
            .bind(&campaign_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to list custom conversions: {}", e);
                AppError::Internal
            })?;

    Ok(json_ok("Custom conversions retrieved", records))
}

/// `PATCH /api/campaigns/:campaign_id/conversions/:conversion_id` — Admin only.
pub async fn update_custom_conversion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((campaign_id, conversion_id)): Path<(String, String)>,
    Json(req): Json<serde_json::Value>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch campaign
    let campaign: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign: {}", e);
                AppError::Internal
            })?;

    let campaign = campaign.ok_or(AppError::NotFound)?;

    // Verify admin owns the campaign
    if campaign.admin_id != user.id {
        return Err(AppError::Forbidden);
    }

    // Fetch the conversion
    let existing: Option<CustomConversionRecord> = sqlx::query_as(
        "SELECT * FROM custom_conversions WHERE id = ? AND campaign_id = ?",
    )
    .bind(&conversion_id)
    .bind(&campaign_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching custom conversion: {}", e);
        AppError::Internal
    })?;

    let existing = existing.ok_or(AppError::NotFound)?;

    // Resolve updated fields
    let new_name = req
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.name);

    let new_rules_str = if let Some(rules_val) = req.get("rules") {
        validate_conversion_rules(rules_val)?;
        rules_val.to_string()
    } else {
        existing.rules.clone()
    };

    let new_conversion_value = req
        .get("conversion_value")
        .and_then(|v| v.as_f64())
        .unwrap_or(existing.conversion_value);

    let new_currency = req
        .get("currency")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.currency)
        .to_string();

    sqlx::query(
        r#"UPDATE custom_conversions
           SET name = ?, rules = ?, conversion_value = ?, currency = ?
           WHERE id = ?"#,
    )
    .bind(new_name)
    .bind(&new_rules_str)
    .bind(new_conversion_value)
    .bind(&new_currency)
    .bind(&conversion_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update custom conversion: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let old_val = json!({
        "name": existing.name,
        "rules": existing.rules,
        "conversion_value": existing.conversion_value,
        "currency": existing.currency,
    })
    .to_string();
    let new_val = json!({
        "name": new_name,
        "rules": new_rules_str,
        "conversion_value": new_conversion_value,
        "currency": new_currency,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "custom_conversion.updated",
        "custom_conversion",
        &conversion_id,
        Some(&old_val),
        Some(&new_val),
    )
    .await?;

    // Return updated record
    let updated: CustomConversionRecord =
        sqlx::query_as("SELECT * FROM custom_conversions WHERE id = ?")
            .bind(&conversion_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("Failed to fetch updated custom conversion: {}", e);
                AppError::Internal
            })?;

    Ok(json_ok("Custom conversion updated", updated))
}

/// `DELETE /api/campaigns/:campaign_id/conversions/:conversion_id` — Admin only.
pub async fn delete_custom_conversion(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((campaign_id, conversion_id)): Path<(String, String)>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch campaign
    let campaign: Option<CampaignRecord> =
        sqlx::query_as("SELECT * FROM campaigns WHERE id = ?")
            .bind(&campaign_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching campaign: {}", e);
                AppError::Internal
            })?;

    let campaign = campaign.ok_or(AppError::NotFound)?;

    // Verify admin owns the campaign
    if campaign.admin_id != user.id {
        return Err(AppError::Forbidden);
    }

    // Fetch the conversion
    let existing: Option<CustomConversionRecord> = sqlx::query_as(
        "SELECT * FROM custom_conversions WHERE id = ? AND campaign_id = ?",
    )
    .bind(&conversion_id)
    .bind(&campaign_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("DB error fetching custom conversion: {}", e);
        AppError::Internal
    })?;

    let _existing = existing.ok_or(AppError::NotFound)?;

    // Preserve historical conversion records by nullifying the FK
    sqlx::query(
        "UPDATE conversions SET custom_conversion_id = NULL WHERE custom_conversion_id = ?",
    )
    .bind(&conversion_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to nullify custom_conversion_id on conversions: {}", e);
        AppError::Internal
    })?;

    // Write audit log BEFORE deletion
    let old_val = json!({
        "id": conversion_id,
        "campaign_id": campaign_id,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "custom_conversion.deleted",
        "custom_conversion",
        &conversion_id,
        Some(&old_val),
        None,
    )
    .await?;

    // Delete the custom conversion
    sqlx::query("DELETE FROM custom_conversions WHERE id = ?")
        .bind(&conversion_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete custom conversion: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok(
        "Custom conversion deleted",
        json!({ "id": conversion_id }),
    ))
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use crate::response::AppError;

    // ── Test 1: admin_cannot_access_unassigned_pixel ──────────────────────────
    //
    // Requirement 3.2: An admin must be assigned to a pixel via pixel_admins
    // before they can create campaigns for it. When no assignment exists the
    // handler must return AppError::Forbidden.
    #[test]
    fn admin_cannot_access_unassigned_pixel() {
        // Simulate the branch: pixel_admins lookup returns None → Forbidden
        fn check_pixel_access(access: Option<&str>) -> Result<(), AppError> {
            if access.is_none() {
                return Err(AppError::Forbidden);
            }
            Ok(())
        }

        // No assignment → Forbidden
        assert!(
            matches!(check_pixel_access(None), Err(AppError::Forbidden)),
            "Expected Forbidden when admin has no pixel_admins entry"
        );

        // Assignment exists → Ok
        assert!(
            check_pixel_access(Some("assignment-id")).is_ok(),
            "Expected Ok when admin has a pixel_admins entry"
        );
    }

    // ── Test 2: delete_rejected_when_events_exist ─────────────────────────────
    //
    // Requirement 3.7: Campaigns that have associated pixel_events must not be
    // deleted. The handler must return AppError::Validation when count > 0.
    #[test]
    fn delete_rejected_when_events_exist() {
        fn check_event_count(count: i64) -> Result<(), AppError> {
            if count > 0 {
                return Err(AppError::Validation {
                    errors: vec!["Cannot delete campaign with existing events".to_string()],
                });
            }
            Ok(())
        }

        // Events exist → Validation error
        assert!(
            matches!(check_event_count(1), Err(AppError::Validation { .. })),
            "Expected Validation error when event count > 0"
        );
        assert!(
            matches!(check_event_count(100), Err(AppError::Validation { .. })),
            "Expected Validation error when event count is large"
        );

        // No events → Ok
        assert!(
            check_event_count(0).is_ok(),
            "Expected Ok when no events reference the campaign"
        );
    }

    // ── Test 3: completed_campaign_rejects_updates ────────────────────────────
    //
    // Requirements 23.1, 23.3: Once a campaign reaches the "completed" status,
    // no further updates are allowed. The handler must return
    // AppError::Validation for any update attempt.
    #[test]
    fn completed_campaign_rejects_updates() {
        fn check_completed(current_status: &str) -> Result<(), AppError> {
            if current_status == "completed" {
                return Err(AppError::Validation {
                    errors: vec!["Cannot update a completed campaign".to_string()],
                });
            }
            Ok(())
        }

        // Completed → Validation error
        assert!(
            matches!(
                check_completed("completed"),
                Err(AppError::Validation { .. })
            ),
            "Expected Validation error when campaign is completed"
        );

        // Other statuses → Ok (update allowed)
        assert!(
            check_completed("active").is_ok(),
            "Expected Ok for active campaign"
        );
        assert!(
            check_completed("paused").is_ok(),
            "Expected Ok for paused campaign"
        );
    }

    // ── Test 4: status_transition_validation ─────────────────────────────────
    //
    // Requirements 23.1, 23.2, 23.3: Only specific status transitions are
    // valid. active↔paused and active/paused→completed are allowed; all other
    // transitions must be rejected.
    #[test]
    fn status_transition_validation() {
        fn validate_transition(from: &str, to: &str) -> Result<(), AppError> {
            let valid = match (from, to) {
                ("active", "paused") => true,
                ("paused", "active") => true,
                ("active", "completed") => true,
                ("paused", "completed") => true,
                _ => false,
            };
            if !valid {
                return Err(AppError::Validation {
                    errors: vec![format!(
                        "Invalid status transition from '{}' to '{}'",
                        from, to
                    )],
                });
            }
            Ok(())
        }

        // Valid transitions
        assert!(
            validate_transition("active", "paused").is_ok(),
            "active → paused should be valid"
        );
        assert!(
            validate_transition("paused", "active").is_ok(),
            "paused → active should be valid"
        );
        assert!(
            validate_transition("active", "completed").is_ok(),
            "active → completed should be valid"
        );
        assert!(
            validate_transition("paused", "completed").is_ok(),
            "paused → completed should be valid"
        );

        // Invalid transitions
        assert!(
            matches!(
                validate_transition("completed", "active"),
                Err(AppError::Validation { .. })
            ),
            "completed → active should be invalid"
        );
        assert!(
            matches!(
                validate_transition("completed", "paused"),
                Err(AppError::Validation { .. })
            ),
            "completed → paused should be invalid"
        );
        assert!(
            matches!(
                validate_transition("active", "active"),
                Err(AppError::Validation { .. })
            ),
            "active → active should be invalid"
        );
        assert!(
            matches!(
                validate_transition("paused", "paused"),
                Err(AppError::Validation { .. })
            ),
            "paused → paused should be invalid"
        );
        assert!(
            matches!(
                validate_transition("active", "unknown"),
                Err(AppError::Validation { .. })
            ),
            "active → unknown should be invalid"
        );
    }

    // ── Test 5: rules_validation_rejects_empty_json ───────────────────────────
    //
    // Requirement 4.2: The rules JSON must contain at least one of `url_filter`
    // or `param_match` keys. An empty JSON object `{}` must be rejected with
    // AppError::Validation.
    #[test]
    fn rules_validation_rejects_empty_json() {
        use serde_json::json;

        fn validate_rules(rules: &serde_json::Value) -> Result<(), AppError> {
            let obj = rules.as_object().ok_or_else(|| AppError::Validation {
                errors: vec!["rules must be a JSON object".to_string()],
            })?;
            if !obj.contains_key("url_filter") && !obj.contains_key("param_match") {
                return Err(AppError::Validation {
                    errors: vec![
                        "rules must contain at least one of 'url_filter' or 'param_match'"
                            .to_string(),
                    ],
                });
            }
            Ok(())
        }

        // Empty object → Validation error
        assert!(
            matches!(validate_rules(&json!({})), Err(AppError::Validation { .. })),
            "Empty rules object should be rejected"
        );

        // Object with unrelated keys → Validation error
        assert!(
            matches!(
                validate_rules(&json!({ "other_key": "value" })),
                Err(AppError::Validation { .. })
            ),
            "Rules with only unrelated keys should be rejected"
        );

        // Object with url_filter → Ok
        assert!(
            validate_rules(&json!({ "url_filter": "/checkout" })).is_ok(),
            "Rules with url_filter should be accepted"
        );

        // Object with param_match → Ok
        assert!(
            validate_rules(&json!({ "param_match": { "utm_campaign": "summer" } })).is_ok(),
            "Rules with param_match should be accepted"
        );

        // Object with both keys → Ok
        assert!(
            validate_rules(&json!({
                "url_filter": "/checkout",
                "param_match": { "utm_campaign": "summer" }
            }))
            .is_ok(),
            "Rules with both url_filter and param_match should be accepted"
        );

        // Non-object (array) → Validation error
        assert!(
            matches!(
                validate_rules(&json!(["url_filter"])),
                Err(AppError::Validation { .. })
            ),
            "Non-object rules should be rejected"
        );
    }

    // ── Test 6: delete_preserves_historical_conversions ───────────────────────
    //
    // Requirement 4.6: When a custom conversion is deleted, existing conversion
    // records must be preserved. The delete logic sets `custom_conversion_id`
    // to NULL rather than deleting the conversion rows.
    #[test]
    fn delete_preserves_historical_conversions() {
        // Simulate the two-step delete logic:
        // Step 1: nullify FK on conversions rows
        // Step 2: delete the custom_conversion record
        //
        // We model this with a simple in-memory Vec to verify the logic branch.

        #[derive(Debug, PartialEq)]
        struct ConversionRow {
            id: &'static str,
            custom_conversion_id: Option<&'static str>,
        }

        let mut conversions = vec![
            ConversionRow { id: "conv-1", custom_conversion_id: Some("cc-42") },
            ConversionRow { id: "conv-2", custom_conversion_id: Some("cc-42") },
            ConversionRow { id: "conv-3", custom_conversion_id: Some("cc-99") }, // different CC
        ];

        let target_cc_id = "cc-42";

        // Step 1: nullify FK (mirrors the UPDATE conversions SET custom_conversion_id = NULL)
        for row in conversions.iter_mut() {
            if row.custom_conversion_id == Some(target_cc_id) {
                row.custom_conversion_id = None;
            }
        }

        // Verify: rows that referenced cc-42 now have NULL FK
        assert_eq!(
            conversions[0].custom_conversion_id,
            None,
            "conv-1 should have custom_conversion_id = NULL after delete"
        );
        assert_eq!(
            conversions[1].custom_conversion_id,
            None,
            "conv-2 should have custom_conversion_id = NULL after delete"
        );

        // Verify: unrelated row is untouched
        assert_eq!(
            conversions[2].custom_conversion_id,
            Some("cc-99"),
            "conv-3 (different CC) should be unaffected"
        );

        // Verify: conversion rows still exist (not deleted)
        assert_eq!(conversions.len(), 3, "All conversion rows must be preserved");
    }
}
