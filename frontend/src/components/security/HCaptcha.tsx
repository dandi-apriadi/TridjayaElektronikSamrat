import React, { useEffect, useRef, useState } from 'react';

type HCaptchaWidgetId = string | number;

type HCaptchaApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark';
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => HCaptchaWidgetId;
  reset: (widgetId?: HCaptchaWidgetId) => void;
  remove?: (widgetId: HCaptchaWidgetId) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

const rawSiteKey = (import.meta.env.VITE_HCAPTCHA_SITE_KEY as string | undefined)?.trim() ?? '';

export const HCAPTCHA_SITE_KEY = rawSiteKey;
export const isHCaptchaEnabled = rawSiteKey.length > 0;

let scriptPromise: Promise<void> | null = null;

const loadHCaptchaScript = () => {
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      if (window.hcaptcha) {
        resolve();
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>('script[data-hcaptcha-script="true"]');
      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Gagal memuat hCaptcha')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.hcaptchaScript = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat hCaptcha'));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
};

interface HCaptchaProps {
  resetKey?: string | number;
  theme?: 'light' | 'dark';
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export const HCaptcha: React.FC<HCaptchaProps> = ({
  resetKey,
  theme = 'dark',
  onVerify,
  onExpire,
  onError,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<HCaptchaWidgetId | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onError, onExpire, onVerify]);

  useEffect(() => {
    if (!isHCaptchaEnabled || !containerRef.current) return;

    let cancelled = false;

    loadHCaptchaScript()
      .then(() => {
        if (cancelled || !window.hcaptcha || !containerRef.current || widgetIdRef.current !== null) return;

        widgetIdRef.current = window.hcaptcha.render(containerRef.current, {
          sitekey: HCAPTCHA_SITE_KEY,
          theme,
          callback: (token: string) => {
            callbacksRef.current.onVerify(token);
          },
          'expired-callback': () => {
            callbacksRef.current.onExpire?.();
          },
          'error-callback': () => {
            callbacksRef.current.onError?.();
          },
        });
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setLoadError(error.message);
          callbacksRef.current.onError?.();
        }
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.hcaptcha?.remove) {
        window.hcaptcha.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    if (widgetIdRef.current !== null && window.hcaptcha) {
      window.hcaptcha.reset(widgetIdRef.current);
    }
  }, [resetKey]);

  if (!isHCaptchaEnabled) return null;

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="min-h-[78px]" />
      {loadError ? (
        <p className="text-body-sm font-medium text-error">{loadError}</p>
      ) : null}
    </div>
  );
};
