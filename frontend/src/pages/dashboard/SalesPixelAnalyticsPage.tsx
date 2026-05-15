import React, { useState, useEffect } from 'react';
import { BarChart3, Activity, Users, ShoppingCart, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';
import MetricsCard from '../../components/pixel/MetricsCard';
import CampaignTable from '../../components/pixel/CampaignTable';
import { apiFetch } from '../../utils/apiClient';
import { readApiError } from '../../utils/apiError';

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

const SalesPixelAnalyticsPage: React.FC = () => {
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
      const response = await apiFetch(
        `/api/pixel-analytics/sales?period_type=${periodType}&start_date=${startDate}&end_date=${endDate}`
      );
      if (!response.ok) {
        throw new Error(await readApiError(response, 'Failed to fetch analytics'));
      }
      const result = await response.json();
      const analyticsWithRate = (result.data?.analytics || []).map((item: any) => ({
        ...item,
        conversion_rate: item.total_events > 0 ? item.conversions / item.total_events : 0,
      }));
      setData({ ...result.data, analytics: analyticsWithRate });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setData(null);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-title-lg font-bold text-on-surface mb-2">My Pixel Analytics</h1>
        <p className="text-body-md text-on-surface-variant">
          Track your campaign performance
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl border border-outline-variant/20">
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
            <button onClick={fetchAnalytics} className="btn-primary w-full">
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <div className="flex items-center justify-center h-64">
            <p className="text-on-surface-variant">Loading analytics...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricsCard
              label="Total Events"
              value={totalEvents}
              icon={<Activity className="w-6 h-6 text-primary" />}
            />
            <MetricsCard
              label="Unique Users"
              value={totalUsers}
              icon={<Users className="w-6 h-6 text-secondary" />}
            />
            <MetricsCard
              label="Conversions"
              value={totalConversions}
              icon={<ShoppingCart className="w-6 h-6 text-tertiary" />}
            />
            <MetricsCard
              label="Total Revenue"
              value={totalRevenue}
              icon={<DollarSign className="w-6 h-6 text-success" />}
            />
          </div>

          {/* Campaign Performance Table */}
          <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
            <h2 className="text-title-md font-bold text-on-surface mb-4">Campaign Performance</h2>
            {data?.analytics && data.analytics.length > 0 ? (
              <CampaignTable campaigns={data.analytics} />
            ) : (
              <div className="flex items-center justify-center h-64 text-on-surface-variant">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No analytics data available</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SalesPixelAnalyticsPage;
