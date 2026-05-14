import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { API_BASE_URL, apiFetch } from '../utils/apiClient';

const API_ENDPOINT = `${API_BASE_URL}/api`;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator' | 'sales' | 'agent' | string;
  /** Jabatan (title/position) — display only, does NOT affect system access.
   *  Only meaningful for users with role = "sales".
   *  Values: "kepala_cabang" | "supervisor" | "koordinator" | "sales"
   */
  jabatan?: string;
  avatar: string;
  bank_account?: string;
  whatsapp?: string;
  referral_slug?: string;
  created_at?: string;
  last_login?: string;
  is_active: boolean;
  is_verified: boolean;
}

interface UserStoreState {
  users: AdminUser[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: (force?: boolean) => Promise<void>;
  createUser: (data: {
    email: string;
    name: string;
    role: string;
    jabatan?: string;
    password: string;
    avatar?: string;
    bankAccount?: string;
    whatsapp?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  updateUser: (id: string, data: Partial<{
    email: string;
    name: string;
    role: string;
    jabatan: string;
    password: string;
    avatar: string;
    bankAccount: string;
    whatsapp: string;
    isActive: boolean;
    isVerified: boolean;
  }>) => Promise<boolean>;
  verifyUser: (id: string) => Promise<boolean>;
  resendVerification: (id: string) => Promise<boolean>;
  updateUserStatus: (id: string, isActive: boolean) => Promise<boolean>;
  resetUserPassword: (id: string, password: string) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
}

export const useUserStore = create<UserStoreState>((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async (force = false) => {
    // Prevent double fetch if already loading or if data exists and not forced
    if (get().isLoading) return;
    if (!force && get().users.length > 0) return;
 
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/users');

      if (!response.ok) {
        throw new Error('Gagal mengambil data users');
      }

      const payload = await response.json();
      set({ users: payload.data?.items || [], isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan',
        isLoading: false,
      });
    }
  },

  createUser: async (data) => {
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Gagal membuat user baru');
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },

  updateUser: async (id, data) => {
    try {
      const response = await apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui user');
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },

  updateUserStatus: async (id, isActive) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui status user');
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },

  verifyUser: async (id) => {
    try {
      const response = await apiFetch(`/api/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVerified: true }),
      });

      if (!response.ok) {
        throw new Error('Gagal memverifikasi user');
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },

  resendVerification: async (id) => {
    try {
      const response = await apiFetch(`/api/users/${id}/resend-verification`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Gagal mengirim ulang verifikasi');
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },

  resetUserPassword: async (id, password) => {
    try {
      const response = await apiFetch(`/api/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        throw new Error('Gagal mereset kata sandi user');
      }

      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },
  deleteUser: async (id) => {
    try {
      const response = await apiFetch(`/api/users/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMsg = errorData?.message || errorData?.errors?.[0] || 'Gagal menghapus user';
        throw new Error(errorMsg);
      }

      await useUserStore.getState().fetchUsers(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },
}));
