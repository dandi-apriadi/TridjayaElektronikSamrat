import type { AnalyticsSnapshot } from './types';

export interface HistoryEntry {
  id: string;
  type: 'stock_report' | 'standard_import';
  fileName: string;
  timestamp: string;
  productCount: number;
  analyticsSnapshot?: AnalyticsSnapshot;
}

const STORAGE_KEY = 'bulkImportHistory';
const MAX_RECORDS = 50;

/**
 * Save an import history record to localStorage.
 * Maintains at most 50 records; oldest removed first.
 */
export function saveHistoryRecord(entry: HistoryEntry): { success: boolean; warning?: string } {
  try {
    const existing = getHistoryRecords();
    existing.unshift(entry); // newest first

    if (existing.length > MAX_RECORDS) {
      existing.length = MAX_RECORDS; // truncate oldest
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    return { success: true };
  } catch (err) {
    // QuotaExceededError or other localStorage issues
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return {
        success: false,
        warning: 'Penyimpanan penuh. Riwayat impor tidak disimpan.',
      };
    }
    return {
      success: false,
      warning: 'Gagal menyimpan riwayat impor.',
    };
  }
}

/**
 * Retrieve all history records from localStorage.
 */
export function getHistoryRecords(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Clear all history records.
 */
export function clearHistoryRecords(): void {
  localStorage.removeItem(STORAGE_KEY);
}
