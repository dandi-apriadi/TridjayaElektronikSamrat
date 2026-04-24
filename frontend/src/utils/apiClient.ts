/**
 * Centralized API client with automatic token refresh on 401.
 * Handles HttpOnly cookie auth with bearer fallback.
 */

import { useAuthStore } from '../store/authStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Enhanced fetch with automatic token refresh on 401
 */
export async function apiFetch(
  endpoint: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth = false, ...fetchOptions } = options;

  // Build URL
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  // Set default options
  const finalOptions: RequestInit = {
    credentials: 'include', // Allow cookies
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    },
  };

  // Add bearer token if available and not skipped
  if (!skipAuth) {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      finalOptions.headers = {
        ...finalOptions.headers,
        Authorization: `Bearer ${accessToken}`,
      };
    }
  }

  let response = await fetch(url, finalOptions);

  // Handle 401 - attempt token refresh
  if (response.status === 401 && !skipAuth) {
    // If already refreshing, wait for it
    if (isRefreshing && refreshPromise) {
      const refreshed = await refreshPromise;
      if (refreshed) {
        // Retry with new token
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) {
          finalOptions.headers = {
            ...finalOptions.headers,
            Authorization: `Bearer ${newToken}`,
          };
          response = await fetch(url, finalOptions);
        }
      }
      return response;
    }

    // Start refresh
    isRefreshing = true;
    refreshPromise = useAuthStore.getState().refreshSession();

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry with new token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        finalOptions.headers = {
          ...finalOptions.headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(url, finalOptions);
      }
    } else {
      // Refresh failed - logout
      await useAuthStore.getState().logout();
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
