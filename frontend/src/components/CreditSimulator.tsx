import React, { useEffect, useMemo, useState } from 'react';
import type { CreditPlan } from '../types';
import {
  calculateInstallments,
  formatRupiah,
  loadCreditData,
  mapProductToCreditCategory,
  tenorLabel,
  tenorPromoNote,
  type CustomerType,
  type InstallmentResult,
} from '../utils/creditCalculator';

interface CreditSimulatorProps {
  productPrice: number;
  productCategory: string;
  productSubcategory?: string;
  onSelectPlan?: (payload: CreditPlan) => void;
}

const tenorOrder: Array<'6x' | '9x' | '12x' | '15x'> = ['6x', '9x', '12x', '15x'];

export const CreditSimulator: React.FC<CreditSimulatorProps> = ({
  productPrice,
  productCategory,
  productSubcategory,
  onSelectPlan,
}) => {
  const [customerType, setCustomerType] = useState<CustomerType>('NEW');
  const [selectedTenor, setSelectedTenor] = useState<'6x' | '9x' | '12x' | '15x' | null>(null);
  const [result, setResult] = useState<InstallmentResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const creditCategory = useMemo(
    () => mapProductToCreditCategory(productCategory, productSubcategory),
    [productCategory, productSubcategory],
  );

  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await loadCreditData();
        const calculation = calculateInstallments(data, productPrice, customerType, creditCategory);

        if (isMounted) {
          setResult(calculation);
          setSelectedTenor((prev) => {
            if (prev && calculation.installments[prev]) {
              return prev;
            }
            if (calculation.installments['12x']) return '12x';
            if (calculation.installments['9x']) return '9x';
            if (calculation.installments['6x']) return '6x';
            return null;
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Gagal menghitung simulasi kredit');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };
  }, [creditCategory, customerType, productPrice]);

  useEffect(() => {
    if (!result || !selectedTenor) return;
    const monthlyInstallment = result.installments[selectedTenor];
    if (!monthlyInstallment) return;

    onSelectPlan?.({ customerType, tenor: selectedTenor, monthlyInstallment });
  }, [customerType, onSelectPlan, result, selectedTenor]);

  const rows = useMemo(() => {
    if (!result) return [] as Array<'6x' | '9x' | '12x' | '15x'>;

    return tenorOrder.filter((tenor) => {
      if (creditCategory === 'gadget' && tenor === '15x') {
        return false;
      }
      return typeof result.installments[tenor] === 'number';
    });
  }, [creditCategory, result]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 text-on-surface-variant">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          <span className="font-body text-body-sm">Memuat simulasi kredit...</span>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="glass-card rounded-2xl p-5 mb-6 border border-error/30 bg-error/10">
        <p className="font-body text-body-sm text-error">{error || 'Data simulasi tidak tersedia.'}</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="font-display text-title-md font-bold text-white">Simulasi Kredit Dinamis</h3>
        <div className="inline-flex rounded-lg bg-surface-high p-1">
          <button
            type="button"
            onClick={() => setCustomerType('NEW')}
            className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${customerType === 'NEW' ? 'bg-primary text-surface' : 'text-on-surface-variant hover:text-white'}`}
          >
            Pelanggan Baru
          </button>
          <button
            type="button"
            onClick={() => setCustomerType('RO')}
            className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-colors ${customerType === 'RO' ? 'bg-primary text-surface' : 'text-on-surface-variant hover:text-white'}`}
          >
            Lama (RO)
          </button>
        </div>
      </div>

      <div className="text-label-sm text-on-surface-variant mb-4">
        Harga simulasi: <span className="text-white font-semibold">{formatRupiah(result.simulatedPrice)}</span>
        {' '}| Key lookup: <span className="text-white font-semibold">{result.matchedPriceKey}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-body-sm">
          <thead>
            <tr className="border-b border-outline-variant/20 text-on-surface-variant">
              <th className="py-2 pr-3">Tenor</th>
              <th className="py-2 pr-3">Angsuran / Bulan</th>
              <th className="py-2 pr-3">Promo</th>
              <th className="py-2 text-right">Pilih</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((tenor) => {
              const value = result.installments[tenor]!;
              const isSelected = selectedTenor === tenor;

              return (
                <tr key={tenor} className="border-b border-outline-variant/10">
                  <td className="py-3 pr-3 text-white font-semibold">{tenorLabel(tenor)}</td>
                  <td className="py-3 pr-3 text-white">{formatRupiah(value)}</td>
                  <td className="py-3 pr-3 text-on-surface-variant">{tenorPromoNote(tenor)}</td>
                  <td className="py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedTenor(tenor)}
                      className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors ${isSelected ? 'bg-primary text-surface' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}
                    >
                      {isSelected ? 'Dipilih' : 'Pilih'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-label-sm text-on-surface-variant">
        * Tenor promo 12x menjadi 11x (gratis 1 angsuran), 15x menjadi 13x (gratis 2 angsuran).
      </p>
    </div>
  );
};

export default CreditSimulator;
