import { API_BASE_URL } from './apiClient';

export type TelemetryEventType = 'page_view' | 'click' | 'whatsapp_click' | 'pixel_event';

export interface TelemetryPayload {
  path?: string;
  source?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface TelemetryPageContext {
  path: string;
  source: string;
  sessionId: string;
  metadata: Record<string, unknown>;
}

const TELEMETRY_ENDPOINTS: Record<TelemetryEventType, string> = {
  page_view: '/api/telemetry/page-view',
  click: '/api/telemetry/click',
  whatsapp_click: '/api/telemetry/whatsapp-click',
  pixel_event: '/api/telemetry/pixel-event',
};

const TELEMETRY_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

export function getTelemetrySessionId(): string {
  if (typeof window === 'undefined') {
    return 'anonymous';
  }

  const existingSession = window.localStorage.getItem('trx_session');
  if (existingSession) {
    return existingSession;
  }

  const id = `v2-${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;
  window.localStorage.setItem('trx_session', id);
  return id;
}

function getPageContextLabel(pathname: string): TelemetryPageContext {
  const normalizedPath = pathname || '/';
  const [basePath, query = ''] = normalizedPath.split('?');
  const path = basePath || '/';
  const metadata: Record<string, unknown> = {
    pagePath: path,
    pageKey: path,
    pageType: 'page',
  };

  const markContent = (pageType: string, contentType: string, pageKey: string, pageLabel: string) => {
    metadata.pageType = pageType;
    metadata.contentType = contentType;
    metadata.contentKey = pageKey;
    metadata.pageKey = pageKey;
    metadata.pageLabel = pageLabel;
  };

  if (path === '/') {
    markContent('home', 'page', 'home', 'Beranda');
  } else if (path === '/blog') {
    markContent('blog_index', 'page', 'blog:index', 'Blog & Artikel');
  } else if (path.startsWith('/blog/')) {
    const slug = path.split('/')[2] || path;
    markContent('article_detail', 'article', `article:${slug}`, slug);
    metadata.contentSlug = slug;
  } else if (path === '/promo') {
    markContent('promo_index', 'page', 'promo:index', 'Promo');
  } else if (path.startsWith('/promo/')) {
    const promoId = path.split('/')[2] || path;
    markContent('promo_detail', 'promo', `promo:${promoId}`, promoId);
    metadata.contentId = promoId;
  } else if (path === '/produk/bike') {
    markContent('product_catalog', 'page', 'catalog:bike', 'Katalog Sepeda Listrik');
  } else if (path === '/produk/home') {
    markContent('product_catalog', 'page', 'catalog:home', 'Katalog Home Living');
  } else if (path.startsWith('/produk/')) {
    const slug = path.split('/')[2] || path;
    markContent('product_detail', 'product', `product:${slug}`, slug);
    metadata.contentSlug = slug;
  } else if (path === '/tentang') {
    markContent('about_page', 'page', 'about', 'Tentang Kami');
  } else if (path === '/daftar-agen') {
    markContent('agent_registration', 'page', 'agent-registration', 'Daftar Agen');
  }

  if (query) {
    metadata.pageQuery = query;
  }

  return {
    path,
    source: 'direct',
    sessionId: getTelemetrySessionId(),
    metadata,
  };
}

export function buildTelemetryPagePayload(pathname: string): TelemetryPayload {
  const context = getPageContextLabel(pathname);
  return {
    path: context.path,
    source: context.source,
    sessionId: context.sessionId,
    metadata: context.metadata,
  };
}

export function recordTelemetry(eventType: TelemetryEventType, payload: TelemetryPayload): void {
  const url = `${TELEMETRY_BASE_URL}${TELEMETRY_ENDPOINTS[eventType]}`;
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
