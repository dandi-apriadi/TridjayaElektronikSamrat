export type CustomerType = 'NEW' | 'RO';
export type CreditCategory = 'furniture' | 'electronics' | 'gadget';

export interface InstallmentRow {
  '6x'?: number;
  '9x'?: number;
  '12x'?: number;
  '15x'?: number;
}

export interface CreditData {
  NEW: Record<CreditCategory, Record<string, InstallmentRow>>;
  RO: Record<CreditCategory, Record<string, InstallmentRow>>;
}

export interface InstallmentResult {
  category: CreditCategory;
  customerType: CustomerType;
  simulatedPrice: number;
  roundedPrice: number;
  matchedPriceKey: string;
  installments: InstallmentRow;
}

const ADMIN_FEE = 700_000;
const PRICE_STEP = 25_000;
const CREDIT_DATA_URL = '/data/credit_calculations.json';

let creditDataCache: CreditData | null = null;
let creditDataPromise: Promise<CreditData> | null = null;

export async function loadCreditData(): Promise<CreditData> {
  if (creditDataCache) {
    return creditDataCache;
  }

  if (!creditDataPromise) {
    creditDataPromise = fetch(CREDIT_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Gagal memuat data kalkulasi kredit');
        }
        return response.json() as Promise<CreditData>;
      })
      .then((payload) => {
        creditDataCache = payload;
        return payload;
      });
  }

  return creditDataPromise;
}

export function mapProductToCreditCategory(category: string, subcategory?: string): CreditCategory {
  const normalizedCategory = category.toLowerCase();
  const normalizedSubcategory = (subcategory ?? '').toLowerCase();

  const gadgetHint = ['gadget', 'smartphone', 'hp', 'tablet', 'phone'];
  if (gadgetHint.some((hint) => normalizedCategory.includes(hint) || normalizedSubcategory.includes(hint))) {
    return 'gadget';
  }

  if (normalizedCategory === 'furniture') {
    return 'furniture';
  }

  // Rule handover: bike mengikuti electronics/ADV kecuali ada aturan khusus.
  return 'electronics';
}

function findClosestPriceKey(priceTable: Record<string, InstallmentRow>, roundedPrice: number): string {
  const sortedKeys = Object.keys(priceTable)
    .map((key) => Number(key))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sortedKeys.length === 0) {
    throw new Error('Data tenor kredit kosong untuk kategori ini');
  }

  const min = sortedKeys[0];
  const max = sortedKeys[sortedKeys.length - 1];

  if (roundedPrice <= min) {
    return String(min);
  }

  if (roundedPrice >= max) {
    return String(max);
  }

  // Prioritaskan exact match, lalu harga di bawah terdekat.
  if (priceTable[String(roundedPrice)]) {
    return String(roundedPrice);
  }

  const lowerOrEqual = sortedKeys.filter((value) => value <= roundedPrice);
  return String(lowerOrEqual[lowerOrEqual.length - 1]);
}

export function calculateInstallments(
  data: CreditData,
  basePrice: number,
  customerType: CustomerType,
  category: CreditCategory,
): InstallmentResult {
  const simulatedPrice = basePrice + ADMIN_FEE;
  const roundedPrice = Math.floor(simulatedPrice / PRICE_STEP) * PRICE_STEP;
  const table = data[customerType]?.[category];

  if (!table) {
    throw new Error('Kategori kredit tidak ditemukan pada data');
  }

  const matchedPriceKey = findClosestPriceKey(table, roundedPrice);
  const installments = table[matchedPriceKey];

  if (!installments) {
    throw new Error('Data angsuran tidak ditemukan untuk harga ini');
  }

  return {
    category,
    customerType,
    simulatedPrice,
    roundedPrice,
    matchedPriceKey,
    installments,
  };
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function tenorLabel(tenor: '6x' | '9x' | '12x' | '15x'): string {
  if (tenor === '12x') return '12x (Jadi 11x)';
  if (tenor === '15x') return '15x (Jadi 13x)';
  return tenor;
}

export function tenorPromoNote(tenor: '6x' | '9x' | '12x' | '15x'): string {
  if (tenor === '12x') return 'Gratis 1x Angsuran';
  if (tenor === '15x') return 'Gratis 2x Angsuran';
  return '-';
}
