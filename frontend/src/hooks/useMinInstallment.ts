import { useState, useEffect } from 'react';
import { loadCreditData, calculateInstallments, mapProductToCreditCategory } from '../utils/creditCalculator';
import type { Product } from '../types';

export function useMinInstallment(product: Product | null) {
  const [minInstallment, setMinInstallment] = useState<number | null>(null);

  useEffect(() => {
    if (!product) return;

    loadCreditData().then((data) => {
      try {
        const category = mapProductToCreditCategory(product.category, product.subcategory);
        
        // Calculate for NEW customers
        const resultNew = calculateInstallments(data, product.price, 'NEW', category);
        const valuesNew = Object.values(resultNew.installments).filter((v): v is number => !!v);
        
        // Calculate for RO customers
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
