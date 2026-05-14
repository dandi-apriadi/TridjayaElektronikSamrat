/**
 * Map physical stock quantity to catalog status.
 *
 * Rules:
 *   0        → "hidden"
 *   1-5      → "indent"
 *   > 5      → "available"
 */
export function mapStockToStatus(quantity: number): 'hidden' | 'indent' | 'available' {
  if (quantity <= 0) return 'hidden';
  if (quantity <= 5) return 'indent';
  return 'available';
}
