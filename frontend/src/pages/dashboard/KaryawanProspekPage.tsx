import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeDollarSign, CalendarOff, CheckCircle, Clock3, MessageCircle, Phone, Plus, Send, Sparkles, Target, UserRound } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import {
  formatProspekDateKey,
  normalizeWhatsapp,
  statusColor,
  statusLabel,
  useKaryawanProspekStore,
} from '../../store/karyawanProspekStore';
import type { ProspekStatus } from '../../store/karyawanProspekStore';
import { calculateProspekDailyFine, formatRupiah } from '../../utils/denda';
import { isAdminSalesRole, isSalesTargetKategori } from '../../utils/roles';
import { useOffRequestStore } from '../../store/offRequestStore';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 120, damping: 18 } } };

const getUserCabang = (user: ReturnType<typeof useAuthStore.getState>['user']) =>
  user?.cabangName || user?.cabang_name || user?.cabangId || user?.cabang_id || '';

const KaryawanProspekPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const allProspek = useKaryawanProspekStore((s) => s.prospek);
  const addProspek = useKaryawanProspekStore((s) => s.addProspek);
  const fetchProspek = useKaryawanProspekStore((s) => s.fetchProspek);
  const prospekError = useKaryawanProspekStore((s) => s.error);
  const offRequests = useOffRequestStore((state) => state.requests);
  const fetchOffRequests = useOffRequestStore((state) => state.fetchRequests);
  const isAdminSales = isAdminSalesRole(user?.role);
  const isAgent = user?.role === 'agent';
  const isOperator = user?.role === 'operator';
  const divisi = user?.divisi || (isAdminSales ? 'Admin Sales' : isAgent ? 'Agen' : isOperator ? 'Operator' : '');
  const cabang = getUserCabang(user) || (isAdminSales ? 'Admin Sales' : isAgent ? 'Agen' : isOperator ? 'Operator' : '');
  const isSales = isAdminSales || isAgent || isSalesTargetKategori(user?.jabatan, divisi);
  const targetProspek = isSales ? 20 : 5;
  const employeeId = user?.id || 'emp-local';
  const todayKey = useMemo(() => formatProspekDateKey(new Date()), []);

  const [namaProspek, setNamaProspek] = useState('');
  const [noWhatsapp, setNoWhatsapp] = useState('');
  const [minatBarang, setMinatBarang] = useState('');
  const [keteranganProspek, setKeteranganProspek] = useState('');
  const [statusProspek, setStatusProspek] = useState<ProspekStatus>('tanya_tanya');
  const [keteranganFincoy, setKeteranganFincoy] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchProspek({ tanggal: todayKey, limit: 500 });
    fetchOffRequests({ tanggal: todayKey, limit: 50 });
  }, [fetchOffRequests, fetchProspek, todayKey]);

  const prospekList = useMemo(
    () => allProspek.filter((item) => item.karyawanId === employeeId && item.tanggal === todayKey),
    [allProspek, employeeId, todayKey],
  );

  const progress = Math.min(Math.round((prospekList.length / targetProspek) * 100), 100);
  const approvedOffToday = offRequests.find((request) => request.karyawanId === employeeId && request.tanggal === todayKey && request.status === 'approved');
  const dendaProspekHariIni = approvedOffToday ? 0 : calculateProspekDailyFine(prospekList.length, targetProspek);
  const dealCount = useMemo(() => prospekList.filter((p) => p.statusProspek === 'deal').length, [prospekList]);
  const followUpCount = useMemo(() => prospekList.filter((p) => p.statusProspek === 'fu_ulang' || p.statusProspek === 'tanya_tanya').length, [prospekList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (approvedOffToday) {
      setSuccessMsg('OFF hari ini sudah disetujui PIC. Prospek tidak wajib dikirim.');
      return;
    }
    if (!namaProspek.trim() || !noWhatsapp.trim() || !minatBarang.trim()) return;
    if (!cabang.trim()) {
      setSuccessMsg('Cabang akun belum diatur. Hubungi admin untuk set cabang akun.');
      return;
    }
    const activeDivisi = divisi.trim();
    if (!activeDivisi) {
      setSuccessMsg('Divisi akun belum diatur. Hubungi admin untuk set divisi akun.');
      return;
    }

    const normalizedWhatsapp = normalizeWhatsapp(noWhatsapp);
    if (!normalizedWhatsapp.startsWith('08') || normalizedWhatsapp.length < 10) {
      setSuccessMsg('Nomor WhatsApp harus valid, rapi, dan diawali 08.');
      return;
    }

    setSubmitting(true);
    try {
      await addProspek({
        karyawanId: employeeId,
        karyawanName: user?.name || (isAdminSales ? 'Admin Sales Tridjaya' : isAgent ? 'Agen Tridjaya' : isOperator ? 'Operator Tridjaya' : 'Karyawan Tridjaya'),
        cabang,
        divisi: activeDivisi,
        namaProspek: namaProspek.toUpperCase(),
        noWhatsapp: normalizedWhatsapp,
        minatBarang: minatBarang.toUpperCase(),
        keteranganProspek,
        statusProspek,
        keteranganFincoy,
        tanggal: todayKey,
        createdAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      });
      setNamaProspek('');
      setNoWhatsapp('');
      setMinatBarang('');
      setKeteranganProspek('');
      setStatusProspek('tanya_tanya');
      setKeteranganFincoy('');
      setSuccessMsg('Prospek berhasil dikirim.');
      window.setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      setSuccessMsg(error instanceof Error ? error.message : 'Prospek gagal dikirim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-outline-variant/20 bg-surface p-6 shadow-sm lg:p-7">
        <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-label-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Prospek harian
            </div>
            <h1 className="text-headline-md font-black text-on-surface">Submit Prospek</h1>
            <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
              Masukkan prospek baru dengan data yang siap di-follow up, mulai dari barang minat sampai status terakhir.
            </p>
          </div>
          <div className="min-w-[240px] rounded-2xl border border-outline-variant/20 bg-surface-high/70 p-4">
            <div className="flex items-center justify-between text-label-sm font-bold">
              <span className="text-on-surface">Progress target</span>
              <span className="text-primary">{prospekList.length}/{targetProspek}</span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-label-sm text-on-surface-variant">{progress}% target harian terkumpul</p>
            {approvedOffToday && (
              <div className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-primary">
                <div className="flex items-center gap-2 text-label-sm font-bold">
                  <CalendarOff className="h-4 w-4" />
                  OFF disetujui PIC
                </div>
                <p className="mt-1 text-label-xs text-on-surface-variant">Prospek hari ini tidak wajib dan tidak dihitung denda.</p>
              </div>
            )}
            <div className={`mt-3 rounded-xl px-3 py-2 ${dendaProspekHariIni > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
              <div className="flex items-center gap-2 text-label-sm font-bold">
                <BadgeDollarSign className="h-4 w-4" />
                Denda hari ini: {formatRupiah(dendaProspekHariIni)}
              </div>
              <p className="mt-1 text-label-xs text-on-surface-variant">
                {dendaProspekHariIni > 0 ? 'Akan hilang jika target harian tercapai.' : 'Target harian sudah aman.'}
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: 'Total Hari Ini', value: prospekList.length, helper: `${Math.max(targetProspek - prospekList.length, 0)} lagi ke target`, icon: Target, tone: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Deal', value: dealCount, helper: 'Prospek siap diproses', icon: CheckCircle, tone: 'text-secondary', bg: 'bg-secondary/10' },
          { label: 'Perlu FU', value: followUpCount, helper: 'Tanya-tanya dan FU ulang', icon: MessageCircle, tone: 'text-yellow-600', bg: 'bg-yellow-500/10' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants} className="rounded-3xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-label-xs font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
                  <p className="mt-2 text-headline-sm font-black text-on-surface">{stat.value}</p>
                </div>
                <div className={`rounded-2xl p-3 ${stat.bg} ${stat.tone}`}><Icon className="h-5 w-5" /></div>
              </div>
              <p className="mt-3 text-body-sm text-on-surface-variant">{stat.helper}</p>
            </motion.div>
          );
        })}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm lg:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-title-lg font-black text-on-surface">Tambah Prospek Baru</h2>
              <p className="text-body-sm text-on-surface-variant">Field wajib: nama, WhatsApp, dan minat barang.</p>
            </div>
          </div>

          {successMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-2xl border border-secondary/20 bg-secondary/10 px-4 py-3 text-body-sm font-semibold text-secondary">
              <CheckCircle className="h-4 w-4" />
              {successMsg}
            </div>
          )}
          {prospekError && (
            <div className="mb-4 rounded-2xl border border-error/20 bg-error/10 px-4 py-3 text-body-sm font-semibold text-error">
              {prospekError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">Nama Prospek *</span>
                <input type="text" value={namaProspek} onChange={(e) => setNamaProspek(e.target.value)} disabled={Boolean(approvedOffToday)} placeholder="NAMA LENGKAP" className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md uppercase text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60" required />
              </label>
              <label className="space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">No WhatsApp *</span>
                <input type="tel" value={noWhatsapp} onChange={(e) => setNoWhatsapp(normalizeWhatsapp(e.target.value))} disabled={Boolean(approvedOffToday)} placeholder="08xxxxxxxxxx" inputMode="numeric" className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60" required />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-label-sm font-bold text-on-surface-variant">Minat Barang *</span>
              <input type="text" value={minatBarang} onChange={(e) => setMinatBarang(e.target.value)} disabled={Boolean(approvedOffToday)} placeholder="TV LED 43 INCH, KULKAS 2 PINTU, SAIGE POLARIS" className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md uppercase text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60" required />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">Status Prospek *</span>
                <select value={statusProspek} onChange={(e) => setStatusProspek(e.target.value as ProspekStatus)} className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15">
                  <option value="tanya_tanya">Tanya-tanya</option>
                  <option value="deal">Deal</option>
                  <option value="not_deal">Not Deal</option>
                  <option value="fu_ulang">FU Ulang</option>
                  <option value="polling">Polling</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">Fincoy / Leasing</span>
                <input type="text" value={keteranganFincoy} onChange={(e) => setKeteranganFincoy(e.target.value)} placeholder="FIF, Spektra, Adira" className="w-full rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-label-sm font-bold text-on-surface-variant">Keterangan</span>
              <textarea value={keteranganProspek} onChange={(e) => setKeteranganProspek(e.target.value)} placeholder="Contoh: minta dikirim brosur, mau datang sore, bandingkan cicilan." rows={3} className="w-full resize-none rounded-2xl border border-outline-variant/20 bg-surface-high px-4 py-3 text-body-md text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15" />
            </label>

            <button type="submit" disabled={submitting || Boolean(approvedOffToday)} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-body-sm font-bold text-on-primary shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto">
              <Send className="h-4 w-4" />
              {approvedOffToday ? 'OFF Disetujui' : submitting ? 'Mengirim...' : 'Kirim Prospek'}
            </button>
          </form>
        </motion.section>

        <motion.section variants={itemVariants} className="rounded-[1.75rem] border border-outline-variant/20 bg-surface p-5 shadow-sm lg:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-title-lg font-black text-on-surface">Prospek Hari Ini</h2>
              <p className="text-body-sm text-on-surface-variant">{prospekList.length} prospek tercatat, prioritaskan yang siap follow up.</p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-label-sm font-bold text-primary">{progress}% target</span>
          </div>

          <div className="space-y-3">
            {prospekList.map((p) => (
              <article key={p.id} className="rounded-2xl border border-outline-variant/15 bg-surface-high/45 p-4 transition hover:border-primary/25 hover:bg-primary/5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-body-sm font-black text-on-surface">
                        <UserRound className="h-4 w-4 text-primary" />
                        {p.namaProspek}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-label-xs font-bold ${statusColor[p.statusProspek] || statusColor.tanya_tanya}`}>
                        {statusLabel[p.statusProspek] || p.statusProspek}
                      </span>
                    </div>
                    <p className="mt-2 text-body-sm font-semibold text-on-surface">{p.minatBarang}</p>
                    <p className="mt-1 text-label-sm text-on-surface-variant">{p.keteranganProspek || 'Belum ada keterangan tambahan.'}</p>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="inline-flex items-center gap-1.5 text-label-sm font-semibold text-on-surface-variant">
                      <Clock3 className="h-3.5 w-3.5" />
                      {p.createdAt}
                    </div>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-label-sm font-bold text-on-surface">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      {p.noWhatsapp}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-label-sm text-on-surface-variant">
                  <span className="rounded-full bg-surface px-3 py-1">Fincoy: {p.keteranganFincoy || '-'}</span>
                </div>
              </article>
            ))}
          </div>

          {prospekList.length === 0 && (
            <div className="rounded-2xl border border-dashed border-outline-variant/30 bg-surface-high/40 p-8 text-center text-body-sm text-on-surface-variant">
              Belum ada prospek hari ini. Mulai dari satu nama yang paling hangat.
            </div>
          )}
        </motion.section>
      </div>
    </motion.div>
  );
};

export default KaryawanProspekPage;
