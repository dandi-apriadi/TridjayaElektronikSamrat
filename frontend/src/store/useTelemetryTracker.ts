import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { buildTelemetryPagePayload, recordTelemetry } from '../utils/telemetry';

export const useTelemetryTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = async () => {
      try {
        recordTelemetry('page_view', buildTelemetryPagePayload(location.pathname + location.search));
      } catch (error) {
        console.error('Telemetry failed to synchronize', error);
      }
    };

    trackPageView();
  }, [location.pathname, location.search]);
};
