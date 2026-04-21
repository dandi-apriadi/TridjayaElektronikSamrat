import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock3, Wallet } from 'lucide-react';

const pendingAgents = [
  { id: 'REG-1021', name: 'Rani Syafitri', city: 'Makassar', socialReach: '12.4k', submittedAt: '2 jam lalu' },
  { id: 'REG-1019', name: 'Fahri Ramadhan', city: 'Gowa', socialReach: '8.1k', submittedAt: '5 jam lalu' },
  { id: 'REG-1013', name: 'Sri Wulandari', city: 'Parepare', socialReach: '5.6k', submittedAt: '1 hari lalu' },
];

const withdrawalRequests = [
  { id: 'WD-3321', agent: 'Agen Samrat Makassar', amount: 'Rp 1.250.000', status: 'Pending' },
  { id: 'WD-3318', agent: 'Dian Sales Partner', amount: 'Rp 950.000', status: 'Need Review' },
  { id: 'WD-3310', agent: 'Krisna Network', amount: 'Rp 2.400.000', status: 'Pending' },
];

const AdminAgentsPage: React.FC = () => {
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [processedWithdrawalIds, setProcessedWithdrawalIds] = useState<string[]>([]);

  const handleApproveAgent = (id: string) => {
    setApprovedIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleProcessWithdrawal = (id: string) => {
    setProcessedWithdrawalIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Agen Aktif</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">1,284</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Approval Menunggu</div>
          <div className="font-display text-headline-sm text-tertiary font-bold mt-1">23</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Penarikan Pending</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">11</div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Queue Registrasi Agen</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[680px]">
            <thead>
              <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
                <th className="py-3 pr-3">ID</th>
                <th className="py-3 pr-3">Nama</th>
                <th className="py-3 pr-3">Area</th>
                <th className="py-3 pr-3">Social Reach</th>
                <th className="py-3 pr-3">Dikirim</th>
                <th className="py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pendingAgents.map((item) => {
                const isApproved = approvedIds.includes(item.id);

                return (
                <tr key={item.id} className="border-b border-outline-variant/10">
                  <td className="py-3 pr-3 text-on-surface">{item.id}</td>
                  <td className="py-3 pr-3 text-on-surface font-semibold">{item.name}</td>
                  <td className="py-3 pr-3 text-on-surface-variant">{item.city}</td>
                  <td className="py-3 pr-3 text-on-surface-variant">{item.socialReach}</td>
                  <td className="py-3 pr-3 text-on-surface-variant">{item.submittedAt}</td>
                  <td className="py-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveAgent(item.id)}
                      className="px-3 py-1.5 rounded-lg bg-secondary/20 text-secondary text-label-sm font-semibold inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-4 h-4" /> {isApproved ? 'Disetujui' : 'Setujui'}
                    </button>
                    <a
                      href={`mailto:partnership@tridjaya.co.id?subject=Review%20Registrasi%20${item.id}`}
                      className="px-3 py-1.5 rounded-lg bg-surface-high text-on-surface-variant text-label-sm font-semibold"
                    >
                      Review
                    </a>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Manajemen Penarikan Komisi</h3>
        <div className="space-y-3">
          {withdrawalRequests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-outline-variant/15 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold text-on-surface">{request.agent}</div>
                <div className="text-label-sm text-on-surface-variant">{request.id}</div>
              </div>
              <div className="font-bold text-primary">{request.amount}</div>
              <div className="text-label-sm text-on-surface-variant inline-flex items-center gap-1">
                {request.status === 'Pending' ? <Clock3 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                {request.status}
              </div>
              <button
                type="button"
                onClick={() => handleProcessWithdrawal(request.id)}
                className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-semibold"
              >
                {processedWithdrawalIds.includes(request.id) ? 'Diproses' : 'Proses'}
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link to="/dashboard/admin/users" className="text-label-sm text-primary font-semibold hover:underline">
            Lanjut ke manajemen akses user
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AdminAgentsPage;