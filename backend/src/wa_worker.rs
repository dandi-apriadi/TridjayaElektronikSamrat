use std::time::Duration;
use sqlx::{Row, SqlitePool};
use serde_json::{json, Value};
use crate::state::AppState;
use crate::fonnte::{FonnteClient, FonnteAccountConfig, FonnteSendRequest};
use crate::wa_dispatcher::{self, WaDispatchConfig};

pub async fn start_wa_worker(state: AppState) {
    tracing::info!("WA Blast Worker started");
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    let fonnte = FonnteClient::new();
    
    loop {
        interval.tick().await;
        if let Err(e) = process_campaigns(&state, &fonnte).await {
            tracing::error!("WA Worker error in process_campaigns: {}", e);
        }
    }
}

async fn process_campaigns(state: &AppState, fonnte: &FonnteClient) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // 1. Get running campaigns
    let running_campaigns = sqlx::query("SELECT id, config FROM wa_campaigns WHERE status = 'running'")
        .fetch_all(&state.pool)
        .await?;
        
    if running_campaigns.is_empty() {
        return Ok(());
    }

    // 2. Get available accounts
    let accounts = fetch_enabled_accounts(&state.pool).await?;
    if accounts.is_empty() {
        tracing::warn!("No enabled WA accounts available for dispatching");
        return Ok(());
    }

    for row in running_campaigns {
        let campaign_id: String = row.get("id");
        let config_raw: Option<String> = row.get("config");
        let campaign_config: Value = config_raw.and_then(|c| serde_json::from_str(&c).ok()).unwrap_or(json!({}));
        
        // 3. Process recipients for this campaign
        process_single_campaign(state, fonnte, &campaign_id, &campaign_config, &accounts).await?;
        
        // 4. Check if campaign is finished
        check_campaign_completion(&state.pool, &campaign_id).await?;
    }
    
    Ok(())
}

async fn fetch_enabled_accounts(pool: &SqlitePool) -> Result<Vec<FonnteAccountConfig>, Box<dyn std::error::Error + Send + Sync>> {
    let rows = sqlx::query("SELECT name, gateway_config FROM wa_accounts WHERE enabled = 1")
        .fetch_all(pool)
        .await?;
        
    let mut configs = Vec::new();
    for row in rows {
        let name: String = row.get("name");
        let gateway_config_raw: Option<String> = row.get("gateway_config");
        let gateway_config: Value = gateway_config_raw.and_then(|c| serde_json::from_str(&c).ok()).unwrap_or(json!({}));
        
        if let Some(token) = gateway_config.get("token").and_then(|t| t.as_str()) {
            configs.push(FonnteAccountConfig::new(name, token));
        }
    }
    Ok(configs)
}

async fn process_single_campaign(
    state: &AppState,
    fonnte: &FonnteClient,
    campaign_id: &str,
    campaign_config: &Value,
    accounts: &[FonnteAccountConfig]
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Get pending recipients
    // We process in small batches to avoid blocking the loop
    let recipients = sqlx::query("SELECT id, phone, variables_json FROM wa_recipients WHERE campaign_id = ? AND status = 'pending' LIMIT 5")
        .fetch_all(&state.pool)
        .await?;
        
    if recipients.is_empty() {
        return Ok(());
    }

    let message_template = campaign_config.get("message_template")
        .and_then(|v| v.as_str())
        .unwrap_or("Halo, ini pesan dari Tridjaya.");

    let dispatch_config = WaDispatchConfig::default(); // Could be loaded from campaign_config later

    for (i, row) in recipients.into_iter().enumerate() {
        let recipient_id: String = row.get("id");
        let phone: String = row.get("phone");
        let vars_raw: Option<String> = row.get("variables_json");
        let vars: Value = vars_raw.and_then(|v| serde_json::from_str(&v).ok()).unwrap_or(json!({}));
        
        // Build message from template
        let message = replace_variables(message_template, &vars);
        
        // Pick account (round robin for now)
        let account_index = i % accounts.len();
        let account = &accounts[account_index];
        
        // Dispatch planning
        let plan = wa_dispatcher::build_dispatch_plan(i as u64, account_index, &dispatch_config, accounts.len());
        
        // Wait according to plan (simulated jitter/delay)
        tokio::time::sleep(plan.delay).await;

        // Send via Fonnte
        let send_req = FonnteSendRequest {
            target: &phone,
            message: &message,
            delay: Some(2), // Fonnte's internal delay
            schedule: None,
            country_code: Some("62"),
        };
        
        match fonnte.send_text(account, send_req).await {
            Ok(resp) if resp.status => {
                // Success
                sqlx::query("UPDATE wa_recipients SET status = 'sent', last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(&recipient_id)
                    .execute(&state.pool)
                    .await?;
                    
                let message_id_str: Option<String> = resp.data.as_ref()
                    .and_then(|d| d.get("id").or_else(|| d.as_array().and_then(|a| a.get(0).and_then(|m| m.get("id")))))
                    .and_then(|id| id.as_str().map(|s| s.to_string()).or_else(|| id.as_i64().map(|n| n.to_string())));
                
                log_dispatch(&state.pool, campaign_id, &recipient_id, &phone, &account.name, "success", None, message_id_str.as_deref()).await?;
            }
            Ok(resp) => {
                // Fonnte returned error
                let error_msg = resp.message.unwrap_or_else(|| "Unknown Fonnte error".to_string());
                sqlx::query("UPDATE wa_recipients SET status = 'failed', last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(&recipient_id)
                    .execute(&state.pool)
                    .await?;
                    
                log_dispatch(&state.pool, campaign_id, &recipient_id, &phone, &account.name, "failed", Some(error_msg), None).await?;
            }
            Err(e) => {
                // Network or other error
                tracing::error!("Failed to send WA to {}: {}", phone, e);
                // Don't update status to failed yet, maybe retry later? 
                // For now, let's mark as failed to avoid infinite loops
                sqlx::query("UPDATE wa_recipients SET status = 'failed', last_attempt_at = CURRENT_TIMESTAMP WHERE id = ?")
                    .bind(&recipient_id)
                    .execute(&state.pool)
                    .await?;
                    
                log_dispatch(&state.pool, campaign_id, &recipient_id, &phone, &account.name, "error", Some(e.to_string()), None).await?;
            }
        }
    }
    
    Ok(())
}

fn replace_variables(template: &str, vars: &Value) -> String {
    let mut result = template.to_string();
    if let Some(obj) = vars.as_object() {
        for (k, v) in obj {
            let placeholder = format!("{{{{{}}}}}", k); // {{key}}
            let value_str = match v {
                Value::String(s) => s.clone(),
                Value::Number(n) => n.to_string(),
                _ => v.to_string(),
            };
            result = result.replace(&placeholder, &value_str);
        }
    }
    result
}

async fn log_dispatch(
    pool: &SqlitePool,
    campaign_id: &str,
    recipient_id: &str,
    phone: &str,
    account_name: &str,
    status: &str,
    error: Option<String>,
    message_id: Option<&str>
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO wa_dispatch_logs (id, campaign_id, recipient_id, phone, wa_account_id, status, meta, message_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(campaign_id)
    .bind(recipient_id)
    .bind(phone)
    .bind(account_name)
    .bind(status)
    .bind(error.map(|e| json!({ "error": e }).to_string()))
    .bind(message_id)
    .execute(pool)
    .await?;
    
    Ok(())
}

async fn check_campaign_completion(pool: &SqlitePool, campaign_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let pending_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM wa_recipients WHERE campaign_id = ? AND status = 'pending'")
        .bind(campaign_id)
        .fetch_one(pool)
        .await?;
        
    if pending_count.0 == 0 {
        sqlx::query("UPDATE wa_campaigns SET status = 'completed' WHERE id = ?")
            .bind(campaign_id)
            .execute(pool)
            .await?;
        tracing::info!("Campaign {} completed", campaign_id);
    }
    
    Ok(())
}
