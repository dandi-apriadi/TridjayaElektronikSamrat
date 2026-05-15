import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Edit, Pause, Play, TrendingUp } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';
import { readApiError } from '../../utils/apiError';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  pixel_id: string;
  status: string;
  utm_admin: string;
  total_events?: number;
  conversions?: number;
  total_revenue?: number;
  currency?: string;
}

const AdminPixelCampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await apiFetch(`/api/campaigns?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Gagal memuat campaign'));
      }
      const result = await response.json();
      setCampaigns(result.data.campaigns || []);
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const response = await apiFetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Gagal mengubah status campaign'));
      }
      fetchCampaigns();
    } catch (error) {
      console.error('Failed to update campaign status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-success/10 text-success',
      paused: 'bg-warning/10 text-warning',
      completed: 'bg-on-surface-variant/10 text-on-surface-variant',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || styles.active}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const filteredCampaigns = campaigns;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-lg font-bold text-on-surface mb-2">Pixel Campaigns</h1>
          <p className="text-body-md text-on-surface-variant">
            Manage your pixel tracking campaigns
          </p>
        </div>
        <Link
          to="/dashboard/admin/pixel-campaigns/new"
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          New Campaign
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="glass-card p-2 rounded-xl border border-outline-variant/20 inline-flex gap-2">
        {['all', 'active', 'paused', 'completed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-label-md font-medium transition-colors ${
              statusFilter === status
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-high'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <p>Loading campaigns...</p>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No campaigns found</p>
              <Link to="/dashboard/admin/pixel-campaigns/new" className="text-primary hover:underline mt-2 inline-block">
                Create your first campaign
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Campaign Name</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Pixel</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Status</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">UTM Admin</th>
                  <th className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant">Total Events</th>
                  <th className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant">Conversions</th>
                  <th className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant">Revenue</th>
                  <th className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-outline-variant/10 hover:bg-surface-high/50">
                    <td className="py-3 px-4 text-body-sm text-on-surface font-medium">{campaign.name}</td>
                    <td className="py-3 px-4 text-body-sm text-on-surface font-mono text-xs">
                      {campaign.pixel_id.substring(0, 12)}...
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(campaign.status)}</td>
                    <td className="py-3 px-4 text-body-sm text-on-surface">{campaign.utm_admin}</td>
                    <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                      {campaign.total_events?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                      {campaign.conversions?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                      {campaign.currency || 'USD'} {campaign.total_revenue?.toLocaleString() || 0}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/dashboard/admin/pixel-campaigns/${campaign.id}`}
                          className="p-2 rounded-lg hover:bg-surface-high transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 text-on-surface-variant" />
                        </Link>
                        {campaign.status !== 'completed' && (
                          <button
                            onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                            className="p-2 rounded-lg hover:bg-surface-high transition-colors"
                            title={campaign.status === 'active' ? 'Pause' : 'Resume'}
                          >
                            {campaign.status === 'active' ? (
                              <Pause className="w-4 h-4 text-on-surface-variant" />
                            ) : (
                              <Play className="w-4 h-4 text-on-surface-variant" />
                            )}
                          </button>
                        )}
                        <Link
                          to={`/dashboard/admin/pixel-analytics?campaign=${campaign.id}`}
                          className="p-2 rounded-lg hover:bg-surface-high transition-colors"
                          title="View Analytics"
                        >
                          <TrendingUp className="w-4 h-4 text-on-surface-variant" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPixelCampaignsPage;
