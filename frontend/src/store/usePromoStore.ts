import { create } from 'zustand';
import type { PromoItem } from '../types';
import { apiFetch } from '../utils/apiClient';

interface PromoState {
  promos: PromoItem[];
  isLoading: boolean;
  error: string | null;
  fetchPromos: (force?: boolean) => Promise<void>;
  getPromoById: (id: string) => PromoItem | undefined;
  createPromo: (data: Partial<PromoItem>) => Promise<boolean>;
  updatePromo: (id: string, data: Partial<PromoItem>) => Promise<boolean>;
  deletePromo: (id: string) => Promise<boolean>;
}

export const usePromoStore = create<PromoState>((set, get) => ({
  promos: [],
  isLoading: false,
  error: null,
  fetchPromos: async (force = false) => {
    if (get().isLoading) return;
    if (!force && get().promos.length > 0) return;
 
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/promotions', { skipAuth: true });
      
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
      const response = await apiFetch('/api/promotions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create promo');
      set({ isLoading: false });
      await get().fetchPromos(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  updatePromo: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch(`/api/promotions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update promo');
      set({ isLoading: false });
      await get().fetchPromos(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  deletePromo: async (id) => {
    try {
      const response = await apiFetch(`/api/promotions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete promo');
      set((state) => ({ promos: state.promos.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  }
}));
