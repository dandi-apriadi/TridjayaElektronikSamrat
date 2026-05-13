use redis::AsyncCommands;
/**
 * Chatbot Engine with Keyword Matching
 *
 * This module provides auto-reply functionality based on keyword matching rules.
 * It processes incoming messages before webhook forwarding for fast response times.
 *
 * Features:
 * - Multiple match modes: exact, contains, starts_with, ends_with, regex
 * - Priority-based rule selection (lowest priority number wins)
 * - Variable replacement in reply templates using regex captured groups
 * - Cooldown tracking per sender per rule using Redis
 * - Auto-reply sending via bridge (2 second target)
 * - Execution logging to wa_chatbot_logs table
 */
use regex::Regex;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::time::Instant;
use tracing::{debug, error, info, warn};

use crate::bridge::BridgeClient;

/// Match mode for chatbot rules
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "TEXT")]
pub enum MatchMode {
    #[serde(rename = "exact")]
    Exact,
    #[serde(rename = "contains")]
    Contains,
    #[serde(rename = "starts_with")]
    StartsWith,
    #[serde(rename = "ends_with")]
    EndsWith,
    #[serde(rename = "regex")]
    Regex,
}

impl std::fmt::Display for MatchMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MatchMode::Exact => write!(f, "exact"),
            MatchMode::Contains => write!(f, "contains"),
            MatchMode::StartsWith => write!(f, "starts_with"),
            MatchMode::EndsWith => write!(f, "ends_with"),
            MatchMode::Regex => write!(f, "regex"),
        }
    }
}

impl std::str::FromStr for MatchMode {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "exact" => Ok(MatchMode::Exact),
            "contains" => Ok(MatchMode::Contains),
            "starts_with" => Ok(MatchMode::StartsWith),
            "ends_with" => Ok(MatchMode::EndsWith),
            "regex" => Ok(MatchMode::Regex),
            _ => Err(format!("Invalid match mode: {}", s)),
        }
    }
}

/// Chatbot rule from database
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChatbotRule {
    pub id: String,
    pub account_id: String,
    pub keyword: String,
    pub match_mode: String,
    pub reply_template: String,
    pub priority: i32,
    pub cooldown_seconds: i32,
    pub enabled: bool,
}

/// Match result with captured groups
#[derive(Debug, Clone)]
pub struct MatchResult {
    pub rule: ChatbotRule,
    pub captured_groups: HashMap<String, String>,
}

/// Chatbot engine configuration
#[derive(Debug, Clone)]
pub struct ChatbotEngineConfig {
    /// Redis URL for cooldown tracking
    pub redis_url: String,
    /// Maximum time to process and send auto-reply (target: 2 seconds)
    pub max_response_time: Duration,
}

impl Default for ChatbotEngineConfig {
    fn default() -> Self {
        Self {
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string()),
            max_response_time: Duration::from_secs(2),
        }
    }
}

/// Chatbot engine for auto-reply functionality
pub struct ChatbotEngine {
    config: ChatbotEngineConfig,
    pool: SqlitePool,
    bridge: Arc<BridgeClient>,
    redis_client: redis::Client,
}

impl ChatbotEngine {
    /// Create a new chatbot engine
    pub fn new(
        config: ChatbotEngineConfig,
        pool: SqlitePool,
        bridge: Arc<BridgeClient>,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        let redis_client = redis::Client::open(config.redis_url.as_str())?;

        Ok(Self {
            config,
            pool,
            bridge,
            redis_client,
        })
    }

    /// Process an incoming message and execute matching chatbot rules
    /// Returns true if a rule was executed, false otherwise
    pub async fn process_message(
        &self,
        account_id: &str,
        sender_phone: &str,
        message_text: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let start_time = Instant::now();

        debug!(
            account_id = %account_id,
            sender = %sender_phone,
            message = %message_text,
            "Processing message for chatbot rules"
        );

        // Fetch active rules for this account
        let rules = self.fetch_active_rules(account_id).await?;

        if rules.is_empty() {
            debug!(account_id = %account_id, "No active chatbot rules found");
            return Ok(false);
        }

        // Find matching rule with highest priority (lowest priority number)
        let match_result = self.find_matching_rule(&rules, message_text)?;

        if let Some(match_result) = match_result {
            let rule = &match_result.rule;

            debug!(
                rule_id = %rule.id,
                priority = rule.priority,
                match_mode = %rule.match_mode,
                "Found matching rule"
            );

            // Check cooldown
            if self
                .is_in_cooldown(account_id, sender_phone, &rule.id)
                .await?
            {
                info!(
                    rule_id = %rule.id,
                    sender = %sender_phone,
                    cooldown = rule.cooldown_seconds,
                    "Skipping auto-reply due to cooldown"
                );
                return Ok(false);
            }

            // Generate reply with variable replacement
            let reply = self.generate_reply(&rule.reply_template, &match_result.captured_groups);

            // Send auto-reply via bridge
            let send_result = self.send_auto_reply(account_id, sender_phone, &reply).await;

            match send_result {
                Ok(_) => {
                    let elapsed = start_time.elapsed();

                    info!(
                        rule_id = %rule.id,
                        sender = %sender_phone,
                        elapsed_ms = elapsed.as_millis(),
                        "Auto-reply sent successfully"
                    );

                    // Log execution
                    self.log_execution(
                        &rule.id,
                        account_id,
                        sender_phone,
                        &rule.keyword,
                        &reply,
                        elapsed.as_millis(),
                    )
                    .await?;

                    // Set cooldown
                    if rule.cooldown_seconds > 0 {
                        self.set_cooldown(
                            account_id,
                            sender_phone,
                            &rule.id,
                            rule.cooldown_seconds,
                        )
                        .await?;
                    }

                    // Warn if response time exceeded target
                    if elapsed > self.config.max_response_time {
                        warn!(
                            rule_id = %rule.id,
                            elapsed_ms = elapsed.as_millis(),
                            target_ms = self.config.max_response_time.as_millis(),
                            "Auto-reply exceeded target response time"
                        );
                    }

                    Ok(true)
                }
                Err(e) => {
                    error!(
                        rule_id = %rule.id,
                        sender = %sender_phone,
                        error = %e,
                        "Failed to send auto-reply"
                    );
                    Err(e)
                }
            }
        } else {
            debug!(
                account_id = %account_id,
                message = %message_text,
                "No matching chatbot rule found"
            );
            Ok(false)
        }
    }

    /// Fetch active chatbot rules for an account, sorted by priority
    async fn fetch_active_rules(&self, account_id: &str) -> Result<Vec<ChatbotRule>, sqlx::Error> {
        sqlx::query_as::<_, ChatbotRule>(
            r#"
            SELECT id, account_id, keyword, match_mode, reply_template, priority, cooldown_seconds, enabled
            FROM wa_chatbot_rules
            WHERE account_id = ? AND enabled = 1
            ORDER BY priority ASC, created_at ASC
            "#
        )
        .bind(account_id)
        .fetch_all(&self.pool)
        .await
    }

    /// Find the first matching rule (highest priority = lowest priority number)
    fn find_matching_rule(
        &self,
        rules: &[ChatbotRule],
        message_text: &str,
    ) -> Result<Option<MatchResult>, Box<dyn std::error::Error>> {
        for rule in rules {
            let match_mode = rule
                .match_mode
                .parse::<MatchMode>()
                .map_err(|e| format!("Invalid match mode '{}': {}", rule.match_mode, e))?;

            let captured_groups = match match_mode {
                MatchMode::Exact => {
                    if message_text == rule.keyword {
                        Some(HashMap::new())
                    } else {
                        None
                    }
                }
                MatchMode::Contains => {
                    if message_text.contains(&rule.keyword) {
                        Some(HashMap::new())
                    } else {
                        None
                    }
                }
                MatchMode::StartsWith => {
                    if message_text.starts_with(&rule.keyword) {
                        Some(HashMap::new())
                    } else {
                        None
                    }
                }
                MatchMode::EndsWith => {
                    if message_text.ends_with(&rule.keyword) {
                        Some(HashMap::new())
                    } else {
                        None
                    }
                }
                MatchMode::Regex => {
                    match Regex::new(&rule.keyword) {
                        Ok(re) => {
                            if let Some(captures) = re.captures(message_text) {
                                let mut groups = HashMap::new();

                                // Capture numbered groups (0 is full match)
                                for i in 0..captures.len() {
                                    if let Some(m) = captures.get(i) {
                                        groups.insert(i.to_string(), m.as_str().to_string());
                                    }
                                }

                                // Capture named groups
                                for name in re.capture_names().flatten() {
                                    if let Some(m) = captures.name(name) {
                                        groups.insert(name.to_string(), m.as_str().to_string());
                                    }
                                }

                                Some(groups)
                            } else {
                                None
                            }
                        }
                        Err(e) => {
                            warn!(
                                rule_id = %rule.id,
                                keyword = %rule.keyword,
                                error = %e,
                                "Invalid regex pattern in rule"
                            );
                            None
                        }
                    }
                }
            };

            if let Some(captured_groups) = captured_groups {
                return Ok(Some(MatchResult {
                    rule: rule.clone(),
                    captured_groups,
                }));
            }
        }

        Ok(None)
    }

    /// Generate reply by replacing variables in template with captured groups
    fn generate_reply(&self, template: &str, captured_groups: &HashMap<String, String>) -> String {
        let mut reply = template.to_string();

        // Replace {{0}}, {{1}}, {{2}}, etc. with captured groups
        for (key, value) in captured_groups {
            let placeholder = format!("{{{{{}}}}}", key);
            reply = reply.replace(&placeholder, value);
        }

        reply
    }

    /// Check if sender is in cooldown period for a specific rule
    async fn is_in_cooldown(
        &self,
        account_id: &str,
        sender_phone: &str,
        rule_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let cooldown_key = format!(
            "chatbot:cooldown:{}:{}:{}",
            account_id, sender_phone, rule_id
        );

        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;
        let exists: bool = conn.exists(&cooldown_key).await?;

        Ok(exists)
    }

    /// Set cooldown for sender and rule
    async fn set_cooldown(
        &self,
        account_id: &str,
        sender_phone: &str,
        rule_id: &str,
        cooldown_seconds: i32,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let cooldown_key = format!(
            "chatbot:cooldown:{}:{}:{}",
            account_id, sender_phone, rule_id
        );

        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;
        let _: () = conn
            .set_ex(&cooldown_key, "1", cooldown_seconds as u64)
            .await?;

        debug!(
            account_id = %account_id,
            sender = %sender_phone,
            rule_id = %rule_id,
            cooldown_seconds = cooldown_seconds,
            "Set cooldown"
        );

        Ok(())
    }

    /// Send auto-reply via bridge
    async fn send_auto_reply(
        &self,
        account_id: &str,
        target_phone: &str,
        message: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let params = serde_json::json!({
            "phone": target_phone,
            "message": message,
        });

        let result = self
            .bridge
            .send_request(account_id, "send_message".to_string(), params)
            .await?;

        debug!(
            account_id = %account_id,
            target = %target_phone,
            result = ?result,
            "Auto-reply sent via bridge"
        );

        Ok(())
    }

    /// Log chatbot execution to database
    async fn log_execution(
        &self,
        rule_id: &str,
        account_id: &str,
        sender_phone: &str,
        matched_keyword: &str,
        reply_sent: &str,
        response_time_ms: u128,
    ) -> Result<(), sqlx::Error> {
        let log_id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO wa_chatbot_logs (id, rule_id, account_id, sender_phone, matched_keyword, reply_sent, response_time_ms, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            "#
        )
        .bind(&log_id)
        .bind(rule_id)
        .bind(account_id)
        .bind(sender_phone)
        .bind(matched_keyword)
        .bind(reply_sent)
        .bind(response_time_ms as i64)
        .execute(&self.pool)
        .await?;

        debug!(
            log_id = %log_id,
            rule_id = %rule_id,
            response_time_ms = response_time_ms,
            "Logged chatbot execution"
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_match_mode_from_str() {
        assert_eq!("exact".parse::<MatchMode>().unwrap(), MatchMode::Exact);
        assert_eq!(
            "contains".parse::<MatchMode>().unwrap(),
            MatchMode::Contains
        );
        assert_eq!(
            "starts_with".parse::<MatchMode>().unwrap(),
            MatchMode::StartsWith
        );
        assert_eq!(
            "ends_with".parse::<MatchMode>().unwrap(),
            MatchMode::EndsWith
        );
        assert_eq!("regex".parse::<MatchMode>().unwrap(), MatchMode::Regex);

        assert!("invalid".parse::<MatchMode>().is_err());
    }

    #[test]
    fn test_match_mode_display() {
        assert_eq!(MatchMode::Exact.to_string(), "exact");
        assert_eq!(MatchMode::Contains.to_string(), "contains");
        assert_eq!(MatchMode::StartsWith.to_string(), "starts_with");
        assert_eq!(MatchMode::EndsWith.to_string(), "ends_with");
        assert_eq!(MatchMode::Regex.to_string(), "regex");
    }

    #[test]
    fn test_exact_match() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule("hello", "exact", "Hi there!", 1)];

        // Should match
        let result = engine.find_matching_rule(&rules, "hello").unwrap();
        assert!(result.is_some());

        // Should not match
        let result = engine.find_matching_rule(&rules, "hello world").unwrap();
        assert!(result.is_none());

        let result = engine.find_matching_rule(&rules, "Hello").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_contains_match() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule("help", "contains", "How can I help?", 1)];

        // Should match
        let result = engine.find_matching_rule(&rules, "I need help").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "help me").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "please help").unwrap();
        assert!(result.is_some());

        // Should not match
        let result = engine
            .find_matching_rule(&rules, "I need assistance")
            .unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_starts_with_match() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule("hello", "starts_with", "Hi!", 1)];

        // Should match
        let result = engine.find_matching_rule(&rules, "hello world").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "hello").unwrap();
        assert!(result.is_some());

        // Should not match
        let result = engine.find_matching_rule(&rules, "say hello").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_ends_with_match() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule("?", "ends_with", "Let me help!", 1)];

        // Should match
        let result = engine.find_matching_rule(&rules, "Can you help?").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "What is this?").unwrap();
        assert!(result.is_some());

        // Should not match
        let result = engine.find_matching_rule(&rules, "? I don't know").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_regex_match_simple() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule(r"hello|hi|hey", "regex", "Greetings!", 1)];

        // Should match
        let result = engine.find_matching_rule(&rules, "hello").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "hi there").unwrap();
        assert!(result.is_some());

        let result = engine.find_matching_rule(&rules, "hey you").unwrap();
        assert!(result.is_some());

        // Should not match
        let result = engine.find_matching_rule(&rules, "greetings").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_regex_match_with_capture_groups() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule(
            r"my name is (\w+)",
            "regex",
            "Hello {{1}}!",
            1,
        )];

        let result = engine
            .find_matching_rule(&rules, "my name is John")
            .unwrap();
        assert!(result.is_some());

        let match_result = result.unwrap();
        assert_eq!(
            match_result.captured_groups.get("0").unwrap(),
            "my name is John"
        );
        assert_eq!(match_result.captured_groups.get("1").unwrap(), "John");
    }

    #[test]
    fn test_regex_match_with_named_groups() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule(
            r"my name is (?P<name>\w+)",
            "regex",
            "Hello {{name}}!",
            1,
        )];

        let result = engine
            .find_matching_rule(&rules, "my name is Alice")
            .unwrap();
        assert!(result.is_some());

        let match_result = result.unwrap();
        assert_eq!(match_result.captured_groups.get("name").unwrap(), "Alice");
    }

    #[test]
    fn test_priority_based_selection() {
        let engine = create_test_engine();
        // Rules should be sorted by priority (ascending) before matching
        let mut rules = vec![
            create_test_rule("help", "contains", "Low priority", 100),
            create_test_rule("help", "contains", "High priority", 1),
            create_test_rule("help", "contains", "Medium priority", 50),
        ];

        // Sort by priority (ascending) to simulate database ORDER BY
        rules.sort_by_key(|r| r.priority);

        let result = engine.find_matching_rule(&rules, "I need help").unwrap();
        assert!(result.is_some());

        let match_result = result.unwrap();
        // Should select the rule with priority 1 (highest priority = lowest number)
        assert_eq!(match_result.rule.reply_template, "High priority");
        assert_eq!(match_result.rule.priority, 1);
    }

    #[test]
    fn test_generate_reply_with_captured_groups() {
        let engine = create_test_engine();

        let mut captured_groups = HashMap::new();
        captured_groups.insert("0".to_string(), "Hello John".to_string());
        captured_groups.insert("1".to_string(), "John".to_string());
        captured_groups.insert("name".to_string(), "John".to_string());

        let template = "Hi {{name}}, you said: {{0}}";
        let reply = engine.generate_reply(template, &captured_groups);

        assert_eq!(reply, "Hi John, you said: Hello John");
    }

    #[test]
    fn test_generate_reply_multiple_variables() {
        let engine = create_test_engine();

        let mut captured_groups = HashMap::new();
        captured_groups.insert("1".to_string(), "Alice".to_string());
        captured_groups.insert("2".to_string(), "Bob".to_string());

        let template = "{{1}} and {{2}} are friends";
        let reply = engine.generate_reply(template, &captured_groups);

        assert_eq!(reply, "Alice and Bob are friends");
    }

    #[test]
    fn test_generate_reply_no_variables() {
        let engine = create_test_engine();

        let captured_groups = HashMap::new();
        let template = "Hello, how can I help you?";
        let reply = engine.generate_reply(template, &captured_groups);

        assert_eq!(reply, "Hello, how can I help you?");
    }

    #[test]
    fn test_generate_reply_missing_variable() {
        let engine = create_test_engine();

        let captured_groups = HashMap::new();
        let template = "Hi {{name}}, welcome!";
        let reply = engine.generate_reply(template, &captured_groups);

        // Variable not replaced if not in captured_groups
        assert_eq!(reply, "Hi {{name}}, welcome!");
    }

    #[test]
    fn test_invalid_regex_pattern() {
        let engine = create_test_engine();
        let rules = vec![create_test_rule(r"[invalid(regex", "regex", "Reply", 1)];

        // Should not panic, should return None
        let result = engine.find_matching_rule(&rules, "test message").unwrap();
        assert!(result.is_none());
    }

    // Helper functions for tests

    fn create_test_engine() -> ChatbotEngine {
        let config = ChatbotEngineConfig::default();
        let redis_client = redis::Client::open("redis://127.0.0.1:6379").unwrap();

        ChatbotEngine {
            config,
            pool: create_test_pool(),
            bridge: Arc::new(BridgeClient::default()),
            redis_client,
        }
    }

    fn create_test_pool() -> SqlitePool {
        use sqlx::sqlite::SqlitePoolOptions;

        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            SqlitePoolOptions::new()
                .max_connections(1)
                .connect("sqlite::memory:")
                .await
                .unwrap()
        })
    }

    fn create_test_rule(
        keyword: &str,
        match_mode: &str,
        reply: &str,
        priority: i32,
    ) -> ChatbotRule {
        ChatbotRule {
            id: uuid::Uuid::new_v4().to_string(),
            account_id: "test_account".to_string(),
            keyword: keyword.to_string(),
            match_mode: match_mode.to_string(),
            reply_template: reply.to_string(),
            priority,
            cooldown_seconds: 0,
            enabled: true,
        }
    }
}
