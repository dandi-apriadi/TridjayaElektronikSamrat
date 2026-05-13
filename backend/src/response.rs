use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::Value;

#[derive(Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: T,
    pub meta: Option<Value>,
}

impl<T> ApiResponse<T> {
    pub fn ok(message: impl Into<String>, data: T) -> Self {
        Self {
            success: true,
            message: message.into(),
            data,
            meta: None,
        }
    }

    pub fn ok_with_meta(message: impl Into<String>, data: T, meta: Value) -> Self {
        Self {
            success: true,
            message: message.into(),
            data,
            meta: Some(meta),
        }
    }
}

#[derive(Serialize)]
pub struct ErrorResponse {
    pub success: bool,
    pub message: String,
    pub detail: Option<String>,
    pub errors: Vec<String>,
}

impl ErrorResponse {
    pub fn new(message: impl Into<String>, detail: Option<String>, errors: Vec<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            detail,
            errors,
        }
    }
}

pub fn json_ok<T: Serialize>(message: impl Into<String>, data: T) -> Response {
    Json(ApiResponse::ok(message, data)).into_response()
}

pub fn json_created<T: Serialize>(message: impl Into<String>, data: T) -> Response {
    (StatusCode::CREATED, Json(ApiResponse::ok(message, data))).into_response()
}

pub type ResponseBody = Response;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("validation failed")]
    Validation { errors: Vec<String> },
    #[error("unauthorized")]
    Unauthorized,
    #[error("forbidden")]
    Forbidden,
    #[error("not found")]
    NotFound,
    #[error("conflict")]
    Conflict,
    #[error("too many requests")]
    TooManyRequests,
    #[error("internal server error")]
    Internal,
    #[error("email not verified")]
    EmailUnverified,
    #[error("cooldown active")]
    CooldownActive {
        target_phone: String,
        cooldown_expires_at: String,
        remaining_seconds: i64,
    },
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("database error: {0}")]
    Database(String),
}

impl AppError {
    pub fn bad_request(msg: impl Into<String>) -> Self {
        Self::BadRequest(msg.into())
    }
}

impl AppError {
    fn status(&self) -> StatusCode {
        match self {
            Self::Validation { .. } => StatusCode::BAD_REQUEST,
            Self::BadRequest(_) => StatusCode::BAD_REQUEST,
            Self::Database(_) => StatusCode::INTERNAL_SERVER_ERROR,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::TooManyRequests => StatusCode::TOO_MANY_REQUESTS,
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
            Self::EmailUnverified => StatusCode::FORBIDDEN,
            Self::CooldownActive { .. } => StatusCode::TOO_MANY_REQUESTS,
        }
    }

    fn message(&self) -> String {
        match self {
            Self::Validation { .. } => "Validation failed".to_string(),
            Self::BadRequest(msg) => msg.clone(),
            Self::Database(msg) => format!("Database error: {}", msg),
            Self::Unauthorized => "Authentication required".to_string(),
            Self::Forbidden => "Access denied".to_string(),
            Self::NotFound => "Resource not found".to_string(),
            Self::Conflict => "Conflict detected".to_string(),
            Self::TooManyRequests => "Too many requests".to_string(),
            Self::Internal => "Unexpected internal error".to_string(),
            Self::EmailUnverified => {
                "Email belum terverifikasi. Silakan cek inbox Anda atau hubungi admin.".to_string()
            }
            Self::CooldownActive { .. } => "Target phone masih dalam cooldown period".to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        let message = self.message();
        let detail = match &self {
            Self::EmailUnverified => {
                Some("Email belum terverifikasi. Silakan cek inbox Anda.".to_string())
            }
            _ => None,
        };

        let body = match self {
            Self::Validation { errors } => ErrorResponse::new(message, None, errors),
            Self::CooldownActive {
                target_phone,
                cooldown_expires_at,
                remaining_seconds,
            } => {
                // Return special format for cooldown error
                let error_data = serde_json::json!({
                    "error": "cooldown_active",
                    "message": message,
                    "data": {
                        "targetPhone": target_phone,
                        "cooldownExpiresAt": cooldown_expires_at,
                        "remainingSeconds": remaining_seconds,
                    }
                });
                return (status, Json(error_data)).into_response();
            }
            _ => ErrorResponse::new(message, detail, Vec::new()),
        };

        (status, Json(body)).into_response()
    }
}
