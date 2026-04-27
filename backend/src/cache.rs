use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::collections::HashMap;
use chrono::{DateTime, Utc, Duration};

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
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl_seconds: Option<usize>) -> redis::RedisResult<()> {
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((redis::ErrorKind::IoError, "Serialization failed", e.to_string()))
        })?;

        let mut conn = self.redis.clone();
        if let Some(ttl) = ttl_seconds {
            conn.set_ex(key, json, ttl).await?;
        } else {
            conn.set(key, json).await?;
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
                    redis::RedisError::from((redis::ErrorKind::IoError, "Deserialization failed", e.to_string()))
                })?;
                Ok(Some(val))
            }
            None => Ok(None),
        }
    }

    /// Invalidate a cache key (Write-on-change)
    pub async fn invalidate(&self, key: &str) -> redis::RedisResult<()> {
        let mut conn = self.redis.clone();
        conn.del(key).await?;
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
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(60)); // Default 1 min check
        
        loop {
            interval.tick().await;
            let activity_snapshot = self.activity.read().await.clone();
            
            for (key, (last_update, count)) in activity_snapshot {
                // Determine adaptive frequency
                // If many updates recently, we might want to sync more often or handle differently
                // For this example, we'll just log the activity
                if count > 10 {
                    tracing::debug!("High activity detected for {}, count: {}", key, count);
                    // In a real scenario, you'd trigger a DB-to-Redis sync here if not already handled by Write-on-change
                }
            }
            
            // Reset counts for the next window
            let mut activity = self.activity.write().await;
            for entry in activity.values_mut() {
                entry.1 = 0;
            }
        }
    }
}
