/**
 * Centralized API client with automatic token refresh on 401.
 * Handles HttpOnly cookie auth with bearer fallback.
 */

import { useAuthStore } from '../store/authStore';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';

function getBackendAssetBaseUrl(): string {
  return API_BASE_URL.replace(/\/api$/, '');
}

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let lastRefreshTime = 0;
const REFRESH_GRACE_PERIOD = 2000; // 2 seconds

/**
 * Enhanced fetch with automatic token refresh on 401
 */
export async function apiFetch(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  // Build URL - use relative path for /api endpoints to leverage proxy and ensure cookies work
  const url = endpoint.startsWith('http')
    ? endpoint
    : endpoint.startsWith('/api')
      ? endpoint
      : `${API_BASE_URL}${endpoint}`;

  // Set default options
  const finalOptions: RequestInit = {
    credentials: 'include', // Allow cookies
    ...fetchOptions,
    headers: {
      ...fetchOptions.headers,
    },
  };

  // Only set application/json if body is not FormData and headers don't already have Content-Type
  if (!(fetchOptions.body instanceof FormData)) {
    finalOptions.headers = {
      'Content-Type': 'application/json',
      ...finalOptions.headers,
    };
  }

  // Add bearer token only to authenticated API endpoints (not public/telemetry/uploads)
  if (!skipAuth) {
    const isAuthenticatedEndpoint =
      endpoint.startsWith('/api/') &&
      !endpoint.startsWith('/api/telemetry/') &&
      !endpoint.startsWith('/api/public/') &&
      !endpoint.startsWith('/api/agent-registrations');
    if (isAuthenticatedEndpoint) {
      const accessToken = useAuthStore.getState().accessToken;
      if (accessToken) {
        finalOptions.headers = {
          ...finalOptions.headers,
          Authorization: `Bearer ${accessToken}`,
        };
      }
    }
  }

  let response = await fetch(url, finalOptions);

  // Handle 401 - attempt token refresh
  if (response.status === 401 && !skipAuth) {
    const now = Date.now();
    
    // 1. If the token was refreshed very recently, just retry once with the current store token
    if (now - lastRefreshTime < REFRESH_GRACE_PERIOD) {
      const currentToken = useAuthStore.getState().accessToken;
      if (currentToken) {
        finalOptions.headers = {
          ...finalOptions.headers,
          Authorization: `Bearer ${currentToken}`,
        };
        return fetch(url, finalOptions);
      }
    }

    // 2. If already refreshing, wait for it
    if (isRefreshing && refreshPromise) {
      const refreshed = await refreshPromise;
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) {
          finalOptions.headers = {
            ...finalOptions.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return fetch(url, finalOptions);
        }
      }
      return response;
    }

    // 3. Start refresh
    isRefreshing = true;
    refreshPromise = useAuthStore.getState().refreshSession();

    try {
      const refreshed = await refreshPromise;
      lastRefreshTime = Date.now();
      
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) {
          finalOptions.headers = {
            ...finalOptions.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return fetch(url, finalOptions);
        }
      } else {
        // Only logout if refresh really failed (e.g. 401 on refresh endpoint)
        // Check if we are still on a 401 state before logging out
        const stillUnauthorized = useAuthStore.getState().accessToken === null;
        if (stillUnauthorized) {
          await useAuthStore.getState().logout();
        }
      }
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  }

  return response;
}

/**
 * Helper for JSON responses
 */
export async function apiJson<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<{ data: T; status: number }> {
  const response = await apiFetch(endpoint, options);
  const data = await response.json();
  return {
    data,
    status: response.status,
  };
}

/**
 * Helper for image URLs from backend
 */
export function getImageUrl(path: string | undefined | null): string {
  if (!path) return `${API_BASE_URL}/uploads/default-product.webp`;
  if (path.startsWith('http')) return path;
  if (path.startsWith('data:')) return path;
  if (path.startsWith('blob:')) return path;

  const placeholderAssetMap: Record<string, string> = {
    'default': '/assets/images/logo.webp',
    'tv': '/assets/images/defaults/default-tv.webp',
    'mesin_cuci': '/assets/images/defaults/default-mesin-cuci.webp',
    'ac': '/assets/images/defaults/default-ac.webp',
    'sepeda_listrik': '/assets/images/defaults/default-sepeda-listrik.webp',
    'kursi': '/assets/images/defaults/default-kursi.webp',
    'kulkas': '/assets/images/defaults/default-kulkas.webp',
    'sofa': '/assets/images/defaults/default-sofa.webp',
    'kompor': '/assets/images/defaults/default-kompor.webp',
    'speaker': '/assets/images/defaults/default-speaker.webp',
    'handphone': '/assets/images/defaults/default-handphone.webp',
    'kasur': '/assets/images/defaults/default-kasur.webp',
    'magic_com': '/assets/images/defaults/default-magicom.webp',
    'kipas_angin': '/assets/images/defaults/default-kipas.webp',
    'dispenser': '/assets/images/defaults/default-dispenser.webp',
    'blender': '/assets/images/defaults/default-blender.webp',
    'oven': '/assets/images/defaults/default-oven.webp',
  };

  // Modern defaults matching
  if (path.includes('default-') && path.endsWith('.webp')) {
    return path;
  }

  const placeholderMatch = path.match(/\/uploads\/placeholders\/([^/.]+)\.(?:png|jpg|jpeg|webp)$/i);
  if (placeholderMatch) {
    const legacyKey = placeholderMatch[1].toLowerCase();
    if (placeholderAssetMap[legacyKey]) {
      return placeholderAssetMap[legacyKey];
    }
    const slug = legacyKey.replace(/_/g, '-');
    return `/assets/images/defaults/default-${slug}.webp`;
  }
  
  // Handle local Vite assets in development
  if (path.startsWith('/src') || path.startsWith('/assets') || path.startsWith('/@fs')) {
    return path;
  }
  
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Uploaded files are served from the backend root (/uploads/*), not /api/uploads/*.
  if (normalizedPath.startsWith('/uploads/')) {
    return `${getBackendAssetBaseUrl()}${normalizedPath}`;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

/**
 * Returns the public-facing frontend base URL.
 * Uses VITE_FRONTEND_URL env var if set (for production deployments),
 * otherwise falls back to window.location.origin.
 * This ensures referral links always point to the correct public domain,
 * even when the dashboard is accessed from a different origin.
 */
export function getFrontendBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_FRONTEND_URL as string | undefined)?.replace(/\/$/, '');
  if (envUrl && envUrl.length > 0) return envUrl;
  return window.location.origin;
}

/**
 * Generates a referral catalog link for a given slug.
 * Always points to /produk?ref=<slug> on the public frontend domain.
 */
export function buildReferralLink(slug: string): string {
  return `${getFrontendBaseUrl()}/produk?ref=${encodeURIComponent(slug)}`;
}
