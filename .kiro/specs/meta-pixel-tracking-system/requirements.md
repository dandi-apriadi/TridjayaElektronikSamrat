# Requirements Document: Meta Pixel Tracking System

## Introduction

The Meta Pixel Tracking System is a comprehensive multi-tenant tracking platform that implements the "Master Pixel Strategy" for Meta (Facebook) advertising. The system enables Super Admins to create and manage master Meta Pixels, assign them to multiple Admins with role-based access control, and provide campaign-specific tracking with unique attribution parameters. This approach enables data pooling for Meta's AI algorithms while maintaining separate reporting and analytics per admin.

The system provides server-side event tracking via Meta's Conversions API (CAPI), real-time event processing, campaign management with custom conversions, and comprehensive analytics dashboards tailored to each user role (Super Admin, Admin, Agent, Sales, Marketing). The platform ensures privacy-compliant data handling, complete audit trails for compliance, and high-performance event processing.

## Glossary

- **System**: The Meta Pixel Tracking System
- **Super_Admin**: User with role "super_admin" who can create pixels and assign admins
- **Admin**: User with role "admin" who can create campaigns and manage conversions
- **Agent**: User with role "agent" who can view analytics for their campaigns
- **Sales**: User with role "sales" who can view analytics for their campaigns
- **Marketing**: User with role "marketing" who can view analytics for their campaigns
- **Pixel**: A Meta Pixel (Dataset) with unique pixel_id from Meta Business Manager
- **Campaign**: A marketing campaign with unique UTM parameters for attribution
- **Event**: A user action tracked by the pixel (PageView, AddToCart, Purchase, Lead, etc.)
- **Custom_Conversion**: A conversion rule defined by an admin for specific campaign goals
- **Meta_CAPI**: Meta Conversions API for server-side event tracking
- **UTM_Parameters**: URL parameters for campaign attribution (utm_source, utm_medium, utm_campaign, utm_admin, etc.)
- **Event_Deduplication**: Process to prevent duplicate events between browser and server tracking
- **Audit_Log**: Immutable record of all system actions for compliance
- **Analytics_Aggregator**: Background job that computes analytics metrics from raw events
- **PII**: Personally Identifiable Information (email, phone, IP address)
- **Hashed_PII**: One-way hashed version of PII for privacy compliance
- **FBP**: Facebook Browser ID cookie (_fbp)
- **FBC**: Facebook Click ID cookie (_fbc)

## Requirements

### Requirement 1: Pixel Management by Super Admin

**User Story:** As a Super Admin, I want to create and manage master Meta Pixels, so that I can centralize tracking and enable data pooling for Meta's AI.

#### Acceptance Criteria

1. WHEN a Super Admin creates a pixel, THE System SHALL store the pixel with unique pixel_id, name, business_manager_id, access_token, and status
2. WHEN a Super Admin creates a pixel, THE System SHALL validate that the pixel_id is unique across all pixels
3. WHEN a Super Admin creates a pixel, THE System SHALL encrypt the access_token before storage
4. WHEN a Super Admin updates a pixel, THE System SHALL record the change in the audit log with old and new values
5. WHEN a Super Admin deactivates a pixel, THE System SHALL set the status to "inactive" and prevent new events from being tracked
6. WHEN a Super Admin views pixels, THE System SHALL display all pixels with their status, assigned admins count, and total events
7. THE System SHALL allow only users with role "super_admin" to create, update, or delete pixels

### Requirement 2: Admin Access Assignment

**User Story:** As a Super Admin, I want to assign and revoke admin access to pixels, so that I can control who can create campaigns and view analytics.

#### Acceptance Criteria

1. WHEN a Super Admin assigns an admin to a pixel, THE System SHALL create a pixel_admins record with user_id, pixel_id, permissions, and assigned_by
2. WHEN a Super Admin assigns an admin to a pixel, THE System SHALL validate that the user has role "admin"
3. WHEN a Super Admin revokes admin access, THE System SHALL delete the pixel_admins record and record the action in the audit log
4. WHEN an admin is assigned to a pixel, THE System SHALL grant permissions specified in the permissions JSON field
5. WHEN a Super Admin views pixel admins, THE System SHALL display all assigned admins with their permissions and assignment date
6. THE System SHALL prevent duplicate admin assignments to the same pixel

### Requirement 3: Campaign Creation and Management

**User Story:** As an Admin, I want to create and manage campaigns with custom UTM parameters, so that I can track the performance of my marketing activities.

#### Acceptance Criteria

1. WHEN an admin creates a campaign, THE System SHALL generate a unique campaign_id and store the campaign with name, pixel_id, utm_source, utm_medium, utm_campaign, utm_admin, and status
2. WHEN an admin creates a campaign, THE System SHALL validate that the admin has access to the specified pixel
3. WHEN an admin creates a campaign, THE System SHALL set utm_admin to a unique identifier for attribution
4. WHEN an admin updates a campaign status, THE System SHALL allow transitions between "active", "paused", and "completed"
5. WHEN an admin views campaigns, THE System SHALL display only campaigns for pixels they have access to
6. THE System SHALL allow admins to update campaign name, UTM parameters, and status
7. WHEN an admin deletes a campaign, THE System SHALL prevent deletion if events exist for that campaign

### Requirement 4: Custom Conversion Definition

**User Story:** As an Admin, I want to define custom conversions with rules, so that I can track specific goals and optimize my campaigns.

#### Acceptance Criteria

1. WHEN an admin creates a custom conversion, THE System SHALL store the conversion with name, campaign_id, event_type, rules, conversion_value, and currency
2. WHEN an admin creates a custom conversion, THE System SHALL validate that the rules JSON contains valid URL filters or parameter matches
3. WHEN an event matches a custom conversion rule, THE System SHALL create a conversion record with the specified conversion_value
4. WHEN an admin views custom conversions, THE System SHALL display all conversions for their campaigns
5. THE System SHALL allow admins to update custom conversion rules and values
6. WHEN an admin deletes a custom conversion, THE System SHALL preserve historical conversion records

### Requirement 5: Pixel Event Tracking

**User Story:** As a user browsing the website, I want my actions to be tracked accurately, so that advertisers can measure campaign effectiveness.

#### Acceptance Criteria

1. WHEN a pixel event is received, THE System SHALL store the event with event_id, pixel_id, event_type, event_source_url, user_agent, ip_address, fbp, fbc, user_data, custom_data, and utm_params
2. WHEN a pixel event is received, THE System SHALL hash the ip_address before storage for privacy compliance
3. WHEN a pixel event contains PII in user_data, THE System SHALL hash email and phone before storage
4. WHEN a pixel event is received, THE System SHALL extract and store all UTM parameters from the URL
5. WHEN a pixel event is received, THE System SHALL generate a unique event_id for deduplication with Meta
6. WHEN a pixel event is received, THE System SHALL process the event within 100ms
7. THE System SHALL support event types: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase, Lead, CompleteRegistration

### Requirement 6: Server-Side Event Transmission to Meta

**User Story:** As a system operator, I want events to be sent to Meta via Conversions API, so that tracking works even when browser-side tracking is blocked.

#### Acceptance Criteria

1. WHEN a pixel event is stored, THE System SHALL send the event to Meta CAPI asynchronously
2. WHEN sending an event to Meta CAPI, THE System SHALL include event_id, pixel_id, event_type, event_time, user_data, custom_data, event_source_url, and action_source
3. WHEN Meta CAPI returns a success response, THE System SHALL store the meta_event_id and set sent_to_meta to true
4. WHEN Meta CAPI returns an error, THE System SHALL store the error_message and increment retry_count
5. WHEN an event fails to send to Meta CAPI, THE System SHALL retry up to 3 times with exponential backoff
6. WHEN an event fails after 3 retries, THE System SHALL mark the event as failed and log the error
7. THE System SHALL use the encrypted access_token from the pixel record for Meta CAPI authentication

### Requirement 7: Event Deduplication

**User Story:** As a system operator, I want to prevent duplicate events between browser and server tracking, so that Meta receives accurate data.

#### Acceptance Criteria

1. WHEN a pixel event is created, THE System SHALL generate a unique event_id using timestamp and random component
2. WHEN sending an event to Meta CAPI, THE System SHALL include the event_id for Meta's deduplication
3. WHEN an event with duplicate event_id is received, THE System SHALL reject the duplicate and return an error
4. THE System SHALL use event_id format that matches Meta's deduplication requirements

### Requirement 8: Campaign Attribution

**User Story:** As an Admin, I want events to be attributed to my campaigns based on UTM parameters, so that I can measure campaign performance.

#### Acceptance Criteria

1. WHEN a pixel event contains utm_admin parameter, THE System SHALL match the event to the corresponding campaign
2. WHEN a pixel event is matched to a campaign, THE System SHALL store the campaign_id in the pixel_events record
3. WHEN a pixel event cannot be matched to a campaign, THE System SHALL store the event with null campaign_id
4. WHEN matching events to campaigns, THE System SHALL use utm_admin as the primary attribution parameter
5. THE System SHALL support attribution based on utm_source, utm_medium, utm_campaign, utm_admin, utm_content, and utm_term

### Requirement 9: Conversion Tracking

**User Story:** As an Admin, I want conversions to be tracked and attributed to my campaigns, so that I can measure ROI.

#### Acceptance Criteria

1. WHEN a Purchase event is received, THE System SHALL create a conversion record with conversion_type "Purchase", conversion_value, currency, and order_id
2. WHEN a Lead event is received, THE System SHALL create a conversion record with conversion_type "Lead"
3. WHEN an event matches a custom conversion rule, THE System SHALL create a conversion record with the custom_conversion_id
4. WHEN a conversion is created, THE System SHALL link it to the campaign via campaign_id
5. THE System SHALL extract conversion_value and currency from the event's custom_data
6. WHEN a conversion is created, THE System SHALL store the conversion_time from the event_time

### Requirement 10: Analytics Aggregation

**User Story:** As a system operator, I want analytics to be aggregated periodically, so that dashboards load quickly without querying raw events.

#### Acceptance Criteria

1. THE System SHALL run an analytics aggregation job every 5 minutes
2. WHEN the analytics aggregator runs, THE System SHALL compute pixel_analytics for each pixel with total_events, unique_users, page_views, add_to_carts, purchases, leads, and total_revenue
3. WHEN the analytics aggregator runs, THE System SHALL compute campaign_analytics for each campaign with total_events, unique_users, conversions, conversion_rate, and total_revenue
4. WHEN computing analytics, THE System SHALL aggregate data for period_types: hourly, daily, weekly, and monthly
5. WHEN analytics are updated, THE System SHALL update the updated_at timestamp
6. THE System SHALL compute unique_users by counting distinct fbp or user_id values
7. WHEN computing conversion_rate, THE System SHALL divide conversions by total_events

### Requirement 11: Super Admin Analytics Dashboard

**User Story:** As a Super Admin, I want to view comprehensive analytics across all pixels and campaigns, so that I can monitor platform performance.

#### Acceptance Criteria

1. WHEN a Super Admin views the analytics dashboard, THE System SHALL display metrics for all pixels
2. WHEN a Super Admin views pixel analytics, THE System SHALL display total_events, unique_users, page_views, add_to_carts, purchases, leads, and total_revenue
3. WHEN a Super Admin views campaign analytics, THE System SHALL display metrics for all campaigns across all pixels
4. WHEN a Super Admin filters analytics by date range, THE System SHALL query the appropriate period_type records
5. THE System SHALL display analytics with charts for trends over time
6. WHEN a Super Admin views analytics, THE System SHALL display real-time event counts from the last hour

### Requirement 12: Admin Analytics Dashboard

**User Story:** As an Admin, I want to view analytics for my campaigns, so that I can measure performance and optimize my marketing.

#### Acceptance Criteria

1. WHEN an admin views the analytics dashboard, THE System SHALL display metrics only for campaigns they created
2. WHEN an admin views campaign analytics, THE System SHALL display total_events, unique_users, conversions, conversion_rate, total_revenue, and ROAS
3. WHEN an admin filters analytics by campaign, THE System SHALL display metrics for the selected campaign
4. WHEN an admin filters analytics by date range, THE System SHALL query the appropriate period_type records
5. THE System SHALL display conversion funnel visualization (PageView → AddToCart → Purchase)
6. WHEN an admin views analytics, THE System SHALL display top-performing campaigns ranked by conversion_rate

### Requirement 13: Role-Based Analytics Access

**User Story:** As an Agent/Sales/Marketing user, I want to view analytics relevant to my activities, so that I can track my performance.

#### Acceptance Criteria

1. WHEN a user with role "agent" views analytics, THE System SHALL display metrics for events where user_id matches their id
2. WHEN a user with role "sales" views analytics, THE System SHALL display metrics for campaigns tagged with their user_id
3. WHEN a user with role "marketing" views analytics, THE System SHALL display metrics for all campaigns they have permission to view
4. THE System SHALL filter analytics based on user role and permissions
5. WHEN a non-admin user views analytics, THE System SHALL hide pixel-level metrics and show only campaign-level metrics

### Requirement 14: Tracking URL Generation

**User Story:** As an Admin, I want to generate tracking URLs with UTM parameters, so that I can easily create links for my ads.

#### Acceptance Criteria

1. WHEN an admin generates a tracking URL, THE System SHALL append utm_source, utm_medium, utm_campaign, and utm_admin parameters
2. WHEN an admin generates a tracking URL, THE System SHALL use the campaign's configured UTM values
3. WHEN an admin generates a tracking URL, THE System SHALL encode special characters in parameter values
4. THE System SHALL display the generated URL in a copyable format
5. WHEN an admin generates a tracking URL, THE System SHALL optionally include utm_content and utm_term parameters

### Requirement 15: Pixel Event Testing

**User Story:** As an Admin, I want to test pixel events before launching campaigns, so that I can verify tracking is working correctly.

#### Acceptance Criteria

1. WHEN an admin sends a test event, THE System SHALL send the event to Meta's Test Events API instead of the production API
2. WHEN a test event is sent, THE System SHALL include a test_event_code for identification
3. WHEN a test event is sent, THE System SHALL display the response from Meta including validation results
4. WHEN a test event fails validation, THE System SHALL display the error messages from Meta
5. THE System SHALL allow admins to test all supported event types
6. WHEN a test event is sent, THE System SHALL not store the event in the pixel_events table

### Requirement 16: Audit Logging

**User Story:** As a compliance officer, I want all system actions to be logged, so that I can audit user activities and maintain compliance.

#### Acceptance Criteria

1. WHEN a pixel is created, updated, or deleted, THE System SHALL create an audit log entry with action_type, resource_type, resource_id, old_value, new_value, user_id, ip_address, and user_agent
2. WHEN an admin is assigned or revoked, THE System SHALL create an audit log entry
3. WHEN a campaign is created, updated, or deleted, THE System SHALL create an audit log entry
4. WHEN a custom conversion is created, updated, or deleted, THE System SHALL create an audit log entry
5. THE System SHALL store audit logs with immutable records (no updates or deletes)
6. WHEN a Super Admin views audit logs, THE System SHALL display all logs with filtering by action_type, resource_type, user_id, and date range
7. THE System SHALL store old_value and new_value as JSON for structured comparison

### Requirement 17: Privacy Compliance

**User Story:** As a data protection officer, I want PII to be handled securely, so that the system complies with privacy regulations.

#### Acceptance Criteria

1. WHEN an event contains an IP address, THE System SHALL hash the IP address using SHA-256 before storage
2. WHEN an event contains email in user_data, THE System SHALL hash the email using SHA-256 before storage
3. WHEN an event contains phone in user_data, THE System SHALL hash the phone using SHA-256 before storage
4. THE System SHALL not store plaintext PII in the database
5. WHEN sending events to Meta CAPI, THE System SHALL send hashed PII as required by Meta's API
6. THE System SHALL use HTTPS for all API communications
7. WHEN storing access tokens, THE System SHALL encrypt them using AES-256

### Requirement 18: Performance Requirements

**User Story:** As a system operator, I want the system to handle high traffic, so that tracking remains reliable during peak periods.

#### Acceptance Criteria

1. WHEN a pixel event is received, THE System SHALL process and store the event within 100ms
2. THE System SHALL support at least 1000 concurrent campaigns without performance degradation
3. WHEN the analytics dashboard is loaded, THE System SHALL return results within 500ms
4. THE System SHALL support at least 10,000 events per minute
5. WHEN the database grows beyond 1 million events, THE System SHALL maintain query performance through proper indexing
6. THE System SHALL use connection pooling for database connections
7. WHEN sending events to Meta CAPI, THE System SHALL use async processing to avoid blocking the API response

### Requirement 19: Error Handling and Resilience

**User Story:** As a system operator, I want the system to handle errors gracefully, so that temporary failures don't result in data loss.

#### Acceptance Criteria

1. WHEN Meta CAPI is unavailable, THE System SHALL store events locally and retry sending
2. WHEN an event fails to send after 3 retries, THE System SHALL log the error and alert administrators
3. WHEN the database is unavailable, THE System SHALL return an error response and not lose events
4. WHEN invalid data is received, THE System SHALL validate and return descriptive error messages
5. THE System SHALL implement circuit breaker pattern for Meta CAPI calls
6. WHEN a background job fails, THE System SHALL log the error and retry on the next scheduled run
7. THE System SHALL implement rate limiting to prevent abuse (100 requests per minute per IP)

### Requirement 20: Domain Verification

**User Story:** As a Super Admin, I want to verify domain ownership in Meta Business Manager, so that the pixel can track events from my website.

#### Acceptance Criteria

1. WHEN a Super Admin creates a pixel, THE System SHALL store domain verification status in the config JSON
2. WHEN a Super Admin updates domain verification, THE System SHALL update the config JSON
3. WHEN a pixel event is received from an unverified domain, THE System SHALL log a warning but still process the event
4. THE System SHALL display domain verification status in the pixel management dashboard
5. WHEN a Super Admin views pixel configuration, THE System SHALL display instructions for domain verification in Meta Business Manager

### Requirement 21: Event Priority Configuration

**User Story:** As a Super Admin, I want to configure event priorities for Aggregated Event Measurement, so that the most important events are prioritized by Meta.

#### Acceptance Criteria

1. WHEN a Super Admin creates a pixel, THE System SHALL store event priorities in the config JSON
2. WHEN a Super Admin updates event priorities, THE System SHALL validate that exactly 8 events are prioritized
3. WHEN a Super Admin views pixel configuration, THE System SHALL display the current event priority order
4. THE System SHALL allow Super Admins to reorder event priorities
5. WHEN event priorities are updated, THE System SHALL record the change in the audit log

### Requirement 22: Meta Business Manager Integration

**User Story:** As a Super Admin, I want to integrate with Meta Business Manager, so that I can manage pixels and access tokens centrally.

#### Acceptance Criteria

1. WHEN a Super Admin creates a pixel, THE System SHALL validate the pixel_id exists in Meta Business Manager
2. WHEN a Super Admin creates a pixel, THE System SHALL validate the access_token has required permissions
3. WHEN a Super Admin updates a pixel, THE System SHALL allow updating the business_manager_id
4. THE System SHALL store business_manager_id for each pixel
5. WHEN a Super Admin views pixels, THE System SHALL display the associated Business Manager

### Requirement 23: Campaign Status Management

**User Story:** As an Admin, I want to pause and resume campaigns, so that I can control when tracking is active.

#### Acceptance Criteria

1. WHEN an admin pauses a campaign, THE System SHALL set status to "paused" and continue tracking events but mark them as paused
2. WHEN an admin resumes a campaign, THE System SHALL set status to "active"
3. WHEN an admin completes a campaign, THE System SHALL set status to "completed" and prevent further updates
4. WHEN a campaign is paused, THE System SHALL still track events for historical analysis
5. THE System SHALL display campaign status in the campaign list
6. WHEN filtering campaigns, THE System SHALL allow filtering by status

### Requirement 24: Multi-Currency Support

**User Story:** As an Admin running international campaigns, I want to track conversions in multiple currencies, so that I can measure performance across regions.

#### Acceptance Criteria

1. WHEN a conversion is created, THE System SHALL store the currency from the event's custom_data
2. WHEN computing total_revenue in analytics, THE System SHALL group by currency
3. WHEN displaying analytics, THE System SHALL show revenue per currency
4. THE System SHALL support ISO 4217 currency codes (USD, EUR, IDR, etc.)
5. WHEN a conversion has no currency specified, THE System SHALL default to USD
6. THE System SHALL validate currency codes against the ISO 4217 standard

### Requirement 25: Background Job Monitoring

**User Story:** As a system operator, I want to monitor background jobs, so that I can ensure analytics and event processing are running correctly.

#### Acceptance Criteria

1. THE System SHALL log the start and completion time of each analytics aggregation job
2. WHEN a background job fails, THE System SHALL log the error with stack trace
3. WHEN a background job takes longer than 5 minutes, THE System SHALL log a warning
4. THE System SHALL expose a health check endpoint that includes background job status
5. WHEN the analytics aggregator is running, THE System SHALL prevent concurrent executions
6. THE System SHALL track the last successful run time for each background job type
