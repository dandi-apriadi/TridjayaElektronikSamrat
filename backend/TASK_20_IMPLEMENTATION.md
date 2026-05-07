# Task 20: Campaign Metrics Calculation - Implementation Summary

**Task**: Implement campaign metrics calculation
**Spec**: self-hosted-whatsapp-gateway
**Requirements**: 10.5, 10.6, 10.8

## Implementation Overview

This task implements a comprehensive campaign metrics system that calculates and aggregates WhatsApp campaign performance metrics.

## Components Implemented

### 1. Core Metrics Module (`backend/src/campaign_metrics.rs`)

The module was already partially implemented and has been enhanced with:

#### Data Structures
- `CampaignMetrics`: Real-time metrics structure
  - `total_recipients`: Total number of recipients
  - `total_sent`: Count of messages sent
  - `total_delivered`: Count of messages delivered
  - `total_read`: Count of messages read
  - `total_replied`: Count of recipients who replied
  - `total_failed`: Count of failed messages
  - `delivered_rate`: Delivery rate percentage (0-100)
  - `read_rate`: Read rate percentage (0-100)
  - `reply_rate`: Reply rate percentage (0-100)

- `CampaignMetricsResponse`: Complete API response structure
  - Campaign details (id, name, status)
  - Real-time metrics
  - Hourly metrics breakdown

- `HourlyMetricsSimple`: Simplified hourly metrics for API response
- `HourlyCampaignMetrics`: Full hourly metrics from database

#### Functions

**`calculate_campaign_metrics(pool, campaign_id)`**
- **Validates**: Requirements 10.5, 10.6
- Calculates real-time metrics from `wa_recipients` table
- Handles division by zero (returns 0.0 rates when no messages sent)
- Returns `CampaignMetrics` structure

**`aggregate_hourly_metrics(pool, campaign_id, hour_timestamp)`**
- **Validates**: Requirement 10.8
- Aggregates metrics for a specific hour
- Stores/updates records in `wa_campaign_metrics` table
- Truncates timestamp to start of hour
- Handles both insert and update operations

**`get_hourly_metrics(pool, campaign_id)`**
- Retrieves all hourly metrics for a campaign
- Returns records ordered by hour_timestamp

**`get_campaign_metrics_response(pool, campaign_id)`**
- **Validates**: Requirements 10.5, 10.6, 10.8
- Returns complete metrics response with:
  - Campaign details (name, status)
  - Real-time metrics
  - Hourly metrics breakdown
- Returns error if campaign not found

**`aggregate_all_campaigns(pool)`**
- Aggregates metrics for all active campaigns
- Designed to be called periodically (e.g., hourly cron job)
- Finds campaigns with activity in current hour
- Aggregates metrics for each campaign

### 2. API Endpoints

#### Admin Endpoint: `GET /api/wa/campaigns/{id}/metrics`
**Location**: `backend/src/routes.rs` (function: `get_wa_campaign_metrics`)
- **Validates**: Requirements 10.5, 10.6, 10.8
- **Authentication**: Admin, WaAdmin, or WaOperator role required
- **Response Format**:
```json
{
  "success": true,
  "message": "Campaign metrics berhasil diambil",
  "data": {
    "campaignId": "campaign-uuid",
    "campaignName": "Campaign Name",
    "status": "completed",
    "metrics": {
      "totalRecipients": 1000,
      "totalSent": 950,
      "totalDelivered": 920,
      "totalRead": 850,
      "totalReplied": 120,
      "totalFailed": 50,
      "deliveredRate": 96.84,
      "readRate": 89.47,
      "replyRate": 12.63
    },
    "hourlyMetrics": [
      {
        "hour": "2026-05-05T10:00:00Z",
        "total_sent": 100,
        "total_delivered": 95,
        "total_read": 85,
        "total_replied": 12,
        "total_failed": 0
      }
    ]
  }
}
```

#### N8N API Endpoint: `GET /api/wa/campaigns/:id/metrics`
**Location**: `backend/src/api_routes.rs` (function: `get_campaign_metrics`)
- **Validates**: Requirements 10.5, 10.6
- **Authentication**: Bearer token (from wa_api_tokens table)
- Returns simplified metrics (no hourly breakdown)
- Already implemented in previous tasks

### 3. Database Schema

The `wa_campaign_metrics` table was already created by migration `2026050502_add_campaign_metrics.sql`:

```sql
CREATE TABLE IF NOT EXISTS wa_campaign_metrics (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    hour_timestamp DATETIME NOT NULL,
    total_sent INTEGER NOT NULL DEFAULT 0,
    total_delivered INTEGER NOT NULL DEFAULT 0,
    total_read INTEGER NOT NULL DEFAULT 0,
    total_replied INTEGER NOT NULL DEFAULT 0,
    delivered_rate REAL,
    read_rate REAL,
    reply_rate REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES wa_campaigns(id) ON DELETE CASCADE
);
```

Indexes:
- `idx_wa_campaign_metrics_campaign_hour`: Efficient campaign + hour queries
- `idx_wa_campaign_metrics_hour`: Time-based queries

### 4. Tests

#### Unit Tests (`backend/src/campaign_metrics.rs`)
- `test_metrics_calculation_with_zero_sent`: Validates division by zero handling
- `test_metrics_calculation_with_data`: Validates rate calculations
- `test_hour_truncation`: Validates hour timestamp truncation

#### Integration Tests (`backend/tests/campaign_metrics_test.rs`)
Comprehensive test suite covering:
- Metrics calculation with no recipients
- Metrics calculation with various recipient statuses
- Division by zero edge case
- Hourly metrics aggregation
- Updating existing hourly metrics
- Complete metrics response with campaign details
- Campaign not found error handling
- 100% success rate scenarios

## Metrics Calculation Logic

### Real-time Metrics
Calculated from `wa_recipients` table:
- `total_sent = COUNT(sent_at IS NOT NULL)`
- `total_delivered = COUNT(delivered_at IS NOT NULL)`
- `total_read = COUNT(read_at IS NOT NULL)`
- `total_replied = COUNT(replied_at IS NOT NULL)`
- `total_failed = COUNT(status = 'failed')`

### Rate Calculations
- `delivered_rate = (total_delivered / total_sent) * 100`
- `read_rate = (total_read / total_sent) * 100`
- `reply_rate = (total_replied / total_sent) * 100`

All rates return 0.0 when `total_sent = 0` to avoid division by zero.

### Hourly Aggregation
- Timestamp truncated to start of hour (e.g., 2024-05-05 14:00:00)
- Counts messages with timestamps within the hour window
- Stores aggregated counts and calculated rates
- Updates existing records if already present for the hour

## Edge Cases Handled

1. **No Recipients**: Returns all zeros with 0.0 rates
2. **Division by Zero**: Returns 0.0 rates when total_sent = 0
3. **Campaign Not Found**: Returns appropriate error
4. **Partial Status Updates**: Correctly counts only non-null timestamps
5. **Concurrent Aggregation**: Uses upsert logic (insert or update)

## Usage

### Manual Metrics Calculation
```rust
use tridjaya_backend::campaign_metrics::calculate_campaign_metrics;

let metrics = calculate_campaign_metrics(&pool, "campaign-id").await?;
println!("Delivered rate: {:.2}%", metrics.delivered_rate);
```

### Hourly Aggregation (Cron Job)
```rust
use tridjaya_backend::campaign_metrics::aggregate_all_campaigns;

// Run this every hour
aggregate_all_campaigns(&pool).await?;
```

### API Request (Admin)
```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/api/wa/campaigns/{id}/metrics
```

### API Request (N8N)
```bash
curl -H "Authorization: Bearer <api_token>" \
  http://localhost:3000/api/wa/campaigns/{id}/metrics
```

## Integration Points

1. **Status Tracking**: Metrics are calculated from `wa_recipients` table which is updated by:
   - `wa_status_tracker.rs`: Updates delivery/read status from webhooks
   - `wa_event_dispatcher.rs`: Handles incoming message events
   - `blast_engine.rs`: Updates sent_at timestamps

2. **Webhook Processing**: Status updates flow through:
   - Webhook received → `wa_webhook_handlers.rs`
   - Event dispatched → `wa_event_dispatcher.rs`
   - Status updated → `wa_status_tracker.rs`
   - Metrics reflect changes immediately

3. **Periodic Aggregation**: Should be scheduled via cron or background job:
   - Call `aggregate_all_campaigns()` every hour
   - Stores historical metrics for reporting
   - Enables time-series analysis

## Verification

The implementation has been verified to:
- ✅ Compile successfully with no errors
- ✅ Include comprehensive unit tests
- ✅ Include integration tests for all scenarios
- ✅ Handle all edge cases (no recipients, division by zero, not found)
- ✅ Follow existing code patterns and conventions
- ✅ Include proper error handling and logging
- ✅ Support both admin and API token authentication
- ✅ Return data in the specified JSON format

## Requirements Validation

- ✅ **Requirement 10.5**: Campaign metrics calculation (total sent, delivered rate, read rate, reply rate)
- ✅ **Requirement 10.6**: API endpoint `GET /api/wa/campaigns/{id}/metrics`
- ✅ **Requirement 10.8**: Hourly aggregation to `wa_campaign_metrics` table

## Files Modified/Created

### Modified
- `backend/src/campaign_metrics.rs`: Enhanced with complete response structure and new functions
- `backend/src/routes.rs`: Added `get_wa_campaign_metrics` handler and route

### Created
- `backend/tests/campaign_metrics_test.rs`: Comprehensive integration tests
- `backend/TASK_20_IMPLEMENTATION.md`: This documentation

### Already Existed (from previous tasks)
- `backend/migrations/2026050502_add_campaign_metrics.sql`: Database schema
- `backend/src/api_routes.rs`: N8N API endpoint
- `backend/src/lib.rs`: Module declaration

## Next Steps

To fully utilize the metrics system:

1. **Set up hourly aggregation job**:
   - Add cron job or background task to call `aggregate_all_campaigns()`
   - Recommended: Run every hour at minute 0

2. **Frontend integration**:
   - Create dashboard to display campaign metrics
   - Show real-time metrics and historical trends
   - Visualize hourly breakdown with charts

3. **Monitoring**:
   - Set up alerts for low delivery rates
   - Track reply rates for engagement analysis
   - Monitor failed message counts

4. **Optimization** (if needed):
   - Add caching for frequently accessed metrics
   - Consider materialized views for large campaigns
   - Add pagination for hourly metrics if needed
