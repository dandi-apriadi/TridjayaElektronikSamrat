import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users, TrendingUp, Activity, Loader2, ArrowUpRight, ExternalLink } from 'lucide-react';

interface DashboardMetrics {
  total_pixels: number;
  total_admins: number;
  events_24h: number;
  events_last_hour: number;
  total_revenue: Record<string, number>;
}

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

const SuperAdminDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/pixel-analytics/super-admin?period_type=daily', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (response.ok) {
          const result = await response.json();
          setMetrics(result.data);
          setError(null);
        } else {
          const error = await response.json();
          setError(error.message || 'Failed to load dashboard metrics');
        }
      } catch (err: any) {
        console.error('Failed to fetch dashboard metrics:', err);
        setError('Failed to load dashboard metrics');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const formatRevenue = (revenue: Record<string, number>) => {
    if (!revenue || Object.keys(revenue).length === 0) return '$0';
    return Object.entries(revenue)
      .map(([currency, amount]) => `${currency} ${amount.toLocaleString()}`)
      .join(' / ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 rounded-xl border border-error/20 bg-error/5">
        <p className="text-error">{error}</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Pixels',
      value: (metrics?.total_pixels || 0).toLocaleString('id-ID'),
      change: '+active',
      sub: 'Platform-wide tracking',
      icon: BarChart3,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/super-admin/pixels',
    },
    {
      label: 'Total Admins',
      value: (metrics?.total_admins || 0).toLocaleString('id-ID'),
      change: '+manage',
      sub: 'Assigned to pixels',
      icon: Users,
      color: 'text-secondary',
      bg: 'bg-secondary/10',
      href: '/dashboard/super-admin/pixels',
    },
    {
      label: 'Events (24h)',
      value: (metrics?.events_24h || 0).toLocaleString('id-ID'),
      change: `${metrics?.events_last_hour || 0}`,
      sub: 'events in last hour',
      icon: Activity,
      color: 'text-tertiary',
      bg: 'bg-tertiary/10',
      href: '/dashboard/super-admin/analytics',
    },
    {
      label: 'Total Revenue',
      value: metrics?.total_revenue ? formatRevenue(metrics.total_revenue) : '$0',
      change: '+track',
      sub: 'Multi-currency support',
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
      href: '/dashboard/super-admin/analytics',
    },
  ];

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
              Platform Overview 🚀
            </p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface">
              Super Admin Dashboard
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {new Date().toLocaleDateString('id-ID', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })} · Platform-wide pixel tracking analytics
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="/dashboard/super-admin/pixels"
              className="px-4 py-2.5 rounded-lg bg-primary/15 text-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/25 transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              Manage Pixels
            </a>
            <a
              href="/dashboard/super-admin/analytics"
              className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
            >
              <Activity className="w-4 h-4" />
              View Analytics
            </a>
          </div>
        </div>
      </motion.div>

      {/* ── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <motion.a
            key={kpi.label}
            href={kpi.href}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -4 }}
            className="glass-card rounded-xl p-5 relative overflow-hidden group block"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 rounded-lg ${kpi.bg} ${kpi.color}`}>
                <kpi.icon className="w-5 h-5" />
              </div>
              <div
                className={`flex items-center gap-0.5 text-label-xs font-bold px-2 py-1 rounded-md ${
                  kpi.change.startsWith('+')
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {kpi.change.startsWith('+') && <ArrowUpRight className="w-3 h-3" />}
                {kpi.change}
              </div>
            </div>
            <div className="font-body text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">
              {kpi.label}
            </div>
            <div className="font-display text-headline-sm font-bold text-on-surface mb-1">
              {kpi.value}
            </div>
            <div className="text-label-xs text-on-surface-variant mb-3">{kpi.sub}</div>
            <div className="text-label-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              View details <ArrowUpRight className="w-3 h-3" />
            </div>
          </motion.a>
        ))}
      </div>

      {/* ── Quick Actions ──────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <h2 className="font-display text-title-md font-bold text-on-surface mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="/dashboard/super-admin/pixels"
            className="p-4 rounded-lg border border-outline-variant/20 hover:bg-surface-high transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-on-surface">Manage Pixels</h3>
              <ExternalLink className="w-4 h-4 text-on-surface-variant group-hover:text-primary transition-colors" />
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Create and configure Meta Pixels
            </p>
          </a>
          <a
            href="/dashboard/super-admin/analytics"
            className="p-4 rounded-lg border border-outline-variant/20 hover:bg-surface-high transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-on-surface">View Analytics</h3>
              <ExternalLink className="w-4 h-4 text-on-surface-variant group-hover:text-secondary transition-colors" />
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Platform-wide performance metrics
            </p>
          </a>
          <a
            href="/dashboard/super-admin/audit-logs"
            className="p-4 rounded-lg border border-outline-variant/20 hover:bg-surface-high transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-on-surface">Audit Logs</h3>
              <ExternalLink className="w-4 h-4 text-on-surface-variant group-hover:text-tertiary transition-colors" />
            </div>
            <p className="text-body-sm text-on-surface-variant">
              Review system activity and changes
            </p>
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default SuperAdminDashboard;
