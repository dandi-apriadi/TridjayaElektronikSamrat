import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, Search, MessageCircle, Send, Clock, 
  CheckCircle2, Eye, Pause, Smartphone, Database, Trash2
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign } from '../../types';
import Pagination from '../../components/ui/Pagination';

const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  draft: { cls: 'bg-surface-high text-on-surface-variant', icon: <Clock className="w-3.5 h-3.5" /> },
  running: { cls: 'bg-primary/20 text-primary border border-primary/30', icon: <Send className="w-3.5 h-3.5" /> },
  paused: { cls: 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30', icon: <Pause className="w-3.5 h-3.5" /> },
  completed: { cls: 'bg-secondary/20 text-secondary border border-secondary/30', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const AdminWaCampaignsPage: React.FC = () => {
  const { accessToken } = useAuthStore();
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchCampaigns();
  }, [accessToken]);

  const fetchCampaigns = async () => {
    if (!accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/wa/campaigns', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      const data = await res.json();
      const items = data.data?.items || data.items || [];
      setCampaigns(Array.isArray(items) ? items : []);
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = campaigns.filter(c => {
    if (!c) return false;
    const campaignName = (c.name || '').toLowerCase();
    const matchSearch = campaignName.includes((search || '').toLowerCase());
    const matchStatus = statusFilter === 'semua' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const getProgressPercent = (c: WaCampaign) => {
    const total = c.recipientTotal || 0;
    if (total === 0) return 0;
    const sent = c.recipientSent || 0;
    const skipped = c.recipientSkipped || 0;
    return Math.round(((sent + skipped) / total) * 100);
  };

  const handleDeleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!window.confirm(`Hapus campaign "${campaignName}"? Semua data penerima juga akan dihapus.`)) return;
    try {
      const res = await fetch(`/api/wa/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      toast.success('Campaign dihapus');
      fetchCampaigns();
    } catch (error) {
      toast.error('Gagal menghapus campaign', error instanceof Error ? error.message : '');
    }
  };

  if (isLoading && campaigns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-on-surface-variant text-sm">Memuat campaign...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6">
      {/* Page content */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-on-surface">WA Campaign Manager</h1>
        <div className="flex gap-2">
          <Link
            to="/dashboard/admin/wa/blast-contacts"
            className="flex items-center gap-2 px-4 py-2 border border-primary/30 bg-primary/10 rounded-xl hover:bg-primary/20 transition-all text-primary font-bold"
          >
            <Database className="w-4 h-4" />
            <span>Database</span>
          </Link>
          <Link
            to="/dashboard/admin/wa/accounts"
            className="flex items-center gap-2 px-4 py-2 border border-outline-variant/30 rounded-xl hover:bg-surface-high transition-all text-on-surface-variant hover:text-on-surface"
          >
            <Smartphone className="w-4 h-4" />
            <span>Kelola Akun</span>
          </Link>
          <Link
            to="/dashboard/admin/wa/campaign/new"
            className="flex items-center gap-2 px-4 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Campaign</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: campaigns.length, icon: <MessageCircle className="w-5 h-5" /> },
          { label: 'Running', value: campaigns.filter(c => c?.status === 'running').length, icon: <Send className="w-5 h-5" /> },
          { label: 'Total Recipients', value: campaigns.reduce((sum, c) => sum + (c?.recipientTotal || 0), 0), icon: <CheckCircle2 className="w-5 h-5" /> },
          { label: 'Sent', value: campaigns.reduce((sum, c) => sum + (c?.recipientSent || 0), 0), icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
        ].map((stat, i) => (
          <motion.div key={i} variants={iv} className="glass-card rounded-2xl p-4 border border-outline-variant/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-body text-on-surface-variant">{stat.label}</p>
                <p className="text-2xl font-display font-bold text-on-surface mt-1">{(stat.value || 0).toLocaleString('id-ID')}</p>
              </div>
              <div className="text-primary/60">{stat.icon}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-card rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-surface-container/30">
          <div className="flex-1 flex gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-on-surface-variant" />
              <input
                type="text"
                placeholder="Cari campaign..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
            >
              <option value="semua">Semua Status</option>
              <option value="draft">Draft</option>
              <option value="running">Running</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <button
            onClick={fetchCampaigns}
            disabled={isLoading}
            className="px-4 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-on-surface disabled:opacity-50 transition-all font-bold"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container/50 border-b border-outline-variant/10">
              <tr>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Nama Campaign</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-4 py-3 text-right font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Recipient</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Progress</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Dibuat</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Belum ada campaign
                  </td>
                </tr>
              ) : (
                paginated.map((campaign) => {
                  const progress = getProgressPercent(campaign);
                  const config = statusConfig[campaign.status] || statusConfig.draft;
                  return (
                    <tr key={campaign.id} className="border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors">
                      <td className="px-4 py-3 text-on-surface font-medium">{campaign.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${config.cls}`}>
                          {config.icon}
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-on-surface-variant font-body">{(campaign.recipientTotal || 0).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3">
                        <div className="w-32 bg-surface-highest rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(var(--color-primary),0.3)]"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-on-surface-variant mt-1 block font-bold">{progress}%</span>
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant text-[11px] font-body">
                        {new Date(campaign.createdAt || '').toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Link
                            to={`/dashboard/admin/wa/campaign/${campaign.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-primary hover:bg-primary/10 rounded transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs">Lihat</span>
                          </Link>
                          <button
                            onClick={() => handleDeleteCampaign(campaign.id, campaign.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="text-xs">Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/10 bg-surface-container/30">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminWaCampaignsPage;
