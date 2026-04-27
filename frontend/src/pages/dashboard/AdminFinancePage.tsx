import React, { useMemo, useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Clock, Wallet, TrendingUp, ArrowDownToLine, Filter } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { getClaimRewardValue } from '../../utils/claimRewards';
import { useAuthStore } from '../../store/authStore';

const statusStyle: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  Pending: { label: 'Menunggu', cls: 'bg-tertiary/15 text-tertiary', icon: <Clock className="w-3.5 h-3.5" /> },
  Approved: { label: 'Disetujui', cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Paid: { label: 'Dibayar', cls: 'bg-primary/15 text-primary', icon: <Wallet className="w-3.5 h-3.5" /> },
  Rejected: { label: 'Ditolak', cls: 'bg-error/15 text-error', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const AdminFinancePage: React.FC = () => {
  const { 
    claims, 
    agents,
    fetchClaims, 
    fetchAgents,
    updateClaimStatus, 
    isLoading, 
    error 
  } = useAdminNetworkStore();
  const { isAuthenticated, accessToken, isInitializing } = useAuthStore();
  const [filter, setFilter] = useState('Semua');
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => setChartReady(true));
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    if (isInitializing) {
      return;
    }

    if (!isAuthenticated || !accessToken) {
      return;
    }

    fetchClaims();
    fetchAgents();
  }, [accessToken, fetchAgents, fetchClaims, isAuthenticated, isInitializing]);

  const payoutRequests = useMemo(() => {
    if (!Array.isArray(claims)) return [];
    return claims.map((claim) => {
      const amount = getClaimRewardValue(claim.tierId, claim.rewardValue);
      const currentStatus = claim.status || 'pending';
      return {
        id: claim.id,
        displayId: `PO-${claim.id.slice(0, 8).toUpperCase()}`,
        agent: claim.agentName || `Agent ${claim.agentId}`,
        agentId: claim.agentId,
        amount: `Rp ${amount.toLocaleString('id-ID')}`,
        raw: amount,
        period: claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }) : 'N/A',
        submittedAt: claim.submittedAt ? new Date(claim.submittedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A',
        status: currentStatus === 'pending' ? 'Pending' : currentStatus === 'processing' ? 'Approved' : currentStatus === 'completed' ? 'Paid' : 'Rejected',
      };
    });
  }, [claims]);

  const commissionByArea = useMemo(() => {
    if (!Array.isArray(claims) || !Array.isArray(agents)) return [];
    
    const areaTotals = claims.reduce<Record<string, number>>((acc, claim) => {
      const agent = agents.find(a => a.id === claim.agentId);
      const city = agent?.city || 'Unknown';
      const amount = getClaimRewardValue(claim.tierId, claim.rewardValue);
      
      acc[city] = (acc[city] || 0) + amount;
      return acc;
    }, {});

    return Object.entries(areaTotals)
      .map(([area, total]) => ({ area, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, 5);
  }, [claims, agents]);

  const handleAction = async (id: string, action: 'processing' | 'completed' | 'cancelled') => {
    await updateClaimStatus(id, action);
  };

  const displayed = payoutRequests.filter((r) => {
    return filter === 'Semua' || r.status === filter;
  });

  const totalPending = payoutRequests.filter((r) => r.status === 'Pending').reduce((s, r) => s + r.raw, 0);
  const totalPaid = payoutRequests.filter((r) => ['Approved', 'Paid'].includes(r.status)).reduce((s, r) => s + r.raw, 0);
  const totalMonthlyCommission = payoutRequests.reduce((sum, request) => sum + request.raw, 0);

  if (isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <div className="w-9 h-9 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface-variant text-body-sm">Memvalidasi sesi login...</p>
      </div>
    );
  }

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="glass-card rounded-xl p-8 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-tertiary/15 flex items-center justify-center text-tertiary">
          <Clock className="w-6 h-6" />
        </div>
        <h4 className="font-display text-title-md font-bold text-on-surface">Sesi Login Berakhir</h4>
        <p className="text-body-sm text-on-surface-variant">Silakan login ulang untuk mengakses data keuangan admin.</p>
      </div>
    );
  }

  if (isLoading && claims.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-on-surface-variant text-body-sm animate-pulse">Mengambil data keuangan...</p>
      </div>
    );
  }

  if (error && claims.length === 0) {
    return (
      <div className="glass-card rounded-xl p-8 flex flex-col items-center text-center gap-4 border-error/20">
        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
          <XCircle className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-display text-title-md font-bold text-on-surface">Gagal Memuat Data</h4>
          <p className="text-body-sm text-on-surface-variant mt-1">{error}</p>
        </div>
        <button 
          onClick={() => { fetchClaims(); fetchAgents(); }}
          className="px-6 py-2 bg-surface-high rounded-lg text-label-sm font-bold hover:bg-surface-highest transition-colors"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
          <Wallet className="w-5 h-5 text-primary" /> Keuangan & Komisi
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Kelola pengajuan payout agen, rekap distribusi komisi, dan laporan keuangan bulanan.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Total Komisi Bulan Ini</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">Rp {totalMonthlyCommission.toLocaleString('id-ID')}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant"><Clock className="w-3.5 h-3.5" /> Pending Payout</div>
          <div className="font-display text-headline-sm text-tertiary font-bold mt-1">
            Rp {totalPending.toLocaleString('id-ID')}
          </div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant"><ArrowDownToLine className="w-3.5 h-3.5" /> Sudah Dibayar</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">
            Rp {totalPaid.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payout Requests Table */}
        <div className="lg:col-span-2 glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <div className="flex items-center justify-between mb-5">
            <h4 className="font-display text-title-sm font-bold text-on-surface">Permintaan Payout</h4>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-on-surface-variant" />
              {['Semua', 'Pending', 'Approved', 'Paid', 'Rejected'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-label-xs font-semibold transition-all ${filter === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {displayed.map((req) => {
              const style = statusStyle[req.status] || { label: req.status, cls: 'bg-surface-high text-on-surface-variant', icon: <Clock className="w-3.5 h-3.5" /> };
              return (
                <div key={req.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg border border-outline-variant/10 hover:bg-surface-high/40 transition-colors">
                  <div>
                    <div className="font-semibold text-on-surface text-body-sm">{req.agent}</div>
                    <div className="text-label-xs text-on-surface-variant">{req.displayId} · {req.agentId} · Periode {req.period}</div>
                    <div className="text-label-xs text-on-surface-variant">{req.submittedAt}</div>
                  </div>
                  <div className="font-bold text-primary text-body-sm">{req.amount}</div>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-xs font-bold ${style.cls}`}>
                    {style.icon} {style.label}
                  </div>
                  {req.status === 'Pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, 'processing')}
                        className="px-3 py-1.5 rounded-md bg-secondary/20 text-secondary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-secondary/30 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, 'cancelled')}
                        className="px-3 py-1.5 rounded-md bg-error/10 text-error text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-error/20 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </div>
                  )}
                  {req.status === 'Approved' && (
                    <button
                      type="button"
                      onClick={() => handleAction(req.id, 'completed')}
                      className="px-3 py-1.5 rounded-md bg-primary/20 text-primary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-primary/30 transition-colors"
                    >
                      <Wallet className="w-3.5 h-3.5" /> Tandai Dibayar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Commission Chart by Area */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h4 className="font-display text-title-sm font-bold text-on-surface">Komisi per Area</h4>
          </div>
          <div className="h-56 min-h-[224px] min-w-0">
            {chartReady && commissionByArea.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={commissionByArea} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#484847" horizontal={false} />
                  <XAxis type="number" stroke="#ADAAAA" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <YAxis dataKey="area" type="category" stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} width={60} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '8px', color: '#FFF', fontSize: '12px' }}
                    formatter={(v: unknown) => [`Rp ${(v as number).toLocaleString('id-ID')}`, 'Total Komisi']}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {commissionByArea.map((_entry, i) => (
                      <Cell key={`cell-${i}`} fill={i === 0 ? '#A2F31F' : '#8FF5FF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full rounded-lg bg-surface-high/50 border border-outline-variant/10 flex items-center justify-center text-on-surface-variant text-body-sm">
                Belum ada data area komisi.
              </div>
            )}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-surface-high border border-outline-variant/10">
            <div className="text-label-xs text-on-surface-variant mb-1">Total Komisi Tersalurkan</div>
            <div className="font-bold text-primary">Rp {commissionByArea.reduce((sum, item) => sum + item.total, 0).toLocaleString('id-ID')}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancePage;
