import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

export type ProspekStatus = 'deal' | 'not_deal' | 'fu_ulang' | 'tanya_tanya' | 'polling';

export interface KaryawanProspekEntry {
  id: string;
  karyawanId: string;
  karyawanName: string;
  cabang: string;
  divisi: string;
  targetKategori?: 'sales' | 'non_sales';
  namaProspek: string;
  noWhatsapp: string;
  minatBarang: string;
  keteranganProspek: string;
  statusProspek: ProspekStatus;
  keteranganFincoy: string;
  tanggal: string;
  createdAt: string;
}

export const statusLabel: Record<ProspekStatus, string> = {
  deal: 'Deal',
  not_deal: 'Not Deal',
  fu_ulang: 'FU Ulang',
  tanya_tanya: 'Tanya-tanya',
  polling: 'Polling',
};

export const statusColor: Record<ProspekStatus, string> = {
  deal: 'bg-secondary/10 text-secondary border-secondary/20',
  not_deal: 'bg-error/10 text-error border-error/20',
  fu_ulang: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  tanya_tanya: 'bg-primary/10 text-primary border-primary/20',
  polling: 'bg-tertiary/10 text-tertiary border-tertiary/20',
};

export const formatProspekDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const normalizeWhatsapp = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('620')) {
    return `0${digits.slice(3)}`;
  }
  if (digits.startsWith('62')) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith('8')) {
    return `0${digits}`;
  }
  if (digits.startsWith('0')) {
    return digits;
  }

  return `0${digits}`;
};

const toWhatsappLinkNumber = (value: string) => {
  const normalized = normalizeWhatsapp(value);
  if (!normalized) return '';
  return `62${normalized.slice(1)}`;
};

export const buildWhatsappUrl = (phone: string, name: string) => {
  const normalized = toWhatsappLinkNumber(phone);
  const message = `Halo ${name}, saya dari Tridjaya Group ingin follow up minat produk yang sebelumnya dibahas.`;
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : '#';
};

interface KaryawanProspekState {
  prospek: KaryawanProspekEntry[];
  isLoading: boolean;
  error: string | null;
  fetchProspek: (params?: { tanggal?: string; karyawanId?: string; limit?: number }) => Promise<void>;
  addProspek: (entry: Omit<KaryawanProspekEntry, 'id'>) => Promise<void>;
  updateProspek: (id: string, updates: Partial<Omit<KaryawanProspekEntry, 'id' | 'karyawanId' | 'karyawanName' | 'tanggal' | 'createdAt'>>) => Promise<void>;
  deleteProspek: (id: string) => Promise<void>;
}

const mapApiProspek = (item: any): KaryawanProspekEntry => ({
  id: String(item.id),
  karyawanId: String(item.karyawanId || item.karyawan_id || ''),
  karyawanName: String(item.karyawanName || item.karyawan_name || ''),
  cabang: String(item.cabang || 'Manado'),
  divisi: String(item.divisi || 'Karyawan'),
  targetKategori: (item.targetKategori || item.target_kategori || 'non_sales') === 'sales' ? 'sales' : 'non_sales',
  namaProspek: String(item.namaProspek || item.nama_prospek || ''),
  noWhatsapp: normalizeWhatsapp(String(item.noWhatsapp || item.no_whatsapp || '')),
  minatBarang: String(item.minatBarang || item.minat_barang || ''),
  keteranganProspek: String(item.keteranganProspek || item.keterangan_prospek || ''),
  statusProspek: (item.statusProspek || item.status_prospek || 'tanya_tanya') as ProspekStatus,
  keteranganFincoy: String(item.keteranganFincoy || item.keterangan_fincoy || ''),
  tanggal: String(item.tanggal || formatProspekDateKey(new Date())),
  createdAt: String(item.createdAt || item.created_at || ''),
});

const readApiError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return payload.errors.join(', ');
  return payload?.detail || payload?.message || fallback;
};

export const useKaryawanProspekStore = create<KaryawanProspekState>()((set, get) => ({
  prospek: [],
  isLoading: false,
  error: null,
  fetchProspek: async (params) => {
    set({ isLoading: true, error: null });
    const query = new URLSearchParams();
    if (params?.tanggal) query.set('tanggal', params.tanggal);
    if (params?.karyawanId) query.set('karyawan_id', params.karyawanId);
    query.set('limit', String(params?.limit || 500));

    try {
      const response = await apiFetch(`/api/prospek-harian?${query.toString()}`);
      if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat prospek.'));
      const payload = await response.json();
      set({ prospek: (payload.data?.items || []).map(mapApiProspek), isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Gagal memuat prospek.', isLoading: false });
    }
  },
  addProspek: async (entry) => {
    const normalizedWhatsapp = normalizeWhatsapp(entry.noWhatsapp);
    if (!normalizedWhatsapp || normalizedWhatsapp.length < 10) {
      throw new Error('Nomor WhatsApp harus valid dan diawali 08.');
    }

    const response = await apiFetch('/api/prospek-harian', {
      method: 'POST',
      body: JSON.stringify({
        cabang: entry.cabang,
        divisi: entry.divisi,
        namaProspek: entry.namaProspek,
        noWhatsapp: normalizedWhatsapp,
        minatBarang: entry.minatBarang,
        keteranganProspek: entry.keteranganProspek,
        statusProspek: entry.statusProspek,
        keteranganFincoy: entry.keteranganFincoy,
        tanggal: entry.tanggal,
      }),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal menyimpan prospek.'));
    await get().fetchProspek({ limit: 500 });
  },
  updateProspek: async (id, updates) => {
    const payload: Record<string, unknown> = {};
    if (updates.cabang !== undefined) payload.cabang = updates.cabang;
    if (updates.divisi !== undefined) payload.divisi = updates.divisi;
    if (updates.namaProspek !== undefined) payload.namaProspek = updates.namaProspek;
    if (updates.noWhatsapp !== undefined) payload.noWhatsapp = normalizeWhatsapp(updates.noWhatsapp);
    if (updates.minatBarang !== undefined) payload.minatBarang = updates.minatBarang;
    if (updates.keteranganProspek !== undefined) payload.keteranganProspek = updates.keteranganProspek;
    if (updates.statusProspek !== undefined) payload.statusProspek = updates.statusProspek;
    if (updates.keteranganFincoy !== undefined) payload.keteranganFincoy = updates.keteranganFincoy;

    const response = await apiFetch(`/api/prospek-harian/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal memperbarui prospek.'));
    await get().fetchProspek({ limit: 500 });
  },
  deleteProspek: async (id) => {
    const response = await apiFetch(`/api/prospek-harian/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await readApiError(response, 'Gagal menghapus prospek.'));
    set((state) => ({ prospek: state.prospek.filter((item) => item.id !== id) }));
  },
}));
