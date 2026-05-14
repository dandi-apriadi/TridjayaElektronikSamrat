pub mod contacts;
pub mod dashboard;
/**
 * WA Gateway - Handlers
 *
 * API endpoint handlers organized by domain
 */
pub mod messages;
pub mod sessions;
pub mod templates;
pub mod webhooks;

use crate::{
    response::AppError,
    state::{AppState, UserRecord},
};

pub fn generate_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn normalize_phone(phone: &str) -> Result<String, AppError> {
    let cleaned: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();

    if cleaned.len() < 10 {
        return Err(AppError::Validation {
            errors: vec![format!("Invalid phone number: {}", phone)],
        });
    }

    let normalized = if cleaned.starts_with('0') {
        format!("62{}", &cleaned[1..])
    } else if cleaned.starts_with("62") {
        cleaned
    } else {
        format!("62{}", cleaned)
    };

    Ok(normalized)
}

pub fn is_admin(user: &UserRecord) -> bool {
    user.role.eq_ignore_ascii_case("admin")
}

pub async fn ensure_session_access(
    state: &AppState,
    user: &UserRecord,
    session_id: &str,
) -> Result<(), AppError> {
    if is_admin(user) {
        let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ?")
            .bind(session_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA session access: {}", e);
                AppError::Internal
            })?;

        return if exists > 0 {
            Ok(())
        } else {
            Err(AppError::NotFound)
        };
    }

    let exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM wa_accounts WHERE id = ? AND created_by = ?")
            .bind(session_id)
            .bind(&user.id)
            .fetch_one(&state.pool)
            .await
            .map_err(|e| {
                tracing::error!("DB error checking WA session ownership: {}", e);
                AppError::Internal
            })?;

    if exists > 0 {
        Ok(())
    } else {
        Err(AppError::NotFound)
    }
}
