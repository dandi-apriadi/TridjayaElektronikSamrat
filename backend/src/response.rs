use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
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
    pub errors: Vec<String>,
}

impl ErrorResponse {
    pub fn new(message: impl Into<String>, errors: Vec<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            errors,
        }
    }
}

pub fn json_ok<T: Serialize>(message: impl Into<String>, data: T) -> Response {
    Json(ApiResponse::ok(message, data)).into_response()
}

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
    #[error("internal server error")]
    Internal,
    #[error("email not verified")]
    EmailUnverified,
}

impl AppError {
    fn status(&self) -> StatusCode {
        match self {
            Self::Validation { .. } => StatusCode::BAD_REQUEST,
            Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::Forbidden => StatusCode::FORBIDDEN,
            Self::NotFound => StatusCode::NOT_FOUND,
            Self::Conflict => StatusCode::CONFLICT,
            Self::Internal => StatusCode::INTERNAL_SERVER_ERROR,
            Self::EmailUnverified => StatusCode::FORBIDDEN,
        }
    }

    fn message(&self) -> String {
        match self {
            Self::Validation { .. } => "Validation failed".to_string(),
            Self::Unauthorized => "Authentication required".to_string(),
            Self::Forbidden => "Access denied".to_string(),
            Self::NotFound => "Resource not found".to_string(),
            Self::Conflict => "Conflict detected".to_string(),
            Self::Internal => "Unexpected internal error".to_string(),
            Self::EmailUnverified => "Email belum terverifikasi. Silakan cek inbox Anda atau hubungi admin.".to_string(),
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        let message = self.message();
        let body = match self {
            Self::Validation { errors } => ErrorResponse::new(message, errors),
            _ => ErrorResponse::new(message, Vec::new()),
        };

        (status, Json(body)).into_response()
    }
}
