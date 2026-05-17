import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  Filter,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useAuthStore } from '../../store/authStore';
import {
  buildWhatsappUrl,
  formatProspekDateKey,
  statusColor,
  useKaryawanProspekStore,
} from '../../store/karyawanProspekStore';
import type { KaryawanProspekEntry, ProspekStatus } from '../../store/karyawanProspekStore';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

type DateFilter = 'all' | 'today' | 'week' | 'month';

const statusOptions: Array<{ value: 'all' | ProspekStatus; label: string }> = [
  { value: 'all', label: 'Semua status' },
  { value: 'deal', label: 'Deal' },
  { value: 'fu_ulang', label: 'FU Ulang' },
  { value: 'tanya_tanya', label: 'Tanya-tanya' },
  { value: 'polling', label: 'Polling' },
  { value: 'not_deal', label: 'Not Deal' },
];

const dateOptions: Array<{ value: DateFilter; label: string }> = [
  { value: 'all', label: 'Semua tanggal' },
  { value: 'today', label: 'Hari ini' },
  { value: 'week', label: '7 hari' },
  { value: 'month', label: '30 hari' },
];

const pageSizeOptions = [8, 12, 20];

const formatDate = (dateKey: string) => new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
}).format(new Date(`${dateKey}T12:00:00`));

const KaryawanProspekDatabasePage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const allProspek = useKaryawanProspekStore((s) => s.prospek);
  const fetchProspek = useKaryawanProspekStore((s) => s.fetchProspek);
  const updateProspek = useKaryawanProspekStore((s) => s.updateProspek);
  const deleteProspek = useKaryawanProspekStore((s) => s.deleteProspek);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProspekStatus>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionMessage, setActionMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const employeeId = user?.id || 'emp-local';

  const todayKey = useMemo(() => formatProspekDateKey(new Date()), []);
  const rows = useMemo<KaryawanProspekEntry[]>(
    () => allProspek
      .filter((item) => item.karyawanId === employeeId)
      .sort((a, b) => `${b.tanggal} ${b.createdAt}`.localeCompare(`${a.tanggal} ${a.createdAt}`)),
    [allProspek, employeeId],
  );

  useEffect(() => {
    fetchProspek({ limit: 500 });
  }, [fetchProspek]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = new Date(`${todayKey}T12:00:00`);

    return rows.filter((item) => {
      if (statusFilter !== 'all' && item.statusProspek !== statusFilter) return false;

      if (dateFilter !== 'all') {
        const date = new Date(`${item.tanggal}T12:00:00`);
        const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
        if (dateFilter === 'today' && diffDays !== 0) return false;
        if (dateFilter === 'week' && diffDays > 6) return false;
        if (dateFilter === 'month' && diffDays > 29) return false;
      }

      if (!query) return true;
      return [
        item.namaProspek,
        item.noWhatsapp,
        item.minatBarang,
        item.keteranganProspek,
        item.keteranganFincoy,
        item.statusProspek,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [dateFilter, rows, search, statusFilter, todayKey]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [currentPage, filteredRows, pageSize]);

  const totalDeal = useMemo(() => rows.filter((item) => item.statusProspek === 'deal').length, [rows]);
  const totalNeedFollowUp = useMemo(() => rows.filter((item) => item.statusProspek === 'fu_ulang' || item.statusProspek === 'tanya_tanya').length, [rows]);
  const todayCount = useMemo(() => rows.filter((item) => item.tanggal === todayKey).length, [rows, todayKey]);
  const conversionRate = rows.length ? Math.round((totalDeal / rows.length) * 100) : 0;
  const hasFilter = search.trim() || statusFilter !== 'all' || dateFilter !== 'all';

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, pageSize, search, statusFilter]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDateFilter('all');
    setPageSize(8);
  };

  const handleStatusChange = async (item: KaryawanProspekEntry, nextStatus: ProspekStatus) => {
    if (item.statusProspek === nextStatus) return;
    setBusyId(item.id);
    try {
      await updateProspek(item.id, { statusProspek: nextStatus });
      setActionMessage('Status prospek berhasil diperbarui.');
      window.setTimeout(() => setActionMessage(''), 2500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Status prospek gagal diperbarui.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: KaryawanProspekEntry) => {
    const confirmed = window.confirm(`Hapus prospek ${item.namaProspek}? Data ini juga akan dilepas dari daftar prospek WA campaign.`);
    if (!confirmed) return;
    setBusyId(item.id);
    try {
      await deleteProspek(item.id);
      setActionMessage('Prospek berhasil dihapus.');
      window.setTimeout(() => setActionMessage(''), 2500);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Prospek gagal dihapus.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
              <Database className="h-3.5 w-3.5" />
              Database prospek
            </div>
            <h1 className="text-headline-md font-black text-on-surface">Prospek Saya</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">
              Lihat semua prospek yang pernah dikumpulkan, cek status follow up, dan buka WhatsApp customer dari satu tabel.
            </p>
          </div>
          <div className="grid min-w-full grid-cols-2 gap-3 sm:min-w-[520px] sm:grid-cols-4">
            {[
              { label: 'Total', value: rows.length, helper: 'Prospek', icon: Database, tone: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Hari Ini', value: todayCount, helper: 'Masuk', icon: CalendarDays, tone: 'text-tertiary', bg: 'bg-tertiary/10' },
              { label: 'Deal', value: totalDeal, helper: `${conversionRate}%`, icon: CheckCircle2, tone: 'text-secondary', bg: 'bg-secondary/10' },
              { label: 'Perlu FU', value: totalNeedFollowUp, helper: 'Aktif', icon: MessageCircle, tone: 'text-yellow-600', bg: 'bg-yellow-500/10' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-2xl border border-outline-variant/20 bg-surface-high/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</span>
                    <span className={`rounded-xl p-2 ${stat.bg} ${stat.tone}`}><Icon className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-2 text-title-lg font-black text-on-surface">{stat.value}</div>
                  <div className="text-label-xs font-semibold text-on-surface-variant">{stat.helper}</div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-4 shadow-sm lg:p-5">
        {actionMessage && (
          <div className="mb-4 rounded-xl border border-primary/15 bg-primary/10 px-4 py-3 text-body-sm font-semibold text-primary">
            {actionMessage}
          </div>
        )}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-title-lg font-black text-on-surface">Filter Data</h2>
            <p className="text-body-sm text-on-surface-variant">Menampilkan {filteredRows.length} dari {rows.length} prospek.</p>
          </div>
          {hasFilter && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-outline-variant/20 bg-surface-high px-4 py-2.5 text-label-sm font-bold text-on-surface transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filter
            </button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_160px_130px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama, nomor, barang, fincoy..."
              className="h-11 w-full rounded-xl border border-outline-variant/20 bg-surface-high px-10 text-body-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            />
          </label>

          <label className="relative block">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ProspekStatus)}
              className="h-11 w-full appearance-none rounded-xl border border-outline-variant/20 bg-surface-high px-10 pr-9 text-body-sm font-semibold text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            >
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          </label>

          <label className="relative block">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DateFilter)}
              className="h-11 w-full appearance-none rounded-xl border border-outline-variant/20 bg-surface-high px-10 pr-9 text-body-sm font-semibold text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            >
              {dateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          </label>

          <label className="relative block">
            <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-11 w-full appearance-none rounded-xl border border-outline-variant/20 bg-surface-high px-10 pr-9 text-body-sm font-semibold text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
            >
              {pageSizeOptions.map((option) => <option key={option} value={option}>{option}/page</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          </label>
        </div>
      </motion.section>

      <motion.section variants={itemVariants} className="overflow-hidden rounded-[1.75rem] border border-outline-variant/20 bg-surface shadow-sm">
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-[1080px] w-full border-collapse">
            <thead className="bg-surface-high/70">
              <tr>
                <th className="px-5 py-3 text-left text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Prospek</th>
                <th className="px-4 py-3 text-left text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Minat Barang</th>
                <th className="px-4 py-3 text-left text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-4 py-3 text-left text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Fincoy</th>
                <th className="px-4 py-3 text-left text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Tanggal</th>
                <th className="px-5 py-3 text-right text-label-xs font-black uppercase tracking-widest text-on-surface-variant">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {paginatedRows.map((item) => (
                <tr key={item.id} className="transition hover:bg-primary/5">
                  <td className="px-5 py-4 align-top">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-on-surface">{item.namaProspek}</div>
                        <div className="mt-1 inline-flex items-center gap-1.5 text-label-sm font-semibold text-on-surface-variant">
                          <Phone className="h-3.5 w-3.5" />
                          {item.noWhatsapp}
                        </div>
                        <p className="mt-2 max-w-md text-label-sm text-on-surface-variant">{item.keteranganProspek}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="text-body-sm font-bold text-on-surface">{item.minatBarang}</div>
                    <div className="mt-1 text-label-sm text-on-surface-variant">{item.cabang} • {item.divisi}</div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <select
                      value={item.statusProspek}
                      disabled={busyId === item.id}
                      onChange={(event) => handleStatusChange(item, event.target.value as ProspekStatus)}
                      className={`rounded-xl border px-3 py-2 text-label-sm font-black outline-none transition focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${statusColor[item.statusProspek]}`}
                    >
                      {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4 align-top text-body-sm font-semibold text-on-surface">{item.keteranganFincoy || '-'}</td>
                  <td className="px-4 py-4 align-top">
                    <div className="font-bold text-on-surface">{formatDate(item.tanggal)}</div>
                    <div className="mt-1 inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                      <Clock3 className="h-3.5 w-3.5" />
                      {item.createdAt}
                    </div>
                  </td>
                  <td className="px-5 py-4 align-top text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <a
                        href={buildWhatsappUrl(item.noWhatsapp, item.namaProspek)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-label-sm font-black text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#25D366]/30"
                      >
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </a>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center justify-center rounded-xl border border-error/20 bg-error/10 p-2.5 text-error transition hover:bg-error/15 disabled:opacity-60"
                        aria-label={`Hapus prospek ${item.namaProspek}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {paginatedRows.map((item) => (
            <article key={item.id} className="rounded-2xl border border-outline-variant/20 bg-surface-high/45 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black text-on-surface">{item.namaProspek}</div>
                  <div className="mt-1 text-label-sm font-semibold text-on-surface-variant">{item.noWhatsapp}</div>
                </div>
                <select
                  value={item.statusProspek}
                  disabled={busyId === item.id}
                  onChange={(event) => handleStatusChange(item, event.target.value as ProspekStatus)}
                  className={`shrink-0 rounded-xl border px-2.5 py-1 text-label-xs font-black outline-none disabled:opacity-60 ${statusColor[item.statusProspek]}`}
                >
                  {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 text-body-sm font-bold text-on-surface">{item.minatBarang}</div>
              <p className="mt-1 text-label-sm text-on-surface-variant">{item.keteranganProspek}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-label-sm text-on-surface-variant">
                <span className="rounded-full bg-surface px-3 py-1">{formatDate(item.tanggal)}, {item.createdAt}</span>
                <span className="rounded-full bg-surface px-3 py-1">Fincoy: {item.keteranganFincoy || '-'}</span>
              </div>
              <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <a
                  href={buildWhatsappUrl(item.noWhatsapp, item.namaProspek)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-label-sm font-black text-white transition hover:opacity-90"
                >
                  <MessageCircle className="h-4 w-4" />
                  Buka WhatsApp
                </a>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => handleDelete(item)}
                  className="inline-flex items-center justify-center rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-error transition hover:bg-error/15 disabled:opacity-60"
                  aria-label={`Hapus prospek ${item.namaProspek}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>

        {filteredRows.length === 0 && (
          <div className="p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface-high text-on-surface-variant">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-title-md font-black text-on-surface">Data tidak ditemukan</h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">Ubah kata kunci atau reset filter untuk melihat prospek lain.</p>
          </div>
        )}

        <div className="border-t border-outline-variant/15 px-3">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
        </div>
      </motion.section>
    </motion.div>
  );
};

export default KaryawanProspekDatabasePage;
