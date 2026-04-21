import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Package, 
  Ticket, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area 
} from 'recharts';

const data = [
  { name: 'Jan', agents: 45, items: 120 },
  { name: 'Feb', agents: 52, items: 125 },
  { name: 'Mar', agents: 61, items: 132 },
  { name: 'Apr', agents: 75, items: 140 },
  { name: 'May', agents: 89, items: 145 },
  { name: 'Jun', agents: 102, items: 155 },
];

const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Active Agents', value: '1,284', change: '+12%', icon: Users, color: 'text-primary', href: '/dashboard/admin/agents' },
          { label: 'Catalog Items', value: '452', change: '+5%', icon: Package, color: 'text-secondary', href: '/dashboard/admin/catalog' },
          { label: 'Active Promotions', value: '18', change: '-2%', icon: Ticket, color: 'text-tertiary', href: '/dashboard/admin/promo' },
          { label: 'Conversion Rate', value: '4.2%', change: '+0.8%', icon: TrendingUp, color: 'text-primary', href: '/dashboard/admin/telemetry' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-2xl p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-surface-high ${kpi.color}`}>
                <kpi.icon className="w-6 h-6" />
              </div>
              <div className={`flex items-center gap-1 text-label-sm font-bold ${kpi.change.startsWith('+') ? 'text-secondary' : 'text-error'}`}>
                {kpi.change}
                {kpi.change.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              </div>
            </div>
            <div className="font-body text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">{kpi.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mb-2">{kpi.value}</div>
            <Link to={kpi.href} className="text-label-sm text-primary font-semibold hover:underline">
              Lihat detail
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-display text-title-md font-bold text-on-surface">Agent Network Growth</h3>
            <select className="bg-surface-high border-none rounded-lg font-body text-label-sm p-2 outline-none">
              <option>Last 6 Months</option>
              <option>Last Year</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorAgents" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8FF5FF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8FF5FF" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#ADAAAA" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis 
                  stroke="#ADAAAA" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '12px', color: '#FFF' }} 
                  itemStyle={{ color: '#8FF5FF' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="agents" 
                  stroke="#8FF5FF" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorAgents)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <h3 className="font-display text-title-md font-bold text-on-surface mb-6">System Health</h3>
          <div className="space-y-6">
            {[
              { label: 'Server Status', status: 'Online', color: 'text-secondary' },
              { label: 'API Latency', status: '45ms', color: 'text-secondary' },
              { label: 'Database Load', status: '12%', color: 'text-secondary' },
              { label: 'Sync Status', status: 'Delayed', color: 'text-error' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="font-body text-body-md text-on-surface-variant">{item.label}</span>
                <span className={`font-body text-body-md font-bold ${item.color}`}>{item.status}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-6 border-t border-outline-variant/20">
            <Link to="/dashboard/admin/telemetry" className="w-full flex items-center justify-between group p-4 rounded-2xl hover:bg-surface-high transition-colors text-left border border-outline-variant/10">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-tertiary" />
                <span className="font-body text-title-xs font-bold text-on-surface">View Error Logs</span>
              </div>
              <ArrowUpRight className="w-4 h-4 text-on-surface-variant group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-3xl p-8">
          <h3 className="font-display text-title-md font-bold text-on-surface mb-6">Recent Agent Registrations</h3>
          <div className="space-y-4">
            {[
              { name: 'Budi Santoso', area: 'Makassar', date: '2 mins ago' },
              { name: 'Siti Aminah', area: 'Manado', date: '45 mins ago' },
              { name: 'Andi Pratama', area: 'Palu', date: '3 hours ago' },
            ].map((agent, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-surface-high transition-colors border border-outline-variant/5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center font-bold text-on-primary">
                    {agent.name[0]}
                  </div>
                  <div>
                    <div className="font-body text-title-xs font-bold text-on-surface">{agent.name}</div>
                    <div className="font-body text-label-sm text-on-surface-variant">{agent.area}</div>
                  </div>
                </div>
                <Link to="/dashboard/admin/agents" className="px-4 py-2 glass-card rounded-lg text-label-sm font-bold text-primary hover:bg-primary/20 transition-colors">
                  Review
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-3xl p-8">
          <h3 className="font-display text-title-md font-bold text-on-surface mb-6">Top Performing Catalog</h3>
          <div className="space-y-4">
            {[
              { label: 'Goda GD120', views: '2,482', conversion: '12%', slug: 'goda-gd120' },
              { label: 'Winfly W200', views: '1,940', conversion: '10%', slug: 'winfly-w200' },
              { label: 'Sofa Premium L', views: '1,204', conversion: '8.5%', slug: 'sofa-premium-l' },
            ].map((product, i) => (
              <Link key={i} to={`/produk/${product.slug}`} className="p-4 rounded-2xl bg-surface-high flex items-center justify-between hover:bg-surface-highest transition-colors">
                <div>
                   <div className="font-body text-title-xs font-bold text-on-surface">{product.label}</div>
                   <div className="font-body text-label-sm text-on-surface-variant">{product.views} Views</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-title-sm font-bold text-secondary">{product.conversion}</div>
                  <div className="font-body text-label-xs text-on-surface-variant">Conv. Rate</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
