import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Activity, Users, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react';
import { format, subDays } from 'date-fns';
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

interface AnalyticsData {
  analytics: Array<{
    campaign_id: string;
    campaign_name: string;
    total_events: number;
    unique_users: number;
    conversions: number;
    total_revenue: number;
    currency: string;
    conversion_rate?: number;
  }>;
  period_type: string;
  start_date: string;
  end_date: string;
}

const AgentPixelAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
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
        `/api/pixel-analytics/agent?period_type=${periodType}&start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        // Calculate conversion rate for each campaign
        const analyticsWithRate = result.data.analytics.map((item: any) => ({
          ...item,
          conversion_rate: item.total_events > 0 ? item.conversions / item.total_events : 0,
        }));
        setData({ ...result.data, analytics: analyticsWithRate });
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

  const totalEvents = data?.analytics.reduce((sum, c) => sum + c.total_events, 0) || 0;
  const totalUsers = data?.analytics.reduce((sum, c) => sum + c.unique_users, 0) || 0;
  const totalConversions = data?.analytics.reduce((sum, c) => sum + c.conversions, 0) || 0;
  const totalRevenue = groupRevenueByCurrency(data?.analytics || []);

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
            Campaign Performance 📊
          </p>
          <h2 className="font-display text-headline-sm font-bold text-on-surface">
            My Pixel Analytics
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Track your campaign performance and conversions
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
                    <p className="text-label-sm text-on-surface-variant mb-1">Conversions</p>
                    <p className="text-title-lg font-bold text-on-surface mb-2">{totalConversions.toLocaleString()}</p>
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
            {data?.analytics && data.analytics.length > 0 ? (
              <CampaignTable campaigns={data.analytics} />
            ) : (
              <div className="flex items-center justify-center h-64 text-on-surface-variant">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-semibold text-on-surface mb-1">No analytics data available</p>
                  <p className="text-body-sm">Start tracking events to see campaign performance</p>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default AgentPixelAnalyticsPage;
