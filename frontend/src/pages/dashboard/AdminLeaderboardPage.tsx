import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Settings, 
  Download, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  Medal, 
  Crown, 
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Clock,
  Plus,
  Star
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area
} from 'recharts';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { useAgentStore } from '../../store/useAgentStore';
import { usePersistedState } from '../../hooks/usePersistedState';

// Fallback data for reward tiers if backend returns empty
const fallbackRewardTiers = [
  { id: 'silver', name: 'Silver Tier', thresholdPoints: 0, isActive: true },
  { id: 'gold', name: 'Gold Tier', thresholdPoints: 5000, isActive: true },
  { id: 'diamond', name: 'Diamond Tier', thresholdPoints: 15000, isActive: true },
];

/* ─── Variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/* ─── Component ─────────────────────────────────────── */
const AdminLeaderboardPage: React.FC = () => {
   const { registrations, claims, fetchRegistrations, fetchClaims, updateClaimStatus } = useAdminNetworkStore();
   const { leaderboard, fetchLeaderboard, rewardTiers, fetchRewardTiers } = useAgentStore();
   const [activeTab, setActiveTab] = usePersistedState<'overview' | 'manage' | 'claims'>('adminLeaderboard:activeTab', 'overview');
   const [currentPage, setCurrentPage] = usePersistedState('adminLeaderboard:currentPage', 1);
  const itemsPerPage = 8;

   useEffect(() => {
      fetchRegistrations();
      fetchClaims();
      fetchLeaderboard();
      fetchRewardTiers();
   }, [fetchClaims, fetchLeaderboard, fetchRegistrations, fetchRewardTiers]);

   const networkGrowthData = useMemo(() => {
      return Array.from({ length: 4 }).map((_, index) => {
         const date = new Date();
         date.setMonth(date.getMonth() - (3 - index));
         const key = `${date.getFullYear()}-${date.getMonth()}`;

         const silver = registrations.filter((item) => {
            const submitted = new Date(item.submittedAt);
            return `${submitted.getFullYear()}-${submitted.getMonth()}` === key && item.status !== 'rejected';
         }).length;

         const gold = claims.filter((claim) => {
            const submitted = new Date(claim.submittedAt);
            return `${submitted.getFullYear()}-${submitted.getMonth()}` === key && claim.status !== 'cancelled';
         }).length;

         const diamond = claims.filter((claim) => {
            const submitted = new Date(claim.submittedAt);
            return `${submitted.getFullYear()}-${submitted.getMonth()}` === key && claim.status === 'completed';
         }).length;

         return {
            month: date.toLocaleDateString('id-ID', { month: 'short' }),
            silver,
            gold,
            diamond,
         };
      });
   }, [claims, registrations]);

   const effectiveRewardTiers = rewardTiers.length > 0 ? rewardTiers : fallbackRewardTiers;

   const resolveTierId = (points: number) => {
      const sorted = [...effectiveRewardTiers].sort((left, right) => left.thresholdPoints - right.thresholdPoints);
      return [...sorted].reverse().find((tier) => points >= tier.thresholdPoints)?.id || sorted[0]?.id || 'silver';
   };

   const rewardConfig = useMemo(() => {
      const counts = leaderboard.reduce<Record<string, number>>((accumulator, agent) => {
         const tierId = resolveTierId(agent.points);
         accumulator[tierId] = (accumulator[tierId] || 0) + 1;
         return accumulator;
      }, {});

      return effectiveRewardTiers.map((tier) => ({
         id: tier.id,
         name: tier.name.replace(/ Tier$/i, ''),
         threshold: `${tier.thresholdPoints.toLocaleString('id-ID')} pts`,
         agents: counts[tier.id] || 0,
         active: tier.isActive,
      }));
   }, [effectiveRewardTiers, leaderboard]);

   const topPeformers = useMemo(() => {
      return [...leaderboard]
         .sort((left, right) => right.points - left.points)
         .slice(0, 5)
         .map((agent) => ({
            id: agent.id,
            name: agent.name,
            city: agent.city || '-',
            points: agent.points,
            growth: `+${agent.totalSales} sales`,
            tier: agent.tierName || effectiveRewardTiers.find((tier) => tier.id === resolveTierId(agent.points))?.name || 'Silver Tier',
         }));
   }, [effectiveRewardTiers, leaderboard]);

   const totalPoints = leaderboard.reduce((sum, agent) => sum + agent.points, 0);

   const activeSilverAgents = rewardConfig.find((tier) => tier.id === 'silver')?.agents ?? 0;
   const activeGoldAgents = rewardConfig.find((tier) => tier.id === 'gold')?.agents ?? 0;
   const legendaryDiamondAgents = rewardConfig.find((tier) => tier.id === 'diamond')?.agents ?? 0;

   const totalPages = Math.ceil(claims.length / itemsPerPage);
   const paginatedClaims = claims.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
   );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header ─────────────────────────────────── */}
      <motion.div variants={itemVariants} className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-title-md font-bold text-on-surface flex items-center gap-2">
               <Trophy className="w-6 h-6 text-primary" /> Leaderboard & Reward Management
            </h3>
            <p className="text-body-sm text-on-surface-variant mt-1 font-medium">
               Pantau performa jaringan dan kelola sistem penghargaan agen di seluruh Sulawesi.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-surface-low/50 p-1 rounded-xl border border-outline-variant/10">
             <button 
               onClick={() => setActiveTab('overview')}
               className={`px-4 py-2 rounded-lg text-label-sm font-bold transition-all ${activeTab === 'overview' ? 'bg-primary text-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
             >
               Overview
             </button>
             <button 
               onClick={() => setActiveTab('manage')}
               className={`px-4 py-2 rounded-lg text-label-sm font-bold transition-all ${activeTab === 'manage' ? 'bg-primary text-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
             >
               Rewards Tiers
             </button>
             <button 
               onClick={() => setActiveTab('claims')}
               className={`px-4 py-2 rounded-lg text-label-sm font-bold transition-all ${activeTab === 'claims' ? 'bg-primary text-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
             >
               Claims {claims.length > 0 && <span className="ml-1 bg-secondary text-surface px-1.5 py-0.5 rounded-full text-[10px]">{claims.length}</span>}
             </button>
          </div>
        </div>
      </motion.div>

      {activeTab === 'overview' && (
        <>
          {/* ── KPI Row ───────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             {[
                      { label: 'Total Points Distributed', value: totalPoints.toLocaleString('id-ID'), sub: 'berdasarkan claim completed', icon: Star, color: 'text-primary', bg: 'bg-primary/10' },
                      { label: 'Active Silver Agents', value: activeSilverAgents.toString(), sub: `${registrations.filter((item) => item.status === 'pending').length} pending`, icon: Medal, color: 'text-slate-400', bg: 'bg-slate-400/10' },
                      { label: 'Active Gold Agents', value: activeGoldAgents.toString(), sub: `${registrations.filter((item) => item.status === 'approved').length} approved`, icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                      { label: 'Legendary Diamond', value: legendaryDiamondAgents.toString(), sub: 'claim completed tier diamond', icon: Crown, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
             ].map((kpi, i) => (
               <motion.div key={i} variants={itemVariants} className="glass-card rounded-xl p-5 border border-outline-variant/10">
                 <div className="flex justify-between items-start mb-3">
                    <div className={`p-2 rounded-lg ${kpi.bg} ${kpi.color}`}>
                       <kpi.icon className="w-5 h-5" />
                    </div>
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/10 text-secondary border border-secondary/20">MONTHLY</div>
                 </div>
                 <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{kpi.label}</div>
                 <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{kpi.value}</div>
                 <div className="text-label-xs text-on-surface-variant mt-0.5">{kpi.sub}</div>
               </motion.div>
             ))}
          </div>

          {/* ── Charts & Top List ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             {/* Network Growth Chart */}
             <motion.div variants={itemVariants} className="lg:col-span-2 glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                   <div>
                      <h4 className="font-display text-title-md font-bold text-on-surface">Trend Keaktifan Tier</h4>
                      <p className="text-label-sm text-on-surface-variant mt-0.5">Pertumbuhan jumlah agen berdasarkan tier reward</p>
                   </div>
                   <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400" /> <span className="text-[10px] text-on-surface-variant font-bold">Silver</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400" /> <span className="text-[10px] text-on-surface-variant font-bold">Gold</span></div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-cyan-400" /> <span className="text-[10px] text-on-surface-variant font-bold">Diamond</span></div>
                   </div>
                </div>
                <div className="h-[300px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={networkGrowthData}>
                        <defs>
                          <linearGradient id="gradSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/><stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/></linearGradient>
                          <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#fbbf24" stopOpacity={0.1}/><stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/></linearGradient>
                          <linearGradient id="gradDiamond" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3ee" stopOpacity={0.1}/><stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
                        <XAxis dataKey="month" stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#ADAAAA" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '10px' }} />
                        <Area type="monotone" dataKey="silver" stroke="#94a3b8" strokeWidth={2} fill="url(#gradSilver)" />
                        <Area type="monotone" dataKey="gold" stroke="#fbbf24" strokeWidth={2} fill="url(#gradGold)" />
                        <Area type="monotone" dataKey="diamond" stroke="#22d3ee" strokeWidth={2} fill="url(#gradDiamond)" />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </motion.div>

             {/* Top Performers Table */}
             <motion.div variants={itemVariants} className="glass-card rounded-2xl p-6 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                   <h4 className="font-display text-title-md font-bold text-on-surface">Top Performer List</h4>
                   <TrendingUp className="w-5 h-5 text-secondary" />
                </div>
                <div className="space-y-4 flex-1">
                   {topPeformers.map((p) => (
                     <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/10 hover:bg-surface-high/40 transition-colors group">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-on-primary text-xs flex-shrink-0">{p.name[0]}</div>
                           <div>
                              <div className="font-semibold text-on-surface text-body-sm truncate w-32">{p.name}</div>
                              <div className="text-[10px] text-on-surface-variant font-bold uppercase">{p.tier} Tier</div>
                           </div>
                        </div>
                        <div className="text-right">
                           <div className="font-bold text-on-surface text-body-sm">{p.points.toLocaleString()}</div>
                           <div className={`text-[10px] font-bold flex items-center gap-0.5 justify-end ${p.growth.startsWith('+') ? 'text-secondary' : 'text-error'}`}>
                              {p.growth.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                              {p.growth}
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
                <button className="w-full mt-6 py-2.5 rounded-xl bg-primary/10 text-primary font-bold text-label-sm hover:bg-primary/20 transition-all flex items-center justify-center gap-2">
                   View Full Directory <ArrowUpRight className="w-4 h-4" />
                </button>
             </motion.div>
          </div>
        </>
      )}

      {activeTab === 'manage' && (
        <motion.div variants={itemVariants} className="space-y-6">
           <div className="flex items-center justify-between">
              <h4 className="font-display text-title-lg font-bold text-on-surface">Reward Tier Setup</h4>
              <button className="px-4 py-2 rounded-xl bg-primary text-surface font-bold text-label-sm flex items-center gap-2 hover:shadow-neon-cyan transition-all">
                 <Plus className="w-4 h-4" /> Create New Tier
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rewardConfig.map((tier) => (
                <div key={tier.id} className="glass-card rounded-2xl p-6 border-l-4 border-l-primary hover:scale-[1.02] transition-transform">
                   <div className="flex justify-between items-start mb-4">
                      <div className="font-display text-display-xs font-bold text-on-surface">{tier.name}</div>
                      <Settings className="w-4 h-4 text-on-surface-variant cursor-pointer" />
                   </div>
                   <div className="space-y-3">
                      <div className="flex justify-between text-body-sm">
                         <span className="text-on-surface-variant">Points Threshold</span>
                         <span className="font-bold text-on-surface">{tier.threshold}</span>
                      </div>
                      <div className="flex justify-between text-body-sm">
                         <span className="text-on-surface-variant">Qualified Agents</span>
                         <span className="font-bold text-primary">{tier.agents} Agents</span>
                      </div>
                      <div className="flex justify-between text-body-sm">
                         <span className="text-on-surface-variant">Tier Status</span>
                         <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary text-[10px] font-bold">ACTIVE</span>
                      </div>
                   </div>
                   <div className="mt-6 pt-6 border-t border-outline-variant/10">
                      <div className="text-label-xs text-on-surface-variant font-bold uppercase mb-3">Key Benefits</div>
                      <div className="space-y-2">
                         <div className="flex items-center gap-2 text-label-sm text-on-surface transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Extra commission bonus
                         </div>
                         <div className="flex items-center gap-2 text-label-sm text-on-surface transition-colors">
                            <CheckCircle2 className="w-3.5 h-3.5 text-secondary" /> Custom profile badge
                         </div>
                      </div>
                   </div>
                   <button className="w-full mt-6 py-2.5 rounded-xl border border-outline-variant/10 text-on-surface-variant font-bold text-label-sm hover:border-primary/40 hover:text-primary transition-all">
                      Edit Tier Config
                   </button>
                </div>
              ))}
           </div>
        </motion.div>
      )}

      {activeTab === 'claims' && (
        <motion.div variants={itemVariants} className="glass-card rounded-2xl overflow-hidden">
           <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between">
              <h4 className="font-display text-title-md font-bold text-on-surface">Pending Reward Claims</h4>
              <div className="flex items-center gap-3">
                 <button className="p-2 rounded-lg bg-surface-high border border-outline-variant/10 text-on-surface-variant hover:text-on-surface transition-all"><Download className="w-4 h-4" /></button>
                 <button className="p-2 rounded-lg bg-surface-high border border-outline-variant/10 text-on-surface-variant hover:text-on-surface transition-all"><Filter className="w-4 h-4" /></button>
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                   <tr className="bg-surface-high/30 text-label-xs text-on-surface-variant uppercase tracking-widest">
                      <th className="px-6 py-4">ID</th>
                      <th className="px-6 py-4">Agent Name</th>
                      <th className="px-6 py-4">Achieved Tier</th>
                      <th className="px-6 py-4">Reward Content</th>
                      <th className="px-6 py-4">Submitted</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                   {paginatedClaims.map((claim) => (
                     <tr key={claim.id} className="hover:bg-surface-high/40 transition-colors group">
                        <td className="px-6 py-4 font-mono text-[11px] font-bold text-on-surface-variant">{claim.id}</td>
                        <td className="px-6 py-4">
                           <div className="font-body text-body-sm font-bold text-on-surface">{claim.agentName || 'Unknown Agent'}</div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${claim.tierId === 'diamond' ? 'bg-cyan-400/10 text-cyan-400' : claim.tierId === 'gold' ? 'bg-amber-400/10 text-amber-400' : 'bg-slate-400/10 text-slate-400'}`}>
                              {claim.tierId.toUpperCase()}
                           </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-body-sm text-on-surface">{claim.rewardName}</td>
                        <td className="px-6 py-4 text-label-xs text-on-surface-variant inline-flex items-center gap-1.5 mt-2">
                           <Clock className="w-3.5 h-3.5" /> {claim.submittedAt}
                        </td>
                        <td className="px-6 py-4 text-right">
                           <div className="flex items-center justify-end gap-2">
                              {claim.status === 'completed' ? (
                                <span className="px-3 py-1.5 rounded-lg bg-secondary/15 text-secondary text-label-xs font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Approved</span>
                              ) : claim.status === 'cancelled' ? (
                                <span className="px-3 py-1.5 rounded-lg bg-error/15 text-error text-label-xs font-bold">Rejected</span>
                              ) : (
                                <>
                                  <button onClick={() => updateClaimStatus(claim.id, 'completed')} className="px-3 py-1.5 rounded-lg bg-secondary text-surface text-label-xs font-bold hover:shadow-neon-cyan transition-all">Approve</button>
                                  <button onClick={() => updateClaimStatus(claim.id, 'cancelled')} className="px-3 py-1.5 rounded-lg bg-surface-highest text-on-surface-variant text-label-xs font-bold hover:text-error transition-all">Reject</button>
                                </>
                              )}
                           </div>
                        </td>
                     </tr>
                   ))}
                             {claims.length === 0 && (
                      <tr>
                                     <td colSpan={6} className="px-6 py-10 text-center text-on-surface-variant text-body-sm">Belum ada reward yang diklaim agen untuk saat ini.</td>
                      </tr>
                   )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              className="mt-4 border-t border-outline-variant/10"
            />
         </motion.div>
      )}

      {/* ── Help Button ─────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex justify-center py-6">
         <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-dark border border-outline-variant/20 text-on-surface-variant text-label-sm font-medium">
            <AlertCircle className="w-4 h-4 text-primary" />
            Sistem poin diperbarui setiap hari pada pukul 00:00 WITA.
            <button className="text-primary font-bold hover:underline ml-2">Lihat Dokumentasi S&K</button>
         </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminLeaderboardPage;
