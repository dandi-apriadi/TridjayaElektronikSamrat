import { create } from 'zustand';
import type { PromoItem } from '../types';
import { useAuthStore } from './authStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_URL = `${API_BASE_URL}/api`;

interface PromoState {
  promos: PromoItem[];
  isLoading: boolean;
  error: string | null;
  fetchPromos: () => Promise<void>;
  getPromoById: (id: string) => PromoItem | undefined;
  createPromo: (data: Partial<PromoItem>) => Promise<boolean>;
  updatePromo: (id: string, data: Partial<PromoItem>) => Promise<boolean>;
  deletePromo: (id: string) => Promise<boolean>;
}

export const usePromoStore = create<PromoState>((set, get) => ({
  promos: [],
  isLoading: false,
  error: null,
  fetchPromos: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/promotions`);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil data promo');
      }

      const payload = await response.json();
      const items = payload.data?.items || [];
      
      set({ promos: items, isLoading: false });
    } catch (error) {
      console.error('Error fetching promos:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' 
      });
    }
  },
  getPromoById: (id: string) => {
    return get().promos.find((p) => p.id === id);
  },
  createPromo: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/promotions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create promo');
      await get().fetchPromos();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  updatePromo: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/promotions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update promo');
      await get().fetchPromos();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  deletePromo: async (id) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/promotions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete promo');
      set((state) => ({ promos: state.promos.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  }
}));
