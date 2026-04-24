import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'editor' | 'operator' | string;
  avatar: string;
  is_active: boolean;
}

interface UserStoreState {
  users: AdminUser[];
  isLoading: boolean;
  error: string | null;
  fetchUsers: () => Promise<void>;
  updateUserStatus: (id: string, isActive: boolean) => Promise<boolean>;
}

const API_ROOT = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_BASE_URL = `${API_ROOT}/api`;

export const useUserStore = create<UserStoreState>((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_BASE_URL}/users`, {
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

  updateUserStatus: async (id, isActive) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_BASE_URL}/users/${id}`, {
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

      await useUserStore.getState().fetchUsers();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' });
      return false;
    }
  },
}));
