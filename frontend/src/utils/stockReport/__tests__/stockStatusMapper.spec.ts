import { describe, it, expect } from 'vitest';
import { mapStockToStatus } from '../stockStatusMapper';

describe('mapStockToStatus', () => {
  it('0 -> hidden', () => expect(mapStockToStatus(0)).toBe('hidden'));
  it('1-5 -> indent', () => {
    expect(mapStockToStatus(1)).toBe('indent');
    expect(mapStockToStatus(5)).toBe('indent');
  });
  it('>5 -> available', () => {
    expect(mapStockToStatus(6)).toBe('available');
    expect(mapStockToStatus(100)).toBe('available');
  });
});
