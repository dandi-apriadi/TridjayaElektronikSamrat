/**
 * Centralized finance utilities for Tridjaya Samrat.
 * This ensures consistency across Admin, Agent, and Public pages.
 */

export interface CreditConfig {
  monthlyRate: number; // e.g., 0.021 for 2.1%
  adminFee: number;
  insuranceRate: number;
  minDpPercentage: number;
}

export const DEFAULT_CREDIT_CONFIG: CreditConfig = {
  monthlyRate: 0.021, // 2.1% per month
  adminFee: 250000,
  insuranceRate: 0.005, // 0.5% per year
  minDpPercentage: 0.15, // 15%
};

/**
 * Calculates monthly installment based on price, DP, and tenor.
 * Formula: (Principal + (Principal * Rate * Tenor)) / Tenor
 */
export const calculateInstallment = (
  price: number,
  dp: number,
  tenor: number,
  config: CreditConfig = DEFAULT_CREDIT_CONFIG
): number => {
  const principal = price - dp;
  if (principal <= 0) return 0;

  // Simple interest calculation (common in Indonesian vehicle leasing)
  const totalInterest = principal * config.monthlyRate * tenor;
  const totalLease = principal + totalInterest + config.adminFee;
  
  // Round to nearest 1000 for cleaner display
  return Math.ceil(totalLease / tenor / 1000) * 1000;
};

/**
 * Gets a standard list of tenors (months)
 */
export const STANDARD_TENORS = [12, 18, 24, 36];

/**
 * Formats a number as Indonesian Rupiah
 */
export const formatIDR = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
