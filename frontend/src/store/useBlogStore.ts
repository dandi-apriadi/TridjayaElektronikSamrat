import { create } from 'zustand';
import type { BlogPost } from '../types';
import { apiFetch } from '../utils/apiClient';

interface BlogState {
  posts: BlogPost[];
  isLoading: boolean;
  error: string | null;
  fetchPosts: (force?: boolean) => Promise<void>;
  getPostBySlug: (slug: string) => BlogPost | undefined;
  createPost: (data: Partial<BlogPost>) => Promise<boolean>;
  updatePost: (id: string, data: Partial<BlogPost>) => Promise<boolean>;
  deletePost: (id: string) => Promise<boolean>;
}

export const useBlogStore = create<BlogState>((set, get) => ({
  posts: [],
  isLoading: false,
  error: null,
  fetchPosts: async (force = false) => {
    if (get().isLoading) return;
    if (!force && get().posts.length > 0) return;
 
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/articles', { skipAuth: true });
      
      if (!response.ok) {
        throw new Error('Gagal mengambil data artikel');
      }

      const payload = await response.json();
      const items = payload.data?.items || [];
      
      set({ posts: items, isLoading: false });
    } catch (error) {
      console.error('Error fetching articles:', error);
      set({ 
        isLoading: false, 
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan' 
      });
    }
  },
  getPostBySlug: (slug: string) => {
    return get().posts.find((p) => p.slug === slug);
  },
  createPost: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create article');
      set({ isLoading: false });
      await get().fetchPosts(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  updatePost: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiFetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update article');
      set({ isLoading: false });
      await get().fetchPosts(true);
      return true;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Error', isLoading: false });
      return false;
    }
  },
  deletePost: async (id) => {
    try {
      const response = await apiFetch(`/api/articles/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete article');
      set((state) => ({ posts: state.posts.filter(p => p.id !== id) }));
      return true;
    } catch (error) {
      return false;
    }
  }
}));
