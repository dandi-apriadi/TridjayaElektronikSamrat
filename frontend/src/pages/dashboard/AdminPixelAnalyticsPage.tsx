import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, ShoppingCart, DollarSign, TrendingUp, BarChart3 } from 'lucide-react';
import { format, subDays } from 'date-fns';
import ConversionFunnel from '../../components/pixel/ConversionFunnel';
import CampaignTable from '../../components/pixel/CampaignTable';

/* ─── Variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring' as const, stiffness: 110, damping: 18 },
  },
};

interface CampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  period_type: string;
  period_start: string;
  period_end: string;
  total_events: number;
  unique_users: number;
  conversions: number;
  conversion_rate: number;
  total_revenue: number;
  currency: string;
}

interface FunnelData {
  campaign_id: string;
  campaign_name: string;
  page_views: number;
  add_to_carts: number;
  purchases: number;
}

interface DashboardData {
  campaign_analytics: CampaignAnalytics[];
  conversion_funnel: FunnelData[];
  top_campaigns: Array<{
    campaign_id: string;
    campaign_name: string;
    avg_conversion_rate: number;
    total_revenue: number;
    currency: string;
  }>;
  period_type: string;
  start_date: string;
  end_date: string;
}

const AdminPixelAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState('daily');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');

  useEffect(() => {
    fetchAnalytics();
  }, [periodType, startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pixel-analytics/admin?period_type=${periodType}&start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupRevenueByCurrency = (items: { total_revenue: number; currency: string }[]) => {
    const grouped = items.reduce((acc, item) => {
      const currency = item.currency || 'USD';
      acc[currency] = (acc[currency] || 0) + item.total_revenue;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`)
      .join(' / ');
  };

  const totalEvents = data?.campaign_analytics.reduce((sum, c) => sum + c.total_events, 0) || 0;
  const totalUsers = data?.campaign_analytics.reduce((sum, c) => sum + c.unique_users, 0) || 0;
  const totalConversions = data?.campaign_analytics.reduce((sum, c) => sum + c.conversions, 0) || 0;
  const totalRevenue = groupRevenueByCurrency(data?.campaign_analytics || []);
  const hasCampaignAnalytics = (data?.campaign_analytics?.length || 0) > 0;
  const hasTopCampaigns = (data?.top_campaigns?.length || 0) > 0;
  const hasFunnelData = !!selectedFunnel && (selectedFunnel.page_views > 0 || selectedFunnel.add_to_carts > 0 || selectedFunnel.purchases > 0);

  const selectedFunnel = selectedCampaign 
    ? data?.conversion_funnel.find(f => f.campaign_id === selectedCampaign)
    : data?.conversion_funnel.reduce((acc, f) => ({
        campaign_id: 'all',
        campaign_name: 'All Campaigns',
        page_views: acc.page_views + f.page_views,
        add_to_carts: acc.add_to_carts + f.add_to_carts,
        purchases: acc.purchases + f.purchases,
      }), { campaign_id: 'all', campaign_name: 'All Campaigns', page_views: 0, add_to_carts: 0, purchases: 0 });

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Welcome Banner ─────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl p-6 md:p-7 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
            Performance Insights
          </p>
          <h2 className="font-display text-headline-sm font-bold text-on-surface">
            Pixel Analytics
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Track performance of your pixel campaigns and conversion funnels
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="glass-card p-4 rounded-xl border border-outline-variant/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              Period Type
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
              className="input-field"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div className="flex items-end">
            <button onClick={fetchAnalytics} className="btn-primary w-full flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Apply Filters
            </button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Activity className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
              <p className="text-on-surface-variant">Loading analytics...</p>
            </div>
          </div>
        </motion.div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <motion.div variants={itemVariants} whileHover={{ scale: 1.01, y: -2 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Total Events</p>
                    <p className="text-title-lg font-bold text-on-surface mb-2">{totalEvents.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Activity className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ scale: 1.01, y: -2 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Unique Users</p>
                    <p className="text-title-lg font-bold text-on-surface mb-2">{totalUsers.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/10">
                    <Users className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ scale: 1.01, y: -2 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Conversions</p>
                    <p className="text-title-lg font-bold text-on-surface mb-2">{totalConversions.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-tertiary/10">
                    <ShoppingCart className="w-6 h-6 text-tertiary" />
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ scale: 1.01, y: -2 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/35 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Total Revenue</p>
                    <p className="text-title-md font-bold text-on-surface mb-2">{totalRevenue}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/10">
                    <DollarSign className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Conversion Funnel */}
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-title-md font-bold text-on-surface">Conversion Funnel</h2>
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="input-field w-64"
              >
                <option value="">All Campaigns</option>
                {data?.conversion_funnel.map((f) => (
                  <option key={f.campaign_id} value={f.campaign_id}>
                    {f.campaign_name}
                  </option>
                ))}
              </select>
            </div>
            {hasFunnelData && selectedFunnel ? (
              <ConversionFunnel
                pageViews={selectedFunnel.page_views}
                addToCarts={selectedFunnel.add_to_carts}
                checkouts={0}
                purchases={selectedFunnel.purchases}
              />
            ) : (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-high/30 px-5 py-8 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-3 text-on-surface-variant/70" />
                <p className="text-on-surface font-semibold">Belum ada data funnel pada periode ini</p>
                <p className="text-body-sm text-on-surface-variant mt-1">Coba ubah rentang tanggal atau pilih campaign lain.</p>
              </div>
            )}
          </motion.div>

          {/* Top Campaigns */}
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
            <h2 className="font-display text-title-md font-bold text-on-surface mb-4">Top Campaigns by Conversion Rate</h2>
            <div className="space-y-3">
              {hasTopCampaigns ? (
                data?.top_campaigns.slice(0, 5).map((campaign, index) => (
                  <motion.div
                    key={campaign.campaign_id}
                    whileHover={{ scale: 1.005, x: 2 }}
                    className="flex items-center justify-between p-3 bg-surface-high rounded-lg border border-outline-variant/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-primary/20 text-primary' :
                        index === 1 ? 'bg-secondary/20 text-secondary' :
                        index === 2 ? 'bg-tertiary/20 text-tertiary' :
                        'bg-surface-highest text-on-surface-variant'
                      }`}>
                        {index === 0 ? '1' : index === 1 ? '2' : index === 2 ? '3' : index + 1}
                      </div>
                      <div>
                        <p className="text-body-md font-medium text-on-surface">{campaign.campaign_name}</p>
                        <p className="text-body-sm text-on-surface-variant">
                          {campaign.currency} {campaign.total_revenue.toLocaleString()} revenue
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-title-sm font-bold text-secondary">
                        {(campaign.avg_conversion_rate * 100).toFixed(2)}%
                      </p>
                      <p className="text-[11px] text-on-surface-variant">conversion rate</p>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="rounded-xl border border-outline-variant/15 bg-surface-high/30 px-5 py-8 text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-3 text-on-surface-variant/70" />
                  <p className="text-on-surface font-semibold">Belum ada campaign teratas</p>
                  <p className="text-body-sm text-on-surface-variant mt-1">Data ranking muncul setelah ada event dan konversi.</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Campaign Performance Table */}
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-title-md font-bold text-on-surface">Campaign Performance</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                <span className="text-label-sm text-on-surface-variant">Live data</span>
              </div>
            </div>
            {hasCampaignAnalytics ? (
              <CampaignTable campaigns={data?.campaign_analytics || []} />
            ) : (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-high/30 px-5 py-10 text-center">
                <BarChart3 className="w-8 h-8 mx-auto mb-3 text-on-surface-variant/70" />
                <p className="text-on-surface font-semibold">No campaigns found</p>
                <p className="text-body-sm text-on-surface-variant mt-1">Belum ada data performa pada periode yang dipilih.</p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default AdminPixelAnalyticsPage;
