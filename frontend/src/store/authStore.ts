import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'agent' | 'editor' | 'operator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  isActive?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  restoreSession: () => Promise<void>;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_URL = `${API_BASE_URL}/api`;

/**
 * HttpOnly Cookie Auth Strategy:
 * - Refresh token stored in HttpOnly cookie (set by backend on login/refresh)
 * - Access token kept in memory only (accessToken state)
 * - On page load, attempts to refresh session via cookie
 * - Bearer token fallback for compatibility
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      login: async ({ email, password }) => {
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.message || 'Login gagal');
          }

          const payload = (await response.json()) as { data?: LoginResponse };
          const authData = payload.data;

          if (!authData?.user) {
            throw new Error('Respons login tidak valid');
          }

          set({
            user: authData.user,
            isAuthenticated: true,
            accessToken: authData.access_token,
          });

          return authData.user;
        } catch (error) {
          throw error;
        }
      },
      logout: async () => {
        const currentToken = useAuthStore.getState().accessToken;
        try {
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
            headers: currentToken
              ? {
                  Authorization: `Bearer ${currentToken}`,
                }
              : undefined,
          });
        } catch {
          // Clear local auth state even when API is unreachable.
        }

        set({ user: null, isAuthenticated: false, accessToken: null });
      },
      refreshSession: async () => {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: '' }),
          });

          if (!response.ok) {
            return false;
          }

          const payload = (await response.json()) as { data?: LoginResponse };
          const authData = payload.data;

          if (!authData?.user) {
            return false;
          }

          set({
            user: authData.user,
            isAuthenticated: true,
            accessToken: authData.access_token,
          });

          return true;
        } catch {
          return false;
        }
      },
      restoreSession: async () => {
        try {
          const response = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: '' }),
          });

          if (response.ok) {
            const payload = (await response.json()) as { data?: LoginResponse };
            const authData = payload.data;

            if (authData?.user) {
              set({
                user: authData.user,
                isAuthenticated: true,
                accessToken: authData.access_token,
              });
            }
          }
        } catch {
          // Silent fail on restore attempt
        }
      },
    }),
    {
      name: 'tridjaya-auth',
    }
  )
);
