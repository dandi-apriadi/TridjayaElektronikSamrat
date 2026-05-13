/**
 * Integration Tests for Input Validation Module
 *
 * **Validates: Requirements 15.1, 15.3, 15.7**
 *
 * This test suite provides comprehensive integration testing for:
 * - Phone number validation (E.164 format) - Requirement 15.1
 * - Webhook URL validation (HTTP/HTTPS only) - Requirement 15.3
 * - SQL injection pattern detection - Requirement 15.7
 */
use tridjaya_backend::validation::{
    detect_sql_injection, validate_phone_number, validate_webhook_url, ValidationError,
};

// ============================================================================
// Phone Number Validation Tests (Requirement 15.1)
// ============================================================================

#[test]
fn test_phone_validation_e164_format_valid() {
    // Valid E.164 formats from different countries
    let valid_numbers = vec![
        "+6281234567890", // Indonesia
        "+12025551234",   // USA
        "+442071234567",  // UK
        "+919876543210",  // India
        "+861234567890",  // China
        "+33123456789",   // France
        "+49301234567",   // Germany
        "+81312345678",   // Japan
        "+5511987654321", // Brazil
        "+27123456789",   // South Africa
    ];

    for number in valid_numbers {
        assert!(
            validate_phone_number(number).is_ok(),
            "Expected {} to be valid E.164 format",
            number
        );
    }
}

#[test]
fn test_phone_validation_missing_plus_prefix() {
    // Missing + prefix should fail
    let invalid_numbers = vec!["6281234567890", "12025551234", "081234567890"];

    for number in invalid_numbers {
        assert!(
            validate_phone_number(number).is_err(),
            "Expected {} to fail without + prefix",
            number
        );
    }
}

#[test]
fn test_phone_validation_starts_with_zero() {
    // E.164 country codes cannot start with 0
    let invalid_numbers = vec!["+0812345678", "+0123456789"];

    for number in invalid_numbers {
        assert!(
            validate_phone_number(number).is_err(),
            "Expected {} to fail (country code starts with 0)",
            number
        );
    }
}

#[test]
fn test_phone_validation_contains_formatting() {
    // E.164 should not contain spaces, dashes, or parentheses
    let invalid_numbers = vec![
        "+62 812 3456 7890",
        "+62-812-3456-7890",
        "+1 (202) 555-1234",
        "+44 (0) 20 7123 4567",
    ];

    for number in invalid_numbers {
        assert!(
            validate_phone_number(number).is_err(),
            "Expected {} to fail (contains formatting)",
            number
        );
    }
}

#[test]
fn test_phone_validation_length_boundaries() {
    // Too short (less than minimum)
    assert!(validate_phone_number("+1").is_err());
    assert!(validate_phone_number("+12").is_err());

    // Valid minimum length (country code + 1 digit)
    assert!(validate_phone_number("+123").is_ok());

    // Valid maximum length (15 digits total)
    assert!(validate_phone_number("+123456789012345").is_ok());

    // Too long (more than 15 digits)
    assert!(validate_phone_number("+1234567890123456").is_err());
    assert!(validate_phone_number("+12345678901234567890").is_err());
}

#[test]
fn test_phone_validation_whitespace_handling() {
    // Leading/trailing whitespace should be trimmed
    assert!(validate_phone_number("  +6281234567890  ").is_ok());
    assert!(validate_phone_number("\t+6281234567890\n").is_ok());

    // But internal whitespace should fail
    assert!(validate_phone_number("+62 81234567890").is_err());
}

#[test]
fn test_phone_validation_non_numeric() {
    // Contains letters or special characters
    let invalid_numbers = vec![
        "+62abc1234567",
        "+62-812-345-678",
        "+62.812.345.678",
        "+62#812345678",
    ];

    for number in invalid_numbers {
        assert!(
            validate_phone_number(number).is_err(),
            "Expected {} to fail (non-numeric)",
            number
        );
    }
}

#[test]
fn test_phone_validation_empty_input() {
    assert!(validate_phone_number("").is_err());
    assert!(validate_phone_number("   ").is_err());
    assert!(validate_phone_number("\t\n").is_err());
}

// ============================================================================
// Webhook URL Validation Tests (Requirement 15.3)
// ============================================================================

#[test]
fn test_webhook_url_https_valid() {
    let valid_urls = vec![
        "https://example.com/webhook",
        "https://api.example.com/v1/webhooks",
        "https://subdomain.example.com:8443/hook",
        "https://example.com/webhook?token=abc123",
        "https://192.168.1.100/webhook",
        "https://[2001:db8::1]/webhook",
    ];

    for url in valid_urls {
        assert!(
            validate_webhook_url(url).is_ok(),
            "Expected {} to be valid HTTPS URL",
            url
        );
    }
}

#[test]
fn test_webhook_url_http_valid() {
    // HTTP should be allowed (for local development)
    let valid_urls = vec![
        "http://localhost:3000/webhook",
        "http://127.0.0.1:8080/hook",
        "http://192.168.1.100/webhook",
        "http://example.com/webhook",
    ];

    for url in valid_urls {
        assert!(
            validate_webhook_url(url).is_ok(),
            "Expected {} to be valid HTTP URL",
            url
        );
    }
}

#[test]
fn test_webhook_url_invalid_schemes() {
    // Only HTTP and HTTPS should be allowed
    let invalid_urls = vec![
        "file:///etc/passwd",
        "ftp://example.com/file",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "gopher://example.com",
        "telnet://example.com",
        "ssh://example.com",
        "ws://example.com/socket",
        "wss://example.com/socket",
    ];

    for url in invalid_urls {
        let result = validate_webhook_url(url);
        assert!(result.is_err(), "Expected {} to fail (invalid scheme)", url);

        // Verify error message mentions scheme
        if let Err(ValidationError::InvalidUrl(msg)) = result {
            assert!(
                msg.contains("scheme") || msg.contains("Invalid scheme"),
                "Error message should mention scheme issue: {}",
                msg
            );
        }
    }
}

#[test]
fn test_webhook_url_malformed() {
    let malformed_urls = vec![
        "not a url",
        "htp://typo.com",
        "://missing-scheme.com",
        "https://",
        "https:/",
        "",
        "   ",
    ];

    for url in malformed_urls {
        assert!(
            validate_webhook_url(url).is_err(),
            "Expected {} to fail (malformed)",
            url
        );
    }
}

#[test]
fn test_webhook_url_with_authentication() {
    // URLs with authentication should be valid
    assert!(validate_webhook_url("https://user:pass@example.com/webhook").is_ok());
    assert!(validate_webhook_url("https://token@api.example.com/hook").is_ok());
}

#[test]
fn test_webhook_url_with_query_and_fragment() {
    // URLs with query parameters and fragments should be valid
    assert!(validate_webhook_url("https://example.com/webhook?key=value&foo=bar").is_ok());
    assert!(validate_webhook_url("https://example.com/webhook#section").is_ok());
    assert!(validate_webhook_url("https://example.com/webhook?key=value#section").is_ok());
}

#[test]
fn test_webhook_url_edge_cases() {
    // Very long URL
    let long_path = "a".repeat(1000);
    let long_url = format!("https://example.com/{}", long_path);
    assert!(validate_webhook_url(&long_url).is_ok());

    // URL with special characters in path
    assert!(validate_webhook_url("https://example.com/webhook/%20space").is_ok());
    assert!(validate_webhook_url("https://example.com/webhook/path%2Fencoded").is_ok());
}

// ============================================================================
// SQL Injection Detection Tests (Requirement 15.7)
// ============================================================================

#[test]
fn test_sql_injection_safe_inputs() {
    let safe_inputs = vec![
        "Hello World",
        "user@example.com",
        "+6281234567890",
        "Product name with spaces",
        "Price: $99.99",
        "Order #12345",
        "Customer feedback: Great service!",
        "Address: 123 Main St, Apt 4B",
    ];

    for input in safe_inputs {
        assert!(
            detect_sql_injection(input).is_ok(),
            "Expected '{}' to be safe",
            input
        );
    }
}

#[test]
fn test_sql_injection_classic_patterns() {
    let malicious_inputs = vec![
        "' OR '1'='1",
        "' or '1'='1",
        "' OR 1=1",
        "' or 1=1",
        "\" OR \"1\"=\"1",
        "\" or 1=1",
        "admin' OR '1'='1' --",
        "' OR 'a'='a",
    ];

    for input in malicious_inputs {
        let result = detect_sql_injection(input);
        assert!(
            result.is_err(),
            "Expected '{}' to be detected as SQL injection",
            input
        );

        // Verify error is SecurityViolation
        assert!(matches!(result, Err(ValidationError::SecurityViolation(_))));
    }
}

#[test]
fn test_sql_injection_drop_table_attacks() {
    let malicious_inputs = vec![
        "'; DROP TABLE users--",
        "\"; DROP TABLE products;",
        "'; DROP TABLE users; --",
        "admin'; DROP TABLE users CASCADE; --",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (DROP TABLE)",
            input
        );
    }
}

#[test]
fn test_sql_injection_delete_attacks() {
    let malicious_inputs = vec![
        "'; DELETE FROM users",
        "\"; DELETE FROM products WHERE 1=1",
        "'; DELETE FROM orders; --",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (DELETE)",
            input
        );
    }
}

#[test]
fn test_sql_injection_update_attacks() {
    let malicious_inputs = vec![
        "'; UPDATE users SET role='admin'",
        "\"; UPDATE products SET price=0",
        "'; UPDATE users SET password='hacked' WHERE 1=1; --",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (UPDATE)",
            input
        );
    }
}

#[test]
fn test_sql_injection_union_based() {
    let malicious_inputs = vec![
        "1 UNION SELECT * FROM users",
        "1 UNION ALL SELECT password FROM users",
        "' UNION SELECT null, username, password FROM users--",
        "1' UNION SELECT table_name FROM information_schema.tables--",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (UNION)",
            input
        );
    }
}

#[test]
fn test_sql_injection_comment_based() {
    let malicious_inputs = vec![
        "admin'--",
        "admin'/*",
        "admin'*/",
        "' OR 1=1--",
        "' OR 1=1/*",
        "' OR 1=1 #",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (comment)",
            input
        );
    }
}

#[test]
fn test_sql_injection_stacked_queries() {
    let malicious_inputs = vec![
        "'; EXEC sp_executesql",
        "\"; EXECUTE immediate",
        "'; exec xp_cmdshell 'dir'",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (stacked query)",
            input
        );
    }
}

#[test]
fn test_sql_injection_extended_procedures() {
    let malicious_inputs = vec![
        "xp_cmdshell",
        "'; EXEC xp_cmdshell 'whoami'",
        "xp_regread",
        "xp_regwrite",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (extended procedure)",
            input
        );
    }
}

#[test]
fn test_sql_injection_time_based_blind() {
    let malicious_inputs = vec![
        "'; WAITFOR DELAY '00:00:05'--",
        "' AND SLEEP(5)--",
        "' AND BENCHMARK(1000000,MD5('A'))--",
        "1' WAITFOR DELAY '0:0:5'--",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (time-based blind)",
            input
        );
    }
}

#[test]
fn test_sql_injection_case_insensitive() {
    // SQL keywords should be detected regardless of case
    let malicious_inputs = vec![
        "' OR '1'='1",
        "' or '1'='1",
        "' Or '1'='1",
        "' oR '1'='1",
        "' UNION SELECT",
        "' union select",
        "' Union Select",
        "'; DROP TABLE",
        "'; drop table",
        "'; Drop Table",
    ];

    for input in malicious_inputs {
        assert!(
            detect_sql_injection(input).is_err(),
            "Expected '{}' to be detected (case insensitive)",
            input
        );
    }
}

#[test]
fn test_sql_injection_false_positives() {
    // These should NOT be flagged as SQL injection
    let safe_inputs = vec![
        "I don't like this", // Contains ' but not injection pattern
        "It's a beautiful day",
        "The price is $10 or $20",      // Contains "or" but not injection
        "Email me at user@example.com", // Contains @ but safe
    ];

    for input in safe_inputs {
        assert!(
            detect_sql_injection(input).is_ok(),
            "Expected '{}' to be safe (false positive check)",
            input
        );
    }
}

#[test]
fn test_sql_injection_empty_input() {
    // Empty input should be safe
    assert!(detect_sql_injection("").is_ok());
    assert!(detect_sql_injection("   ").is_ok());
}

// ============================================================================
// Cross-Validation Tests
// ============================================================================

#[test]
fn test_validation_error_types() {
    // Test that correct error types are returned
    let phone_err = validate_phone_number("invalid");
    assert!(matches!(
        phone_err,
        Err(ValidationError::InvalidPhoneNumber)
    ));

    let url_err = validate_webhook_url("file:///etc/passwd");
    assert!(matches!(url_err, Err(ValidationError::InvalidUrl(_))));

    let sql_err = detect_sql_injection("'; DROP TABLE users--");
    assert!(matches!(
        sql_err,
        Err(ValidationError::SecurityViolation(_))
    ));
}

#[test]
fn test_validation_combined_workflow() {
    // Simulate a typical workflow validating multiple inputs
    let phone = "+6281234567890";
    let webhook = "https://example.com/webhook";
    let message = "Hello, this is a test message";

    assert!(validate_phone_number(phone).is_ok());
    assert!(validate_webhook_url(webhook).is_ok());
    assert!(detect_sql_injection(message).is_ok());

    // Now with malicious inputs
    let bad_phone = "'; DROP TABLE--";
    let bad_webhook = "javascript:alert(1)";
    let bad_message = "' OR '1'='1";

    assert!(validate_phone_number(bad_phone).is_err());
    assert!(validate_webhook_url(bad_webhook).is_err());
    assert!(detect_sql_injection(bad_message).is_err());
}
