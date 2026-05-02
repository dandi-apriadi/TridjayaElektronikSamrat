use std::time::Duration;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WaDispatchConfig {
    pub delay_ms: u64,
    pub jitter_ms: u64,
    pub max_per_account_per_minute: u32,
}

impl Default for WaDispatchConfig {
    fn default() -> Self {
        Self {
            delay_ms: 3000,
            jitter_ms: 500,
            max_per_account_per_minute: 20,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WaDispatchJob {
    pub campaign_id: String,
    pub recipient_id: String,
    pub phone: String,
    pub message: String,
    pub account_id: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WaDispatchPlan {
    pub delay: Duration,
    pub account_slot: usize,
    pub account_spacing: Duration,
}

pub fn compute_message_delay(base_ms: u64, jitter_ms: u64, sequence: u64) -> Duration {
    let jitter = if jitter_ms == 0 {
        0
    } else {
        sequence % (jitter_ms + 1)
    };

    Duration::from_millis(base_ms.saturating_add(jitter))
}

pub fn account_spacing(max_per_account_per_minute: u32) -> Duration {
    let limit = max_per_account_per_minute.max(1) as u64;
    let spacing_ms = 60_000_u64 / limit;
    Duration::from_millis(spacing_ms.max(1))
}

pub fn select_account_slot(sequence: usize, account_count: usize) -> usize {
    if account_count == 0 {
        0
    } else {
        sequence % account_count
    }
}

pub fn build_dispatch_plan(sequence: u64, account_sequence: usize, config: &WaDispatchConfig, account_count: usize) -> WaDispatchPlan {
    WaDispatchPlan {
        delay: compute_message_delay(config.delay_ms, config.jitter_ms, sequence),
        account_slot: select_account_slot(account_sequence, account_count),
        account_spacing: account_spacing(config.max_per_account_per_minute),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn delay_includes_deterministic_jitter() {
        let delay = compute_message_delay(3000, 500, 7);
        assert_eq!(delay, Duration::from_millis(3007));
    }

    #[test]
    fn account_slot_wraps_round_robin() {
        assert_eq!(select_account_slot(0, 3), 0);
        assert_eq!(select_account_slot(1, 3), 1);
        assert_eq!(select_account_slot(4, 3), 1);
    }

    #[test]
    fn spacing_defaults_to_safe_value() {
        assert_eq!(account_spacing(0), Duration::from_millis(60000));
        assert_eq!(account_spacing(20), Duration::from_millis(3000));
    }
}
