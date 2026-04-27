import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { API_BASE_URL } from '../utils/apiClient';

const API_ENDPOINT = `${API_BASE_URL}/api`;

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'editor' | 'operator' | string;
  avatar: string;
  bank_account?: string;
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
    password: string;
    avatar?: string;
    bankAccount?: string;
    isActive?: boolean;
  }) => Promise<boolean>;
  updateUser: (id: string, data: Partial<{
    email: string;
    name: string;
    role: string;
    password: string;
    avatar: string;
    bankAccount: string;
    isActive: boolean;
    isVerified: boolean;
  }>) => Promise<boolean>;
  verifyUser: (id: string) => Promise<boolean>;
  resendVerification: (id: string) => Promise<boolean>;
  updateUserStatus: (id: string, isActive: boolean) => Promise<boolean>;
  resetUserPassword: (id: string, password: string) => Promise<boolean>;
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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users/${id}/resend-verification`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_ENDPOINT}/users/${id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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
}));
