use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fmt::Write;
use thiserror::Error;

/// Campaign configuration errors
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Invalid JSON: {0}")]
    InvalidJson(String),

    #[error("Missing required field: {0}")]
    MissingField(String),

    #[error("Invalid field value for '{field}': {reason}")]
    InvalidFieldValue { field: String, reason: String },

    #[error("Delay min ({min}) must be less than or equal to delay max ({max})")]
    InvalidDelayRange { min: u64, max: u64 },

    #[error("Delay range must be between 5000-30000ms (got {0}-{1}ms)")]
    DelayOutOfRange(u64, u64),

    #[error("Invalid media type: {0}. Expected 'image', 'pdf', 'video', or 'none'")]
    InvalidMediaType(String),

    #[error("Spintax syntax error: {0}")]
    SpintaxSyntaxError(String),

    #[error("Spintax is required but not enabled for message with spintax syntax")]
    SpintaxNotEnabled,
}

/// Media configuration for campaign
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum MediaTypeEnum {
    Image,
    Pdf,
    Video,
    None,
}

impl MediaTypeEnum {
    pub fn as_str(&self) -> &str {
        match self {
            MediaTypeEnum::Image => "image",
            MediaTypeEnum::Pdf => "pdf",
            MediaTypeEnum::Video => "video",
            MediaTypeEnum::None => "none",
        }
    }

    pub fn from_string(s: &str) -> Result<Self, ConfigError> {
        match s.to_lowercase().as_str() {
            "image" => Ok(MediaTypeEnum::Image),
            "pdf" => Ok(MediaTypeEnum::Pdf),
            "video" => Ok(MediaTypeEnum::Video),
            "none" => Ok(MediaTypeEnum::None),
            _ => Err(ConfigError::InvalidMediaType(s.to_string())),
        }
    }
}

/// Delay configuration for anti-ban protection
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DelayConfig {
    pub min_delay_ms: u64,
    pub max_delay_ms: u64,
}

impl DelayConfig {
    /// Validate delay configuration
    fn validate(&self) -> Result<(), ConfigError> {
        // Check min <= max
        if self.min_delay_ms > self.max_delay_ms {
            return Err(ConfigError::InvalidDelayRange {
                min: self.min_delay_ms,
                max: self.max_delay_ms,
            });
        }

        // Check range is within 5000-30000ms
        if self.min_delay_ms < 5000 || self.max_delay_ms > 30000 {
            return Err(ConfigError::DelayOutOfRange(
                self.min_delay_ms,
                self.max_delay_ms,
            ));
        }

        Ok(())
    }
}

/// Media configuration for campaign
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MediaConfig {
    pub media_type: MediaTypeEnum,
    pub media_url: Option<String>,
}

/// Campaign configuration schema
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CampaignConfigSchema {
    pub message_template: String,
    pub delay_config: DelayConfig,
    pub spintax_enabled: bool,
    pub media_config: Option<MediaConfig>,
}

impl CampaignConfigSchema {
    /// Parse campaign configuration from JSON string
    /// 
    /// **Validates: Requirements 16.1, 16.2**
    pub fn parse(json_str: &str) -> Result<Self, ConfigError> {
        let value: Value = serde_json::from_str(json_str)
            .map_err(|e| ConfigError::InvalidJson(e.to_string()))?;

        Self::parse_value(&value)
    }

    /// Parse campaign configuration from JSON value
    fn parse_value(value: &Value) -> Result<Self, ConfigError> {
        let obj = value
            .as_object()
            .ok_or_else(|| ConfigError::InvalidJson("Expected JSON object".to_string()))?;

        // Extract and validate message_template (required)
        let message_template = obj
            .get("message_template")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| ConfigError::MissingField("message_template".to_string()))?;

        if message_template.is_empty() {
            return Err(ConfigError::InvalidFieldValue {
                field: "message_template".to_string(),
                reason: "cannot be empty".to_string(),
            });
        }

        // Extract and validate spintax_enabled
        let spintax_enabled = obj
            .get("spintax_enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        // Validate spintax syntax if enabled
        if spintax_enabled {
            Self::validate_spintax_syntax(&message_template)?;
        }

        // Extract and validate delay_config (required)
        let delay_config = obj
            .get("delay_config")
            .ok_or_else(|| ConfigError::MissingField("delay_config".to_string()))?
            .as_object()
            .ok_or_else(|| ConfigError::InvalidFieldValue {
                field: "delay_config".to_string(),
                reason: "must be an object".to_string(),
            })?;

        let min_delay_ms = delay_config
            .get("min_delay_ms")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| ConfigError::InvalidFieldValue {
                field: "delay_config.min_delay_ms".to_string(),
                reason: "must be a non-negative integer (milliseconds)".to_string(),
            })?;

        let max_delay_ms = delay_config
            .get("max_delay_ms")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| ConfigError::InvalidFieldValue {
                field: "delay_config.max_delay_ms".to_string(),
                reason: "must be a non-negative integer (milliseconds)".to_string(),
            })?;

        let delay_config = DelayConfig {
            min_delay_ms,
            max_delay_ms,
        };

        delay_config.validate()?;

        // Extract and validate media_config (optional)
        let media_config = if let Some(media_obj) = obj.get("media_config") {
            if media_obj.is_null() {
                None
            } else {
                let media_obj = media_obj.as_object().ok_or_else(|| {
                    ConfigError::InvalidFieldValue {
                        field: "media_config".to_string(),
                        reason: "must be an object or null".to_string(),
                    }
                })?;

                let media_type_str = media_obj
                    .get("media_type")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ConfigError::InvalidFieldValue {
                        field: "media_config.media_type".to_string(),
                        reason: "must be a string".to_string(),
                    })?;

                let media_type = MediaTypeEnum::from_string(media_type_str)?;

                let media_url = media_obj
                    .get("media_url")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());

                Some(MediaConfig { media_type, media_url })
            }
        } else {
            None
        };

        Ok(CampaignConfigSchema {
            message_template,
            delay_config,
            spintax_enabled,
            media_config,
        })
    }

    /// Validate spintax syntax
    /// 
    /// **Validates: Requirements 16.2**
    fn validate_spintax_syntax(template: &str) -> Result<(), ConfigError> {
        let mut depth = 0;
        let mut max_depth = 0;
        let mut in_variable = false;
        let mut chars = template.chars().peekable();

        while let Some(ch) = chars.next() {
            match ch {
                '{' => {
                    if chars.peek() == Some(&'{') {
                        // Variable {{...}}
                        chars.next();
                        in_variable = true;
                    } else {
                        // Option group {...|...}
                        depth += 1;
                        if depth > max_depth {
                            max_depth = depth;
                        }
                    }
                }
                '}' => {
                    if in_variable && chars.peek() == Some(&'}') {
                        chars.next();
                        in_variable = false;
                    } else if depth > 0 {
                        depth -= 1;
                    } else if !in_variable {
                        return Err(ConfigError::SpintaxSyntaxError(
                            "Mismatched closing brace".to_string(),
                        ));
                    }
                }
                _ => {}
            }
        }

        if depth != 0 {
            return Err(ConfigError::SpintaxSyntaxError(
                "Unclosed option group".to_string(),
            ));
        }

        if in_variable {
            return Err(ConfigError::SpintaxSyntaxError(
                "Unclosed variable".to_string(),
            ));
        }

        if max_depth > 3 {
            return Err(ConfigError::SpintaxSyntaxError(
                format!("Nesting depth {} exceeds maximum of 3", max_depth),
            ));
        }

        Ok(())
    }

    /// Convert config to pretty-printed JSON
    /// 
    /// **Validates: Requirements 16.3, 16.8**
    pub fn to_pretty_json(&self) -> String {
        let value = json!({
            "message_template": self.message_template,
            "delay_config": {
                "min_delay_ms": self.delay_config.min_delay_ms,
                "max_delay_ms": self.delay_config.max_delay_ms,
            },
            "spintax_enabled": self.spintax_enabled,
            "media_config": self.media_config.as_ref().map(|m| {
                json!({
                    "media_type": m.media_type.as_str(),
                    "media_url": m.media_url,
                })
            }),
        });

        Self::format_json_with_indentation(&value, 2)
    }

    /// Format JSON with custom indentation
    /// RFC 8259 compliant
    fn format_json_with_indentation(value: &Value, indent: usize) -> String {
        let mut output = String::new();
        Self::format_value(&mut output, value, indent, 0).ok();
        output
    }

    fn format_value(
        output: &mut String,
        value: &Value,
        indent: usize,
        current_depth: usize,
    ) -> std::fmt::Result {
        match value {
            Value::Null => write!(output, "null")?,
            Value::Bool(b) => write!(output, "{}", b)?,
            Value::Number(n) => write!(output, "{}", n)?,
            Value::String(s) => {
                write!(output, "\"")?;
                for ch in s.chars() {
                    match ch {
                        '"' => write!(output, "\\\"")?,
                        '\\' => write!(output, "\\\\")?,
                        '\n' => write!(output, "\\n")?,
                        '\r' => write!(output, "\\r")?,
                        '\t' => write!(output, "\\t")?,
                        '\x08' => write!(output, "\\b")?,
                        '\x0c' => write!(output, "\\f")?,
                        c if c.is_control() => {
                            write!(output, "\\u{:04x}", c as u32)?;
                        }
                        c => write!(output, "{}", c)?,
                    }
                }
                write!(output, "\"")?;
            }
            Value::Array(arr) => {
                if arr.is_empty() {
                    write!(output, "[]")?;
                } else {
                    write!(output, "[")?;
                    let next_depth = current_depth + 1;
                    for (i, item) in arr.iter().enumerate() {
                        write!(output, "\n{}", " ".repeat(next_depth * indent))?;
                        Self::format_value(output, item, indent, next_depth)?;
                        if i < arr.len() - 1 {
                            write!(output, ",")?;
                        }
                    }
                    write!(output, "\n{}]", " ".repeat(current_depth * indent))?;
                }
            }
            Value::Object(obj) => {
                if obj.is_empty() {
                    write!(output, "{{}}")?;
                } else {
                    write!(output, "{{")?;
                    let next_depth = current_depth + 1;
                    let mut first = true;
                    for (key, val) in obj.iter() {
                        if !first {
                            write!(output, ",")?;
                        }
                        first = false;
                        write!(output, "\n{}", " ".repeat(next_depth * indent))?;
                        write!(output, "\"{}\": ", key)?;
                        Self::format_value(output, val, indent, next_depth)?;
                    }
                    write!(output, "\n{}}}", " ".repeat(current_depth * indent))?;
                }
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_valid_config() {
        let json = r#"{
            "message_template": "Hello {{name}}",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            },
            "spintax_enabled": false
        }"#;

        let config = CampaignConfigSchema::parse(json).unwrap();
        assert_eq!(config.message_template, "Hello {{name}}");
        assert_eq!(config.delay_config.min_delay_ms, 5000);
        assert_eq!(config.delay_config.max_delay_ms, 15000);
        assert!(!config.spintax_enabled);
        assert_eq!(config.media_config, None);
    }

    #[test]
    fn test_parse_with_media_config() {
        let json = r#"{
            "message_template": "Check this image",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 10000
            },
            "spintax_enabled": false,
            "media_config": {
                "media_type": "image",
                "media_url": "https://example.com/image.jpg"
            }
        }"#;

        let config = CampaignConfigSchema::parse(json).unwrap();
        assert_eq!(config.media_config.as_ref().unwrap().media_type, MediaTypeEnum::Image);
        assert_eq!(config.media_config.as_ref().unwrap().media_url, Some("https://example.com/image.jpg".to_string()));
    }

    #[test]
    fn test_missing_required_field() {
        let json = r#"{
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            }
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::MissingField(_))));
    }

    #[test]
    fn test_invalid_delay_range() {
        let json = r#"{
            "message_template": "Hello",
            "delay_config": {
                "min_delay_ms": 15000,
                "max_delay_ms": 5000
            },
            "spintax_enabled": false
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::InvalidDelayRange { .. })));
    }

    #[test]
    fn test_delay_out_of_range() {
        let json = r#"{
            "message_template": "Hello",
            "delay_config": {
                "min_delay_ms": 1000,
                "max_delay_ms": 50000
            },
            "spintax_enabled": false
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::DelayOutOfRange(_, _))));
    }

    #[test]
    fn test_invalid_media_type() {
        let json = r#"{
            "message_template": "Hello",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            },
            "spintax_enabled": false,
            "media_config": {
                "media_type": "unknown"
            }
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::InvalidMediaType(_))));
    }

    #[test]
    fn test_spintax_validation_unclosed_brace() {
        let json = r#"{
            "message_template": "Hello {name",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            },
            "spintax_enabled": true
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::SpintaxSyntaxError(_))));
    }

    #[test]
    fn test_spintax_validation_nested_too_deep() {
        let json = r#"{
            "message_template": "Hello {a|{b|{c|{d|e}}}}",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            },
            "spintax_enabled": true
        }"#;

        let result = CampaignConfigSchema::parse(json);
        assert!(matches!(result, Err(ConfigError::SpintaxSyntaxError(_))));
    }

    #[test]
    fn test_pretty_print() {
        let config = CampaignConfigSchema {
            message_template: "Hello {{name}}".to_string(),
            delay_config: DelayConfig {
                min_delay_ms: 5000,
                max_delay_ms: 15000,
            },
            spintax_enabled: false,
            media_config: None,
        };

        let pretty = config.to_pretty_json();
        assert!(pretty.contains("\"message_template\""));
        assert!(pretty.contains("\"Hello {{name}}\""));
        assert!(pretty.contains("\"delay_config\""));
        assert!(pretty.contains("\"spintax_enabled\""));
    }

    #[test]
    fn test_round_trip_parse_and_print() {
        let json = r#"{
            "message_template": "Hello {{name}}",
            "delay_config": {
                "min_delay_ms": 5000,
                "max_delay_ms": 15000
            },
            "spintax_enabled": false,
            "media_config": null
        }"#;

        let config = CampaignConfigSchema::parse(json).unwrap();
        let pretty = config.to_pretty_json();
        let reparsed = CampaignConfigSchema::parse(&pretty).unwrap();
        
        assert_eq!(config, reparsed);
    }
}
