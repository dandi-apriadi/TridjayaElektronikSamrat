import { create } from 'zustand';
import type { Product } from '../types';
import { useAuthStore } from './authStore';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_URL = `${API_BASE_URL}/api`;

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: () => Promise<void>;
  getProductsByCategory: (category: Product['category']) => Product[];
  getProductBySlug: (slug: string) => Product | undefined;
  createProduct: (data: Partial<Product>) => Promise<boolean>;
  updateProduct: (id: string, data: Partial<Product>) => Promise<boolean>;
  deleteProduct: (id: string) => Promise<boolean>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  isLoading: false,
  error: null,
  fetchProducts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/catalogs`);
      
      if (!response.ok) {
        throw new Error('Gagal mengambil data produk dari server');
      }

      const payload = await response.json();
      const items = payload.data?.items || [];
      
      set({ products: items, isLoading: false });
    } catch (error) {
      console.error('Error fetching products:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' 
      });
    }
  },
  getProductsByCategory: (category: Product['category']) => {
    return get().products.filter((p) => p.category === category);
  },
  getProductBySlug: (slug: string) => {
    return get().products.find((p) => p.slug === slug);
  },
  createProduct: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/catalogs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create product');
      await get().fetchProducts();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  updateProduct: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/catalogs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update product');
      await get().fetchProducts();
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  deleteProduct: async (id) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const response = await fetch(`${API_URL}/catalogs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete product');
      set((state) => ({ products: state.products.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  }
}));
