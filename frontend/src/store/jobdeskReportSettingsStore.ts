import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../utils/apiClient';

export interface JobdeskReportSettings {
  startTime: string;
  endTime: string;
  updatedAt?: string;
}

interface JobdeskReportSettingsStore extends JobdeskReportSettings {
  isLoading: boolean;
  error: string | null;
  fetchReportingWindow: () => Promise<void>;
  setReportingWindow: (payload: Pick<JobdeskReportSettings, 'startTime' | 'endTime'>) => Promise<void>;
}

export const defaultJobdeskReportSettings: JobdeskReportSettings = {
  startTime: '08:00',
  endTime: '18:00',
};

export const timeToMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
};

export const isWithinReportingWindow = (settings: Pick<JobdeskReportSettings, 'startTime' | 'endTime'>, date = new Date()) => {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = timeToMinutes(settings.startTime);
  const endMinutes = timeToMinutes(settings.endTime);

  if (startMinutes === endMinutes) return true;
  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
};

export const getReportingWindowLabel = (settings: Pick<JobdeskReportSettings, 'startTime' | 'endTime'>) => {
  return `${settings.startTime} - ${settings.endTime} WITA`;
};

const readApiError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) return payload.errors.join(', ');
  return payload?.detail || payload?.message || fallback;
};

export const useJobdeskReportSettingsStore = create<JobdeskReportSettingsStore>()(
  persist(
    (set) => ({
      ...defaultJobdeskReportSettings,
      isLoading: false,
      error: null,
      fetchReportingWindow: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await apiFetch('/api/jobdesk-report-settings');
          if (!response.ok) throw new Error(await readApiError(response, 'Gagal memuat jam pelaporan.'));
          const payload = await response.json();
          set({
            startTime: payload.data?.startTime || defaultJobdeskReportSettings.startTime,
            endTime: payload.data?.endTime || defaultJobdeskReportSettings.endTime,
            updatedAt: payload.data?.updatedAt || undefined,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Gagal memuat jam pelaporan.',
            isLoading: false,
          });
        }
      },
      setReportingWindow: async (payload) => {
        set({
          startTime: payload.startTime,
          endTime: payload.endTime,
          updatedAt: new Date().toISOString(),
          error: null,
        });
        try {
          const response = await apiFetch('/api/jobdesk-report-settings', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
          if (!response.ok) throw new Error(await readApiError(response, 'Gagal menyimpan jam pelaporan.'));
          const responsePayload = await response.json();
          set({
            startTime: responsePayload.data?.startTime || payload.startTime,
            endTime: responsePayload.data?.endTime || payload.endTime,
            updatedAt: responsePayload.data?.updatedAt || new Date().toISOString(),
            error: null,
          });
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Gagal menyimpan jam pelaporan.',
          });
          throw error;
        }
      },
    }),
    {
      name: 'tridjaya-jobdesk-report-settings',
      partialize: (state) => ({
        startTime: state.startTime,
        endTime: state.endTime,
        updatedAt: state.updatedAt,
      }),
    }
  )
);
