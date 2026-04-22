import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, Clock,
  CheckCircle2, Download, Calendar, Filter,
  DollarSign, Target, BarChart3,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';

const earningHistory = [
  { month: 'Nov', komisi: 1800000, payout: 1500000 },
  { month: 'Des', komisi: 2100000, payout: 1800000 },
  { month: 'Jan', komisi: 2500000, payout: 2100000 },
  { month: 'Feb', komisi: 3200000, payout: 2800000 },
  { month: 'Mar', komisi: 2900000, payout: 2500000 },
  { month: 'Apr', komisi: 3800000, payout: 3200000 },
];

const transactions = [
  { id: 'TRX-0041', type: 'Komisi', description: 'Goda GD120 — Andi Wijaya', amount: 750000, date: '20 Apr 2026', status: 'Credited' },
  { id: 'TRX-0040', type: 'Komisi', description: 'Smart TV OLED — Dewi Lestari', amount: 840000, date: '18 Apr 2026', status: 'Credited' },
  { id: 'TRX-0039', type: 'Payout', description: 'Penarikan ke BRI 1234-xxxx', amount: -2500000, date: '15 Apr 2026', status: 'Paid' },
  { id: 'TRX-0038', type: 'Komisi', description: 'Winfly W200 — Hendra S.', amount: 920000, date: '12 Apr 2026', status: 'Credited' },
  { id: 'TRX-0037', type: 'Bonus', description: 'Bonus Ranking Top 3 Maret', amount: 500000, date: '01 Apr 2026', status: 'Credited' },
  { id: 'TRX-0036', type: 'Payout', description: 'Penarikan ke BRI 1234-xxxx', amount: -1800000, date: '28 Mar 2026', status: 'Paid' },
];

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AgentEarningsPage: React.FC = () => {
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [filterType, setFilterType] = useState('Semua');

  const filtered = transactions.filter((t) => filterType === 'Semua' || t.type === filterType);
  const availableBalance = 1620000;
  const pendingBalance   = 750000;
  const totalEarnings    = earningHistory.reduce((s, e) => s + e.komisi, 0);

  const handleWithdraw = () => {
    setSubmitted(true);
    setTimeout(() => { setShowWithdrawModal(false); setSubmitted(false); setWithdrawAmount(''); }, 2000);
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
              Pantau komisi real-time, riwayat transaksi, dan ajukan penarikan dana ke rekening Anda.
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
          <div className="text-label-xs text-on-surface-variant">Per hari ini · Siap dicairkan</div>
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
          <div className="text-label-xs text-on-surface-variant">Sedang diverifikasi admin</div>
        </motion.div>

        <motion.div variants={iv} className="glass-card rounded-xl p-6">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary w-fit mb-4"><BarChart3 className="w-5 h-5" /></div>
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Komisi (6 Bln)</div>
          <div className="font-display text-headline-md font-bold text-primary mb-1">
            Rp {(totalEarnings / 1000000).toFixed(1)}jt
          </div>
          <div className="text-label-xs text-secondary flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" /> +20.1% vs periode lalu
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
            <p className="text-body-sm text-on-surface-variant mt-0.5">Komisi, bonus, dan penarikan</p>
          </div>
          <div className="flex items-center gap-2">
            {['Semua', 'Komisi', 'Payout', 'Bonus'].map((t) => (
              <button key={t} type="button" onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterType === t ? 'bg-secondary/20 text-secondary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {filtered.map((trx) => {
            const isPositive = trx.amount > 0;
            return (
              <div key={trx.id} className="flex items-center gap-4 p-3.5 rounded-xl hover:bg-surface-high/30 transition-colors">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPositive ? 'bg-secondary/15' : 'bg-primary/10'}`}>
                  {isPositive
                    ? (trx.type === 'Bonus' ? <Target className="w-4 h-4 text-tertiary" /> : <TrendingUp className="w-4 h-4 text-secondary" />)
                    : <ArrowDownRight className="w-4 h-4 text-primary" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-body-sm">{trx.description}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-label-xs text-on-surface-variant">
                    <span>{trx.id}</span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{trx.date}</span>
                    <span className={`px-1.5 py-0.5 rounded-md font-bold ${trx.status === 'Credited' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>
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
        </div>
        <div className="mt-4 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
          <span className="text-label-sm text-on-surface-variant">{filtered.length} transaksi</span>
          <button type="button" className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:gap-2 transition-all">
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
                  <Filter className="w-3.5 h-3.5 inline mr-1.5" /> Rekening: BRI 1234-5678-xxxx (Nama Agen)
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowWithdrawModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-variant font-semibold hover:text-on-surface transition-colors">
                    Batal
                  </button>
                  <button type="button" onClick={handleWithdraw}
                    className="flex-1 py-2.5 rounded-xl bg-secondary/20 text-secondary font-semibold hover:bg-secondary/30 transition-colors">
                    Ajukan
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