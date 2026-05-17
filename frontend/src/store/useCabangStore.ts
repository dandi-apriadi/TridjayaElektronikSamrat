import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';
import type { CabangItem } from '../types';

interface ApiErrorPayload {
  message?: string;
  detail?: string | null;
  errors?: string[];
}

async function getApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return payload.errors.filter(Boolean).join(', ');
  }
  return payload?.detail || payload?.message || fallback;
}

interface CabangStoreState {
  cabang: CabangItem[];
  isLoading: boolean;
  error: string | null;
  fetchCabang: (force?: boolean) => Promise<void>;
  createCabang: (data: Partial<Pick<CabangItem, 'nama' | 'alamat' | 'kota' | 'telepon' | 'koordinatorNama' | 'isActive'>>) => Promise<boolean>;
  updateCabang: (id: string, data: Partial<Pick<CabangItem, 'nama' | 'alamat' | 'kota' | 'telepon' | 'koordinatorNama' | 'isActive'>>) => Promise<boolean>;
  deleteCabang: (id: string) => Promise<boolean>;
}

export const useCabangStore = create<CabangStoreState>((set, get) => ({
  cabang: [],
  isLoading: false,
  error: null,

  fetchCabang: async (force = false) => {
    if (get().isLoading && !force) return;
    if (!force && get().cabang.length > 0) return;

    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/admin/cabang');
      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Gagal mengambil data cabang'));
      }

      const payload = await response.json();
      set({ cabang: payload.data?.items || [], isLoading: false });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat cabang',
      });
    }
  },

  createCabang: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/admin/cabang', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Gagal menambah cabang'));
      }

      await get().fetchCabang(true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menambah cabang',
      });
      return false;
    }
  },

  updateCabang: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch(`/api/admin/cabang/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Gagal memperbarui cabang'));
      }

      await get().fetchCabang(true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui cabang',
      });
      return false;
    }
  },

  deleteCabang: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch(`/api/admin/cabang/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(await getApiErrorMessage(response, 'Gagal menghapus cabang'));
      }

      await get().fetchCabang(true);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menghapus cabang',
      });
      return false;
    }
  },
}));
