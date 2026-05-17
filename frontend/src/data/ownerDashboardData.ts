export type TrendDirection = 'up' | 'down' | 'neutral';

export interface KpiCardData {
  label: string;
  value: number;
  formattedValue: string;
  previousValue: number;
  trend: TrendDirection;
  trendPercentage: string;
}

export interface BranchOmset {
  cabang: string;
  omset: number;
}

export interface HourlyOmset {
  hour: string;
  cumulative: number;
}

export interface TargetVsActual {
  month: string;
  target: number;
  actual: number;
}

export interface SalesRanking {
  rank: number;
  name: string;
  revenue: number;
}

export interface NonSalesRanking {
  rank: number;
  name: string;
  contributionCount: number;
}

export interface OwnerDashboardData {
  prospek: KpiCardData;
  closing: KpiCardData;
  conversionRate: KpiCardData;
  raportPersentase: KpiCardData;
  omsetPerCabang: BranchOmset[];
  omsetRealtime: {
    total: number;
    hourlyData: HourlyOmset[];
  };
  targetVsActual: TargetVsActual[];
  topSales: SalesRanking[];
  topNonSales: NonSalesRanking[];
}

export const formatRupiah = (value: number): string =>
  `Rp ${value.toLocaleString('id-ID')}`;

export const calculateGapPercentage = (actual: number, target: number): number => {
  if (target <= 0) return 0;
  return ((actual - target) / target) * 100;
};

export const ownerDashboardData: OwnerDashboardData = {
  prospek: {
    label: 'Prospek Masuk Hari Ini',
    value: 84,
    formattedValue: '84',
    previousValue: 71,
    trend: 'up',
    trendPercentage: '+18.3%',
  },
  closing: {
    label: 'Closing Hari Ini',
    value: 23,
    formattedValue: '23',
    previousValue: 19,
    trend: 'up',
    trendPercentage: '+21.1%',
  },
  conversionRate: {
    label: 'Conversion Rate',
    value: 27.4,
    formattedValue: '27.4%',
    previousValue: 24.9,
    trend: 'up',
    trendPercentage: '+2.5%',
  },
  raportPersentase: {
    label: 'Raport Persentase',
    value: 96,
    formattedValue: '96%',
    previousValue: 101,
    trend: 'down',
    trendPercentage: '-5.0%',
  },
  omsetPerCabang: [
    { cabang: 'Manado Utama', omset: 485_000_000 },
    { cabang: 'Bitung', omset: 362_000_000 },
    { cabang: 'Tomohon', omset: 294_000_000 },
    { cabang: 'Kotamobagu', omset: 231_000_000 },
    { cabang: 'Tondano', omset: 187_000_000 },
  ],
  omsetRealtime: {
    total: 1_559_000_000,
    hourlyData: [
      { hour: '09:00', cumulative: 95_000_000 },
      { hour: '10:00', cumulative: 212_000_000 },
      { hour: '11:00', cumulative: 398_000_000 },
      { hour: '12:00', cumulative: 584_000_000 },
      { hour: '13:00', cumulative: 761_000_000 },
      { hour: '14:00', cumulative: 1_022_000_000 },
      { hour: '15:00', cumulative: 1_284_000_000 },
      { hour: '16:00', cumulative: 1_559_000_000 },
    ],
  },
  targetVsActual: [
    { month: 'Jan', target: 1_100_000_000, actual: 1_045_000_000 },
    { month: 'Feb', target: 1_150_000_000, actual: 1_188_000_000 },
    { month: 'Mar', target: 1_200_000_000, actual: 1_164_000_000 },
    { month: 'Apr', target: 1_260_000_000, actual: 1_301_000_000 },
    { month: 'Mei', target: 1_340_000_000, actual: 1_288_000_000 },
    { month: 'Jun', target: 1_420_000_000, actual: 1_477_000_000 },
  ],
  topSales: [
    { rank: 1, name: 'Randy Kalalo', revenue: 188_000_000 },
    { rank: 2, name: 'Novi Lumenta', revenue: 176_000_000 },
    { rank: 3, name: 'Fajar Rumengan', revenue: 165_000_000 },
    { rank: 4, name: 'Alicia Wuisan', revenue: 153_000_000 },
    { rank: 5, name: 'Dion Paat', revenue: 149_000_000 },
    { rank: 6, name: 'Kevin Mambu', revenue: 141_000_000 },
    { rank: 7, name: 'Wendy Langi', revenue: 138_000_000 },
    { rank: 8, name: 'Siska Tuerah', revenue: 129_000_000 },
    { rank: 9, name: 'Eka Tumundo', revenue: 122_000_000 },
    { rank: 10, name: 'Rizky Wenas', revenue: 118_000_000 },
  ],
  topNonSales: [
    { rank: 1, name: 'Meyke Tumbel', contributionCount: 126 },
    { rank: 2, name: 'Yopi Wuntu', contributionCount: 118 },
    { rank: 3, name: 'Stevi Moniaga', contributionCount: 112 },
    { rank: 4, name: 'Jeki Pangemanan', contributionCount: 106 },
    { rank: 5, name: 'Mita Tilaar', contributionCount: 101 },
    { rank: 6, name: 'Hendra Kaligis', contributionCount: 97 },
    { rank: 7, name: 'Nita Walukow', contributionCount: 95 },
    { rank: 8, name: 'Ariane Ruru', contributionCount: 91 },
    { rank: 9, name: 'Vicky Pandelaki', contributionCount: 87 },
    { rank: 10, name: 'Tio Mangindaan', contributionCount: 84 },
  ],
};
