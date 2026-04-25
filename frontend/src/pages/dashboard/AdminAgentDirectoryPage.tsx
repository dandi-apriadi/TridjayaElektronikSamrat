import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

const statusColor: Record<string, string> = {
  Aktif: 'bg-secondary/15 text-secondary',
  Probation: 'bg-tertiary/15 text-tertiary',
  Suspended: 'bg-error/15 text-error',
  Inactive: 'bg-on-surface-variant/15 text-on-surface-variant',
};

const AdminAgentDirectoryPage: React.FC = () => {
  const { agents, isLoading, fetchAgents } = useAdminNetworkStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  React.useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const mappedAgents = agents.map(a => ({
    ...a,
    status: a.isActive ? 'Aktif' : 'Inactive',
    joinedLabel: a.joinedAt ? format(new Date(a.joinedAt), 'MMM yyyy', { locale: idLocale }) : '—',
    earningsLabel: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(a.totalSales * 300000) // Assumed 300k commission per sale for display
  }));

  const filtered = mappedAgents.filter((a) => {
    const matchSearch = (a.name || '').toLowerCase().includes(search.toLowerCase()) || (a.city || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalAktif = agents.filter((a) => a.isActive).length;
  const totalSalesCount = agents.reduce((s, a) => s + a.totalSales, 0);
  const uniqueCities = new Set(agents.filter(a => a.city).map(a => a.city)).size;

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
          <div className="text-label-sm text-on-surface-variant">Total Penjualan (All Time)</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{totalSalesCount} Unit</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Area Terjangkau</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">{uniqueCities} Kota/Kab</div>
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
      <div className="glass-card rounded-xl p-6 overflow-x-auto relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 bg-surface/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
              <th className="py-3 pr-4">Agen</th>
              <th className="py-3 pr-4">Area</th>
              <th className="py-3 pr-4">Kontak</th>
              <th className="py-3 pr-4">
                <span className="inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Penjualan</span>
              </th>
              <th className="py-3 pr-4">Tier</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((agent) => (
              <tr key={agent.id} className="border-b border-outline-variant/10 hover:bg-surface-high/40 transition-colors group">
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center font-bold text-on-primary text-md flex-shrink-0 shadow-lg shadow-primary/20">
                      {(agent.name || 'A')[0]}
                    </div>
                    <div>
                      <div className="font-bold text-on-surface text-body-sm">{agent.name}</div>
                      <div className="text-label-xs text-on-surface-variant font-medium opacity-70">Bergabung {agent.joinedLabel}</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="flex flex-col">
                    <div className="inline-flex items-center gap-1 text-body-sm font-semibold text-on-surface">
                      <MapPin className="w-3 h-3 text-primary" />
                      {agent.city || '—'}
                    </div>
                    <div className="text-label-xs text-on-surface-variant">{agent.province || '—'}</div>
                  </div>
                </td>
                <td className="py-4 pr-4 text-body-sm text-on-surface-variant">
                  <div className="flex flex-col gap-1">
                    <span className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"><Phone className="w-3 h-3" /> {agent.whatsapp || '—'}</span>
                    <span className="inline-flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer"><Mail className="w-3 h-3" /> {agent.email}</span>
                  </div>
                </td>
                <td className="py-4 pr-4">
                  <div className="font-display text-body-md font-bold text-on-surface">{agent.totalSales} <span className="text-label-xs font-normal text-on-surface-variant">Unit</span></div>
                  <div className="text-label-xs font-bold text-primary tracking-tight">{agent.earningsLabel}</div>
                </td>
                <td className="py-4 pr-4">
                  {agent.tierName ? (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-highest border border-outline-variant/10">
                      <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(var(--secondary-rgb),0.5)]" />
                      <span className="text-label-xs font-bold text-on-surface">{agent.tierName}</span>
                    </div>
                  ) : (
                    <span className="text-on-surface-variant text-label-xs font-medium italic opacity-50">Unranked</span>
                  )}
                </td>
                <td className="py-4 pr-4">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${statusColor[agent.status]}`}>
                    {agent.status}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link to={`/dashboard/admin/agents/edit/${agent.id}`} className="p-2 rounded-lg bg-surface-highest text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all duration-300" title="Lihat Detail">
                      <Eye className="w-4.5 h-4.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !isLoading && (
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-40">
                    <Search className="w-12 h-12" />
                    <p className="text-body-md font-medium">Tidak ada agen yang sesuai kriteria.</p>
                  </div>
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
