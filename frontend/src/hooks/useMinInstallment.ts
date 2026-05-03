import { useState, useEffect } from 'react';
import { loadCreditData, calculateInstallments, mapProductToCreditCategory } from '../utils/creditCalculator';
import type { Product } from '../types';

export interface CreditSummary {
  /** Angsuran bulanan termurah (tenor terpanjang = 15x) */
  minInstallment: number | null;
  /** DP minimum = angsuran 15x (sesuai aturan bisnis Tridjaya) */
  minDp: number | null;
}

/**
 * Menghitung ringkasan kredit untuk sebuah produk.
 *
 * Aturan bisnis:
 * - "Cicil dari" = angsuran bulanan termurah (15x tenor, nasabah baru atau RO)
 * - "DP mulai"   = nilai angsuran 15x (bukan dpMin manual dari database)
 *
 * Menggunakan data pricelist kredit dari /data/credit_calculations.json.
 */
export function useMinInstallment(product: Product | null): number | null {
  const [minInstallment, setMinInstallment] = useState<number | null>(null);

  useEffect(() => {
    if (!product) return;

    loadCreditData().then((data) => {
      try {
        const category = mapProductToCreditCategory(product.category, product.subcategory);

        const resultNew = calculateInstallments(data, product.price, 'NEW', category);
        const valuesNew = Object.values(resultNew.installments).filter((v): v is number => !!v);

        const resultRO = calculateInstallments(data, product.price, 'RO', category);
        const valuesRO = Object.values(resultRO.installments).filter((v): v is number => !!v);

        const allValues = [...valuesNew, ...valuesRO];

        if (allValues.length > 0) {
          setMinInstallment(Math.min(...allValues));
        }
      } catch (e) {
        console.error('Error calculating min installment:', e);
      }
    }).catch(err => console.error('Failed to load credit data:', err));
  }, [product?.id, product?.price, product?.category, product?.subcategory]);

  return minInstallment;
}

/**
 * Menghitung ringkasan kredit lengkap: angsuran termurah + DP minimum.
 *
 * DP minimum = angsuran 15x (tenor terpanjang).
 * Ini adalah nilai yang harus dibayar customer di awal sebagai uang muka.
 */
export function useCreditSummary(product: Product | null): CreditSummary {
  const [summary, setSummary] = useState<CreditSummary>({
    minInstallment: null,
    minDp: null,
  });

  useEffect(() => {
    if (!product) return;

    loadCreditData().then((data) => {
      try {
        const category = mapProductToCreditCategory(product.category, product.subcategory);

        // NEW customer installments
        const resultNew = calculateInstallments(data, product.price, 'NEW', category);
        // RO customer installments
        const resultRO = calculateInstallments(data, product.price, 'RO', category);

        // Collect all installment values across both customer types
        const allValues = [
          ...Object.values(resultNew.installments),
          ...Object.values(resultRO.installments),
        ].filter((v): v is number => typeof v === 'number' && v > 0);

        // minInstallment = cheapest monthly payment (longest tenor = 15x)
        const minInstallment = allValues.length > 0 ? Math.min(...allValues) : null;

        // DP minimum = angsuran 15x for NEW customers (business rule)
        // If 15x not available, fall back to the longest available tenor
        const dp15xNew = resultNew.installments['15x'] ?? null;
        const dp15xRO = resultRO.installments['15x'] ?? null;
        // Use the lower of the two (RO is usually cheaper)
        const minDp = dp15xNew !== null && dp15xRO !== null
          ? Math.min(dp15xNew, dp15xRO)
          : dp15xNew ?? dp15xRO ?? minInstallment;

        setSummary({ minInstallment, minDp });
      } catch (e) {
        console.error('Error calculating credit summary:', e);
      }
    }).catch(err => console.error('Failed to load credit data:', err));
  }, [product?.id, product?.price, product?.category, product?.subcategory]);

  return summary;
}
