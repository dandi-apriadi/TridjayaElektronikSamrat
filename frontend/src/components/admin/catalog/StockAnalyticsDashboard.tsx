import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  Package,
  SearchX,
  TrendingUp,
} from 'lucide-react';
import type {
  ParsedStockRow,
  PriceDiscrepancy,
  RestockItem,
  StockAnalytics,
  StockHealthCategory,
} from '../../../utils/stockReport';
import { formatRupiah } from '../../../utils/creditCalculator';

type StockAnalyticsDashboardProps = {
  rows: ParsedStockRow[];
  analytics: StockAnalytics;
  restockItems: RestockItem[];
  priceDiscrepancies: PriceDiscrepancy[];
  location?: string | null;
  reportDate?: string | null;
  matchedCount?: number;
  unmatchedCount?: number;
  onProductClick?: (productKey: string) => void;
};

const healthMeta: Record<StockHealthCategory, { label: string; className: string }> = {
  dead_stock: { label: 'Habis', className: 'bg-error/15 text-error border-error/25' },
  low_stock: { label: 'Kritis', className: 'bg-tertiary/15 text-tertiary border-tertiary/25' },
  healthy: { label: 'Normal', className: 'bg-secondary/15 text-secondary border-secondary/25' },
  overstock: { label: 'Berlebih', className: 'bg-primary/15 text-primary border-primary/25' },
  discrepancy: { label: 'Selisih', className: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/25' },
};

function formatReportDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function healthForStock(stock: number): StockHealthCategory {
  if (stock === 0) return 'dead_stock';
  if (stock <= 5) return 'low_stock';
  if (stock <= 50) return 'healthy';
  return 'overstock';
}

export const StockAnalyticsDashboard: React.FC<StockAnalyticsDashboardProps> = ({
  rows,
  analytics,
  restockItems,
  priceDiscrepancies,
  location,
  reportDate,
  matchedCount = 0,
  unmatchedCount = 0,
  onProductClick,
}) => {
  const titleLocation = location?.trim() || 'Lokasi tidak terdeteksi';
  const productsNeedingRestock =
    analytics.healthBreakdown.dead_stock + analytics.healthBreakdown.low_stock;

  const exportCsv = () => {
    const priceByCode = new Map(
      priceDiscrepancies.map((item) => [item.productCode, item])
    );
    const restockKeys = new Set(restockItems.map((item) => item.productCode));
    const lines = [
      [
        'product name',
        'stock quantity',
        'stock health category',
        'catalog price',
        'report price',
        'price difference %',
        'restock recommendation',
      ].map(escapeCsv).join(','),
      ...rows.map((row) => {
        const key = row.productCode || row.productName || '';
        const price = priceByCode.get(key);
        const health = healthMeta[healthForStock(row.physicalStock)].label;
        return [
          row.productName || row.productCode || '-',
          row.physicalStock,
          health,
          price?.expectedPrice ?? '',
          price?.actualPrice ?? row.unitCost ?? '',
          price ? price.differencePercent.toFixed(2) : '',
          restockKeys.has(key) ? 'Ya' : 'Tidak',
        ].map(escapeCsv).join(',');
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-stok-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-outline-variant/20 bg-surface-low p-6 text-center">
        <SearchX className="mx-auto mb-3 h-8 w-8 text-on-surface-variant" />
        <p className="font-semibold text-on-surface">Tidak ada data analytics stok.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-outline-variant/20 bg-surface-low p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Laporan Stok - {titleLocation}
          </p>
          <h3 className="mt-1 text-xl font-bold text-on-surface">
            {formatReportDate(reportDate)}
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {matchedCount} cocok katalog, {unmatchedCount} belum ditemukan
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary/15 px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-primary/25"
        >
          <Download className="h-4 w-4" />
          Export Laporan
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Produk', value: analytics.totalSKUs, icon: Package },
          { label: 'Total Stok', value: analytics.totalPhysicalStock, icon: BarChart3 },
          { label: 'Butuh Restock', value: productsNeedingRestock, icon: AlertTriangle },
          { label: 'Selisih Harga', value: priceDiscrepancies.length, icon: TrendingUp },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-outline-variant/15 bg-surface p-4">
            <item.icon className="mb-3 h-4 w-4 text-primary" />
            <div className="text-2xl font-bold text-on-surface">{item.value}</div>
            <div className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              {item.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-lg border border-outline-variant/15 bg-surface p-4">
          <h4 className="mb-3 font-bold text-on-surface">Distribusi Kesehatan Stok</h4>
          <div className="space-y-2">
            {(Object.keys(healthMeta) as StockHealthCategory[]).map((key) => {
              const count = analytics.healthBreakdown[key] || 0;
              const width = analytics.totalSKUs > 0 ? (count / analytics.totalSKUs) * 100 : 0;
              return (
                <div key={key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-on-surface">{healthMeta[key].label}</span>
                    <span className="text-on-surface-variant">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-high">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/15 bg-surface p-4">
          <h4 className="mb-3 font-bold text-on-surface">Rekomendasi Restock</h4>
          <div className="space-y-2">
            {restockItems.length === 0 ? (
              <p className="text-sm text-on-surface-variant">Tidak ada produk yang perlu restock cepat.</p>
            ) : (
              restockItems.map((item) => (
                <button
                  key={`${item.productCode}-${item.productName}`}
                  type="button"
                  onClick={() => onProductClick?.(item.productName || item.productCode)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-error/15 bg-error/8 px-3 py-2 text-left transition-colors hover:bg-error/12"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-on-surface">
                      {item.productName || item.productCode}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      Rekomendasi order {item.recommendedOrder}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md bg-error/15 px-2 py-1 text-xs font-bold text-error">
                    {item.currentStock}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-outline-variant/15 bg-surface p-4">
        <h4 className="mb-3 font-bold text-on-surface">Selisih Harga</h4>
        {priceDiscrepancies.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Tidak ada selisih harga di atas ambang review.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-outline-variant/15 text-xs uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="py-2 pr-3">Produk</th>
                  <th className="py-2 pr-3">Harga Katalog</th>
                  <th className="py-2 pr-3">Harga Report</th>
                  <th className="py-2 pr-3">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {priceDiscrepancies.map((item) => (
                  <tr key={item.productCode} className="border-b border-outline-variant/10">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        onClick={() => onProductClick?.(item.productCode)}
                        className="font-semibold text-primary hover:underline"
                      >
                        {item.productCode}
                      </button>
                    </td>
                    <td className="py-2 pr-3">{formatRupiah(item.expectedPrice)}</td>
                    <td className="py-2 pr-3">{formatRupiah(item.actualPrice)}</td>
                    <td className="py-2 pr-3 font-bold text-tertiary">
                      {item.differencePercent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};

export default StockAnalyticsDashboard;
