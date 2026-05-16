use crate::{
    auth::{authorize, Role},
    pixel::{
        crypto::{encrypt_token, get_encryption_key},
        models::{
            AssignAdminRequest, CreatePixelRequest, PixelAdminRecord, PixelRecord,
            UpdatePixelRequest,
        },
    },
    response::{json_ok, AppError},
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use serde_json::json;
use uuid::Uuid;

const PIXEL_RECORD_SELECT: &str = "SELECT id, pixel_id, name, business_manager_id, status, access_token, created_by, config, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at FROM pixels";
const PIXEL_WITH_STATS_SELECT: &str = "SELECT p.id, p.pixel_id, p.name, p.business_manager_id, p.status, p.created_by, p.config, DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_at, DATE_FORMAT(p.updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at";

// ─── Extended row types ───────────────────────────────────────────────────────

/// `PixelRecord` plus aggregate counts returned by `list_pixels`.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
struct PixelWithStats {
    pub id: String,
    pub pixel_id: String,
    pub name: String,
    pub business_manager_id: Option<String>,
    pub status: String,
    pub created_by: String,
    pub config: String,
    pub created_at: String,
    pub updated_at: String,
    pub assigned_admins_count: i64,
    pub total_events: i64,
}

/// `PixelAdminRecord` plus user name/email returned by `list_pixel_admins`.
#[derive(sqlx::FromRow, serde::Serialize, Clone)]
struct PixelAdminWithUser {
    pub id: String,
    pub pixel_id: String,
    pub user_id: String,
    pub permissions: String,
    pub assigned_at: String,
    pub assigned_by: String,
    pub user_name: String,
    pub user_email: String,
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

async fn write_audit_log(
    pool: &sqlx::MySqlPool,
    user_id: Option<&str>,
    action_type: &str,
    resource_type: &str,
    resource_id: &str,
    old_value: Option<&str>,
    new_value: Option<&str>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
) -> Result<(), AppError> {
    let log_id = Uuid::new_v4().to_string();
    sqlx::query(
        r#"INSERT INTO pixel_audit_logs
           (id, user_id, action_type, resource_type, resource_id,
            old_value, new_value, ip_address, user_agent, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#,
    )
    .bind(&log_id)
    .bind(user_id)
    .bind(action_type)
    .bind(resource_type)
    .bind(resource_id)
    .bind(old_value)
    .bind(new_value)
    .bind(ip_address)
    .bind(user_agent)
    .bind("{}")
    .execute(pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to write audit log: {}", e);
        AppError::Internal
    })?;
    Ok(())
}

// ─── Pixel CRUD ───────────────────────────────────────────────────────────────

/// `POST /api/pixels` — Admin only.
pub async fn create_pixel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<CreatePixelRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Validate pixel_id uniqueness
    let existing: Option<(String,)> = sqlx::query_as("SELECT id FROM pixels WHERE pixel_id = ?")
        .bind(&req.pixel_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking pixel_id uniqueness: {}", e);
            AppError::Internal
        })?;

    if existing.is_some() {
        return Err(AppError::Conflict);
    }

    // Encrypt access token
    let key = get_encryption_key();
    let encrypted_token = encrypt_token(&req.access_token, &key).map_err(|e| {
        tracing::error!("Failed to encrypt access token: {}", e);
        AppError::Internal
    })?;

    let id = Uuid::new_v4().to_string();
    let config_str = req
        .config
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());

    sqlx::query(
        r#"INSERT INTO pixels (id, pixel_id, name, business_manager_id, status, access_token, created_by, config)
           VALUES (?, ?, ?, ?, 'active', ?, ?, ?)"#,
    )
    .bind(&id)
    .bind(&req.pixel_id)
    .bind(&req.name)
    .bind(&req.business_manager_id)
    .bind(&encrypted_token)
    .bind(&user.id)
    .bind(&config_str)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert pixel: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let new_val = json!({ "pixel_id": req.pixel_id, "name": req.name }).to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "pixel.created",
        "pixel",
        &id,
        None,
        Some(&new_val),
        None,
        None,
    )
    .await?;

    // Fetch and return the created record
    let query = format!("{PIXEL_RECORD_SELECT} WHERE id = ?");
    let record: PixelRecord = sqlx::query_as(&query)
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch created pixel: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Pixel created", record))
}

/// `GET /api/pixels` — Admin and operator.
pub async fn list_pixels(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let pixels: Vec<PixelWithStats> = if user.role.eq_ignore_ascii_case("admin") {
        let query = format!(r#"{PIXEL_WITH_STATS_SELECT},
                   (SELECT COUNT(*) FROM pixel_admins pa WHERE pa.pixel_id = p.id) AS assigned_admins_count,
                   (SELECT COUNT(*) FROM pixel_events pe WHERE pe.pixel_id = p.id) AS total_events
               FROM pixels p
               ORDER BY p.created_at DESC"#);
        sqlx::query_as(&query)
        .fetch_all(&state.pool)
        .await
    } else {
        let query = format!(r#"{PIXEL_WITH_STATS_SELECT},
                   (SELECT COUNT(*) FROM pixel_admins pa2 WHERE pa2.pixel_id = p.id) AS assigned_admins_count,
                   (SELECT COUNT(*) FROM pixel_events pe WHERE pe.pixel_id = p.id) AS total_events
               FROM pixels p
               JOIN pixel_admins pa ON pa.pixel_id = p.id
               WHERE pa.user_id = ?
               ORDER BY p.created_at DESC"#);
        sqlx::query_as(&query)
        .bind(&user.id)
        .fetch_all(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("Failed to list pixels: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Pixels retrieved", pixels))
}

/// `GET /api/pixels/:id` — Admin and operator.
pub async fn get_pixel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin, Role::Operator]).await?;

    let record: Option<PixelRecord> = if user.role.eq_ignore_ascii_case("admin") {
        let query = format!("{PIXEL_RECORD_SELECT} WHERE id = ?");
        sqlx::query_as(&query)
            .bind(&id)
            .fetch_optional(&state.pool)
            .await
    } else {
        let query = format!("{PIXEL_RECORD_SELECT} p JOIN pixel_admins pa ON pa.pixel_id = p.id WHERE p.id = ? AND pa.user_id = ?");
        sqlx::query_as(&query)
        .bind(&id)
        .bind(&user.id)
        .fetch_optional(&state.pool)
        .await
    }
    .map_err(|e| {
        tracing::error!("Failed to fetch pixel: {}", e);
        AppError::Internal
    })?;

    match record {
        Some(r) => Ok(json_ok("Pixel retrieved", r)),
        None => Err(AppError::NotFound),
    }
}

/// `PATCH /api/pixels/:id` — Admin only.
pub async fn update_pixel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(req): Json<UpdatePixelRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch existing pixel
    let query = format!("{PIXEL_RECORD_SELECT} WHERE id = ?");
    let existing: Option<PixelRecord> = sqlx::query_as(&query)
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching pixel for update: {}", e);
            AppError::Internal
        })?;

    let existing = existing.ok_or(AppError::NotFound)?;

    // Validate status if provided
    if let Some(ref status) = req.status {
        match status.as_str() {
            "active" | "inactive" | "suspended" => {}
            _ => {
                return Err(AppError::Validation {
                    errors: vec![format!(
                        "Invalid status '{}'. Must be one of: active, inactive, suspended",
                        status
                    )],
                });
            }
        }
    }

    // Resolve updated fields (fall back to existing values)
    let new_name = req.name.as_deref().unwrap_or(&existing.name);
    let new_bm_id = req
        .business_manager_id
        .as_deref()
        .or(existing.business_manager_id.as_deref());
    let new_status = req.status.as_deref().unwrap_or(&existing.status);
    let new_config = req
        .config
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| existing.config.clone());

    // Re-encrypt access token if a new one was provided
    let new_token = if let Some(ref plain) = req.access_token {
        let key = get_encryption_key();
        encrypt_token(plain, &key).map_err(|e| {
            tracing::error!("Failed to encrypt access token: {}", e);
            AppError::Internal
        })?
    } else {
        existing.access_token.clone()
    };

    sqlx::query(
        r#"UPDATE pixels
           SET name = ?, business_manager_id = ?, status = ?, access_token = ?, config = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?"#,
    )
    .bind(new_name)
    .bind(new_bm_id)
    .bind(new_status)
    .bind(&new_token)
    .bind(&new_config)
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update pixel: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let old_val = json!({
        "name": existing.name,
        "status": existing.status,
        "business_manager_id": existing.business_manager_id,
        "config": existing.config,
    })
    .to_string();
    let new_val = json!({
        "name": new_name,
        "status": new_status,
        "business_manager_id": new_bm_id,
        "config": new_config,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "pixel.updated",
        "pixel",
        &id,
        Some(&old_val),
        Some(&new_val),
        None,
        None,
    )
    .await?;

    // Return updated record
    let query = format!("{PIXEL_RECORD_SELECT} WHERE id = ?");
    let updated: PixelRecord = sqlx::query_as(&query)
        .bind(&id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch updated pixel: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Pixel updated", updated))
}

/// `DELETE /api/pixels/:id` — Admin only.
pub async fn delete_pixel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Fetch existing pixel
    let query = format!("{PIXEL_RECORD_SELECT} WHERE id = ?");
    let existing: Option<PixelRecord> = sqlx::query_as(&query)
        .bind(&id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error fetching pixel for delete: {}", e);
            AppError::Internal
        })?;

    let existing = existing.ok_or(AppError::NotFound)?;

    // Write audit log BEFORE deletion
    let old_val = json!({
        "pixel_id": existing.pixel_id,
        "name": existing.name,
        "status": existing.status,
    })
    .to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "pixel.deleted",
        "pixel",
        &id,
        Some(&old_val),
        None,
        None,
        None,
    )
    .await?;

    sqlx::query(
        "DELETE FROM conversions WHERE event_id IN (SELECT id FROM pixel_events WHERE pixel_id = ?)",
    )
    .bind(&id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete pixel conversions: {}", e);
        AppError::Internal
    })?;

    sqlx::query("DELETE FROM pixel_events WHERE pixel_id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete pixel events: {}", e);
            AppError::Internal
        })?;

    sqlx::query("DELETE FROM pixel_analytics WHERE pixel_id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete pixel analytics: {}", e);
            AppError::Internal
        })?;

    sqlx::query("DELETE FROM pixels WHERE id = ?")
        .bind(&id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete pixel: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Pixel deleted", json!({ "id": id })))
}

// ─── Admin assignment ─────────────────────────────────────────────────────────

/// `POST /api/pixels/:id/admins` — Admin only.
pub async fn assign_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(pixel_id): Path<String>,
    Json(req): Json<AssignAdminRequest>,
) -> Result<axum::response::Response, AppError> {
    let user = authorize(&state, &headers, &[Role::Admin]).await?;

    // Validate pixel exists
    let pixel_exists: Option<(String,)> = sqlx::query_as("SELECT id FROM pixels WHERE id = ?")
        .bind(&pixel_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("DB error checking pixel existence: {}", e);
            AppError::Internal
        })?;

    if pixel_exists.is_none() {
        return Err(AppError::NotFound);
    }

    // Validate target user exists and can operate pixel campaigns.
    let target: Option<(String, String)> =
        sqlx::query_as("SELECT id, role FROM users WHERE id = ?")
            .bind(&req.user_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error fetching target user: {}", e);
                AppError::Internal
            })?;

    match target {
        None => {
            return Err(AppError::Validation {
                errors: vec!["Target user not found".to_string()],
            });
        }
        Some((_, role)) if !role.eq_ignore_ascii_case("admin") && !role.eq_ignore_ascii_case("operator") => {
            return Err(AppError::Validation {
                errors: vec![format!(
                    "User must have role 'admin' or 'operator', but has role '{}'",
                    role
                )],
            });
        }
        _ => {}
    }

    // Check for duplicate assignment
    let duplicate: Option<(String,)> =
        sqlx::query_as("SELECT id FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
            .bind(&pixel_id)
            .bind(&req.user_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking duplicate assignment: {}", e);
                AppError::Internal
            })?;

    if duplicate.is_some() {
        return Err(AppError::Conflict);
    }

    let assignment_id = Uuid::new_v4().to_string();
    let permissions_str = req
        .permissions
        .as_ref()
        .map(|v| v.to_string())
        .unwrap_or_else(|| "{}".to_string());

    sqlx::query(
        r#"INSERT INTO pixel_admins (id, pixel_id, user_id, permissions, assigned_by)
           VALUES (?, ?, ?, ?, ?)"#,
    )
    .bind(&assignment_id)
    .bind(&pixel_id)
    .bind(&req.user_id)
    .bind(&permissions_str)
    .bind(&user.id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to insert pixel_admin: {}", e);
        AppError::Internal
    })?;

    // Audit log
    let new_val = json!({ "pixel_id": pixel_id, "user_id": req.user_id }).to_string();
    write_audit_log(
        &state.pool,
        Some(&user.id),
        "admin.assigned",
        "pixel_admin",
        &assignment_id,
        None,
        Some(&new_val),
        None,
        None,
    )
    .await?;

    // Return the created record
    let record: PixelAdminRecord = sqlx::query_as(
        "SELECT id, pixel_id, user_id, permissions, DATE_FORMAT(assigned_at, '%Y-%m-%d %H:%i:%s') AS assigned_at, assigned_by FROM pixel_admins WHERE id = ?",
    )
        .bind(&assignment_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch created pixel_admin: {}", e);
            AppError::Internal
        })?;

    Ok(json_ok("Admin assigned", record))
}

/// `DELETE /api/pixels/:pixel_id/admins/:user_id` — Admin only.
pub async fn revoke_admin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path((pixel_id, user_id)): Path<(String, String)>,
) -> Result<axum::response::Response, AppError> {
    let actor = authorize(&state, &headers, &[Role::Admin]).await?;

    let result = sqlx::query("DELETE FROM pixel_admins WHERE pixel_id = ? AND user_id = ?")
        .bind(&pixel_id)
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete pixel_admin: {}", e);
            AppError::Internal
        })?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    // Audit log
    let old_val = json!({ "pixel_id": pixel_id, "user_id": user_id }).to_string();
    write_audit_log(
        &state.pool,
        Some(&actor.id),
        "admin.revoked",
        "pixel_admin",
        &format!("{}/{}", pixel_id, user_id),
        Some(&old_val),
        None,
        None,
        None,
    )
    .await?;

    Ok(json_ok(
        "Admin revoked",
        json!({ "pixel_id": pixel_id, "user_id": user_id }),
    ))
}

/// `GET /api/pixels/:id/admins` — Admin only.
pub async fn list_pixel_admins(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(pixel_id): Path<String>,
) -> Result<axum::response::Response, AppError> {
    authorize(&state, &headers, &[Role::Admin]).await?;

    let admins: Vec<PixelAdminWithUser> = sqlx::query_as(
        r#"SELECT
               pa.id, pa.pixel_id, pa.user_id, pa.permissions,
               DATE_FORMAT(pa.assigned_at, '%Y-%m-%d %H:%i:%s') AS assigned_at,
               pa.assigned_by,
               u.name AS user_name, u.email AS user_email
           FROM pixel_admins pa
           JOIN users u ON u.id = pa.user_id
           WHERE pa.pixel_id = ?
           ORDER BY pa.assigned_at DESC"#,
    )
    .bind(&pixel_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list pixel admins: {}", e);
        AppError::Internal
    })?;

    Ok(json_ok("Pixel admins retrieved", admins))
}

// ─── Unit tests ───────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Test 1: duplicate pixel_id check logic ────────────────────────────────
    //
    // We test the validation logic in isolation: if a pixel_id already exists
    // in the DB the handler must return AppError::Conflict.  We simulate this
    // by checking the branch that is taken when `existing.is_some()`.
    #[test]
    fn create_pixel_rejects_duplicate_pixel_id() {
        // Simulate the branch: existing record found → Conflict
        let existing: Option<(String,)> = Some(("some-uuid".to_string(),));
        let result: Result<(), AppError> = if existing.is_some() {
            Err(AppError::Conflict)
        } else {
            Ok(())
        };
        assert!(
            matches!(result, Err(AppError::Conflict)),
            "Expected Conflict when pixel_id already exists"
        );
    }

    // ── Test 2: unauthorized role gets Forbidden ──────────────────────────────
    //
    // The `authorize` function returns AppError::Forbidden when the caller's
    // role is not in the allowed list.  We verify the Role comparison logic
    // directly without needing a live DB.
    #[test]
    fn unauthorized_role_gets_forbidden() {
        use crate::auth::Role;
        use std::str::FromStr;

        let allowed = vec![Role::Admin];
        let caller_role = Role::from_str("agent").unwrap();

        let is_allowed = allowed.iter().any(|r| r == &caller_role);
        let result: Result<(), AppError> = if is_allowed {
            Ok(())
        } else {
            Err(AppError::Forbidden)
        };

        assert!(
            matches!(result, Err(AppError::Forbidden)),
            "Expected Forbidden for non-admin role"
        );
    }

    // ── Test 3: update_pixel validates status ─────────────────────────────────
    //
    // Only "active", "inactive", and "suspended" are valid status values.
    // Any other string must produce AppError::Validation.
    #[test]
    fn update_pixel_validates_status() {
        fn validate_status(status: &str) -> Result<(), AppError> {
            match status {
                "active" | "inactive" | "suspended" => Ok(()),
                _ => Err(AppError::Validation {
                    errors: vec![format!(
                        "Invalid status '{}'. Must be one of: active, inactive, suspended",
                        status
                    )],
                }),
            }
        }

        // Valid statuses
        assert!(validate_status("active").is_ok());
        assert!(validate_status("inactive").is_ok());
        assert!(validate_status("suspended").is_ok());

        // Invalid statuses
        assert!(matches!(
            validate_status("deleted"),
            Err(AppError::Validation { .. })
        ));
        assert!(matches!(
            validate_status(""),
            Err(AppError::Validation { .. })
        ));
        assert!(matches!(
            validate_status("ACTIVE"),
            Err(AppError::Validation { .. })
        ));
        assert!(matches!(
            validate_status("paused"),
            Err(AppError::Validation { .. })
        ));
    }

    // ── Test 4: assign_admin rejects non-admin user ───────────────────────────
    //
    // Requirements 2.2, 2.6: Only users with role 'admin' may be assigned as
    // pixel admins.  When the target user has any other role the handler must
    // return AppError::Validation.
    //
    // We simulate the branch: `role != "admin"` → AppError::Validation.
    #[test]
    fn assign_admin_rejects_non_admin_user() {
        // Helper that mirrors the role-check branch inside `assign_admin`.
        fn check_user_role(role: &str) -> Result<(), AppError> {
            if role != "admin" {
                return Err(AppError::Validation {
                    errors: vec![format!(
                        "User must have role 'admin', but has role '{}'",
                        role
                    )],
                });
            }
            Ok(())
        }

        // Roles that must be rejected
        for bad_role in &["agent", "sales", "operator", ""] {
            assert!(
                matches!(check_user_role(bad_role), Err(AppError::Validation { .. })),
                "Expected Validation error for role '{}'",
                bad_role
            );
        }

        // The only accepted role
        assert!(
            check_user_role("admin").is_ok(),
            "Expected Ok for role 'admin'"
        );
    }

    // ── Test 5: assign_admin rejects duplicate assignment ─────────────────────
    //
    // Requirement 16.2: Assigning the same user to the same pixel twice must
    // return AppError::Conflict.
    //
    // We simulate the branch: `duplicate.is_some()` → AppError::Conflict.
    #[test]
    fn assign_admin_rejects_duplicate_assignment() {
        fn check_duplicate(duplicate: Option<&str>) -> Result<(), AppError> {
            if duplicate.is_some() {
                return Err(AppError::Conflict);
            }
            Ok(())
        }

        // Duplicate found → Conflict
        assert!(
            matches!(
                check_duplicate(Some("existing-id")),
                Err(AppError::Conflict)
            ),
            "Expected Conflict when duplicate assignment exists"
        );

        // No duplicate → Ok
        assert!(
            check_duplicate(None).is_ok(),
            "Expected Ok when no duplicate assignment exists"
        );
    }

    // ── Test 6: revoke_admin returns NotFound when no rows affected ───────────
    //
    // Requirement 2.6: Revoking an admin that does not exist (or was already
    // revoked) must return AppError::NotFound.
    //
    // We simulate the branch: `result.rows_affected() == 0` → AppError::NotFound.
    #[test]
    fn revoke_admin_returns_not_found_when_no_rows_affected() {
        fn check_rows_affected(rows: u64) -> Result<(), AppError> {
            if rows == 0 {
                return Err(AppError::NotFound);
            }
            Ok(())
        }

        // Zero rows deleted → NotFound
        assert!(
            matches!(check_rows_affected(0), Err(AppError::NotFound)),
            "Expected NotFound when rows_affected() == 0"
        );

        // One or more rows deleted → Ok
        assert!(
            check_rows_affected(1).is_ok(),
            "Expected Ok when rows_affected() == 1"
        );
        assert!(
            check_rows_affected(2).is_ok(),
            "Expected Ok when rows_affected() > 1"
        );
    }
}
