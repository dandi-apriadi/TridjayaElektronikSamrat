import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'agent' | 'sales' | 'editor' | 'operator' | 'super_admin';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  bank_account?: string;
  whatsapp?: string;
  referral_slug?: string;
  created_at?: string;
  last_login?: string;
  isActive?: boolean;
  is_active?: boolean;
  is_verified?: boolean;
  /**
   * Backend mengirim flag ini sebagai true bila user wajib mengganti password
   * (mis. baru disetujui admin atau password-nya direset). Frontend wajib
   * mengarahkan user ke halaman ganti password sebelum membuka dashboard.
   */
  must_change_password?: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
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

/**
 * Untuk auth endpoints, gunakan relative URL agar request melewati Vite proxy
 * (development) atau same-origin (production). Ini memastikan HttpOnly cookies
 * dikirim dengan benar karena tidak ada cross-origin issue.
 */
const API_URL = '/api';

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
      login: async ({ email, password, remember }) => {
        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password, remember }),
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
            set({ user: null, isAuthenticated: false, accessToken: null });
            return false;
          }

          const payload = (await response.json()) as { data?: LoginResponse & { authenticated?: boolean } };
          const authData = payload.data;

          if (authData?.authenticated === false || !authData?.access_token || !authData?.user) {
            set({ user: null, isAuthenticated: false, accessToken: null });
            return false;
          }

          set({
            user: authData.user,
            isAuthenticated: true,
            accessToken: authData.access_token,
          });

          return true;
        } catch {
          set({ user: null, isAuthenticated: false, accessToken: null });
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

          if (!response.ok) {
            set({ user: null, isAuthenticated: false, accessToken: null });
            return;
          }

          const payload = (await response.json()) as { data?: LoginResponse & { authenticated?: boolean } };
          const authData = payload.data;

          if (authData?.authenticated !== false && authData?.access_token && authData?.user) {
            set({
              user: authData.user,
              isAuthenticated: true,
              accessToken: authData.access_token,
            });
          } else {
            set({ user: null, isAuthenticated: false, accessToken: null });
          }
        } catch (error) {
          console.error('Session restoration failed:', error);
          set({ user: null, isAuthenticated: false, accessToken: null });
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
          // Backend baru saja meng-clear must_change_password di DB. Sinkronkan
          // state lokal supaya banner force-change-password & redirect login
          // berikutnya tidak salah berperilaku.
          const currentUser = useAuthStore.getState().user;
          if (currentUser?.must_change_password) {
            set({ user: { ...currentUser, must_change_password: false } });
          }
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      }
    }),
    {
      name: 'tridjaya-auth',
      // TIDAK persist user data ke localStorage untuk keamanan.
      // Access token sengaja TIDAK dipersist; refresh token disimpan di HttpOnly cookie
      // oleh backend dan dipulihkan via restoreSession() saat aplikasi mount.
      // User data akan di-fetch ulang setelah refresh token valid.
      partialize: () => ({}), // Tidak persist apa pun
    }
  )
);
