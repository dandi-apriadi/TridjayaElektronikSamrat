import { describe, it, expect } from 'vitest';
import {
  categorizeStockHealth,
  computeStockAnalytics,
  generateRestockRecommendations,
  computePriceAnalytics,
} from '../analyticsEngine';
import type { ParsedStockRow } from '../types';

describe('categorizeStockHealth', () => {
  it('returns dead_stock for 0 quantity', () => {
    expect(categorizeStockHealth(0)).toBe('dead_stock');
  });

  it('returns low_stock for 1-5', () => {
    expect(categorizeStockHealth(1)).toBe('low_stock');
    expect(categorizeStockHealth(5)).toBe('low_stock');
  });

  it('returns healthy for 6-50', () => {
    expect(categorizeStockHealth(6)).toBe('healthy');
    expect(categorizeStockHealth(50)).toBe('healthy');
  });

  it('returns overstock for >50', () => {
    expect(categorizeStockHealth(51)).toBe('overstock');
    expect(categorizeStockHealth(100)).toBe('overstock');
  });
});

describe('computeStockAnalytics', () => {
  it('computes totals and health breakdown', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 0, systemStock: 0, difference: 0, raw: {} },
      { productName: 'B', physicalStock: 3, systemStock: 5, difference: -2, raw: {} },
      { productName: 'C', physicalStock: 20, systemStock: 20, difference: 0, raw: {} },
      { productName: 'D', physicalStock: 100, systemStock: 100, difference: 0, raw: {} },
      { productName: 'E', physicalStock: 10, systemStock: 5, difference: 5, raw: {} },
    ];

    const result = computeStockAnalytics(rows);

    expect(result.totalSKUs).toBe(5);
    expect(result.totalPhysicalStock).toBe(133);
    expect(result.totalSystemStock).toBe(130);
    expect(result.healthBreakdown.dead_stock).toBe(1);
    expect(result.healthBreakdown.low_stock).toBe(1);
    expect(result.healthBreakdown.healthy).toBe(1);
    expect(result.healthBreakdown.overstock).toBe(1);
    expect(result.healthBreakdown.discrepancy).toBe(1); // row E: |10-5|=5 > 3
  });

  it('flags discrepancy when |diff| > 3', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 10, systemStock: 5, difference: 5, raw: {} },
      { productName: 'B', physicalStock: 20, systemStock: 20, difference: 0, raw: {} },
    ];

    const result = computeStockAnalytics(rows);
    expect(result.discrepancyCount).toBe(1);
    expect(result.healthBreakdown.discrepancy).toBe(1);
    expect(result.healthBreakdown.healthy).toBe(1);
  });

  it('computes total value from unitCost', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 10, systemStock: 5, difference: 5, unitCost: 5000, raw: {} },
    ];

    const result = computeStockAnalytics(rows);
    expect(result.totalStockValue).toBe(50000);
  });
});

describe('generateRestockRecommendations', () => {
  it('returns top 10 critical stock items sorted ascending', () => {
    // Create 12 items all with stock 0-5 (critical), should be capped at 10
    const rows: ParsedStockRow[] = Array.from({ length: 12 }, (_, i) => ({
      productName: `Produk ${i}`,
      physicalStock: i % 6, // cycles 0,1,2,3,4,5,0,1,2,3,4,5
      systemStock: 0,
      difference: i % 6,
      raw: {},
    }));

    const result = generateRestockRecommendations(rows);
    expect(result.length).toBe(10);
    // sorted ascending by stock
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].currentStock).toBeLessThanOrEqual(result[i + 1].currentStock);
    }
  });

  it('excludes items with stock > 5', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 3, systemStock: 0, difference: 3, raw: {} },
      { productName: 'B', physicalStock: 10, systemStock: 0, difference: 10, raw: {} },
    ];

    const result = generateRestockRecommendations(rows);
    expect(result.length).toBe(1);
    expect(result[0].productName).toBe('A');
  });

  it('assigns urgency based on stock level', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 0, systemStock: 0, difference: 0, raw: {} },
      { productName: 'B', physicalStock: 1, systemStock: 0, difference: 1, raw: {} },
      { productName: 'C', physicalStock: 5, systemStock: 0, difference: 5, raw: {} },
    ];

    const result = generateRestockRecommendations(rows);
    expect(result.find((r) => r.productName === 'A')!.urgency).toBe('high');
    expect(result.find((r) => r.productName === 'B')!.urgency).toBe('medium');
    expect(result.find((r) => r.productName === 'C')!.urgency).toBe('low');
  });
});

describe('computePriceAnalytics', () => {
  it('computes price analytics and flags discrepancies > 5%', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 10, systemStock: 10, difference: 0, unitCost: 11000, raw: {} },
      { productName: 'B', physicalStock: 5, systemStock: 5, difference: 0, unitCost: 10000, raw: {} },
      { productName: 'C', physicalStock: 8, systemStock: 8, difference: 0, unitCost: 5000, raw: {} },
    ];

    const catalog = [
      { id: '1', name: 'A', price: 10000 },
      { id: '2', name: 'B', price: 10000 },
      { id: '3', name: 'C', price: 10000 },
    ];

    const result = computePriceAnalytics(rows, catalog);

    expect(result.priceAnalytics.averageUnitCost).toBeCloseTo(8666.67, 1); // (11000+10000+5000)/3
    expect(result.priceAnalytics.totalInventoryValue).toBe(200000); // 11000*10 + 10000*5 + 5000*8
    expect(result.priceAnalytics.priceRange).toEqual({ min: 5000, max: 11000 });

    // A: +10% (flagged), C: -50% (flagged), B: 0% (not flagged)
    expect(result.discrepancies.length).toBe(2);
    // Sorted by absolute difference descending: C (|5000-10000|=5000) > A (|11000-10000|=1000)
    expect(result.discrepancies[0].productCode).toBe('C');
    expect(result.discrepancies[1].productCode).toBe('A');
  });

  it('ignores catalog products with null price', () => {
    const rows: ParsedStockRow[] = [
      { productName: 'A', physicalStock: 10, systemStock: 10, difference: 0, unitCost: 12000, raw: {} },
    ];

    const catalog = [{ id: '1', name: 'A', price: null }];

    const result = computePriceAnalytics(rows, catalog);
    expect(result.discrepancies.length).toBe(0);
  });
});
