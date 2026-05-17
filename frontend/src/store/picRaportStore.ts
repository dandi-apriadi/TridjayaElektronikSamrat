import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type PicRaportEvidence, type PicRaportReviewStatus } from '../data/picRaportData';
import { jobdeskPositions, type JobdeskPosition } from '../data/ownerRaportData';
import { apiFetch, getImageUrl } from '../utils/apiClient';

interface ReviewPayload {
  status: PicRaportReviewStatus;
  score?: number;
  comment?: string;
}

interface SubmitRaportItem {
  jobdeskIndex: number;
  jobdeskText: string;
  mode: 'none' | 'image' | 'video';
  evidenceUrl?: string;
  employeeNote?: string;
}

interface PicRaportStore {
  evidence: PicRaportEvidence[];
  evidenceTotal: number;
  evidencePage: number;
  evidenceLimit: number;
  divisions: JobdeskPosition[];
  isLoading: boolean;
  error: string | null;
  fetchEvidence: (params?: {
    tanggal?: string;
    tanggalFrom?: string;
    tanggalTo?: string;
    karyawanId?: string;
    cabang?: string;
    divisi?: string;
    status?: string;
    q?: string;
    page?: number;
    limit?: number;
  }) => Promise<void>;
  fetchDivisions: () => Promise<void>;
  submitRaport: (payload: { tanggal: string; cabang: string; divisi: string; items: SubmitRaportItem[] }) => Promise<void>;
  reviewEvidence: (id: string, payload: ReviewPayload) => Promise<void>;
  addDivision: (name: string) => void;
  updateDivision: (divisionId: string, name: string) => void;
  deleteDivision: (divisionId: string) => void;
  moveDivision: (divisionId: string, direction: -1 | 1) => void;
  addJobdesk: (divisionId: string, jobdesk: string) => void;
  updateJobdesk: (divisionId: string, index: number, jobdesk: string) => void;
  deleteJobdesk: (divisionId: string, index: number) => void;
  moveJobdesk: (divisionId: string, index: number, direction: -1 | 1) => void;
}

const slugifyDivision = (value: string) => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `divisi-${Date.now()}`;
};

const readApiError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return payload.errors.join(', ');
  return payload?.detail || payload?.message || fallback;
};

const mapApiEvidence = (item: any): PicRaportEvidence => ({
  id: String(item.id),
  employeeId: String(item.employeeId || item.employee_id || ''),
  employeeName: String(item.employeeName || item.employee_name || ''),
  cabang: String(item.cabang || 'Cabang belum diatur'),
  divisiId: String(item.divisiId || item.divisi_id || 'umum'),
  divisiName: String(item.divisiName || item.divisi_name || item.divisiId || item.divisi_id || 'Umum'),
  tanggal: String(item.tanggal),
  submittedAt: String(item.submittedAt || item.submitted_at || `${item.tanggal}T00:00:00`),
  jobdeskIndex: Number(item.jobdeskIndex ?? item.jobdesk_index ?? 0),
  jobdeskText: String(item.jobdeskText || item.jobdesk_text || ''),
  mode: (item.mode || 'none') as PicRaportEvidence['mode'],
  evidenceUrl: item.evidenceUrl || item.evidence_url ? getImageUrl(item.evidenceUrl || item.evidence_url) : undefined,
  employeeNote: item.employeeNote || item.employee_note || undefined,
  reviewStatus: (item.reviewStatus || item.review_status || 'pending') as PicRaportReviewStatus,
  score: typeof item.score === 'number' ? item.score : item.score == null ? undefined : Number(item.score),
  reviewerComment: item.reviewerComment || item.reviewer_comment || '',
  reviewedAt: item.reviewedAt || item.reviewed_at || undefined,
});

const saveDivisions = async (divisions: JobdeskPosition[]) => {
  const response = await apiFetch('/api/jobdesk-divisions', {
    method: 'PATCH',
    body: JSON.stringify({ divisions }),
  });
  if (!response.ok) throw new Error(await readApiError(response, 'Gagal menyimpan master jobdesk.'));
};

const persistDivisions = (divisions: JobdeskPosition[]) => {
  saveDivisions(divisions).catch((error) => {
    usePicRaportStore.setState({ error: error instanceof Error ? error.message : 'Gagal menyimpan master jobdesk.' });
  });
};

const moveArrayItem = <T,>(items: T[], fromIndex: number, toIndex: number) => {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

export const usePicRaportStore = create<PicRaportStore>()(
  persist(
    (set, get) => ({
      evidence: [],
      evidenceTotal: 0,
      evidencePage: 1,
      evidenceLimit: 100,
      divisions: jobdeskPositions,
      isLoading: false,
      error: null,
      fetchEvidence: async (params) => {
        set({ isLoading: true, error: null });
        const query = new URLSearchParams();
        if (params?.tanggal) query.set('tanggal', params.tanggal);
        if (params?.tanggalFrom) query.set('tanggal_from', params.tanggalFrom);
        if (params?.tanggalTo) query.set('tanggal_to', params.tanggalTo);
        if (params?.karyawanId) query.set('karyawan_id', params.karyawanId);
        if (params?.cabang) query.set('cabang', params.cabang);
        if (params?.divisi) query.set('divisi', params.divisi);
        if (params?.status) query.set('status', params.status);
        if (params?.q) query.set('q', params.q);
        if (params?.page) query.set('page', String(params.page));
        query.set('limit', String(params?.limit || 500));
        try {
          const response = await apiFetch(`/api/raport-harian?${query.toString()}`);
          if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat raport.'));
          const payload = await response.json();
          set({
            evidence: (payload.data?.items || []).map(mapApiEvidence),
            evidenceTotal: Number(payload.data?.total || 0),
            evidencePage: Number(payload.data?.page || params?.page || 1),
            evidenceLimit: Number(payload.data?.limit || params?.limit || 500),
            isLoading: false,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Gagal memuat raport.',
            isLoading: false,
          });
        }
      },
      fetchDivisions: async () => {
        try {
          const response = await apiFetch('/api/jobdesk-divisions');
          if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat master jobdesk.'));
          const payload = await response.json();
          const divisions = payload.data?.divisions;
          if (Array.isArray(divisions) && divisions.length > 0) {
            set({ divisions, error: null });
          } else {
            await saveDivisions(get().divisions);
          }
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Gagal memuat master jobdesk.' });
        }
      },
      submitRaport: async (payload) => {
        const response = await apiFetch('/api/raport-harian', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await readApiError(response, 'Gagal menyimpan raport.'));
        await get().fetchEvidence({ tanggal: payload.tanggal, limit: 2000 });
      },
      reviewEvidence: async (id, payload) => {
        const response = await apiFetch(`/api/raport-harian/${encodeURIComponent(id)}/review`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(await readApiError(response, 'Gagal menyimpan review.'));
        set((state) => ({
          evidence: state.evidence.map((item) =>
            item.id === id
              ? {
                  ...item,
                  reviewStatus: payload.status,
                  score: payload.status === 'rejected' ? 0 : payload.score,
                  reviewerComment: payload.comment?.trim() || '',
                  reviewedAt: new Date().toISOString(),
                }
              : item
          ),
        }));
      },
      addDivision: (name) =>
        set((state) => {
          const trimmedName = name.trim();
          if (!trimmedName) return state;

          const id = slugifyDivision(trimmedName);
          if (state.divisions.some((division) => division.id === id || division.posisi.toLowerCase() === trimmedName.toLowerCase())) {
            return state;
          }

          const nextDivisions = [
            ...state.divisions,
            {
              id,
              posisi: trimmedName,
              jobdesks: [],
            },
          ];
          persistDivisions(nextDivisions);
          return {
            divisions: nextDivisions,
          };
        }),
      updateDivision: (divisionId, name) =>
        set((state) => {
          const trimmedName = name.trim();
          if (!trimmedName) return state;
          const nextDivisions = state.divisions.map((division) =>
            division.id === divisionId ? { ...division, posisi: trimmedName } : division
          );
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
      deleteDivision: (divisionId) =>
        set((state) => {
          if (state.divisions.length <= 1) {
            return { ...state, error: 'Minimal satu divisi wajib tersedia.' };
          }
          const nextDivisions = state.divisions.filter((division) => division.id !== divisionId);
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
      moveDivision: (divisionId, direction) =>
        set((state) => {
          const currentIndex = state.divisions.findIndex((division) => division.id === divisionId);
          const nextDivisions = moveArrayItem(state.divisions, currentIndex, currentIndex + direction);
          if (nextDivisions === state.divisions) return state;
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
      addJobdesk: (divisionId, jobdesk) =>
        set((state) => {
          const trimmedJobdesk = jobdesk.trim();
          if (!trimmedJobdesk) return state;

          const nextDivisions = state.divisions.map((division) =>
              division.id === divisionId
                ? {
                    ...division,
                    jobdesks: division.jobdesks.includes(trimmedJobdesk)
                      ? division.jobdesks
                      : [...division.jobdesks, trimmedJobdesk],
                  }
                : division
            );
          persistDivisions(nextDivisions);
          return {
            divisions: nextDivisions,
          };
        }),
      updateJobdesk: (divisionId, index, jobdesk) =>
        set((state) => {
          const trimmedJobdesk = jobdesk.trim();
          if (!trimmedJobdesk) return state;
          const nextDivisions = state.divisions.map((division) =>
            division.id === divisionId
              ? {
                  ...division,
                  jobdesks: division.jobdesks.map((item, itemIndex) => (itemIndex === index ? trimmedJobdesk : item)),
                }
              : division
          );
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
      deleteJobdesk: (divisionId, index) =>
        set((state) => {
          const nextDivisions = state.divisions.map((division) =>
            division.id === divisionId
              ? { ...division, jobdesks: division.jobdesks.filter((_, itemIndex) => itemIndex !== index) }
              : division
          );
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
      moveJobdesk: (divisionId, index, direction) =>
        set((state) => {
          const nextDivisions = state.divisions.map((division) =>
            division.id === divisionId
              ? { ...division, jobdesks: moveArrayItem(division.jobdesks, index, index + direction) }
              : division
          );
          persistDivisions(nextDivisions);
          return { divisions: nextDivisions, error: null };
        }),
    }),
    {
      name: 'tridjaya-pic-raport',
      partialize: (state) => ({
        divisions: state.divisions,
      }),
    }
  )
);
