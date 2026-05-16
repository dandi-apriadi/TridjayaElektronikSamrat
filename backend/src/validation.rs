/**
 * Input Validation Module
 *
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.6, 15.7, 15.8**
 *
 * This module provides comprehensive input validation functions for:
 * - Phone number validation (E.164 format)
 * - Message text sanitization
 * - Webhook URL validation
 * - File upload validation (magic bytes, MIME type consistency)
 * - SQL injection pattern detection
 *
 * All database operations use SQLx parameterized queries (Requirement 15.8)
 */
use thiserror::Error;

/// Validation error types
#[derive(Debug, Error)]
pub enum ValidationError {
    #[error("Invalid phone number format")]
    InvalidPhoneNumber,

    #[error("Invalid URL: {0}")]
    InvalidUrl(String),

    #[error("Invalid file: {0}")]
    InvalidFile(String),

    #[error("Security violation: {0}")]
    SecurityViolation(String),
}

/// Validate phone number format (E.164)
/// **Validates: Requirements 15.1**
///
/// E.164 format: +[country code][number]
/// Example: +6281234567890, +12025551234
///
/// # Arguments
/// * `phone` - Phone number string to validate
///
/// # Returns
/// * `Ok(String)` - Validated phone number
/// * `Err(ValidationError::InvalidPhoneNumber)` - If format is invalid
///
/// # Examples
/// ```
/// use tridjaya_backend::validation::validate_phone_number;
///
/// assert!(validate_phone_number("+6281234567890").is_ok());
/// assert!(validate_phone_number("081234567890").is_err());
/// ```
pub fn validate_phone_number(phone: &str) -> Result<String, ValidationError> {
    let phone = phone.trim();

    // E.164 format: +[country code][number]
    // Country code: 1-3 digits starting with 1-9
    // Total length: 3-15 digits after the +.
    let re = regex::Regex::new(r"^\+[1-9]\d{2,14}$").unwrap();

    if !re.is_match(phone) {
        return Err(ValidationError::InvalidPhoneNumber);
    }

    Ok(phone.to_string())
}

/// Sanitize message text
/// **Validates: Requirements 15.2**
///
/// Removes control characters except newline, tab, and carriage return.
/// Preserves Unicode characters for international text support.
///
/// # Arguments
/// * `message` - Message text to sanitize
///
/// # Returns
/// * Sanitized message string
///
/// # Examples
/// ```
/// use tridjaya_backend::validation::sanitize_message;
///
/// let msg = "Hello\nWorld";
/// assert_eq!(sanitize_message(msg), "Hello\nWorld");
///
/// let msg_with_control = "Hello\x00World";
/// assert_eq!(sanitize_message(msg_with_control), "HelloWorld");
/// ```
pub fn sanitize_message(message: &str) -> String {
    // Remove control characters except newline (\n), tab (\t), and carriage return (\r)
    message
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t' || *c == '\r')
        .collect()
}

/// Validate webhook URL
/// **Validates: Requirements 15.3**
///
/// Parses URL and checks that scheme is HTTP or HTTPS.
/// Rejects other schemes (file://, ftp://, etc.) for security.
///
/// # Arguments
/// * `url` - URL string to validate
///
/// # Returns
/// * `Ok(String)` - Validated URL
/// * `Err(ValidationError::InvalidUrl)` - If URL is invalid or has non-HTTP(S) scheme
///
/// # Examples
/// ```
/// use tridjaya_backend::validation::validate_webhook_url;
///
/// assert!(validate_webhook_url("https://example.com/webhook").is_ok());
/// assert!(validate_webhook_url("file:///etc/passwd").is_err());
/// ```
pub fn validate_webhook_url(url: &str) -> Result<String, ValidationError> {
    // Parse URL
    let parsed = url::Url::parse(url)
        .map_err(|e| ValidationError::InvalidUrl(format!("Failed to parse URL: {}", e)))?;

    // Check scheme is HTTP or HTTPS
    let scheme = parsed.scheme();
    if scheme != "http" && scheme != "https" {
        return Err(ValidationError::InvalidUrl(format!(
            "Invalid scheme '{}'. Only HTTP and HTTPS are allowed",
            scheme
        )));
    }

    Ok(url.to_string())
}

/// File type information
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileType {
    Jpeg,
    Png,
    WebP,
    Pdf,
    Mp4,
}

impl FileType {
    /// Get expected MIME type for this file type
    pub fn mime_type(&self) -> &'static str {
        match self {
            FileType::Jpeg => "image/jpeg",
            FileType::Png => "image/png",
            FileType::WebP => "image/webp",
            FileType::Pdf => "application/pdf",
            FileType::Mp4 => "video/mp4",
        }
    }

    /// Get expected file extensions for this file type
    pub fn extensions(&self) -> &'static [&'static str] {
        match self {
            FileType::Jpeg => &["jpg", "jpeg"],
            FileType::Png => &["png"],
            FileType::WebP => &["webp"],
            FileType::Pdf => &["pdf"],
            FileType::Mp4 => &["mp4"],
        }
    }
}

/// Check if data starts with expected magic bytes
///
/// # Arguments
/// * `data` - File data bytes
/// * `expected` - Expected magic bytes
///
/// # Returns
/// * `true` if data starts with expected bytes, `false` otherwise
fn check_magic_bytes(data: &[u8], expected: &[u8]) -> bool {
    if data.len() < expected.len() {
        return false;
    }

    data[..expected.len()] == *expected
}

/// Detect file type from magic bytes
/// **Validates: Requirements 15.6**
///
/// # Arguments
/// * `data` - File data bytes
///
/// # Returns
/// * `Some(FileType)` if magic bytes match a supported type
/// * `None` if no match found
fn detect_file_type(data: &[u8]) -> Option<FileType> {
    // JPEG: FF D8 FF
    if check_magic_bytes(data, &[0xFF, 0xD8, 0xFF]) {
        return Some(FileType::Jpeg);
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if check_magic_bytes(data, &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
        return Some(FileType::Png);
    }

    // WebP: RIFF (52 49 46 46) + WEBP at offset 8 (57 45 42 50)
    if data.len() >= 12
        && check_magic_bytes(data, &[0x52, 0x49, 0x46, 0x46])
        && check_magic_bytes(&data[8..], &[0x57, 0x45, 0x42, 0x50])
    {
        return Some(FileType::WebP);
    }

    // PDF: 25 50 44 46 (%PDF)
    if check_magic_bytes(data, &[0x25, 0x50, 0x44, 0x46]) {
        return Some(FileType::Pdf);
    }

    // MP4: ftyp box (varies, but typically starts with 00 00 00 XX 66 74 79 70)
    // Check for 'ftyp' at offset 4
    if data.len() >= 8 && check_magic_bytes(&data[4..], &[0x66, 0x74, 0x79, 0x70]) {
        return Some(FileType::Mp4);
    }

    None
}

/// Validate file upload
/// **Validates: Requirements 15.6**
///
/// Checks:
/// 1. Magic bytes match expected file type
/// 2. File extension matches detected type
/// 3. Declared MIME type matches detected type
///
/// Supported types: JPEG, PNG, WebP, PDF, MP4
///
/// # Arguments
/// * `file_data` - File content bytes
/// * `file_extension` - File extension (e.g., "jpg", "png")
/// * `declared_mime_type` - MIME type from upload (e.g., "image/jpeg")
///
/// # Returns
/// * `Ok(())` - If validation passes
/// * `Err(ValidationError::InvalidFile)` - If validation fails
///
/// # Examples
/// ```
/// use tridjaya_backend::validation::validate_file_upload;
///
/// // JPEG magic bytes
/// let jpeg_data = vec![0xFF, 0xD8, 0xFF, 0xE0, 0, 0, 0, 0, 0, 0, 0, 0];
/// assert!(validate_file_upload(&jpeg_data, "jpg", "image/jpeg").is_ok());
///
/// // Mismatch: PNG data with JPEG extension
/// let png_data = vec![0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
/// assert!(validate_file_upload(&png_data, "jpg", "image/jpeg").is_err());
/// ```
pub fn validate_file_upload(
    file_data: &[u8],
    file_extension: &str,
    declared_mime_type: &str,
) -> Result<(), ValidationError> {
    // Check minimum file size
    if file_data.len() < 12 {
        return Err(ValidationError::InvalidFile(
            "File too small to validate".to_string(),
        ));
    }

    // Detect file type from magic bytes
    let detected_type = detect_file_type(file_data).ok_or_else(|| {
        ValidationError::InvalidFile("Unsupported file type or corrupted file".to_string())
    })?;

    // Normalize extension (remove leading dot, lowercase)
    let normalized_ext = file_extension.trim_start_matches('.').to_lowercase();

    // Check extension matches detected type
    if !detected_type
        .extensions()
        .contains(&normalized_ext.as_str())
    {
        return Err(ValidationError::InvalidFile(format!(
            "File extension '{}' does not match detected type {:?}",
            file_extension, detected_type
        )));
    }

    // Check MIME type matches detected type
    let expected_mime = detected_type.mime_type();
    if declared_mime_type != expected_mime {
        return Err(ValidationError::InvalidFile(format!(
            "MIME type '{}' does not match detected type '{}' for {:?}",
            declared_mime_type, expected_mime, detected_type
        )));
    }

    Ok(())
}

/// Detect SQL injection patterns in input
/// **Validates: Requirements 15.7**
///
/// This is defense-in-depth. Primary defense is SQLx parameterized queries (Requirement 15.8).
///
/// Detects common SQL injection patterns:
/// - ' OR '1'='1
/// - '; DROP TABLE
/// - UNION SELECT
/// - -- (SQL comment)
/// - /* */ (SQL comment)
/// - xp_ (SQL Server extended procedures)
///
/// # Arguments
/// * `input` - Input string to check
///
/// # Returns
/// * `Ok(())` - If no SQL injection patterns detected
/// * `Err(ValidationError::SecurityViolation)` - If SQL injection pattern detected
///
/// # Examples
/// ```
/// use tridjaya_backend::validation::detect_sql_injection;
///
/// assert!(detect_sql_injection("Hello World").is_ok());
/// assert!(detect_sql_injection("' OR '1'='1").is_err());
/// assert!(detect_sql_injection("'; DROP TABLE users--").is_err());
/// ```
pub fn detect_sql_injection(input: &str) -> Result<(), ValidationError> {
    let input_lower = input.to_lowercase();

    // Common SQL injection patterns
    let patterns = [
        // Classic injection
        "' or '1'='1",
        "' or 'a'='a",
        "' or 1=1",
        "\" or \"1\"=\"1",
        "\" or 1=1",
        // Command injection
        "'; drop table",
        "\"; drop table",
        "'; delete from",
        "\"; delete from",
        "'; update ",
        "\"; update ",
        // Union-based injection
        " union select",
        " union all select",
        // Comment-based injection
        "--",
        "/*",
        "*/",
        // Stacked queries
        "'; exec",
        "\"; exec",
        "'; execute",
        "\"; execute",
        // SQL Server extended procedures
        "xp_cmdshell",
        "xp_",
        // Time-based blind injection
        "waitfor delay",
        "sleep(",
        "benchmark(",
    ];

    for pattern in &patterns {
        if input_lower.contains(pattern) {
            tracing::warn!("SQL injection pattern detected: '{}' in input", pattern);
            return Err(ValidationError::SecurityViolation(format!(
                "Potential SQL injection detected: pattern '{}'",
                pattern
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Phone number validation tests
    #[test]
    fn test_validate_phone_number_valid() {
        assert!(validate_phone_number("+6281234567890").is_ok());
        assert!(validate_phone_number("+12025551234").is_ok());
        assert!(validate_phone_number("+442071234567").is_ok());
        assert!(validate_phone_number("+919876543210").is_ok());
        assert!(validate_phone_number("+861234567890").is_ok());
    }

    #[test]
    fn test_validate_phone_number_invalid() {
        // Missing +
        assert!(validate_phone_number("081234567890").is_err());
        assert!(validate_phone_number("6281234567890").is_err());

        // Starts with 0
        assert!(validate_phone_number("+0812345").is_err());

        // Contains spaces
        assert!(validate_phone_number("+62 812 3456 7890").is_err());

        // Contains dashes
        assert!(validate_phone_number("+62-812-3456-7890").is_err());

        // Too short
        assert!(validate_phone_number("+1").is_err());

        // Too long (more than 15 digits)
        assert!(validate_phone_number("+12345678901234567").is_err());

        // Empty
        assert!(validate_phone_number("").is_err());
        assert!(validate_phone_number("   ").is_err());
    }

    // Message sanitization tests
    #[test]
    fn test_sanitize_message_preserves_normal_text() {
        let msg = "Hello World";
        assert_eq!(sanitize_message(msg), msg);

        let msg = "Hello\nWorld\tTest";
        assert_eq!(sanitize_message(msg), msg);

        let msg = "Line1\r\nLine2";
        assert_eq!(sanitize_message(msg), msg);
    }

    #[test]
    fn test_sanitize_message_removes_control_chars() {
        let msg_with_control = "Hello\x00World\x01Test";
        assert_eq!(sanitize_message(msg_with_control), "HelloWorldTest");

        let msg_with_bell = "Hello\x07World";
        assert_eq!(sanitize_message(msg_with_bell), "HelloWorld");

        let msg_with_escape = "Hello\x1bWorld";
        assert_eq!(sanitize_message(msg_with_escape), "HelloWorld");
    }

    #[test]
    fn test_sanitize_message_preserves_unicode() {
        let msg_unicode = "Hello 世界 🌍";
        assert_eq!(sanitize_message(msg_unicode), msg_unicode);

        let msg_arabic = "مرحبا بك";
        assert_eq!(sanitize_message(msg_arabic), msg_arabic);

        let msg_emoji = "Hello 👋 World 🌟";
        assert_eq!(sanitize_message(msg_emoji), msg_emoji);
    }

    // Webhook URL validation tests
    #[test]
    fn test_validate_webhook_url_valid() {
        assert!(validate_webhook_url("https://example.com/webhook").is_ok());
        assert!(validate_webhook_url("http://localhost:3000/webhook").is_ok());
        assert!(validate_webhook_url("https://api.example.com/v1/webhooks/incoming").is_ok());
        assert!(validate_webhook_url("http://192.168.1.100:8080/hook").is_ok());
    }

    #[test]
    fn test_validate_webhook_url_invalid_scheme() {
        assert!(validate_webhook_url("file:///etc/passwd").is_err());
        assert!(validate_webhook_url("ftp://example.com/file").is_err());
        assert!(validate_webhook_url("javascript:alert(1)").is_err());
        assert!(validate_webhook_url("data:text/html,<script>alert(1)</script>").is_err());
    }

    #[test]
    fn test_validate_webhook_url_malformed() {
        assert!(validate_webhook_url("not a url").is_err());
        assert!(validate_webhook_url("").is_err());
        assert!(validate_webhook_url("://missing-scheme").is_err());
    }

    // File upload validation tests
    #[test]
    fn test_validate_file_upload_jpeg() {
        // JPEG magic bytes: FF D8 FF E0
        let jpeg_data = vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        ];
        assert!(validate_file_upload(&jpeg_data, "jpg", "image/jpeg").is_ok());
        assert!(validate_file_upload(&jpeg_data, "jpeg", "image/jpeg").is_ok());
    }

    #[test]
    fn test_validate_file_upload_png() {
        // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        ];
        assert!(validate_file_upload(&png_data, "png", "image/png").is_ok());
    }

    #[test]
    fn test_validate_file_upload_webp() {
        // WebP magic bytes: RIFF + WEBP
        let webp_data = vec![
            0x52, 0x49, 0x46, 0x46, // RIFF
            0x00, 0x00, 0x00, 0x00, // Size (placeholder)
            0x57, 0x45, 0x42, 0x50, // WEBP
        ];
        assert!(validate_file_upload(&webp_data, "webp", "image/webp").is_ok());
    }

    #[test]
    fn test_validate_file_upload_pdf() {
        // PDF magic bytes: %PDF
        let pdf_data = vec![
            0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xC2, 0xA5,
        ];
        assert!(validate_file_upload(&pdf_data, "pdf", "application/pdf").is_ok());
    }

    #[test]
    fn test_validate_file_upload_mp4() {
        // MP4 magic bytes: ftyp at offset 4
        let mp4_data = vec![
            0x00, 0x00, 0x00, 0x20, // Size
            0x66, 0x74, 0x79, 0x70, // ftyp
            0x69, 0x73, 0x6F, 0x6D, // isom
        ];
        assert!(validate_file_upload(&mp4_data, "mp4", "video/mp4").is_ok());
    }

    #[test]
    fn test_validate_file_upload_extension_mismatch() {
        // PNG data with JPEG extension
        let png_data = vec![
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        ];
        assert!(validate_file_upload(&png_data, "jpg", "image/jpeg").is_err());
    }

    #[test]
    fn test_validate_file_upload_mime_mismatch() {
        // JPEG data with PNG MIME type
        let jpeg_data = vec![
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        ];
        assert!(validate_file_upload(&jpeg_data, "jpg", "image/png").is_err());
    }

    #[test]
    fn test_validate_file_upload_too_small() {
        let small_data = vec![0xFF, 0xD8];
        assert!(validate_file_upload(&small_data, "jpg", "image/jpeg").is_err());
    }

    #[test]
    fn test_validate_file_upload_unsupported_type() {
        // GIF magic bytes (not supported)
        let gif_data = vec![
            0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ];
        assert!(validate_file_upload(&gif_data, "gif", "image/gif").is_err());
    }

    // SQL injection detection tests
    #[test]
    fn test_detect_sql_injection_safe_input() {
        assert!(detect_sql_injection("Hello World").is_ok());
        assert!(detect_sql_injection("user@example.com").is_ok());
        assert!(detect_sql_injection("+6281234567890").is_ok());
        assert!(detect_sql_injection("Product name with spaces").is_ok());
    }

    #[test]
    fn test_detect_sql_injection_classic_patterns() {
        assert!(detect_sql_injection("' OR '1'='1").is_err());
        assert!(detect_sql_injection("' or 1=1").is_err());
        assert!(detect_sql_injection("\" OR \"1\"=\"1").is_err());
        assert!(detect_sql_injection("admin' --").is_err());
    }

    #[test]
    fn test_detect_sql_injection_command_injection() {
        assert!(detect_sql_injection("'; DROP TABLE users--").is_err());
        assert!(detect_sql_injection("'; DELETE FROM products").is_err());
        assert!(detect_sql_injection("'; UPDATE users SET role='admin'").is_err());
    }

    #[test]
    fn test_detect_sql_injection_union_based() {
        assert!(detect_sql_injection("1 UNION SELECT * FROM users").is_err());
        assert!(detect_sql_injection("1 UNION ALL SELECT password FROM users").is_err());
    }

    #[test]
    fn test_detect_sql_injection_comments() {
        assert!(detect_sql_injection("admin'--").is_err());
        assert!(detect_sql_injection("admin'/*").is_err());
        assert!(detect_sql_injection("admin'*/").is_err());
    }

    #[test]
    fn test_detect_sql_injection_case_insensitive() {
        assert!(detect_sql_injection("' OR '1'='1").is_err());
        assert!(detect_sql_injection("' or '1'='1").is_err());
        assert!(detect_sql_injection("' Or '1'='1").is_err());
    }

    #[test]
    fn test_detect_sql_injection_extended_procedures() {
        assert!(detect_sql_injection("'; EXEC xp_cmdshell 'dir'").is_err());
        assert!(detect_sql_injection("xp_cmdshell").is_err());
    }

    #[test]
    fn test_detect_sql_injection_time_based() {
        assert!(detect_sql_injection("'; WAITFOR DELAY '00:00:05'--").is_err());
        assert!(detect_sql_injection("' AND SLEEP(5)--").is_err());
        assert!(detect_sql_injection("' AND BENCHMARK(1000000,MD5('A'))--").is_err());
    }
}
