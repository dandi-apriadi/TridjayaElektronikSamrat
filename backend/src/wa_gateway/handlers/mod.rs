/**
 * WA Gateway - Handlers
 * 
 * API endpoint handlers organized by domain
 */

pub mod messages;
pub mod contacts;
pub mod templates;
pub mod sessions;
pub mod webhooks;
pub mod dashboard;

use crate::response::AppError;

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
