import React from 'react';
import { Wallet, ArrowDownToLine } from 'lucide-react';

const withdrawalHistory = [
  { id: 'WD-3301', date: '09 Apr 2026', amount: 'Rp 1.100.000', status: 'Approved' },
  { id: 'WD-3278', date: '25 Mar 2026', amount: 'Rp 900.000', status: 'Approved' },
  { id: 'WD-3266', date: '18 Mar 2026', amount: 'Rp 650.000', status: 'Paid' },
];

const AgentEarningsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Total Komisi Bulan Ini</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">Rp 6.420.000</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Saldo Bisa Ditarik</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">Rp 2.150.000</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Pending Payout</div>
          <div className="font-display text-headline-sm text-tertiary font-bold mt-1">Rp 870.000</div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 flex items-center justify-between">
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" /> Earnings & Financials
          </h3>
          <p className="text-body-sm text-on-surface-variant mt-1">Ajukan penarikan komisi sesuai periode payout.</p>
        </div>
        <a
          href="mailto:finance@tridjaya.co.id?subject=Pengajuan%20Withdraw%20Komisi%20Agen"
          className="px-4 py-2 rounded-xl bg-secondary/20 text-secondary font-semibold inline-flex items-center gap-2"
        >
          <ArrowDownToLine className="w-4 h-4" /> Ajukan Withdraw
        </a>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
              <th className="py-3 pr-3">ID</th>
              <th className="py-3 pr-3">Tanggal</th>
              <th className="py-3 pr-3">Jumlah</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {withdrawalHistory.map((row) => (
              <tr key={row.id} className="border-b border-outline-variant/10">
                <td className="py-3 pr-3 text-on-surface-variant">{row.id}</td>
                <td className="py-3 pr-3 text-on-surface">{row.date}</td>
                <td className="py-3 pr-3 text-primary font-semibold">{row.amount}</td>
                <td className="py-3 text-on-surface-variant">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AgentEarningsPage;