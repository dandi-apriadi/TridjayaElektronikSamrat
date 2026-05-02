use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{env, time::Duration};

#[derive(Clone, Debug)]
pub struct FonnteAccountConfig {
    pub name: String,
    pub token: String,
    pub enabled: bool,
    pub base_url: String,
}

impl FonnteAccountConfig {
    pub fn new(name: impl Into<String>, token: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            token: token.into(),
            enabled: true,
            base_url: fonnte_base_url(),
        }
    }
}

#[derive(Clone)]
pub struct FonnteClient {
    http: Client,
    base_url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct FonnteSendRequest<'a> {
    pub target: &'a str,
    pub message: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub delay: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schedule: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<&'a str>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FonnteSendResponse {
    #[serde(default)]
    pub status: bool,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub data: Option<Value>,
}

#[derive(Debug, thiserror::Error)]
pub enum FonnteError {
    #[error("fonnte client is disabled")]
    Disabled,
    #[error("fonnte request failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("fonnte returned non-success status: {0}")]
    Http(StatusCode),
}

impl FonnteClient {
    pub fn new() -> Self {
        let base_url = fonnte_base_url();
        let http = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("reqwest client should build");

        Self { http, base_url }
    }

    pub async fn send_text(
        &self,
        account: &FonnteAccountConfig,
        request: FonnteSendRequest<'_>,
    ) -> Result<FonnteSendResponse, FonnteError> {
        if !account.enabled || account.token.trim().is_empty() {
            return Err(FonnteError::Disabled);
        }

        let endpoint = format!("{}/send", self.base_url);
        let response = self
            .http
            .post(endpoint)
            .header("Authorization", account.token.trim())
            .header("Accept", "application/json")
            .form(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(FonnteError::Http(response.status()));
        }

        let parsed = response.json::<FonnteSendResponse>().await?;
        Ok(parsed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_config_defaults_are_sane() {
        let account = FonnteAccountConfig::new("main", "token-123");
        assert_eq!(account.name, "main");
        assert_eq!(account.token, "token-123");
        assert!(account.enabled);
        assert!(account.base_url.starts_with("http"));
    }

    #[test]
    fn send_request_serializes_optional_fields() {
        let request = FonnteSendRequest {
            target: "6281234567890",
            message: "Halo",
            delay: Some(3000),
            schedule: None,
            country_code: Some("62"),
        };
        let json = serde_json::to_value(request).expect("serialize request");
        assert_eq!(json["target"], "6281234567890");
        assert_eq!(json["message"], "Halo");
        assert_eq!(json["delay"], 3000);
        assert_eq!(json["country_code"], "62");
        assert!(json.get("schedule").is_none());
    }
}

fn fonnte_base_url() -> String {
    env::var("FONNTE_BASE_URL")
        .unwrap_or_else(|_| "https://api.fonnte.com".to_string())
        .trim_end_matches('/')
        .to_string()
}
