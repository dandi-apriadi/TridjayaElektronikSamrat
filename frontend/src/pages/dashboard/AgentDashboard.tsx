import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  Users, 
  Target, 
  TrendingUp, 
  ArrowUpRight, 
  Search,
  ExternalLink,
  MessageSquare
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';

const earningData = [
  { day: 'Mon', amount: 450000 },
  { day: 'Tue', amount: 1200000 },
  { day: 'Wed', amount: 800000 },
  { day: 'Thu', amount: 1500000 },
  { day: 'Fri', amount: 2100000 },
  { day: 'Sat', amount: 950000 },
  { day: 'Sun', amount: 400000 },
];

const leads = [
  { name: 'Andi Jaya', interest: 'Goda GD120', status: 'Follow Up', slug: 'goda-gd120' },
  { name: 'Rina Melati', interest: 'Sofa Premium L', status: 'Negotiation', slug: 'sofa-premium-l' },
  { name: 'Hendra Saputra', interest: 'Winfly W200', status: 'Payment Pending', slug: 'winfly-w200' },
  { name: 'Santi Wijaya', interest: 'Smart TV OLED', status: 'Cold', slug: 'smart-tv-65' },
];

const AgentDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const visibleLeads = useMemo(
    () => leads.filter((lead) =>
      `${lead.name} ${lead.interest}`.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [searchQuery]
  );

  return (
    <div className="space-y-8">
      {/* Top Welcome / Quick Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-surface-low p-8 rounded-3xl border border-outline-variant/10">
        <div>
          <h2 className="font-display text-headline-sm font-bold text-on-surface mb-1">Semangat Pagi, Agen Samrat!</h2>
          <p className="font-body text-body-md text-on-surface-variant">Hari ini Anda memiliki <span className="text-secondary font-bold">4 prospek baru</span> yang perlu dihubungi.</p>
        </div>
        <div className="relative max-w-md w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant" />
          <input 
            type="text" 
            placeholder="Cek harga produk / stok..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-surface-high border-none rounded-2xl outline-none focus:ring-2 focus:ring-primary/50 transition-all font-body text-body-md"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Earnings', value: 'Rp 6,420,000', change: '+18.5%', icon: DollarSign, color: 'text-primary', href: '/dashboard/agent/earnings' },
          { label: 'Successful Sales', value: '12 Units', change: '+2', icon: Target, color: 'text-secondary', href: '/dashboard/agent/leads' },
          { label: 'Active Prospects', value: '28', change: '+4', icon: Users, color: 'text-tertiary', href: '/dashboard/agent/leads' },
          { label: 'Conversion Rate', value: '14.2%', change: '+2.1%', icon: TrendingUp, color: 'text-secondary', href: '/dashboard/agent/knowledge' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card rounded-2xl p-6 hover:shadow-neon-cyan transition-all duration-300"
          >
            <div className={`w-12 h-12 rounded-xl bg-surface-high flex items-center justify-center mb-4 ${kpi.color}`}>
              <kpi.icon className="w-6 h-6" />
            </div>
            <div className="font-body text-label-sm text-on-surface-variant uppercase tracking-widest mb-1">{kpi.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mb-2">{kpi.value}</div>
            <div className="flex items-center gap-1 text-label-xs font-bold text-secondary">
              <ArrowUpRight className="w-3 h-3" />
              {kpi.change} <span className="text-on-surface-variant opacity-60 ml-1">this month</span>
            </div>
            <Link to={kpi.href} className="inline-block mt-2 text-label-sm text-primary font-semibold hover:underline">
              Lihat detail
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Earnings Chart */}
        <div className="lg:col-span-2 glass-card rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
             <h3 className="font-display text-title-md font-bold text-on-surface">Weekly Earnings Performance</h3>
             <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span className="font-body text-label-sm text-on-surface-variant">IDR Output</span>
             </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={earningData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                <XAxis 
                  dataKey="day" 
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
                  hide 
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(143, 245, 255, 0.05)' }}
                  contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '12px', color: '#FFF' }}
                />
                <Bar 
                  dataKey="amount" 
                  radius={[6, 6, 0, 0]}
                >
                   {earningData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 4 ? '#A2F31F' : '#8FF5FF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hot Leads / Recent Prospects */}
        <div className="glass-card rounded-3xl p-8">
          <h3 className="font-display text-title-md font-bold text-on-surface mb-6">Hot Leads</h3>
          <div className="space-y-4">
            {visibleLeads.map((lead, i) => (
              <div key={i} className="group p-4 rounded-2xl hover:bg-surface-high transition-all border border-outline-variant/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-body text-title-xs font-bold text-on-surface group-hover:text-primary transition-colors">{lead.name}</div>
                  <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    lead.status === 'Payment Pending' ? 'bg-secondary/20 text-secondary' : 'bg-surface-highest text-on-surface-variant'
                  }`}>{lead.status}</div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-body text-label-sm text-on-surface-variant">{lead.interest}</span>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={`https://wa.me/628529999999?text=${encodeURIComponent(`Halo ${lead.name}, kami tindak lanjuti minat Anda untuk ${lead.interest}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-primary/10 rounded-lg text-primary hover:bg-primary/20"
                      aria-label={`Follow up ${lead.name}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </a>
                    <Link to={`/produk/${lead.slug}`} className="p-2 bg-secondary/10 rounded-lg text-secondary hover:bg-secondary/20" aria-label={`Lihat ${lead.interest}`}>
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
            {visibleLeads.length === 0 && (
              <p className="text-body-sm text-on-surface-variant">Tidak ada lead yang cocok dengan pencarian.</p>
            )}
          </div>
          <Link to="/dashboard/agent/leads" className="w-full mt-6 py-4 border border-dashed border-outline-variant/30 rounded-2xl font-body text-label-md font-bold text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all block text-center">
            + Add New Lead
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;
