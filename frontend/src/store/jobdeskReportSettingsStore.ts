import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface JobdeskReportSettings {
  startTime: string;
  endTime: string;
  updatedAt?: string;
}

interface JobdeskReportSettingsStore extends JobdeskReportSettings {
  setReportingWindow: (payload: Pick<JobdeskReportSettings, 'startTime' | 'endTime'>) => void;
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

export const useJobdeskReportSettingsStore = create<JobdeskReportSettingsStore>()(
  persist(
    (set) => ({
      ...defaultJobdeskReportSettings,
      setReportingWindow: (payload) =>
        set({
          startTime: payload.startTime,
          endTime: payload.endTime,
          updatedAt: new Date().toISOString(),
        }),
    }),
    { name: 'tridjaya-jobdesk-report-settings' }
  )
);
