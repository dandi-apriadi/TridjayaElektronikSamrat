use chrono::{DateTime, Utc};
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

pub struct CacheManager {
    redis: redis::aio::ConnectionManager,
    // Track access frequency for adaptive sync
    // Key: Cache key, Value: (Last update time, update count in current window)
    activity: Arc<RwLock<HashMap<String, (DateTime<Utc>, u32)>>>,
}

impl CacheManager {
    pub fn new(redis: redis::aio::ConnectionManager) -> Self {
        Self {
            redis,
            activity: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Set data in cache with an optional TTL
    pub async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl_seconds: Option<usize>,
    ) -> redis::RedisResult<()> {
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::IoError,
                "Serialization failed",
                e.to_string(),
            ))
        })?;

        let mut conn = self.redis.clone();
        if let Some(ttl) = ttl_seconds {
            conn.set_ex::<_, _, ()>(key, json, ttl as u64).await?;
        } else {
            conn.set::<_, _, ()>(key, json).await?;
        }

        // Track activity for adaptive logic
        self.record_activity(key).await;
        Ok(())
    }

    /// Get data from cache
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> redis::RedisResult<Option<T>> {
        let mut conn = self.redis.clone();
        let json: Option<String> = conn.get(key).await?;

        match json {
            Some(s) => {
                let val = serde_json::from_str(&s).map_err(|e| {
                    redis::RedisError::from((
                        redis::ErrorKind::IoError,
                        "Deserialization failed",
                        e.to_string(),
                    ))
                })?;
                Ok(Some(val))
            }
            None => Ok(None),
        }
    }

    /// Invalidate a cache key (Write-on-change)
    pub async fn invalidate(&self, key: &str) -> redis::RedisResult<()> {
        let mut conn = self.redis.clone();
        conn.del::<_, ()>(key).await?;
        self.record_activity(key).await;
        Ok(())
    }

    async fn record_activity(&self, key: &str) {
        let mut activity = self.activity.write().await;
        let entry = activity.entry(key.to_string()).or_insert((Utc::now(), 0));
        entry.1 += 1;
        entry.0 = Utc::now();
    }

    /// Background task for adaptive sync
    pub async fn start_adaptive_sync(self: Arc<Self>) {
        let mut current_interval = 60; // Start with 60 seconds

        loop {
            tokio::time::sleep(tokio::time::Duration::from_secs(current_interval)).await;

            let mut activity = self.activity.write().await;
            let mut total_activity = 0;
            let stale_before = Utc::now() - chrono::Duration::hours(24);
            activity.retain(|_, (last_access, count)| *last_access >= stale_before || *count > 0);

            for (key, (_, count)) in activity.iter() {
                total_activity += count;
                if *count > 0 {
                    tracing::debug!(
                        "Adaptive Sync: Key {} had {} changes in the last window",
                        key,
                        count
                    );
                }
            }

            // Adjust interval based on total activity
            // If many changes, speed up (minimum 10 seconds)
            // If few changes, slow down (maximum 10 minutes / 600 seconds)
            if total_activity > 50 {
                current_interval = (current_interval / 2).max(10);
                tracing::info!(
                    "High activity detected ({} changes). Shortening sync interval to {}s",
                    total_activity,
                    current_interval
                );
            } else if total_activity == 0 {
                current_interval = (current_interval + 60).min(600);
                tracing::debug!(
                    "No activity detected. Lengthening sync interval to {}s",
                    current_interval
                );
            } else {
                // Return to baseline gradually
                if current_interval < 60 {
                    current_interval += 10;
                } else if current_interval > 60 {
                    current_interval -= 10;
                }
            }

            // Reset counts for the next window
            for entry in activity.values_mut() {
                entry.1 = 0;
            }

            // Perform actual sync tasks here if needed (e.g. pre-warming cache for hot keys)
            // For now, we just log the adaptation.
        }
    }
}
