import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle2, Download, Calendar, Filter,
  DollarSign, BarChart3,
} from 'lucide-react';
import jsPDF from 'jspdf';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import Pagination from '../../components/ui/Pagination';
import { useAgentStore } from '../../store/useAgentStore';
import { useAuthStore } from '../../store/authStore';
import { getClaimRewardValue } from '../../utils/claimRewards';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AgentEarningsPage: React.FC = () => {
  const { claims, fetchClaims, createClaim } = useAgentStore();
  const user = useAuthStore((state) => state.user);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('Semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const completedClaims = claims.filter((claim) => claim.status === 'completed').length;
  const pendingClaims = claims.filter((claim) => claim.status === 'pending' || claim.status === 'processing').length;

  const availableBalance = claims
    .filter((claim) => claim.status === 'completed')
    .reduce((sum, claim) => sum + getClaimRewardValue(claim.tierId, claim.rewardValue), 0);
  const pendingBalance = claims
    .filter((claim) => claim.status === 'pending' || claim.status === 'processing')
    .reduce((sum, claim) => sum + getClaimRewardValue(claim.tierId, claim.rewardValue), 0);

  const earningHistory = useMemo(() => {
    return Array.from({ length: 6 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${date.getMonth()}`;

      const monthlyClaims = claims.filter((claim) => {
        const created = new Date(claim.submittedAt);
        return `${created.getFullYear()}-${created.getMonth()}` === key;
      });

      const komisi = monthlyClaims
        .filter((claim) => claim.status === 'completed')
        .reduce((sum, claim) => sum + getClaimRewardValue(claim.tierId, claim.rewardValue), 0);
      const payout = monthlyClaims
        .filter((claim) => claim.status === 'pending' || claim.status === 'processing')
        .reduce((sum, claim) => sum + getClaimRewardValue(claim.tierId, claim.rewardValue), 0);

      return {
        month: date.toLocaleDateString('id-ID', { month: 'short' }),
        komisi,
        payout,
      };
    });
  }, [claims]);

  const transactions = useMemo(() => {
    return claims.map((claim) => {
      const isCompleted = claim.status === 'completed';
      const isPending = claim.status === 'pending' || claim.status === 'processing';
      const amount = getClaimRewardValue(claim.tierId, claim.rewardValue);

      return {
        id: `CLM-${String(claim.id).padStart(4, '0')}`,
        type: isCompleted ? 'Komisi' : 'Payout',
        description: `${claim.rewardName} (${claim.status})`,
        amount: isCompleted ? amount : -amount,
        date: new Date(claim.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        status: isCompleted ? 'Credited' : isPending ? 'Pending' : 'Rejected',
      };
    });
  }, [claims]);

  const filtered = transactions.filter((t) => filterType === 'Semua' || t.type === filterType);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalEarnings = earningHistory.reduce((s, e) => s + e.komisi, 0);
  const payoutTrend = earningHistory.reduce((s, e) => s + e.payout, 0);

  const handleExportPdf = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const exportDate = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const formatCurrency = (value: number) => `Rp ${Math.abs(value).toLocaleString('id-ID')}`;
    const exportedTransactions = filtered;

    let y = 48;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Laporan Komisi & Penarikan Agen', 40, y);

    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Nama Agen: ${user?.name ?? '-'}`, 40, y);

    y += 14;
    doc.text(`Waktu Export: ${exportDate}`, 40, y);

    y += 22;
    doc.setDrawColor(220, 220, 220);
    doc.line(40, y, pageWidth - 40, y);

    y += 20;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Ringkasan', 40, y);

    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Saldo Dapat Ditarik: ${formatCurrency(availableBalance)}`, 40, y);
    y += 14;
    doc.text(`Komisi Pending: ${formatCurrency(pendingBalance)}`, 40, y);
    y += 14;
    doc.text(`Total Komisi 6 Bulan: ${formatCurrency(totalEarnings)}`, 40, y);
    y += 14;
    doc.text(`Total Payout Pending 6 Bulan: ${formatCurrency(payoutTrend)}`, 40, y);

    y += 22;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Riwayat Transaksi', 40, y);

    y += 16;
    doc.setFillColor(245, 245, 245);
    doc.rect(40, y - 11, pageWidth - 80, 18, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Tanggal', 44, y);
    doc.text('ID', 132, y);
    doc.text('Tipe', 220, y);
    doc.text('Status', 286, y);
    doc.text('Nilai', pageWidth - 44, y, { align: 'right' });

    y += 16;
    doc.setFont('helvetica', 'normal');

    if (exportedTransactions.length === 0) {
      doc.text('Tidak ada transaksi pada filter ini.', 44, y);
    } else {
      exportedTransactions.forEach((trx, index) => {
        if (y > pageHeight - 44) {
          doc.addPage();
          y = 48;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('Lanjutan Riwayat Transaksi', 40, y);
          y += 18;
          doc.setFillColor(245, 245, 245);
          doc.rect(40, y - 11, pageWidth - 80, 18, 'F');
          doc.setFontSize(9);
          doc.text('Tanggal', 44, y);
          doc.text('ID', 132, y);
          doc.text('Tipe', 220, y);
          doc.text('Status', 286, y);
          doc.text('Nilai', pageWidth - 44, y, { align: 'right' });
          y += 16;
          doc.setFont('helvetica', 'normal');
        }

        const amountLabel = `${trx.amount > 0 ? '+' : '-'}${formatCurrency(trx.amount)}`;
        doc.setFontSize(9);
        doc.text(trx.date, 44, y);
        doc.text(trx.id, 132, y);
        doc.text(trx.type, 220, y);
        doc.text(trx.status, 286, y);
        doc.text(amountLabel, pageWidth - 44, y, { align: 'right' });

        y += 14;
        if (index < exportedTransactions.length - 1) {
          doc.setDrawColor(235, 235, 235);
          doc.line(40, y, pageWidth - 40, y);
          y += 6;
        }
      });
    }

    doc.save(`tridjaya-earnings-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      setErrorMessage('Jumlah penarikan harus lebih dari 0.');
      return;
    }

    if (amount > availableBalance) {
      setErrorMessage('Jumlah melebihi saldo dapat ditarik.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      const success = await createClaim(`withdraw-${Date.now()}`, `Penarikan Dana Rp ${amount.toLocaleString('id-ID')}`);
      if (!success) {
        setErrorMessage('Gagal mengajukan penarikan.');
        return;
      }
      await fetchClaims();
      setSubmitted(true);
      setTimeout(() => {
        setShowWithdrawModal(false);
        setSubmitted(false);
        setWithdrawAmount('');
      }, 2000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-secondary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Finansial Agen</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Wallet className="w-6 h-6 text-secondary" /> Komisi & Penarikan
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Data komisi dan payout ditarik langsung dari nilai claim API berdasarkan tier reward.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="px-4 py-2.5 rounded-lg bg-secondary/15 text-secondary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-secondary/25 transition-colors w-fit"
          >
            <Wallet className="w-4 h-4" /> Ajukan Penarikan
          </button>
        </div>
      </motion.div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden border border-secondary/20">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/50 to-transparent" />
          <div className="p-2.5 rounded-lg bg-secondary/10 text-secondary w-fit mb-4"><DollarSign className="w-5 h-5" /></div>
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Saldo Dapat Ditarik</div>
          <div className="font-display text-headline-md font-bold text-secondary mb-1">
            Rp {availableBalance.toLocaleString('id-ID')}
          </div>
          <div className="text-label-xs text-on-surface-variant">{completedClaims} claim completed</div>
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="mt-4 w-full py-2.5 rounded-lg bg-secondary/20 text-secondary font-semibold text-label-sm hover:bg-secondary/30 transition-colors"
          >
            Tarik Sekarang
          </button>
        </motion.div>

        <motion.div variants={iv} className="glass-card rounded-xl p-6">
          <div className="p-2.5 rounded-lg bg-tertiary/10 text-tertiary w-fit mb-4"><Clock className="w-5 h-5" /></div>
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Komisi Pending</div>
          <div className="font-display text-headline-md font-bold text-tertiary mb-1">
            Rp {pendingBalance.toLocaleString('id-ID')}
          </div>
          <div className="text-label-xs text-on-surface-variant">{pendingClaims} claim menunggu proses admin</div>
        </motion.div>

        <motion.div variants={iv} className="glass-card rounded-xl p-6">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary w-fit mb-4"><BarChart3 className="w-5 h-5" /></div>
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Komisi (6 Bln)</div>
          <div className="font-display text-headline-md font-bold text-primary mb-1">
            Rp {(totalEarnings / 1000000).toFixed(1)}jt
          </div>
          <div className="text-label-xs text-secondary flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> Payout 6 bulan: Rp {(payoutTrend / 1000000).toFixed(1)}jt
          </div>
        </motion.div>
      </div>

      {/* Chart */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Tren Komisi vs Payout</h3>
            <p className="text-label-sm text-on-surface-variant mt-0.5">6 bulan terakhir</p>
          </div>
          <div className="flex items-center gap-4 text-label-xs text-on-surface-variant">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-secondary" />Komisi</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-primary" />Payout</span>
          </div>
        </div>
        <div className="h-[220px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={earningHistory}>
              <defs>
                <linearGradient id="gradKomisi" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#A2F31F" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#A2F31F" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPayout" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8FF5FF" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8FF5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
              <XAxis dataKey="month" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v: number) => `${(v / 1000000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                formatter={(v: unknown) => [`Rp ${((v as number) / 1000000).toFixed(2)}jt`, '']}
              />
              <Area type="monotone" dataKey="komisi" stroke="#A2F31F" strokeWidth={2.5} fill="url(#gradKomisi)" name="Komisi" />
              <Area type="monotone" dataKey="payout" stroke="#8FF5FF" strokeWidth={2} fill="url(#gradPayout)" name="Payout" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Transaction History */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface">Riwayat Transaksi</h3>
            <p className="text-body-sm text-on-surface-variant mt-0.5">Mutasi claim komisi dan payout</p>
          </div>
          <div className="flex items-center gap-2">
            {['Semua', 'Komisi', 'Payout'].map((t) => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterType === t ? 'bg-secondary/20 text-secondary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {paginated.map((trx) => {
            const isPositive = trx.amount > 0;
            return (
              <div key={trx.id} className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-surface-high/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPositive ? 'bg-secondary/15' : 'bg-primary/10'}`}>
                  {isPositive
                    ? <TrendingUp className="w-4 h-4 text-secondary" />
                    : <ArrowDownRight className="w-4 h-4 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-body-sm">{trx.description}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-label-xs text-on-surface-variant">
                    <span>{trx.id}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{trx.date}</span>
                    <span className={`px-1.5 py-0.5 rounded-md font-bold ${trx.status === 'Credited' ? 'bg-secondary/10 text-secondary' : trx.status === 'Pending' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'}`}>
                      {trx.status}
                    </span>
                  </div>
                </div>
                <div className={`font-display font-bold text-body-md flex-shrink-0 ${isPositive ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {isPositive ? '+' : ''}Rp {Math.abs(trx.amount).toLocaleString('id-ID')}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-body-sm text-on-surface-variant">Belum ada transaksi pada filter ini.</div>
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-6 border-t border-outline-variant/10"
        />

        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
          <span className="text-label-sm text-on-surface-variant">{filtered.length} transaksi</span>
          <button 
            type="button" 
            onClick={handleExportPdf}
            className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
      </motion.div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-surface-low border border-outline-variant/20 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-display text-title-md font-bold text-on-surface mb-2">Ajukan Penarikan</h3>
            <p className="text-body-sm text-on-surface-variant mb-4">
              Saldo tersedia: <strong className="text-secondary">Rp {availableBalance.toLocaleString('id-ID')}</strong>
            </p>
            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-secondary mx-auto mb-3" />
                <p className="font-semibold text-on-surface">Permintaan terkirim!</p>
                <p className="text-body-sm text-on-surface-variant mt-1">Admin akan memproses dalam 1×24 jam.</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="text-label-sm text-on-surface-variant font-semibold mb-1.5 block">Jumlah Penarikan (IDR)</label>
                  <input type="number" placeholder="Masukkan jumlah..." value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-secondary/40 font-body text-body-md"
                  />
                </div>
                <div className="mb-4 p-3 rounded-xl bg-surface-high text-label-sm text-on-surface-variant">
                  <Filter className="w-3.5 h-3.5 inline mr-1.5" /> Rekening: {user?.bank_account?.trim() ? user.bank_account : 'belum diatur'} ({user?.name ?? 'Agen'})
                </div>
                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-error/10 text-error text-label-sm">{errorMessage}</div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-variant font-semibold hover:text-on-surface transition-colors">
                    Batal
                  </button>
                  <button type="button" onClick={handleWithdraw} disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-secondary/20 text-secondary font-semibold hover:bg-secondary/30 transition-colors">
                    {submitting ? 'Mengajukan...' : 'Ajukan'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default AgentEarningsPage;
