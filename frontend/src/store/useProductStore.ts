import { create } from 'zustand';
import type { Product } from '../types';
import { apiFetch } from '../utils/apiClient';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: (force?: boolean) => Promise<void>;
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
  fetchProducts: async (force = false) => {
    // Prevent redundant fetching, but allow if forced
    if (get().isLoading && !force) return;
    if (!force && get().products.length > 0) return;
 
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/catalogs');
      
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
      const response = await apiFetch('/api/catalogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create product');
      
      // Reset loading before fetching or pass force=true
      set({ isLoading: false }); 
      await get().fetchProducts(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  updateProduct: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch(`/api/catalogs/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update product');
      
      // Reset loading before fetching or pass force=true
      set({ isLoading: false });
      await get().fetchProducts(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  deleteProduct: async (id) => {
    try {
      const response = await apiFetch(`/api/catalogs/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete product');
      set((state) => ({ products: state.products.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  }
}));
