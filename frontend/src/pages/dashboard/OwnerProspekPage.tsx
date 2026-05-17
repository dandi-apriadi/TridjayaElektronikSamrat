import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, Target, BarChart3, TrendingUp, TrendingDown, Minus, Trophy, Search, SlidersHorizontal, X } from 'lucide-react';
import { ownerDashboardData } from '../../data/ownerDashboardData';
import type { TrendDirection } from '../../data/ownerDashboardData';
import Pagination from '../../components/ui/Pagination';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const TrendIcon: React.FC<{ direction: TrendDirection; className?: string }> = ({ direction, className = 'w-4 h-4' }) => {
  if (direction === 'up') return <TrendingUp className={className} />;
  if (direction === 'down') return <TrendingDown className={className} />;
  return <Minus className={className} />;
};

// Dummy data: Top Sales by Prospek (target min 20/hari)
const topSalesProspek = [
  { rank: 1, nama: 'Randy Kalalo', cabang: 'Manado Pusat', prospekHariIni: 32, target: 20, persentase: 160 },
  { rank: 2, nama: 'Novi Lumenta', cabang: 'Tomohon', prospekHariIni: 28, target: 20, persentase: 140 },
  { rank: 3, nama: 'Fajar Rumengan', cabang: 'Bitung', prospekHariIni: 25, target: 20, persentase: 125 },
  { rank: 4, nama: 'Alicia Wuisan', cabang: 'Minahasa', prospekHariIni: 24, target: 20, persentase: 120 },
  { rank: 5, nama: 'Dion Paat', cabang: 'Kotamobagu', prospekHariIni: 23, target: 20, persentase: 115 },
  { rank: 6, nama: 'Kevin Mambu', cabang: 'Tondano', prospekHariIni: 22, target: 20, persentase: 110 },
  { rank: 7, nama: 'Wendy Langi', cabang: 'Airmadidi', prospekHariIni: 21, target: 20, persentase: 105 },
  { rank: 8, nama: 'Siska Tuerah', cabang: 'Langowan', prospekHariIni: 20, target: 20, persentase: 100 },
  { rank: 9, nama: 'Eka Tumundo', cabang: 'Ratahan', prospekHariIni: 18, target: 20, persentase: 90 },
  { rank: 10, nama: 'Rizky Wienas', cabang: 'Amurang', prospekHariIni: 15, target: 20, persentase: 75 },
];

// Dummy data: Top Non-Sales by Prospek (target min 5/hari)
const topNonSalesProspek = [
  { rank: 1, nama: 'Meyke Tumel', cabang: 'Manado Pusat', posisi: 'Support Konten', prospekHariIni: 12, target: 5, persentase: 240 },
  { rank: 2, nama: 'Yopi Wuntu', cabang: 'Tomohon', posisi: 'Driver', prospekHariIni: 10, target: 5, persentase: 200 },
  { rank: 3, nama: 'Stevi Moniaga', cabang: 'Bitung', posisi: 'Admin Stok', prospekHariIni: 9, target: 5, persentase: 180 },
  { rank: 4, nama: 'Jesi Pangomanan', cabang: 'Minahasa', posisi: 'PDI', prospekHariIni: 8, target: 5, persentase: 160 },
  { rank: 5, nama: 'Mita Tilaar', cabang: 'Kotamobagu', posisi: 'Kasir', prospekHariIni: 7, target: 5, persentase: 140 },
  { rank: 6, nama: 'Hendra Kaligis', cabang: 'Tondano', posisi: 'GC', prospekHariIni: 7, target: 5, persentase: 140 },
  { rank: 7, nama: 'Nita Watukow', cabang: 'Airmadidi', posisi: 'Support Online', prospekHariIni: 6, target: 5, persentase: 120 },
  { rank: 8, nama: 'Arland Ruru', cabang: 'Langowan', posisi: 'Admin SPK', prospekHariIni: 5, target: 5, persentase: 100 },
  { rank: 9, nama: 'Vicky Pandolaki', cabang: 'Ratahan', posisi: 'CRM', prospekHariIni: 4, target: 5, persentase: 80 },
  { rank: 10, nama: 'Tin Mangindaan', cabang: 'Amurang', posisi: 'Desk Call', prospekHariIni: 3, target: 5, persentase: 60 },
];

type EmployeeProspekRow = {
  rank: number;
  nama: string;
  cabang: string;
  kategori: 'Sales' | 'Non-Sales';
  posisi: string;
  prospekHariIni: number;
  target: number;
  persentase: number;
};

type AchievementFilter = 'Semua' | 'Tercapai' | 'Belum Tercapai';
type EmployeeSortKey = 'rank' | 'nama' | 'cabang' | 'prospek_desc' | 'prospek_asc' | 'persentase_desc' | 'persentase_asc';

const branches = [
  'Manado Pusat',
  'Tomohon',
  'Bitung',
  'Minahasa',
  'Kotamobagu',
  'Tondano',
  'Airmadidi',
  'Langowan',
  'Ratahan',
  'Amurang',
  'Kawangkoan',
  'Tateli',
  'Paniki',
  'Malalayang',
  'Paal Dua',
  'Tuminting',
];

const additionalSalesNames = [
  'Aldo Kairupan',
  'Ria Sumual',
  'Mario Runtuwene',
  'Claudia Rotinsulu',
  'Vano Pangemanan',
  'Lidia Mandagi',
  'Reno Sondakh',
  'Maya Tumbelaka',
  'Dimas Wowor',
  'Grace Roring',
  'Ivan Lumenta',
  'Putri Mamesah',
  'Andre Kaunang',
  'Tasya Manoppo',
];

const nonSalesPositions = [
  'Support Konten',
  'Driver',
  'Admin Stok',
  'PDI',
  'Kasir',
  'GC',
  'Support Online',
  'Admin SPK',
  'CRM',
  'Desk Call',
  'Gudang',
  'Teknisi',
  'Collector',
  'Admin Finance',
];

const additionalNonSalesNames = [
  'Yuni Kawilarang',
  'Berto Mokoagow',
  'Laras Londa',
  'Glen Dondokambey',
  'Icha Rondonuwu',
  'Tio Kalalo',
  'Nessa Karamoy',
  'Rio Sumendap',
  'Cindy Rantung',
  'Reza Tatontos',
  'Mona Pangkey',
  'Bima Wenas',
  'Aurel Makalalag',
  'Evan Rarung',
  'Nadia Supit',
  'Jovan Karundeng',
  'Kezia Tilaar',
  'Rama Polii',
  'Intan Lasut',
  'Steven Rumokoy',
  'Felly Mantiri',
  'Aldi Warouw',
  'Niken Pelealu',
  'Robby Paruntu',
  'Lia Katuuk',
  'Jojo Tendean',
  'Elsa Lengkong',
  'Rafael Kolondam',
  'Mira Panambunan',
  'Nico Pangalila',
  'Fika Mokodompit',
  'Dicky Kumaat',
  'Anya Tangkudung',
  'Rivaldi Walangitan',
  'Mitha Pontoh',
  'Theo Wullur',
  'Nana Sengkey',
  'Jefry Pondaag',
  'Cella Mamahit',
  'Fandy Kalesaran',
  'Riska Waworuntu',
  'Owen Tumiwa',
  'Tania Kandou',
  'Dede Mamonto',
  'Melda Sarundajang',
  'Brian Liow',
];

const allEmployeeProspek: EmployeeProspekRow[] = [
  ...topSalesProspek.map((row) => ({
    nama: row.nama,
    cabang: row.cabang,
    kategori: 'Sales' as const,
    posisi: 'Sales',
    prospekHariIni: row.prospekHariIni,
    target: row.target,
    persentase: row.persentase,
  })),
  ...additionalSalesNames.map((nama, index) => {
    const prospekHariIni = [14, 14, 13, 13, 12, 12, 11, 11, 10, 10, 9, 9, 10, 9][index];
    const target = 20;
    return {
      nama,
      cabang: branches[(index + 10) % branches.length],
      kategori: 'Sales' as const,
      posisi: 'Sales',
      prospekHariIni,
      target,
      persentase: Math.round((prospekHariIni / target) * 100),
    };
  }),
  ...topNonSalesProspek.map((row) => ({
    nama: row.nama,
    cabang: row.cabang,
    kategori: 'Non-Sales' as const,
    posisi: row.posisi,
    prospekHariIni: row.prospekHariIni,
    target: row.target,
    persentase: row.persentase,
  })),
  ...additionalNonSalesNames.map((nama, index) => {
    const prospekHariIni = index < 35 ? 3 : 2;
    const target = 5;
    return {
      nama,
      cabang: branches[(index + 5) % branches.length],
      kategori: 'Non-Sales' as const,
      posisi: nonSalesPositions[index % nonSalesPositions.length],
      prospekHariIni,
      target,
      persentase: Math.round((prospekHariIni / target) * 100),
    };
  }),
]
  .sort((a, b) => b.prospekHariIni - a.prospekHariIni || b.persentase - a.persentase)
  .map((row, index) => ({ ...row, rank: index + 1 }));

const OwnerProspekPage: React.FC = () => {
  const { prospek, closing, conversionRate, raportPersentase } = ownerDashboardData;

  const cards = [
    { ...prospek, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { ...closing, icon: Target, color: 'text-secondary', bg: 'bg-secondary/10' },
    { ...conversionRate, icon: BarChart3, color: 'text-tertiary', bg: 'bg-tertiary/10' },
    { ...raportPersentase, icon: Target, color: 'text-primary', bg: 'bg-primary/10', isRaport: true },
  ];

  // Data per hari (24 jam, bisa pilih tanggal)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode] = useState<'minggu' | 'bulan'>('minggu');
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBranchFilter, setEmployeeBranchFilter] = useState('Semua');
  const [employeeCategoryFilter, setEmployeeCategoryFilter] = useState<'Semua' | EmployeeProspekRow['kategori']>('Semua');
  const [employeePositionFilter, setEmployeePositionFilter] = useState('Semua');
  const [employeeAchievementFilter, setEmployeeAchievementFilter] = useState<AchievementFilter>('Semua');
  const [employeeSort, setEmployeeSort] = useState<EmployeeSortKey>('rank');
  const employeeItemsPerPage = 12;
  const employeeBranchOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(allEmployeeProspek.map((row) => row.cabang))).sort((a, b) => a.localeCompare(b, 'id'))],
    []
  );
  const employeePositionOptions = useMemo(
    () => ['Semua', ...Array.from(new Set(allEmployeeProspek.map((row) => row.posisi))).sort((a, b) => a.localeCompare(b, 'id'))],
    []
  );
  const filteredEmployeeProspek = useMemo(() => {
    const searchValue = employeeSearch.trim().toLowerCase();

    return allEmployeeProspek
      .filter((row) => {
        const matchesSearch =
          searchValue.length === 0 ||
          `${row.nama} ${row.cabang} ${row.kategori} ${row.posisi}`.toLowerCase().includes(searchValue);
        const matchesBranch = employeeBranchFilter === 'Semua' || row.cabang === employeeBranchFilter;
        const matchesCategory = employeeCategoryFilter === 'Semua' || row.kategori === employeeCategoryFilter;
        const matchesPosition = employeePositionFilter === 'Semua' || row.posisi === employeePositionFilter;
        const matchesAchievement =
          employeeAchievementFilter === 'Semua' ||
          (employeeAchievementFilter === 'Tercapai' ? row.persentase >= 100 : row.persentase < 100);

        return matchesSearch && matchesBranch && matchesCategory && matchesPosition && matchesAchievement;
      })
      .sort((a, b) => {
        if (employeeSort === 'nama') return a.nama.localeCompare(b.nama, 'id');
        if (employeeSort === 'cabang') return a.cabang.localeCompare(b.cabang, 'id') || a.rank - b.rank;
        if (employeeSort === 'prospek_desc') return b.prospekHariIni - a.prospekHariIni || a.rank - b.rank;
        if (employeeSort === 'prospek_asc') return a.prospekHariIni - b.prospekHariIni || a.rank - b.rank;
        if (employeeSort === 'persentase_desc') return b.persentase - a.persentase || a.rank - b.rank;
        if (employeeSort === 'persentase_asc') return a.persentase - b.persentase || a.rank - b.rank;
        return a.rank - b.rank;
      });
  }, [
    employeeAchievementFilter,
    employeeBranchFilter,
    employeeCategoryFilter,
    employeePositionFilter,
    employeeSearch,
    employeeSort,
  ]);
  const employeeTotalPages = Math.max(1, Math.ceil(filteredEmployeeProspek.length / employeeItemsPerPage));
  const employeePageStart = (employeePage - 1) * employeeItemsPerPage;
  const paginatedEmployeeProspek = filteredEmployeeProspek.slice(
    employeePageStart,
    employeePageStart + employeeItemsPerPage
  );
  const hasEmployeeFilters =
    employeeSearch.trim() !== '' ||
    employeeBranchFilter !== 'Semua' ||
    employeeCategoryFilter !== 'Semua' ||
    employeePositionFilter !== 'Semua' ||
    employeeAchievementFilter !== 'Semua' ||
    employeeSort !== 'rank';

  useEffect(() => {
    setEmployeePage(1);
  }, [
    employeeAchievementFilter,
    employeeBranchFilter,
    employeeCategoryFilter,
    employeePositionFilter,
    employeeSearch,
    employeeSort,
  ]);

  const resetEmployeeFilters = () => {
    setEmployeeSearch('');
    setEmployeeBranchFilter('Semua');
    setEmployeeCategoryFilter('Semua');
    setEmployeePositionFilter('Semua');
    setEmployeeAchievementFilter('Semua');
    setEmployeeSort('rank');
  };
  const hourlyData = [
    { jam: '00:00', sales: 0, nonSales: 0 }, { jam: '01:00', sales: 0, nonSales: 0 },
    { jam: '02:00', sales: 0, nonSales: 0 }, { jam: '03:00', sales: 0, nonSales: 0 },
    { jam: '04:00', sales: 0, nonSales: 0 }, { jam: '05:00', sales: 0, nonSales: 0 },
    { jam: '06:00', sales: 1, nonSales: 0 }, { jam: '07:00', sales: 3, nonSales: 1 },
    { jam: '08:00', sales: 12, nonSales: 5 }, { jam: '09:00', sales: 22, nonSales: 10 },
    { jam: '10:00', sales: 35, nonSales: 15 }, { jam: '11:00', sales: 28, nonSales: 12 },
    { jam: '12:00', sales: 15, nonSales: 7 }, { jam: '13:00', sales: 25, nonSales: 11 },
    { jam: '14:00', sales: 32, nonSales: 14 }, { jam: '15:00', sales: 38, nonSales: 16 },
    { jam: '16:00', sales: 30, nonSales: 13 }, { jam: '17:00', sales: 22, nonSales: 9 },
    { jam: '18:00', sales: 15, nonSales: 5 }, { jam: '19:00', sales: 10, nonSales: 3 },
    { jam: '20:00', sales: 5, nonSales: 2 }, { jam: '21:00', sales: 3, nonSales: 1 },
    { jam: '22:00', sales: 1, nonSales: 0 }, { jam: '23:00', sales: 0, nonSales: 0 },
  ];

  // Data per minggu (Senin - Minggu)
  const weeklyData = [
    { hari: 'Senin', sales: 95, nonSales: 42 },
    { hari: 'Selasa', sales: 110, nonSales: 48 },
    { hari: 'Rabu', sales: 88, nonSales: 38 },
    { hari: 'Kamis', sales: 102, nonSales: 45 },
    { hari: 'Jumat', sales: 98, nonSales: 40 },
    { hari: 'Sabtu', sales: 120, nonSales: 52 },
    { hari: 'Minggu', sales: 45, nonSales: 18 },
  ];

  // Data per bulan (tanggal 1 - 31)
  const monthlyData = Array.from({ length: 31 }, (_, i) => ({
    tanggal: `${i + 1}`,
    sales: Math.floor(Math.random() * 60) + 60,
    nonSales: Math.floor(Math.random() * 30) + 20,
  }));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="font-display text-headline-sm font-bold text-on-surface">Prospek & Closing</h1>
        <p className="text-body-sm text-on-surface-variant mt-1">Monitoring prospek masuk, closing, conversion rate, dan raport persentase</p>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          let trendColor = 'text-on-surface-variant';
          let trendBg = 'bg-surface-high';
          if (card.trend === 'up') { trendColor = 'text-secondary'; trendBg = 'bg-secondary/10'; }
          else if (card.trend === 'down') { trendColor = 'text-error'; trendBg = 'bg-error/10'; }
          const valueColor = (card as any).isRaport ? (card.value >= 100 ? 'text-secondary' : 'text-error') : 'text-on-surface';

          return (
            <motion.div key={card.label} variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 rounded-lg ${card.bg} ${card.color}`}><Icon className="w-5 h-5" /></div>
                <div className={`flex items-center gap-0.5 text-label-xs font-bold px-2 py-1 rounded-md ${trendBg} ${trendColor}`}>
                  <TrendIcon direction={card.trend} className="w-3 h-3" />{card.trendPercentage}
                </div>
              </div>
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">{card.label}</div>
              <div className={`font-display text-headline-sm font-bold ${valueColor}`}>{card.formattedValue}</div>
              <div className="text-label-xs text-on-surface-variant mt-1">Kemarin: {(card as any).isRaport ? `${card.previousValue}%` : card.previousValue.toLocaleString('id-ID')}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Grafik Prospek */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Grafik Pengumpulan Prospek</h3>
            <p className="text-label-xs text-on-surface-variant mt-1">Distribusi prospek masuk berdasarkan waktu</p>
          </div>
          <div className="flex items-center gap-3">
            {selectedDate !== '' && (
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 bg-surface-high border border-outline-variant/20 rounded-lg text-label-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/40" />
            )}
            <div className="flex gap-1 bg-surface-high rounded-lg p-1">
              <button onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate !== '' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Hari</button>
              <button onClick={() => setSelectedDate('')} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate === '' && viewMode === 'minggu' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`} onClickCapture={() => setViewMode('minggu')}>Minggu</button>
              <button onClick={() => { setSelectedDate(''); setViewMode('bulan'); }} className={`px-3 py-1.5 rounded-md text-label-xs font-semibold transition-colors ${selectedDate === '' && viewMode === 'bulan' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>Bulan</button>
            </div>
          </div>
        </div>
        <div className="w-full h-[320px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={100}>
            <AreaChart data={selectedDate !== '' ? hourlyData : viewMode === 'minggu' ? (weeklyData as any[]) : (monthlyData as any[])}>
              <defs>
                <linearGradient id="gradS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradNS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#A2F31F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey={selectedDate !== '' ? 'jam' : viewMode === 'minggu' ? 'hari' : 'tanggal'} stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: 'rgba(30,30,46,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={2.5} fill="url(#gradS)" />
              <Area type="monotone" dataKey="nonSales" name="Non-Sales" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradNS)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {selectedDate !== '' && (
          <div className="mt-3 p-3 rounded-lg bg-surface-high/50 border border-white/5">
            <p className="text-label-xs text-on-surface-variant">
              <span className="font-semibold text-primary">Peak hours:</span> Mayoritas prospek dikumpulkan antara <span className="font-bold text-on-surface">09:00 - 16:00</span>. Puncak di jam <span className="font-bold text-on-surface">15:00</span>.
            </p>
          </div>
        )}
      </motion.div>

      {/* Persentase Prospek — Akumulasi Target */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Persentase Pencapaian Prospek Hari Ini</h3>
        <p className="text-body-sm text-on-surface-variant mb-4">Target dihitung dari jumlah karyawan × target per kategori (Sales: 20/hari, Non-Sales: 5/hari)</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Sales */}
          {(() => {
            const jumlahSales = 24;
            const targetSalesPerOrang = 20;
            const totalTargetSales = jumlahSales * targetSalesPerOrang;
            const actualSales = 385;
            const persentaseSales = Math.round((actualSales / totalTargetSales) * 100);
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Sales ({jumlahSales} orang)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseSales >= 100 ? 'text-secondary' : 'text-error'}`}>{persentaseSales}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseSales >= 100 ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(persentaseSales, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{actualSales} / {totalTargetSales} prospek (target {targetSalesPerOrang}/orang)</div>
              </div>
            );
          })()}
          {/* Non-Sales */}
          {(() => {
            const jumlahNonSales = 56;
            const targetNonSalesPerOrang = 5;
            const totalTargetNonSales = jumlahNonSales * targetNonSalesPerOrang;
            const actualNonSales = 198;
            const persentaseNonSales = Math.round((actualNonSales / totalTargetNonSales) * 100);
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Non-Sales ({jumlahNonSales} orang)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseNonSales >= 100 ? 'text-secondary' : 'text-error'}`}>{persentaseNonSales}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseNonSales >= 100 ? 'bg-secondary' : 'bg-error'}`} style={{ width: `${Math.min(persentaseNonSales, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{actualNonSales} / {totalTargetNonSales} prospek (target {targetNonSalesPerOrang}/orang)</div>
              </div>
            );
          })()}
          {/* Total */}
          {(() => {
            const totalTarget = (24 * 20) + (56 * 5);
            const totalActual = 385 + 198;
            const persentaseTotal = Math.round((totalActual / totalTarget) * 100);
            return (
              <div className="rounded-xl border border-white/5 bg-surface-high/50 p-4">
                <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total (80 karyawan)</div>
                <div className={`font-display text-title-lg font-bold ${persentaseTotal >= 100 ? 'text-secondary' : persentaseTotal >= 70 ? 'text-yellow-400' : 'text-error'}`}>{persentaseTotal}%</div>
                <div className="w-full bg-surface rounded-full h-2 mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${persentaseTotal >= 100 ? 'bg-secondary' : persentaseTotal >= 70 ? 'bg-yellow-400' : 'bg-error'}`} style={{ width: `${Math.min(persentaseTotal, 100)}%` }} />
                </div>
                <div className="text-label-xs text-on-surface-variant mt-2">{totalActual} / {totalTarget} prospek total</div>
              </div>
            );
          })()}
        </div>
      </motion.div>

      {/* Top Sales by Prospek */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Top Sales — Prospek Terbanyak</h3>
              <p className="text-label-xs text-on-surface-variant">Target minimal: 20 prospek/hari</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-12">#</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
                </tr>
              </thead>
              <tbody>
                {topSalesProspek.map((row) => (
                  <tr key={row.rank} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        {row.rank <= 3 && <Trophy className={`w-3.5 h-3.5 ${row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />}
                        <span className="text-body-sm font-bold text-on-surface">{row.rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.cabang}</td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                        {row.persentase}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Top Non-Sales by Prospek */}
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-5 h-5 text-secondary" />
            <div>
              <h3 className="font-display text-title-md font-bold text-on-surface">Top Non-Sales — Prospek Terbanyak</h3>
              <p className="text-label-xs text-on-surface-variant">Target minimal: 5 prospek/hari</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-12">#</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                  <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Posisi</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                  <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
                </tr>
              </thead>
              <tbody>
                {topNonSalesProspek.map((row) => (
                  <tr key={row.rank} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        {row.rank <= 3 && <Trophy className={`w-3.5 h-3.5 ${row.rank === 1 ? 'text-yellow-400' : row.rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />}
                        <span className="text-body-sm font-bold text-on-surface">{row.rank}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.posisi}</td>
                    <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                        {row.persentase}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Seluruh Karyawan */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Seluruh Karyawan — Pencapaian Prospek</h3>
            <p className="text-label-xs text-on-surface-variant mt-1">Menampilkan {filteredEmployeeProspek.length} dari {allEmployeeProspek.length} karyawan</p>
          </div>
          <div className="rounded-lg border border-outline-variant/10 bg-surface-high px-3 py-2 text-label-xs text-on-surface-variant">
            Baris <span className="font-bold text-on-surface">{filteredEmployeeProspek.length === 0 ? 0 : employeePageStart + 1}</span> - <span className="font-bold text-on-surface">{Math.min(employeePageStart + employeeItemsPerPage, filteredEmployeeProspek.length)}</span> dari <span className="font-bold text-on-surface">{filteredEmployeeProspek.length}</span>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-outline-variant/10 bg-surface-high/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <span className="text-label-sm font-bold text-on-surface">Filter Data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input
                type="search"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder="Cari nama, cabang, kategori, posisi..."
                className="w-full h-10 rounded-lg border border-outline-variant/20 bg-surface px-9 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={employeeBranchFilter}
              onChange={(event) => setEmployeeBranchFilter(event.target.value)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              {employeeBranchOptions.map((branch) => (
                <option key={branch} value={branch}>Cabang: {branch}</option>
              ))}
            </select>
            <select
              value={employeeCategoryFilter}
              onChange={(event) => setEmployeeCategoryFilter(event.target.value as 'Semua' | EmployeeProspekRow['kategori'])}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="Semua">Kategori: Semua</option>
              <option value="Sales">Kategori: Sales</option>
              <option value="Non-Sales">Kategori: Non-Sales</option>
            </select>
            <select
              value={employeePositionFilter}
              onChange={(event) => setEmployeePositionFilter(event.target.value)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              {employeePositionOptions.map((position) => (
                <option key={position} value={position}>Posisi: {position}</option>
              ))}
            </select>
            <select
              value={employeeAchievementFilter}
              onChange={(event) => setEmployeeAchievementFilter(event.target.value as AchievementFilter)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="Semua">Status: Semua</option>
              <option value="Tercapai">Status: Tercapai</option>
              <option value="Belum Tercapai">Status: Belum Tercapai</option>
            </select>
            <select
              value={employeeSort}
              onChange={(event) => setEmployeeSort(event.target.value as EmployeeSortKey)}
              className="h-10 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm text-on-surface outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            >
              <option value="rank">Urutkan: Ranking</option>
              <option value="nama">Urutkan: Nama A-Z</option>
              <option value="cabang">Urutkan: Cabang A-Z</option>
              <option value="prospek_desc">Urutkan: Prospek Tertinggi</option>
              <option value="prospek_asc">Urutkan: Prospek Terendah</option>
              <option value="persentase_desc">Urutkan: Persentase Tertinggi</option>
              <option value="persentase_asc">Urutkan: Persentase Terendah</option>
            </select>
            <button
              type="button"
              onClick={resetEmployeeFilters}
              disabled={!hasEmployeeFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3 w-14">#</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Nama</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Cabang</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Kategori</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Posisi</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Prospek</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">Target</th>
                <th className="text-right text-label-xs text-on-surface-variant uppercase tracking-widest py-2 px-3">%</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployeeProspek.map((row) => (
                <tr key={`${row.kategori}-${row.nama}`} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3 text-body-sm font-bold text-on-surface">{row.rank}</td>
                  <td className="py-2.5 px-3 text-body-sm font-medium text-on-surface">{row.nama}</td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.cabang}</td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex rounded-md px-2 py-1 text-label-xs font-bold ${row.kategori === 'Sales' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                      {row.kategori}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant">{row.posisi}</td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface text-right font-semibold">{row.prospekHariIni}</td>
                  <td className="py-2.5 px-3 text-body-sm text-on-surface-variant text-right">{row.target}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-label-xs font-bold ${row.persentase >= 100 ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {row.persentase}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredEmployeeProspek.length === 0 && (
          <div className="rounded-xl border border-outline-variant/10 bg-surface-high/40 py-10 text-center">
            <p className="text-body-sm font-semibold text-on-surface">Tidak ada data yang cocok</p>
            <p className="text-label-xs text-on-surface-variant mt-1">Ubah kombinasi filter untuk melihat data karyawan lain.</p>
          </div>
        )}
        <Pagination
          currentPage={employeePage}
          totalPages={employeeTotalPages}
          onPageChange={setEmployeePage}
          className="mt-2 border-t border-white/5"
        />
      </motion.div>
    </motion.div>
  );
};

export default OwnerProspekPage;
