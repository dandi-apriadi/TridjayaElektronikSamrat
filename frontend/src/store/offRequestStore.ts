import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

export type OffRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface OffRequest {
  id: string;
  karyawanId: string;
  karyawanNama: string;
  cabang: string;
  divisi: string;
  tanggal: string;
  alasan: string;
  status: OffRequestStatus;
  reviewerId?: string;
  reviewerNama?: string;
  reviewerComment?: string;
  reviewedAt?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

interface FetchOffRequestsParams {
  status?: OffRequestStatus | 'all';
  karyawanId?: string;
  tanggal?: string;
  tanggalFrom?: string;
  tanggalTo?: string;
  page?: number;
  limit?: number;
}

interface OffRequestStore {
  requests: OffRequest[];
  total: number;
  isLoading: boolean;
  error: string | null;
  fetchRequests: (params?: FetchOffRequestsParams) => Promise<void>;
  createRequest: (payload: { tanggal: string; alasan: string }) => Promise<OffRequest>;
  reviewRequest: (id: string, payload: { status: 'approved' | 'rejected'; comment?: string }) => Promise<OffRequest>;
  getApprovedOffForDate: (employeeId: string | undefined, tanggal: string) => OffRequest | undefined;
  getLatestForDate: (employeeId: string | undefined, tanggal: string) => OffRequest | undefined;
}

const readApiError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return payload.errors.join(', ');
  return payload?.detail || payload?.message || fallback;
};

const mapApiOffRequest = (item: any): OffRequest => ({
  id: String(item.id),
  karyawanId: String(item.karyawanId || item.karyawan_id || ''),
  karyawanNama: String(item.karyawanNama || item.karyawan_nama || ''),
  cabang: String(item.cabang || ''),
  divisi: String(item.divisi || ''),
  tanggal: String(item.tanggal || ''),
  alasan: String(item.alasan || ''),
  status: (item.status || 'pending') as OffRequestStatus,
  reviewerId: item.reviewerId || item.reviewer_id || undefined,
  reviewerNama: item.reviewerNama || item.reviewer_nama || undefined,
  reviewerComment: item.reviewerComment || item.reviewer_comment || undefined,
  reviewedAt: item.reviewedAt || item.reviewed_at || undefined,
  expiresAt: String(item.expiresAt || item.expires_at || ''),
  createdAt: String(item.createdAt || item.created_at || ''),
  updatedAt: String(item.updatedAt || item.updated_at || ''),
});

export const useOffRequestStore = create<OffRequestStore>((set, get) => ({
  requests: [],
  total: 0,
  isLoading: false,
  error: null,
  fetchRequests: async (params) => {
    set({ isLoading: true, error: null });
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.karyawanId) query.set('karyawan_id', params.karyawanId);
    if (params?.tanggal) query.set('tanggal', params.tanggal);
    if (params?.tanggalFrom) query.set('tanggal_from', params.tanggalFrom);
    if (params?.tanggalTo) query.set('tanggal_to', params.tanggalTo);
    if (params?.page) query.set('page', String(params.page));
    query.set('limit', String(params?.limit || 200));

    try {
      const response = await apiFetch(`/api/off-requests?${query.toString()}`);
      if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat pengajuan OFF.'));
      const payload = await response.json();
      set({
        requests: (payload.data?.items || []).map(mapApiOffRequest),
        total: Number(payload.data?.total || 0),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Gagal memuat pengajuan OFF.',
        isLoading: false,
      });
    }
  },
  createRequest: async (payload) => {
    const response = await apiFetch('/api/off-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal membuat pengajuan OFF.'));
    const body = await response.json();
    const item = mapApiOffRequest(body.data);
    set((state) => ({
      requests: [item, ...state.requests.filter((request) => request.id !== item.id)],
      total: state.total + 1,
      error: null,
    }));
    return item;
  },
  reviewRequest: async (id, payload) => {
    const response = await apiFetch(`/api/off-requests/${encodeURIComponent(id)}/review`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal memproses pengajuan OFF.'));
    const body = await response.json();
    const item = mapApiOffRequest(body.data);
    set((state) => ({
      requests: state.requests.map((request) => (request.id === item.id ? item : request)),
      error: null,
    }));
    return item;
  },
  getApprovedOffForDate: (employeeId, tanggal) =>
    get().requests.find((request) => request.karyawanId === employeeId && request.tanggal === tanggal && request.status === 'approved'),
  getLatestForDate: (employeeId, tanggal) =>
    get()
      .requests
      .filter((request) => request.karyawanId === employeeId && request.tanggal === tanggal)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
}));
