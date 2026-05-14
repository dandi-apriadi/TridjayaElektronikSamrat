import { describe, it, expect, beforeEach } from 'vitest';
import { saveHistoryRecord, getHistoryRecords, clearHistoryRecords } from '../historyManager';

describe('historyManager', () => {
  beforeEach(() => clearHistoryRecords());

  it('saves and retrieves records', () => {
    const entry = { id: '1', type: 'stock_report' as const, fileName: 'stok.xlsx', timestamp: '2024-01-01', productCount: 10 };
    saveHistoryRecord(entry);
    expect(getHistoryRecords().length).toBe(1);
    expect(getHistoryRecords()[0].fileName).toBe('stok.xlsx');
  });

  it('enforces 50 record limit', () => {
    for (let i = 0; i < 55; i++) {
      saveHistoryRecord({ id: String(i), type: 'standard_import', fileName: `file${i}.xlsx`, timestamp: '2024-01-01', productCount: 1 });
    }
    expect(getHistoryRecords().length).toBe(50);
    expect(getHistoryRecords()[0].id).toBe('54'); // newest first
  });

  it('returns empty array when no records', () => {
    expect(getHistoryRecords()).toEqual([]);
  });
});
