import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:8081/api/telemetry';

export const useTelemetryTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        await fetch(`${API_BASE_URL}/page-view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path: location.pathname + location.search,
            source: document.referrer || 'direct',
            sessionId: sessionStorage.getItem('trx_session') || initializeSession()
          }),
        });
      } catch (error) {
        console.error('Telemetry failed to synchronize', error);
      }
    };

    trackPageView();
  }, [location.pathname, location.search]);
};

function initializeSession() {
  const id = Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem('trx_session', id);
  return id;
}
