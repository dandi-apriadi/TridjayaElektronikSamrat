import type {
  ParsedStockRow,
  StockAnalytics,
  StockHealthCategory,
  RestockItem,
  PriceAnalytics,
  PriceDiscrepancy,
} from './types';

/**
 * Categorize stock quantity into health buckets based on physical stock.
 * Habis = 0, Kritis = 1-5, Normal = 6-50, Berlebih = >50
 */
export function categorizeStockHealth(physicalStock: number): StockHealthCategory {
  if (physicalStock === 0) return 'dead_stock';
  if (physicalStock <= 5) return 'low_stock';
  if (physicalStock <= 50) return 'healthy';
  return 'overstock';
}

/**
 * Compute overall stock analytics from parsed rows.
 */
export function computeStockAnalytics(rows: ParsedStockRow[]): StockAnalytics {
  const totalSKUs = rows.length;
  let totalPhysicalStock = 0;
  let totalSystemStock = 0;
  let totalDiscrepancy = 0;
  let discrepancyCount = 0;
  let totalStockValue = 0;

  const healthBreakdown: Record<StockHealthCategory, number> = {
    healthy: 0,
    low_stock: 0,
    overstock: 0,
    dead_stock: 0,
    discrepancy: 0,
  };

  for (const row of rows) {
    totalPhysicalStock += row.physicalStock;
    totalSystemStock += row.systemStock;

    const diff = row.physicalStock - row.systemStock;
    if (Math.abs(diff) > 3) {
      discrepancyCount++;
      totalDiscrepancy += Math.abs(diff);
      healthBreakdown['discrepancy']++;
    } else {
      const health = categorizeStockHealth(row.physicalStock);
      healthBreakdown[health]++;
    }

    if (row.totalValue !== undefined && !isNaN(row.totalValue)) {
      totalStockValue += row.totalValue;
    } else if (row.unitCost !== undefined && !isNaN(row.unitCost)) {
      totalStockValue += row.unitCost * row.physicalStock;
    }
  }

  return {
    totalSKUs,
    totalPhysicalStock,
    totalSystemStock,
    totalDiscrepancy,
    discrepancyCount,
    healthBreakdown,
    totalStockValue,
  };
}

/**
 * Generate restock recommendations: top 10 products with stock 0-5,
 * sorted ascending by physical stock (most urgent first).
 */
export function generateRestockRecommendations(
  rows: ParsedStockRow[]
): RestockItem[] {
  const critical = rows
    .filter((r) => r.physicalStock >= 0 && r.physicalStock <= 5)
    .map((r) => {
      const urgency: RestockItem['urgency'] =
        r.physicalStock === 0
          ? 'high'
          : r.physicalStock <= 2
            ? 'medium'
            : 'low';
      return {
        productCode: r.productCode || r.productName || 'Unknown',
        productName: r.productName || r.productCode,
        currentStock: r.physicalStock,
        recommendedOrder:
          r.physicalStock === 0
            ? 20
            : r.physicalStock <= 2
              ? 15
              : 10,
        urgency,
      };
    })
    .sort((a, b) => a.currentStock - b.currentStock);

  return critical.slice(0, 10);
}

// Product from catalog (for price comparison)
export interface CatalogProduct {
  id: string;
  name: string;
  price: number | null;
}

/**
 * Compute price analytics by comparing report prices against catalog.
 */
export function computePriceAnalytics(
  rows: ParsedStockRow[],
  catalogProducts: CatalogProduct[]
): {
  priceAnalytics: PriceAnalytics;
  discrepancies: PriceDiscrepancy[];
} {
  const catalogMap = new Map<string, CatalogProduct>();
  for (const p of catalogProducts) {
    const key = p.name.toLowerCase().trim();
    catalogMap.set(key, p);
  }

  let totalInventoryValue = 0;
  let totalUnitCostEntries = 0;
  let unitCostSum = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  const discrepancies: PriceDiscrepancy[] = [];

  for (const row of rows) {
    if (row.unitCost !== undefined && !isNaN(row.unitCost)) {
      unitCostSum += row.unitCost;
      totalUnitCostEntries++;
      totalInventoryValue += row.unitCost * row.physicalStock;

      if (row.unitCost < minPrice) minPrice = row.unitCost;
      if (row.unitCost > maxPrice) maxPrice = row.unitCost;
    }

    const nameKey = (row.productName || '').toLowerCase().trim();
    const catalog = catalogMap.get(nameKey);

    if (catalog && catalog.price !== null && catalog.price > 0) {
      if (row.unitCost !== undefined && !isNaN(row.unitCost)) {
        const diff = row.unitCost - catalog.price;
        const percent = (diff / catalog.price) * 100;

        if (Math.abs(percent) > 5) {
          discrepancies.push({
            productCode: row.productCode || row.productName || '',
            expectedPrice: catalog.price,
            actualPrice: row.unitCost,
            difference: diff,
            differencePercent: percent,
          });
        }
      }
    }
  }

  // Sort by absolute difference descending
  discrepancies.sort(
    (a, b) => Math.abs(b.difference) - Math.abs(a.difference)
  );

  const averageUnitCost =
    totalUnitCostEntries > 0 ? unitCostSum / totalUnitCostEntries : 0;

  return {
    priceAnalytics: {
      averageUnitCost,
      totalInventoryValue,
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice === -Infinity ? 0 : maxPrice,
      },
    },
    discrepancies,
  };
}
