import { create } from 'zustand';
import type { PromoItem } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_URL = `${API_BASE_URL}/api`;

interface PromoState {
  promos: PromoItem[];
  isLoading: boolean;
  error: string | null;
  fetchPromos: () => Promise<void>;
  getPromoById: (id: string) => PromoItem | undefined;
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
  }
}));
