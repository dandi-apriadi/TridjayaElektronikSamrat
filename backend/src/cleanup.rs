use crate::{bridge::BridgeClient, queue_manager::QueueManager};
use chrono::{DateTime, Utc};
use redis::{aio::ConnectionManager, AsyncCommands};
use sqlx::SqlitePool;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tokio::time::{interval, timeout};
use tracing::{debug, error, info, warn};

#[derive(Debug, Clone)]
pub struct CleanupConfig {
    pub hourly_interval: Duration,
    pub webhook_log_retention_days: i64,
    pub dispatch_log_retention_days: i64,
    pub idle_connection_hours: i64,
    pub temp_file_retention_hours: i64,
    pub redis_cleanup_interval_hours: i64,
}

impl Default for CleanupConfig {
    fn default() -> Self {
        Self {
            hourly_interval: Duration::from_secs(3600),
            webhook_log_retention_days: 7,
            dispatch_log_retention_days: 30,
            idle_connection_hours: 2,
            temp_file_retention_hours: 24,
            redis_cleanup_interval_hours: 6,
        }
    }
}

#[derive(Debug, Default, Clone)]
pub struct CleanupReport {
    pub deleted_webhook_logs: u64,
    pub deleted_dispatch_logs: u64,
    pub deleted_redis_keys: usize,
    pub closed_connections: usize,
    pub deleted_temp_files: usize,
}

pub struct CleanupManager {
    pool: SqlitePool,
    redis: Option<Arc<RwLock<ConnectionManager>>>,
    queue_manager: Option<Arc<QueueManager>>,
    bridge: Option<Arc<BridgeClient>>,
    temp_media_dirs: Vec<PathBuf>,
    config: CleanupConfig,
    last_redis_cleanup: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl CleanupManager {
    pub fn new(
        pool: SqlitePool,
        redis: Option<Arc<RwLock<ConnectionManager>>>,
        queue_manager: Option<Arc<QueueManager>>,
        bridge: Option<Arc<BridgeClient>>,
        temp_media_dirs: Vec<PathBuf>,
    ) -> Self {
        Self {
            pool,
            redis,
            queue_manager,
            bridge,
            temp_media_dirs,
            config: CleanupConfig::default(),
            last_redis_cleanup: Arc::new(RwLock::new(None)),
        }
    }

    pub fn with_config(mut self, config: CleanupConfig) -> Self {
        self.config = config;
        self
    }

    pub async fn start_scheduler(self: Arc<Self>) {
        let mut ticker = interval(self.config.hourly_interval);

        loop {
            ticker.tick().await;

            if let Err(e) = self.run_once().await {
                error!(error = %e, "Cleanup job failed");
            }
        }
    }

    pub async fn run_once(&self) -> Result<CleanupReport, Box<dyn std::error::Error + Send + Sync>> {
        let mut report = CleanupReport::default();

        report.deleted_webhook_logs = self.cleanup_webhook_logs().await?;
        report.deleted_dispatch_logs = self.cleanup_dispatch_logs().await?;
        report.closed_connections = self.close_idle_whatsapp_connections().await?;
        report.deleted_temp_files = self.cleanup_temp_media_files().await?;

        if self.should_run_redis_cleanup().await {
            report.deleted_redis_keys = self.cleanup_redis_cache_entries().await?;
            *self.last_redis_cleanup.write().await = Some(Utc::now());
        }

        info!(
            deleted_webhook_logs = report.deleted_webhook_logs,
            deleted_dispatch_logs = report.deleted_dispatch_logs,
            deleted_redis_keys = report.deleted_redis_keys,
            closed_connections = report.closed_connections,
            deleted_temp_files = report.deleted_temp_files,
            "Cleanup run completed"
        );

        Ok(report)
    }

    pub async fn graceful_shutdown(&self, timeout_duration: Duration) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        info!(timeout_seconds = timeout_duration.as_secs(), "Starting graceful shutdown sequence");

        timeout(timeout_duration, async {
            self.drain_message_queue(timeout_duration).await?;
            self.close_all_whatsapp_connections().await?;
            Ok::<(), Box<dyn std::error::Error + Send + Sync>>(())
        })
        .await
        .map_err(|_| -> Box<dyn std::error::Error + Send + Sync> {
            "graceful shutdown timed out".into()
        })??;

        info!("Graceful shutdown completed");
        Ok(())
    }

    async fn should_run_redis_cleanup(&self) -> bool {
        let last = self.last_redis_cleanup.read().await;
        match *last {
            Some(last_run) => Utc::now().signed_duration_since(last_run).num_hours() >= self.config.redis_cleanup_interval_hours,
            None => true,
        }
    }

    async fn cleanup_webhook_logs(&self) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let deleted = sqlx::query("DELETE FROM wa_webhook_logs WHERE created_at < datetime('now', ?)")
            .bind(format!("-{} days", self.config.webhook_log_retention_days))
            .execute(&self.pool)
            .await?
            .rows_affected();

        debug!(deleted, "Deleted expired webhook logs");
        Ok(deleted)
    }

    async fn cleanup_dispatch_logs(&self) -> Result<u64, Box<dyn std::error::Error + Send + Sync>> {
        let deleted = sqlx::query(
            r#"
            DELETE FROM wa_dispatch_logs
            WHERE created_at < datetime('now', ?)
              AND campaign_id IN (SELECT id FROM wa_campaigns WHERE status = 'completed')
            "#,
        )
        .bind(format!("-{} days", self.config.dispatch_log_retention_days))
        .execute(&self.pool)
        .await?
        .rows_affected();

        debug!(deleted, "Deleted expired dispatch logs");
        Ok(deleted)
    }

    async fn cleanup_redis_cache_entries(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let Some(redis) = &self.redis else {
            return Ok(0);
        };

        let mut removed = 0usize;
        let mut conn = redis.write().await;

        for pattern in ["wa:media:*", "chatbot:cooldown:*", "bomber:cooldown:*", "ratelimit:*"] {
            let keys: Vec<String> = conn.keys(pattern).await.unwrap_or_default();

            for key in keys {
                let ttl = conn.ttl::<_, i64>(&key).await.unwrap_or(-2);
                if ttl == -1 {
                    let _: Result<(), redis::RedisError> = conn.del(&key).await;
                    removed += 1;
                }
            }
        }

        debug!(removed, "Cleaned up stale Redis cache entries");
        Ok(removed)
    }

    async fn close_idle_whatsapp_connections(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let threshold = Utc::now() - chrono::Duration::hours(self.config.idle_connection_hours);
        // Filter on `updated_at` (refreshed on every connection / disconnection /
        // session-persist event by SessionManager), NOT `created_at` — otherwise
        // every account whose row is older than `idle_connection_hours` would be
        // killed regardless of whether it had recent activity.
        let idle_accounts: Vec<String> = sqlx::query_scalar(
            r#"
            SELECT id
            FROM wa_accounts
            WHERE status = 'connected'
              AND datetime(updated_at) < datetime(?)
            "#,
        )
        .bind(threshold.to_rfc3339())
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let mut closed = 0usize;
        for account_id in idle_accounts {
            if let Some(bridge) = &self.bridge {
                if let Err(e) = bridge.kill_process(&account_id).await {
                    warn!(account_id = %account_id, error = %e, "Failed to close idle WhatsApp connection");
                    continue;
                }
            }

            let _ = sqlx::query("UPDATE wa_accounts SET status = 'disconnected' WHERE id = ?")
                .bind(&account_id)
                .execute(&self.pool)
                .await;

            closed += 1;
        }

        Ok(closed)
    }

    async fn close_all_whatsapp_connections(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let active_accounts: Vec<String> = sqlx::query_scalar(
            "SELECT id FROM wa_accounts WHERE status IN ('connected', 'waiting_for_scan', 'disconnected')",
        )
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        let mut closed = 0usize;
        for account_id in active_accounts {
            if let Some(bridge) = &self.bridge {
                let _ = bridge.kill_process(&account_id).await;
            }

            let _ = sqlx::query("UPDATE wa_accounts SET status = 'disconnected' WHERE id = ?")
                .bind(&account_id)
                .execute(&self.pool)
                .await;

            closed += 1;
        }

        Ok(closed)
    }

    async fn drain_message_queue(&self, timeout_duration: Duration) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let Some(queue_manager) = &self.queue_manager else {
            return Ok(());
        };

        let deadline = tokio::time::Instant::now() + timeout_duration;
        loop {
            let metrics = queue_manager.get_queue_metrics().await?;
            if metrics.total_depth == 0 {
                break;
            }

            if tokio::time::Instant::now() >= deadline {
                warn!(remaining = metrics.total_depth, "Queue drain timeout reached");
                break;
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        Ok(())
    }

    async fn cleanup_temp_media_files(&self) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        let mut deleted = 0usize;
        let cutoff = SystemTime::now()
            .checked_sub(Duration::from_secs(self.config.temp_file_retention_hours as u64 * 3600))
            .unwrap_or(SystemTime::UNIX_EPOCH);

        for dir in &self.temp_media_dirs {
            deleted += self.cleanup_temp_files_in_dir(dir, cutoff)?;
        }

        Ok(deleted)
    }

    fn cleanup_temp_files_in_dir(&self, dir: &Path, cutoff: SystemTime) -> Result<usize, Box<dyn std::error::Error + Send + Sync>> {
        if !dir.exists() {
            return Ok(0);
        }

        let mut deleted = 0usize;
        let mut stack = vec![dir.to_path_buf()];

        while let Some(current_dir) = stack.pop() {
            for entry in fs::read_dir(&current_dir)? {
                let entry = entry?;
                let path = entry.path();
                let metadata = entry.metadata()?;

                if metadata.is_dir() {
                    stack.push(path);
                    continue;
                }

                let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
                if modified < cutoff {
                    if fs::remove_file(&path).is_ok() {
                        deleted += 1;
                    }
                }
            }
        }

        Ok(deleted)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cleanup_config_defaults() {
        let config = CleanupConfig::default();
        assert_eq!(config.hourly_interval, Duration::from_secs(3600));
        assert_eq!(config.webhook_log_retention_days, 7);
        assert_eq!(config.dispatch_log_retention_days, 30);
        assert_eq!(config.idle_connection_hours, 2);
        assert_eq!(config.temp_file_retention_hours, 24);
        assert_eq!(config.redis_cleanup_interval_hours, 6);
    }

    #[test]
    fn test_cleanup_report_default() {
        let report = CleanupReport::default();
        assert_eq!(report.deleted_webhook_logs, 0);
        assert_eq!(report.deleted_dispatch_logs, 0);
        assert_eq!(report.deleted_redis_keys, 0);
        assert_eq!(report.closed_connections, 0);
        assert_eq!(report.deleted_temp_files, 0);
    }
}
