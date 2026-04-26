import { API_BASE_URL } from './apiClient';

export type TelemetryEventType = 'page_view' | 'click' | 'whatsapp_click' | 'pixel_event';

export interface TelemetryPayload {
  path?: string;
  source?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

const TELEMETRY_ENDPOINTS: Record<TelemetryEventType, string> = {
  page_view: '/api/telemetry/page-view',
  click: '/api/telemetry/click',
  whatsapp_click: '/api/telemetry/whatsapp-click',
  pixel_event: '/api/telemetry/pixel-event',
};

export function recordTelemetry(eventType: TelemetryEventType, payload: TelemetryPayload): void {
  const url = `${API_BASE_URL}${TELEMETRY_ENDPOINTS[eventType]}`;
  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const sent = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      if (sent) {
        return;
      }
    } catch {
      // Fall back to fetch below.
    }
  }

  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Telemetry must not block the user flow.
  });
}