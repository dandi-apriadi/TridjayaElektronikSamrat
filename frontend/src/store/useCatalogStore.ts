import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

/** Lean product type for catalog list view — no description, specs, ratings array, etc. */
export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  displayPrice?: number;
  priceMarkup?: {
    id: string;
    scope: string;
    targetValue?: string | null;
    markupType: string;
    markupValue: number;
  } | null;
  priceInstallment?: number;
  dpMin?: number;
  image: string;
  badge?: string;
  badgeText?: string;
  stock: string;
  stockQuantity?: number | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  views?: number;
  leads?: number;
  conversions?: number;
  conversionRate?: number;
}

export interface CatalogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CatalogAggregates {
  totalActive: number;
  totalLowStock: number;
  totalOutOfStock: number;
  totalViews: number;
  totalLeads: number;
  totalConversions: number;
}

export interface CatalogQuery {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  search?: string;
  sort?: string;
}

interface CatalogState {
  items: CatalogItem[];
  pagination: CatalogPagination;
  aggregates: CatalogAggregates;
  categories: string[];
  isLoading: boolean;
  error: string | null;
  lastQuery: CatalogQuery | null;
  fetchCatalogPage: (params: CatalogQuery) => Promise<void>;
  invalidate: () => void;
}

const defaultPagination: CatalogPagination = { page: 1, limit: 20, total: 0, totalPages: 0 };
const defaultAggregates: CatalogAggregates = {
  totalActive: 0,
  totalLowStock: 0,
  totalOutOfStock: 0,
  totalViews: 0,
  totalLeads: 0,
  totalConversions: 0,
};

function buildQueryString(params: CatalogQuery): string {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.category && params.category !== 'Semua') searchParams.set('category', params.category);
  if (params.status && params.status !== 'Semua') searchParams.set('status', params.status);
  if (params.search?.trim()) searchParams.set('search', params.search.trim());
  if (params.sort) searchParams.set('sort', params.sort);
  return searchParams.toString();
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  pagination: defaultPagination,
  aggregates: defaultAggregates,
  categories: [],
  isLoading: false,
  error: null,
  lastQuery: null,

  fetchCatalogPage: async (params: CatalogQuery) => {
    // Avoid duplicate requests with same params
    const current = get();
    if (current.isLoading) return;

    set({ isLoading: true, error: null, lastQuery: params });

    try {
      const qs = buildQueryString(params);
      const response = await apiFetch(`/api/admin/catalogs/paginated?${qs}`);

      if (!response.ok) {
        throw new Error('Gagal mengambil data katalog');
      }

      const payload = await response.json();
      const data = payload.data || {};

      set({
        items: data.items || [],
        pagination: data.pagination || defaultPagination,
        aggregates: data.aggregates || defaultAggregates,
        categories: data.categories || [],
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan jaringan',
      });
    }
  },

  invalidate: () => {
    // Re-fetch with last query params
    const lastQuery = get().lastQuery;
    if (lastQuery) {
      set({ isLoading: false }); // Reset loading state to allow re-fetch
      get().fetchCatalogPage(lastQuery);
    }
  },
}));
