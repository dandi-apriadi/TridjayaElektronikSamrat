import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, TrendingUp, MapPin, Phone, Mail, UserX, Eye, Filter } from 'lucide-react';

const agents = [
  { id: 'AGT-001', name: 'Agen Samrat Makassar', city: 'Makassar', area: 'Sulawesi Selatan', phone: '+62 812-0001-0001', email: 'mks.001@tridjaya.co.id', totalSales: 48, totalEarnings: 'Rp 14.400.000', rating: 4.9, status: 'Aktif', joined: 'Jan 2025' },
  { id: 'AGT-002', name: 'Dian Sales Partner', city: 'Gowa', area: 'Sulawesi Selatan', phone: '+62 812-0002-0002', email: 'gwa.002@tridjaya.co.id', totalSales: 35, totalEarnings: 'Rp 10.500.000', rating: 4.7, status: 'Aktif', joined: 'Feb 2025' },
  { id: 'AGT-003', name: 'Krisna Network', city: 'Manado', area: 'Sulawesi Utara', phone: '+62 813-0003-0003', email: 'mnd.003@tridjaya.co.id', totalSales: 29, totalEarnings: 'Rp 8.700.000', rating: 4.5, status: 'Aktif', joined: 'Mar 2025' },
  { id: 'AGT-004', name: 'Ratna Mobile Palu', city: 'Palu', area: 'Sulawesi Tengah', phone: '+62 822-0004-0004', email: 'plu.004@tridjaya.co.id', totalSales: 22, totalEarnings: 'Rp 6.600.000', rating: 4.3, status: 'Aktif', joined: 'Mar 2025' },
  { id: 'AGT-005', name: 'Bagas Elektro Kendari', city: 'Kendari', area: 'Sulawesi Tenggara', phone: '+62 811-0005-0005', email: 'kdr.005@tridjaya.co.id', totalSales: 18, totalEarnings: 'Rp 5.400.000', rating: 4.1, status: 'Aktif', joined: 'Apr 2025' },
  { id: 'AGT-006', name: 'Rani Syafitri', city: 'Makassar', area: 'Sulawesi Selatan', phone: '+62 815-0006-0006', email: 'rs.006@tridjaya.co.id', totalSales: 8, totalEarnings: 'Rp 2.400.000', rating: 3.8, status: 'Probation', joined: 'Apr 2025' },
  { id: 'AGT-007', name: 'Hendra Distribusi', city: 'Pare-Pare', area: 'Sulawesi Selatan', phone: '+62 819-0007-0007', email: 'pp.007@tridjaya.co.id', totalSales: 0, totalEarnings: 'Rp 0', rating: 0, status: 'Suspended', joined: 'Feb 2025' },
];

const statusColor: Record<string, string> = {
  Aktif: 'bg-secondary/15 text-secondary',
  Probation: 'bg-tertiary/15 text-tertiary',
  Suspended: 'bg-error/15 text-error',
};

const AdminAgentDirectoryPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  const filtered = agents.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) || a.city.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalAktif = agents.filter((a) => a.status === 'Aktif').length;
  const totalSales = agents.reduce((s, a) => s + a.totalSales, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface">Direktori Agen Aktif</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">Pantau performa, area kerja, dan status seluruh jaringan agen Tridjaya.</p>
        </div>
        <Link to="/dashboard/admin/agents" className="px-4 py-2 rounded-lg bg-primary/20 text-primary font-semibold text-label-sm w-fit">
          ← Kembali ke Registrasi
        </Link>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Total Agen Aktif</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">{totalAktif}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Total Transaksi (All Time)</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{totalSales} Unit</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Area Terjangkau</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">4 Provinsi</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            placeholder="Cari agen atau kota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="w-4 h-4 text-on-surface-variant" />
          {['Semua', 'Aktif', 'Probation', 'Suspended'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl p-6 overflow-x-auto">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
              <th className="py-3 pr-4">Agen</th>
              <th className="py-3 pr-4">Area</th>
              <th className="py-3 pr-4">Kontak</th>
              <th className="py-3 pr-4">
                <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Penjualan</span>
              </th>
              <th className="py-3 pr-4">
                <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" /> Rating</span>
              </th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((agent) => (
              <tr key={agent.id} className="border-b border-outline-variant/10 hover:bg-surface-high/40 transition-colors group">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center font-bold text-on-primary text-sm flex-shrink-0">
                      {agent.name[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-on-surface text-body-sm">{agent.name}</div>
                      <div className="text-label-xs text-on-surface-variant">{agent.id} · Bergabung {agent.joined}</div>
                    </div>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {agent.city}, {agent.area}
                  </div>
                </td>
                <td className="py-3 pr-4 text-body-sm text-on-surface-variant">
                  <div className="flex flex-col gap-0.5">
                    <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {agent.phone}</span>
                    <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {agent.email}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="font-bold text-on-surface">{agent.totalSales} Unit</div>
                  <div className="text-label-xs text-primary">{agent.totalEarnings}</div>
                </td>
                <td className="py-3 pr-4">
                  {agent.rating > 0 ? (
                    <div className="inline-flex items-center gap-1 font-bold text-on-surface">
                      <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      {agent.rating}
                    </div>
                  ) : (
                    <span className="text-on-surface-variant text-label-sm">—</span>
                  )}
                </td>
                <td className="py-3 pr-4">
                  <span className={`px-2 py-1 rounded-md text-label-xs font-bold ${statusColor[agent.status]}`}>
                    {agent.status}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a href={`mailto:${agent.email}`} className="p-1.5 rounded-md bg-surface-highest text-on-surface-variant hover:text-primary transition-colors" title="Kirim Email">
                      <Eye className="w-4 h-4" />
                    </a>
                    <button type="button" className="p-1.5 rounded-md bg-error/10 text-error hover:bg-error/20 transition-colors" title="Suspend Agen">
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-on-surface-variant text-body-sm">
                  Tidak ada agen yang sesuai filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAgentDirectoryPage;
