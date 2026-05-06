import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays } from 'date-fns';

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

const COLORS = ['#8FF5FF', '#A2F31F', '#F31F7B', '#FFD700', '#FF8C00', '#9932CC', '#00FA9A', '#FF4500'];

interface PixelAnalytics {
  pixel_id: string;
  total_events: number;
  unique_users: number;
  page_views: number;
  add_to_carts: number;
  purchases: number;
  leads: number;
  total_revenue: number;
  currency: string;
}

interface CampaignAnalytics {
  campaign_id: string;
  total_events: number;
  unique_users: number;
  conversions: number;
  avg_conversion_rate: number;
  total_revenue: number;
  currency: string;
}

interface DashboardData {
  pixel_analytics: PixelAnalytics[];
  campaign_analytics: CampaignAnalytics[];
  realtime_events_last_hour: number;
  period_type: string;
  start_date: string;
  end_date: string;
}

const SuperAdminAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState('daily');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchAnalytics();
  }, [periodType, startDate, endDate]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/pixel-analytics/super-admin?period_type=${periodType}&start_date=${startDate}&end_date=${endDate}`,
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

  const totalEvents = data?.pixel_analytics.reduce((sum, p) => sum + p.total_events, 0) || 0;
  const totalUsers = data?.pixel_analytics.reduce((sum, p) => sum + p.unique_users, 0) || 0;
  const totalPurchases = data?.pixel_analytics.reduce((sum, p) => sum + p.purchases, 0) || 0;
  const totalRevenue = groupRevenueByCurrency(data?.pixel_analytics || []);

  // Prepare event type breakdown data
  const eventTypeData = data?.pixel_analytics.length ? [
    { name: 'Page Views', value: data.pixel_analytics.reduce((sum, p) => sum + p.page_views, 0) },
    { name: 'Add to Carts', value: data.pixel_analytics.reduce((sum, p) => sum + p.add_to_carts, 0) },
    { name: 'Purchases', value: data.pixel_analytics.reduce((sum, p) => sum + p.purchases, 0) },
    { name: 'Leads', value: data.pixel_analytics.reduce((sum, p) => sum + p.leads, 0) },
  ] : [];

  // Prepare revenue by campaign data (top 10)
  const revenueByCampaign = data?.campaign_analytics
    .sort((a, b) => b.total_revenue - a.total_revenue)
    .slice(0, 10)
    .map(c => ({
      name: c.campaign_id.substring(0, 8),
      revenue: c.total_revenue,
      currency: c.currency || 'USD'
    })) || [];

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
        className="glass-card rounded-xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
            Platform Insights 🌐
          </p>
          <h2 className="font-display text-headline-sm font-bold text-on-surface">
            Platform Analytics
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Comprehensive analytics across all pixels and campaigns
          </p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="glass-card p-4 rounded-xl border border-outline-variant/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
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
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }}>
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
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }}>
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
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Purchases</p>
                    <p className="text-title-lg font-bold text-on-surface mb-2">{totalPurchases.toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-tertiary/10">
                    <ShoppingCart className="w-6 h-6 text-tertiary" />
                  </div>
                </div>
              </div>
            </motion.div>
            <motion.div variants={itemVariants} whileHover={{ scale: 1.02, y: -4 }}>
              <div className="glass-card p-5 rounded-xl border border-outline-variant/20 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-green-500/40 to-transparent" />
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-label-sm text-on-surface-variant mb-1">Total Revenue</p>
                    <p className="text-title-md font-bold text-on-surface mb-2">{totalRevenue}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-green-500/10">
                    <DollarSign className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Real-time Events */}
          <motion.div variants={itemVariants} className="glass-card p-4 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <p className="text-label-md text-on-surface">
                <span className="font-bold">{data?.realtime_events_last_hour || 0}</span> events in the last hour
              </p>
            </div>
          </motion.div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Type Breakdown */}
            <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <h2 className="font-display text-title-md font-bold text-on-surface mb-4">Event Type Breakdown</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={eventTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                  <XAxis dataKey="name" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Bar dataKey="value" fill="#8FF5FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Revenue by Campaign */}
            <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
              <h2 className="font-display text-title-md font-bold text-on-surface mb-4">Top 10 Campaigns by Revenue</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByCampaign}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                  <XAxis dataKey="name" stroke="#ADAAAA" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px', color: '#FFF', fontSize: '12px' }}
                  />
                  <Bar dataKey="revenue" fill="#A2F31F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Pixel-level Metrics Table */}
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-title-md font-bold text-on-surface">Pixel-Level Metrics</h2>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
                <span className="text-label-sm text-on-surface-variant">Live data</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Pixel ID</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Total Events</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Unique Users</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Purchases</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Leads</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.pixel_analytics.map((pixel) => (
                    <motion.tr 
                      key={pixel.pixel_id} 
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                      className="border-b border-outline-variant/10 transition-colors"
                    >
                      <td className="py-3 px-4 text-body-sm text-on-surface font-mono">{pixel.pixel_id}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right font-semibold">{pixel.total_events.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right">{pixel.unique_users.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right">{pixel.purchases.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right">{pixel.leads.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right font-semibold">
                        {pixel.currency} {pixel.total_revenue.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Campaign Metrics Table */}
          <motion.div variants={itemVariants} className="glass-card p-6 rounded-xl border border-outline-variant/20 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
            <h2 className="font-display text-title-md font-bold text-on-surface mb-4">Campaign Metrics</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-left py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Campaign ID</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Total Events</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Unique Users</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Conversions</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Conv. Rate</th>
                    <th className="text-right py-3 px-4 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.campaign_analytics.map((campaign) => (
                    <motion.tr 
                      key={campaign.campaign_id} 
                      whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                      className="border-b border-outline-variant/10 transition-colors"
                    >
                      <td className="py-3 px-4 text-body-sm text-on-surface font-mono">{campaign.campaign_id.substring(0, 12)}...</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right font-semibold">{campaign.total_events.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right">{campaign.unique_users.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right">{campaign.conversions.toLocaleString()}</td>
                      <td className="py-3 px-4 text-body-sm text-right">
                        <span className={`font-semibold ${
                          campaign.avg_conversion_rate > 0.05 ? 'text-green-600' :
                          campaign.avg_conversion_rate > 0.02 ? 'text-yellow-600' :
                          'text-on-surface'
                        }`}>
                          {(campaign.avg_conversion_rate * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body-sm text-on-surface text-right font-semibold">
                        {campaign.currency} {campaign.total_revenue.toLocaleString()}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default SuperAdminAnalyticsPage;
