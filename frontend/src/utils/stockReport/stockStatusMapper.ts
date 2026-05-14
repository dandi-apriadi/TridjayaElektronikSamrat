/**
 * Map physical stock quantity to catalog status.
 *
 * Rules:
 *   0        → "out_of_stock" (shown publicly with Indent label)
 *   1-5      → "indent"
 *   > 5      → "available"
 */
export function mapStockToStatus(quantity: number): 'out_of_stock' | 'indent' | 'available' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= 5) return 'indent';
  return 'available';
}
