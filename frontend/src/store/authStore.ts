import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE_URL } from '../utils/apiClient';

export type UserRole = 'admin' | 'agent' | 'editor' | 'operator';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  bank_account?: string;
  created_at?: string;
  last_login?: string;
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
  isInitializing: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  restoreSession: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  updatePassword: (old: string, newP: string) => Promise<boolean>;
}

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
      isInitializing: true,
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

          if (!authData?.access_token || !authData?.user) {
            return false;
          }

          set({
            user: authData.user,
            isAuthenticated: true,
            accessToken: authData.access_token,
          });

          return true;
        } catch (error) {
          console.error('Refresh session error:', error);
          return false;
        }
      },
      restoreSession: async () => {
        set({ isInitializing: true });
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

            if (authData?.access_token && authData?.user) {
              set({
                user: authData.user,
                isAuthenticated: true,
                accessToken: authData.access_token,
              });
            }
          }
        } catch (error) {
          console.error('Restore session error:', error);
        } finally {
          set({ isInitializing: false });
        }
      },
      updateProfile: async (data) => {
        try {
          const token = useAuthStore.getState().accessToken;
          const res = await fetch(`${API_URL}/auth/profile`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
          });
          if (!res.ok) throw new Error('Gagal update profil');
          const payload = await res.json();
          set({ user: payload.data });
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      },
      updatePassword: async (old, newP) => {
        try {
          const token = useAuthStore.getState().accessToken;
          const res = await fetch(`${API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ old_password: old, new_password: newP })
          });
          if (!res.ok) throw new Error('Gagal ubah password');
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      }
    }),
    {
      name: 'tridjaya-auth',
    }
  )
);
