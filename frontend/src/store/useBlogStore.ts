import { create } from 'zustand';
import type { BlogPost } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_URL = `${API_BASE_URL}/api`;

interface BlogState {
  posts: BlogPost[];
  isLoading: boolean;
  error: string | null;
  fetchPosts: () => Promise<void>;
  getPostBySlug: (slug: string) => BlogPost | undefined;
}

export const useBlogStore = create<BlogState>((set, get) => ({
  posts: [],
  isLoading: false,
  error: null,
  fetchPosts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/articles`);
      
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
  }
}));
