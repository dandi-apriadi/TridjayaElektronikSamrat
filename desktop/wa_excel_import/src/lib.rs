use calamine::{open_workbook_auto, Reader};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::{path::Path, time::Duration};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RecipientDraft {
    pub phone: String,
    #[serde(default)]
    pub variables: Value,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RecipientBatch {
    pub recipients: Vec<RecipientDraft>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct UploadResult {
    pub sent: usize,
    pub skipped: usize,
    pub failed: usize,
    pub message: String,
}

#[derive(Clone, Debug)]
pub struct ParsedWorkbook {
    pub headers: Vec<String>,
    pub recipients: Vec<RecipientDraft>,
}

#[derive(Clone, Debug)]
pub struct ImportSettings {
    pub backend_url: String,
    pub bearer_token: String,
    pub campaign_id: String,
    pub chunk_size: usize,
    pub timeout: Duration,
}

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("file tidak ditemukan")]
    FileNotFound,
    #[error("workbook kosong")]
    EmptyWorkbook,
    #[error("header phone tidak ditemukan")]
    MissingPhoneHeader,
    #[error("phone tidak valid di baris {0}")]
    InvalidPhone(usize),
    #[error("{0}")]
    Other(String),
}

pub fn normalize_header(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut prev_underscore = false;

    for ch in value.trim().chars() {
        if ch.is_ascii_alphanumeric() {
            output.push(ch.to_ascii_lowercase());
            prev_underscore = false;
        } else if !prev_underscore {
            output.push('_');
            prev_underscore = true;
        }
    }

    output.trim_matches('_').to_string()
}

pub fn normalize_phone(value: &str) -> Option<String> {
    let digits: String = value.chars().filter(|ch| ch.is_ascii_digit()).collect();
    if digits.len() < 8 {
        None
    } else {
        Some(digits)
    }
}

pub fn parse_variables_from_row(headers: &[String], row: &[String], phone_index: usize) -> Value {
    let mut variables = Map::new();

    for (index, header) in headers.iter().enumerate() {
        if index == phone_index {
            continue;
        }
        let value = row.get(index).map(|value| value.trim()).unwrap_or("");
        if value.is_empty() {
            continue;
        }
        variables.insert(header.clone(), Value::String(value.to_string()));
    }

    Value::Object(variables)
}

pub fn parse_excel_file(path: &Path) -> Result<ParsedWorkbook, ImportError> {
    if !path.exists() {
        return Err(ImportError::FileNotFound);
    }

    let mut workbook = open_workbook_auto(path).map_err(|error| ImportError::Other(error.to_string()))?;
    let range = workbook
        .worksheet_range_at(0)
        .ok_or(ImportError::EmptyWorkbook)?
        .map_err(|error| ImportError::Other(error.to_string()))?;

    let mut rows = range.rows();
    let header_row = rows.next().ok_or(ImportError::EmptyWorkbook)?;
    let headers = header_row
        .iter()
        .map(|cell| normalize_header(&cell.to_string()))
        .collect::<Vec<_>>();

    let phone_index = headers
        .iter()
        .position(|header| matches!(header.as_str(), "phone" | "phone_number" | "phone_no" | "nomor" | "nomor_hp" | "whatsapp" | "whatsapp_number" | "wa"))
        .ok_or(ImportError::MissingPhoneHeader)?;

    let mut recipients = Vec::new();
    for (row_index, row) in rows.enumerate() {
        let values = row.iter().map(|cell| cell.to_string()).collect::<Vec<_>>();
        let phone_raw = values.get(phone_index).map(|value| value.as_str()).unwrap_or("");
        let phone = match normalize_phone(phone_raw) {
            Some(value) => value,
            None => return Err(ImportError::InvalidPhone(row_index + 2)),
        };

        let variables = parse_variables_from_row(&headers, &values, phone_index);
        recipients.push(RecipientDraft { phone, variables });
    }

    Ok(ParsedWorkbook { headers, recipients })
}

pub fn chunk_recipients(recipients: &[RecipientDraft], chunk_size: usize) -> Vec<Vec<RecipientDraft>> {
    let size = chunk_size.max(1);
    recipients
        .chunks(size)
        .map(|chunk| chunk.to_vec())
        .collect()
}

pub fn build_upload_payload(recipients: Vec<RecipientDraft>) -> RecipientBatch {
    RecipientBatch { recipients }
}

pub fn manual_recipient(phone: &str, variables_json: &str) -> Result<RecipientDraft, ImportError> {
    let phone = normalize_phone(phone).ok_or(ImportError::InvalidPhone(1))?;
    let variables = if variables_json.trim().is_empty() {
        Value::Object(Map::new())
    } else {
        serde_json::from_str(variables_json).map_err(|error| ImportError::Other(format!("variables JSON tidak valid: {}", error)))?
    };

    Ok(RecipientDraft { phone, variables })
}

pub fn upload_recipients(settings: &ImportSettings, recipients: &[RecipientDraft]) -> Result<UploadResult, ImportError> {
    if recipients.is_empty() {
        return Ok(UploadResult {
            sent: 0,
            skipped: 0,
            failed: 0,
            message: "Tidak ada recipient untuk diupload".to_string(),
        });
    }

    let client = reqwest::blocking::Client::builder()
        .timeout(settings.timeout)
        .build()
        .map_err(|error| ImportError::Other(error.to_string()))?;

    let mut sent = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;

    for batch in chunk_recipients(recipients, settings.chunk_size) {
        let endpoint = format!(
            "{}/api/wa/campaigns/{}/recipients",
            settings.backend_url.trim_end_matches('/'),
            settings.campaign_id.trim()
        );
        let payload = build_upload_payload(batch);
        let response = client
            .post(&endpoint)
            .bearer_auth(settings.bearer_token.trim())
            .json(&payload)
            .send()
            .map_err(|error| ImportError::Other(error.to_string()))?;

        if !response.status().is_success() {
            failed += payload.recipients.len();
            continue;
        }

        let value: Value = response.json().map_err(|error| ImportError::Other(error.to_string()))?;
        let inserted = value.get("data").and_then(|data| data.get("inserted")).and_then(Value::as_i64).unwrap_or(payload.recipients.len() as i64);
        let skipped_count = value.get("data").and_then(|data| data.get("skipped")).and_then(Value::as_i64).unwrap_or(0);
        sent += inserted.max(0) as usize;
        skipped += skipped_count.max(0) as usize;
    }

    Ok(UploadResult {
        sent,
        skipped,
        failed,
        message: format!("Upload selesai: {} terkirim, {} ter-skip, {} gagal", sent, skipped, failed),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn normalize_header_collapses_non_word_characters() {
        assert_eq!(normalize_header("Phone Number"), "phone_number");
        assert_eq!(normalize_header("Nama Lengkap"), "nama_lengkap");
    }

    #[test]
    fn normalize_phone_keeps_digits() {
        assert_eq!(normalize_phone("+62 812-3456-7890"), Some("6281234567890".to_string()));
        assert_eq!(normalize_phone("123"), None);
    }

    #[test]
    fn manual_recipient_parses_json() {
        let draft = manual_recipient("081234567890", r#"{"name":"Budi"}"#).expect("valid recipient");
        assert_eq!(draft.phone, "081234567890");
        assert_eq!(draft.variables["name"], "Budi");
    }

    #[test]
    fn chunking_uses_requested_size() {
        let recipients = vec![
            RecipientDraft { phone: "1".into(), variables: Value::Null },
            RecipientDraft { phone: "2".into(), variables: Value::Null },
            RecipientDraft { phone: "3".into(), variables: Value::Null },
        ];
        let chunks = chunk_recipients(&recipients, 2);
        assert_eq!(chunks.len(), 2);
        assert_eq!(chunks[0].len(), 2);
        assert_eq!(chunks[1].len(), 1);
    }

    #[test]
    fn build_upload_payload_wraps_recipients() {
        let payload = build_upload_payload(vec![RecipientDraft { phone: "1".into(), variables: Value::Null }]);
        assert_eq!(payload.recipients.len(), 1);
    }

    #[test]
    fn parse_excel_handles_missing_file() {
        let path = PathBuf::from("does-not-exist.xlsx");
        let err = parse_excel_file(&path).unwrap_err();
        assert!(matches!(err, ImportError::FileNotFound));
    }
}
