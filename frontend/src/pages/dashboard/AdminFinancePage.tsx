import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Wallet, TrendingUp, ArrowDownToLine, Filter } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

const payoutRequests = [
  { id: 'PO-4401', agent: 'Agen Samrat Makassar', agentId: 'AGT-001', amount: 'Rp 2.400.000', raw: 2400000, period: 'Apr 2026', submittedAt: '2 jam lalu', status: 'Pending' },
  { id: 'PO-4398', agent: 'Dian Sales Partner', agentId: 'AGT-002', amount: 'Rp 1.800.000', raw: 1800000, period: 'Apr 2026', submittedAt: '5 jam lalu', status: 'Pending' },
  { id: 'PO-4391', agent: 'Krisna Network', agentId: 'AGT-003', amount: 'Rp 1.200.000', raw: 1200000, period: 'Mar 2026', submittedAt: '1 hari lalu', status: 'Approved' },
  { id: 'PO-4385', agent: 'Ratna Mobile Palu', agentId: 'AGT-004', amount: 'Rp 900.000', raw: 900000, period: 'Mar 2026', submittedAt: '2 hari lalu', status: 'Paid' },
  { id: 'PO-4370', agent: 'Bagas Elektro Kendari', agentId: 'AGT-005', amount: 'Rp 650.000', raw: 650000, period: 'Feb 2026', submittedAt: '5 hari lalu', status: 'Rejected' },
];

const commissionByArea = [
  { area: 'Makassar', total: 14400000 },
  { area: 'Gowa', total: 10500000 },
  { area: 'Manado', total: 8700000 },
  { area: 'Palu', total: 6600000 },
  { area: 'Kendari', total: 5400000 },
];

const statusStyle: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  Pending: { label: 'Menunggu', cls: 'bg-tertiary/15 text-tertiary', icon: <Clock className="w-3.5 h-3.5" /> },
  Approved: { label: 'Disetujui', cls: 'bg-secondary/15 text-secondary', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Paid: { label: 'Dibayar', cls: 'bg-primary/15 text-primary', icon: <Wallet className="w-3.5 h-3.5" /> },
  Rejected: { label: 'Ditolak', cls: 'bg-error/15 text-error', icon: <XCircle className="w-3.5 h-3.5" /> },
};

const AdminFinancePage: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('Semua');

  const handleAction = (id: string, action: string) => {
    setStatuses((prev) => ({ ...prev, [id]: action }));
  };

  const displayed = payoutRequests.filter((r) => {
    const currentStatus = statuses[r.id] || r.status;
    return filter === 'Semua' || currentStatus === filter;
  });

  const totalPending = payoutRequests.filter((r) => (statuses[r.id] || r.status) === 'Pending').reduce((s, r) => s + r.raw, 0);
  const totalPaid = payoutRequests.filter((r) => ['Approved', 'Paid'].includes(statuses[r.id] || r.status)).reduce((s, r) => s + r.raw, 0);

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
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">Rp 45.600.000</div>
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
              const currentStatus = statuses[req.id] || req.status;
              const style = statusStyle[currentStatus];
              return (
                <div key={req.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-3 rounded-lg border border-outline-variant/10 hover:bg-surface-high/40 transition-colors">
                  <div>
                    <div className="font-semibold text-on-surface text-body-sm">{req.agent}</div>
                    <div className="text-label-xs text-on-surface-variant">{req.id} · {req.agentId} · Periode {req.period}</div>
                    <div className="text-label-xs text-on-surface-variant">{req.submittedAt}</div>
                  </div>
                  <div className="font-bold text-primary text-body-sm">{req.amount}</div>
                  <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-xs font-bold ${style.cls}`}>
                    {style.icon} {style.label}
                  </div>
                  {currentStatus === 'Pending' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, 'Approved')}
                        className="px-3 py-1.5 rounded-md bg-secondary/20 text-secondary text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-secondary/30 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(req.id, 'Rejected')}
                        className="px-3 py-1.5 rounded-md bg-error/10 text-error text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-error/20 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tolak
                      </button>
                    </div>
                  )}
                  {currentStatus === 'Approved' && (
                    <button
                      type="button"
                      onClick={() => handleAction(req.id, 'Paid')}
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
          <div className="h-56">
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
          </div>
          <div className="mt-4 p-3 rounded-lg bg-surface-high border border-outline-variant/10">
            <div className="text-label-xs text-on-surface-variant mb-1">Total Komisi Tersalurkan</div>
            <div className="font-bold text-primary">Rp 45.600.000</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancePage;
