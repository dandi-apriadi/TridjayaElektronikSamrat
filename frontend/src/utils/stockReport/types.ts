// ============================================
// Stock Report Type Definitions
// ============================================

/** Result of file type detection */
export interface DetectionResult {
  isStockReport: boolean;
  confidence: number; // number of matched columns
  matchedColumns: string[];
  error?: string;
}

/** Maps raw column headers to known stock report fields */
export interface ColumnMapping {
  mapped: Record<string, string>; // header -> field name
  unmapped: string[];
  requiredFields: string[];
  missingRequired: string[];
}

/** A single row after column mapping */
export interface MappedRow {
  [field: string]: unknown;
}

/** A parsed stock row with typed values */
export interface ParsedStockRow {
  productCode?: string;
  productName?: string;
  location?: string;
  physicalStock: number;
  systemStock: number;
  difference: number;
  unitCost?: number;
  totalValue?: number;
  notes?: string;
  raw: Record<string, unknown>;
}

/** Overall result of parsing a stock report file */
export interface StockParseResult {
  rows: ParsedStockRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: string[];
  errors: string[];
}

/** Health category for a stock item */
export type StockHealthCategory =
  | 'healthy'
  | 'low_stock'
  | 'overstock'
  | 'dead_stock'
  | 'discrepancy';

/** Stock analytics summary */
export interface StockAnalytics {
  totalSKUs: number;
  totalPhysicalStock: number;
  totalSystemStock: number;
  totalDiscrepancy: number;
  discrepancyCount: number;
  healthBreakdown: Record<StockHealthCategory, number>;
  totalStockValue: number;
}

/** Item that needs restocking */
export interface RestockItem {
  productCode: string;
  productName?: string;
  currentStock: number;
  recommendedOrder: number;
  urgency: 'low' | 'medium' | 'high';
}

/** Price analytics from stock data */
export interface PriceAnalytics {
  averageUnitCost: number;
  totalInventoryValue: number;
  priceRange: { min: number; max: number };
}

/** A single price discrepancy */
export interface PriceDiscrepancy {
  productCode: string;
  expectedPrice: number;
  actualPrice: number;
  difference: number;
  differencePercent: number;
}

/** Item in a discrepancy list */
export interface DiscrepancyItem {
  productCode: string;
  productName?: string;
  location?: string;
  physicalStock: number;
  systemStock: number;
  difference: number;
  unitCost?: number;
  totalValueImpact?: number;
}

/** Snapshot of analytics at a point in time */
export interface AnalyticsSnapshot {
  timestamp: string;
  stock: StockAnalytics;
  restockItems: RestockItem[];
  priceAnalytics: PriceAnalytics;
  topDiscrepancies: DiscrepancyItem[];
}

/** Breakdown of what would be updated in a system sync */
export interface UpdateBreakdown {
  itemsToUpdate: number;
  itemsUnchanged: number;
  itemsWithIssues: number;
  estimatedValueAdjustment: number;
}
