import { create } from 'zustand';
import type { PartnerItem } from '../types';
import { apiFetch } from '../utils/apiClient';

interface PartnerState {
  partners: PartnerItem[];
  isLoading: boolean;
  error: string | null;
  fetchPartners: (force?: boolean, adminView?: boolean) => Promise<void>;
  createPartner: (data: Partial<PartnerItem>) => Promise<boolean>;
  updatePartner: (id: string, data: Partial<PartnerItem>) => Promise<boolean>;
  updatePartnerOrder: (items: Array<{ id: string; sortOrder: number }>) => Promise<boolean>;
  deletePartner: (id: string) => Promise<boolean>;
}

export const usePartnerStore = create<PartnerState>((set, get) => ({
  partners: [],
  isLoading: false,
  error: null,

  fetchPartners: async (force = false, adminView = false) => {
    if (!force && get().isLoading) return;
    if (!force && get().partners.length > 0 && !adminView) return;

    set({ isLoading: true, error: null });
    try {
      const endpoint = adminView ? '/api/admin/partners' : '/api/partners';
      const response = await apiFetch(endpoint);
      if (!response.ok) {
        throw new Error('Gagal mengambil data partner');
      }

      const payload = await response.json();
      const items = payload.data?.items || [];
      set({ partners: items, isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat partner',
      });
    }
  },

  createPartner: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === 'logo' && (value as unknown) instanceof File) {
            formData.append('logo', value as unknown as File);
          } else {
            formData.append(key, String(value));
          }
        }
      });

      const response = await apiFetch('/api/admin/partners', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Gagal menambah partner');
      }

      await get().fetchPartners(true, true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menambah partner',
      });
      return false;
    }
  },

  updatePartner: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          if (key === 'logo' && (value as unknown) instanceof File) {
            formData.append('logo', value as unknown as File);
          } else {
            formData.append(key, String(value));
          }
        }
      });

      const response = await apiFetch(`/api/admin/partners/${id}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui partner');
      }

      await get().fetchPartners(true, true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui partner',
      });
      return false;
    }
  },

  updatePartnerOrder: async (items) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/admin/partners/order', {
        method: 'PATCH',
        body: JSON.stringify(items),
      });

      if (!response.ok) {
        throw new Error('Gagal memperbarui urutan partner');
      }

      await get().fetchPartners(true, true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengurutkan partner',
      });
      return false;
    }
  },


  deletePartner: async (id) => {
    set({ error: null });
    try {
      const response = await apiFetch(`/api/admin/partners/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Gagal menghapus partner');
      }

      set((state) => ({
        partners: state.partners.filter((item) => item.id !== id),
      }));
      return true;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus partner',
      });
      return false;
    }
  },
}));
