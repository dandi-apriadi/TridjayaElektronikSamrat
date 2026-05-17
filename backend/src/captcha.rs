//! Optional hCaptcha verification used by public submission endpoints.
//!
//! Verification is **opt-in**: when `HCAPTCHA_SECRET` is set in the environment
//! the verifier requires a valid `h-captcha-response` token, otherwise the
//! verifier is a no-op so existing deployments continue to work unchanged.
//!
//! To enable:
//!   1. Sign up at https://www.hcaptcha.com/ and copy the secret + site key.
//!   2. Set `HCAPTCHA_SECRET=<your secret>` in the backend `.env`.
//!   3. Render the hCaptcha widget on the frontend form and include the
//!      resulting token in the multipart payload under one of the field
//!      names accepted by the submit handler (`h-captcha-response`,
//!      `captchaToken`, …).
//!   4. The handler will reject submissions whose token is missing / invalid.

use serde::Deserialize;

use crate::response::AppError;

const HCAPTCHA_VERIFY_URL: &str = "https://hcaptcha.com/siteverify";

#[derive(Debug, Deserialize)]
struct HCaptchaVerifyResponse {
    success: bool,
    #[serde(default, rename = "error-codes")]
    error_codes: Vec<String>,
}

/// Returns `Ok(())` when:
///   - `HCAPTCHA_SECRET` is unset (the feature is disabled), **or**
///   - `HCAPTCHA_SECRET` is set and the supplied `token` is valid.
///
/// Returns `AppError::Validation` otherwise so the caller can surface a
/// user-friendly error message.
pub async fn verify_hcaptcha_if_configured(
    token: &str,
    remote_ip: Option<&str>,
) -> Result<(), AppError> {
    let Ok(secret) = std::env::var("HCAPTCHA_SECRET") else {
        return Ok(());
    };
    let secret = secret.trim();
    if secret.is_empty() {
        return Ok(());
    }

    let token = token.trim();
    if token.is_empty() {
        return Err(AppError::Validation {
            errors: vec!["Captcha wajib diisi".to_string()],
        });
    }

    let mut form: Vec<(&str, String)> = vec![
        ("secret", secret.to_string()),
        ("response", token.to_string()),
    ];
    if let Some(ip) = remote_ip {
        form.push(("remoteip", ip.to_string()));
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(std::time::Duration::from_secs(3))
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|err| {
            tracing::error!("Failed to build hCaptcha HTTP client: {}", err);
            AppError::Internal
        })?;

    let response = client
        .post(HCAPTCHA_VERIFY_URL)
        .form(&form)
        .send()
        .await
        .map_err(|err| {
            tracing::warn!("hCaptcha verification request failed: {}", err);
            AppError::Validation {
                errors: vec!["Gagal memverifikasi captcha, coba lagi".to_string()],
            }
        })?;

    let parsed: HCaptchaVerifyResponse = response.json().await.map_err(|err| {
        tracing::warn!("hCaptcha returned unparseable response: {}", err);
        AppError::Validation {
            errors: vec!["Captcha tidak dapat diverifikasi".to_string()],
        }
    })?;

    if parsed.success {
        Ok(())
    } else {
        tracing::warn!("hCaptcha rejected token (codes={:?})", parsed.error_codes);
        Err(AppError::Validation {
            errors: vec!["Captcha tidak valid".to_string()],
        })
    }
}
