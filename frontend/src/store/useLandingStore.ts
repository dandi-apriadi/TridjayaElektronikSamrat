import { create } from 'zustand';
import type { LandingHeroSlideData, LandingHomeData } from '../types';
import { apiFetch } from '../utils/apiClient';
import { readApiError } from '../utils/apiError';

type LandingSlideInput = Partial<Omit<LandingHeroSlideData, 'id'>>;

interface LandingState {
  home: LandingHomeData | null;
  slides: LandingHeroSlideData[];
  isLoadingHome: boolean;
  isLoadingSlides: boolean;
  error: string | null;
  fetchHome: (force?: boolean) => Promise<void>;
  fetchSlides: (force?: boolean) => Promise<void>;
  createSlide: (data: LandingSlideInput) => Promise<LandingHeroSlideData>;
  updateSlide: (id: string, data: LandingSlideInput) => Promise<LandingHeroSlideData>;
  deleteSlide: (id: string) => Promise<void>;
  updateSlideOrder: (items: Array<{ id: string; sortOrder: number }>) => Promise<void>;
  uploadSlideImage: (file: File) => Promise<string>;
}

const parseItems = (payload: any): LandingHeroSlideData[] => payload?.data?.items ?? [];
const parseItem = (payload: any): LandingHeroSlideData => payload?.data?.item;

export const useLandingStore = create<LandingState>((set, get) => ({
  home: null,
  slides: [],
  isLoadingHome: false,
  isLoadingSlides: false,
  error: null,

  fetchHome: async (force = false) => {
    if (!force && get().home) return;
    if (get().isLoadingHome) return;

    set({ isLoadingHome: true, error: null });
    try {
      const response = await apiFetch('/api/landing/home', { skipAuth: true });
      if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat landing page'));
      const payload = await response.json();
      set({ home: payload.data as LandingHomeData, isLoadingHome: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan',
        isLoadingHome: false,
      });
    }
  },

  fetchSlides: async (force = false) => {
    if (!force && get().slides.length > 0) return;
    if (get().isLoadingSlides) return;

    set({ isLoadingSlides: true, error: null });
    try {
      const response = await apiFetch('/api/admin/landing/slides');
      if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat slide landing'));
      const payload = await response.json();
      set({ slides: parseItems(payload), isLoadingSlides: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan',
        isLoadingSlides: false,
      });
    }
  },

  createSlide: async (data) => {
    const response = await apiFetch('/api/admin/landing/slides', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal membuat slide'));
    const payload = await response.json();
    const item = parseItem(payload);
    set((state) => ({
      slides: [...state.slides, item].sort((a, b) => a.sortOrder - b.sortOrder),
      home: null,
    }));
    return item;
  },

  updateSlide: async (id, data) => {
    const response = await apiFetch(`/api/admin/landing/slides/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal memperbarui slide'));
    const payload = await response.json();
    const item = parseItem(payload);
    set((state) => ({
      slides: state.slides.map((slide) => (slide.id === id ? item : slide)).sort((a, b) => a.sortOrder - b.sortOrder),
      home: null,
    }));
    return item;
  },

  deleteSlide: async (id) => {
    const response = await apiFetch(`/api/admin/landing/slides/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal menghapus slide'));
    set((state) => ({
      slides: state.slides.filter((slide) => slide.id !== id),
      home: null,
    }));
  },

  updateSlideOrder: async (items) => {
    const response = await apiFetch('/api/admin/landing/slides/order', {
      method: 'PATCH',
      body: JSON.stringify(items),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal mengurutkan slide'));
    set((state) => ({
      slides: state.slides
        .map((slide) => {
          const found = items.find((item) => item.id === slide.id);
          return found ? { ...slide, sortOrder: found.sortOrder } : slide;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder),
      home: null,
    }));
  },

  uploadSlideImage: async (file) => {
    const body = new FormData();
    body.append('file', file);
    const response = await apiFetch('/api/admin/landing/slides/upload', {
      method: 'POST',
      body,
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal upload gambar'));
    const payload = await response.json();
    return String(payload?.data?.url ?? '');
  },
}));
