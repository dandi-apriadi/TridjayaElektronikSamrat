import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, 
  Target, 
  Star, 
  TrendingUp, 
  ChevronRight, 
  Search,
  Users,
  Medal,
  Crown,
  Gift,
  Zap,
  MapPin
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAgentStore } from '../../store/useAgentStore';
import Pagination from '../../components/ui/Pagination';

// Data will be fetched from the backend via useAgentStore. No static fallback data.
// Fallback data removed; we will rely on fetched leaderboard data.
const fallbackLeaderboardData: any[] = [];


const rewardTierMeta: Record<string, { icon: typeof Medal; color: string; bgColor: string; benefits: string[] }> = {
  silver: {
    icon: Medal,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    benefits: ['Komisi Extra 1%', 'Badge Profil Silver', 'Prioritas Support'],
  },
  gold: {
    icon: Trophy,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    benefits: ['Komisi Extra 2.5%', 'Akses Produk Pre-launch', 'Voucher Belanja Rp 500rb'],
  },
  diamond: {
    icon: Crown,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    benefits: ['Komisi Extra 5%', 'Exclusive Gathering', 'Trip Liburan Tahunan'],
  },
};

// No static fallback reward tiers; data will be fetched from the backend.
const fallbackRewardTiers: any[] = [];

/* ─── Variants ─────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/* ─── Component ─────────────────────────────────────── */
const AgentLeaderboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const { stats, fetchStats, leaderboard, fetchLeaderboard, rewardTiers, fetchRewardTiers, isLoading } = useAgentStore();
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'rewards'>('leaderboard');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchStats();
    fetchLeaderboard();
    fetchRewardTiers();
  }, [fetchLeaderboard, fetchRewardTiers, fetchStats]);

  const effectiveLeaderboard = leaderboard.length > 0
    ? leaderboard.map((entry, index) => ({
        ...entry,
        rank: index + 1,
        avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(entry.name)}`,
      }))
    : [];

  const filteredLeaderboard = effectiveLeaderboard.filter(a => 
    (a.name?.toLowerCase() || '').includes(search.toLowerCase()) || 
    (a.city?.toLowerCase() || '').includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLeaderboard.length / itemsPerPage);
  const paginatedLeaderboard = filteredLeaderboard.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );


  const currentPoints = stats?.points || 0;
  const currentUserEntry = effectiveLeaderboard.find((entry) => entry.id === user?.id);
  const currentRank = currentUserEntry ? effectiveLeaderboard.findIndex((entry) => entry.id === user?.id) + 1 : null;
  const effectiveRewardTiers = rewardTiers.length > 0 ? rewardTiers : fallbackRewardTiers;

  const nextTierProgress = useMemo(() => {
    const sorted = [...effectiveRewardTiers].filter((tier) => tier.isActive).sort((a, b) => a.thresholdPoints - b.thresholdPoints);
    const nextTier = sorted.find((tier) => tier.thresholdPoints > currentPoints) || null;
    const previousTier = [...sorted].reverse().find((tier) => tier.thresholdPoints <= currentPoints) || null;
    const currentThreshold = previousTier?.thresholdPoints ?? 0;
    const nextThreshold = nextTier?.thresholdPoints ?? currentThreshold;
    const base = Math.max(1, nextThreshold - currentThreshold);

    return {
      percent: nextTier ? Math.max(0, Math.min(100, ((currentPoints - currentThreshold) / base) * 100)) : 100,
      remaining: nextTier ? Math.max(0, nextThreshold - currentPoints) : 0,
      nextTierName: nextTier?.name ?? null,
    };
  }, [currentPoints, effectiveRewardTiers]);

  const dynamicRewardTiers = useMemo(() => {
    return effectiveRewardTiers.map((tier) => ({
      ...tier,
      meta: rewardTierMeta[tier.id] || rewardTierMeta.silver,
      current: currentPoints,
    }));
  }, [currentPoints, effectiveRewardTiers]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* ── Header Area ──────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold tracking-widest uppercase text-label-sm mb-2">
            <Trophy className="w-4 h-4" /> Hall of Fame
          </div>
          <h2 className="font-display text-display-sm font-bold text-on-surface">Leaderboard & Rewards</h2>
          <p className="text-body-md text-on-surface-variant mt-2 max-w-2xl font-medium leading-relaxed">
            Bersainglah secara sehat untuk menjadi agen terbaik dan nikmati berbagai keuntungan eksklusif di setiap pencapaian Anda.
          </p>
        </div>
        <div className="flex bg-surface-low/50 p-1 rounded-xl border border-outline-variant/10">
          <button 
            onClick={() => setActiveTab('leaderboard')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-body-sm transition-all ${activeTab === 'leaderboard' ? 'bg-primary text-surface shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Leaderboard
          </button>
          <button 
            onClick={() => setActiveTab('rewards')}
            className={`px-6 py-2.5 rounded-lg font-semibold text-body-sm transition-all ${activeTab === 'rewards' ? 'bg-primary text-surface shadow-lg' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            My Rewards
          </button>
        </div>
      </motion.div>

      {activeTab === 'leaderboard' ? (
        filteredLeaderboard.length === 0 && !isLoading ? (
          <motion.div variants={itemVariants} className="glass-card rounded-2xl p-12 text-center">
            <Trophy className="w-16 h-16 text-on-surface-variant/20 mx-auto mb-4" />
            <h3 className="font-display text-title-lg font-bold text-on-surface">Leaderboard Kosong</h3>
            <p className="text-body-md text-on-surface-variant mt-2">
              Belum ada data peringkat agen. Data akan muncul setelah ada aktivitas penjualan.
            </p>
          </motion.div>
        ) : (
          <>
          {/* ── Top 3 Podium ───────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pt-10">
            {/* 2nd Place */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -8 }}
              className="glass-card rounded-2xl p-6 text-center order-2 md:order-1 relative"
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-slate-300 overflow-hidden shadow-xl">
                <img src={filteredLeaderboard[1]?.avatar || (fallbackLeaderboardData[1]?.avatar || '')} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="mt-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-400/10 text-slate-400 font-bold text-label-sm mb-3">
                  <Star className="w-3.5 h-3.5 fill-current" /> Rank 2
                </div>
                <h4 className="font-display text-title-md font-bold text-on-surface mb-1 truncate">{filteredLeaderboard[1]?.name || (fallbackLeaderboardData[1]?.name || '-')}</h4>
                <div className="text-label-xs text-on-surface-variant mb-4">{filteredLeaderboard[1]?.city || (fallbackLeaderboardData[1]?.city || '-')}</div>
                <div className="text-headline-sm font-bold text-primary">{(filteredLeaderboard[1]?.points || (fallbackLeaderboardData[1]?.points || 0)).toLocaleString()} pts</div>
                <div className="text-label-xs text-on-surface-variant mt-1">{filteredLeaderboard[1]?.totalSales || (fallbackLeaderboardData[1]?.totalSales || 0)} Sales (Month)</div>
              </div>
            </motion.div>

            {/* 1st Place */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -8 }}
              className="glass-card rounded-2xl p-8 text-center order-1 md:order-2 border-primary/30 relative"
            >
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-4 border-amber-400 overflow-hidden shadow-2xl shadow-amber-400/20">
                <img src={filteredLeaderboard[0]?.avatar || (fallbackLeaderboardData[0]?.avatar || '')} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-amber-400/40 to-transparent pointer-events-none" />
              </div>
              <div className="absolute -top-6 right-1/4 translate-x-1/2">
                <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center shadow-lg transform rotate-12">
                  <Crown className="w-6 h-6 text-surface" />
                </div>
              </div>
              <div className="mt-12">
                <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-400 text-surface font-bold text-label-md mb-4 shadow-lg shadow-amber-400/20">
                   THE CHAMPION
                </div>
                <h4 className="font-display text-headline-sm font-bold text-on-surface mb-1">{filteredLeaderboard[0]?.name || (fallbackLeaderboardData[0]?.name || '-')}</h4>
                <div className="text-body-sm text-on-surface-variant mb-6">{filteredLeaderboard[0]?.city || (fallbackLeaderboardData[0]?.city || '-')}</div>
                <div className="text-display-sm font-bold gradient-text-primary mb-2">{(filteredLeaderboard[0]?.points || (fallbackLeaderboardData[0]?.points || 0)).toLocaleString()} pts</div>
                <div className="text-title-sm font-bold text-secondary">{filteredLeaderboard[0]?.totalSales || (fallbackLeaderboardData[0]?.totalSales || 0)} Successful Sales</div>
              </div>
            </motion.div>

            {/* 3rd Place */}
            <motion.div 
              variants={itemVariants}
              whileHover={{ y: -8 }}
              className="glass-card rounded-2xl p-6 text-center order-3 relative"
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full border-4 border-orange-700 overflow-hidden shadow-xl">
                <img src={filteredLeaderboard[2]?.avatar || (fallbackLeaderboardData[2]?.avatar || '')} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="mt-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-700/10 text-orange-700 font-bold text-label-sm mb-3">
                  <Star className="w-3.5 h-3.5 fill-current" /> Rank 3
                </div>
                <h4 className="font-display text-title-md font-bold text-on-surface mb-1 truncate">{filteredLeaderboard[2]?.name || (fallbackLeaderboardData[2]?.name || '-')}</h4>
                <div className="text-label-xs text-on-surface-variant mb-4">{filteredLeaderboard[2]?.city || (fallbackLeaderboardData[2]?.city || '-')}</div>
                <div className="text-headline-sm font-bold text-primary">{(filteredLeaderboard[2]?.points || (fallbackLeaderboardData[2]?.points || 0)).toLocaleString()} pts</div>
                <div className="text-label-xs text-on-surface-variant mt-1">{filteredLeaderboard[2]?.totalSales || (fallbackLeaderboardData[2]?.totalSales || 0)} Sales (Month)</div>
              </div>
            </motion.div>
          </div>

          {/* ── Your Personal Ranking ──────────────────── */}
          <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-6 relative z-10">
              <div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center font-display text-headline-sm font-bold text-surface shadow-lg">
                {currentRank ? `#${currentRank}` : '#-'}
              </div>
              <div>
                <h4 className="font-display text-title-lg font-bold text-on-surface">Peringkat Anda Saat Ini</h4>
                <p className="text-body-sm text-on-surface-variant mt-1 font-medium">
                  Hebat, {user?.name}! Anda terus berkembang di jaringan Sulawesi. 
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center md:items-end gap-2 relative z-10">
               <div className="text-title-md font-bold text-on-surface">{activeTab === 'leaderboard' ? `${currentPoints.toLocaleString('id-ID')} pts` : ''}</div>
               <div className="text-label-sm text-secondary font-bold flex items-center gap-1">
                 <Target className="w-4 h-4" /> {nextTierProgress.nextTierName ? `${nextTierProgress.remaining.toLocaleString('id-ID')} pts lagi ke ${nextTierProgress.nextTierName}` : 'Tier tertinggi telah tercapai'}
               </div>
               <div className="w-48 h-2 bg-surface-highest rounded-full overflow-hidden mt-1">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${nextTierProgress.percent}%` }}
                   transition={{ duration: 1.5, ease: "easeOut" }}
                   className="h-full bg-primary" 
                 />
               </div>
            </div>
          </motion.div>

          {/* ── Search & Filter ────────────────────────── */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-between gap-4">
             <div className="relative w-full sm:w-80">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
               <input 
                 type="text" 
                 placeholder="Cari agen atau kota..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/10 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
               />
             </div>
             <div className="flex p-1 bg-surface-high/50 rounded-xl border border-outline-variant/10 w-fit">
               <button className="px-4 py-1.5 rounded-lg text-label-sm font-bold bg-primary/20 text-primary">All Network</button>
               <button className="px-4 py-1.5 rounded-lg text-label-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors">By City</button>
             </div>
          </motion.div>

          {/* ── Leaderboard Table ──────────────────────── */}
          <motion.div variants={itemVariants} className="glass-card rounded-2xl overflow-hidden">
             <table className="w-full text-left">
               <thead>
                 <tr className="border-b border-outline-variant/20 text-label-xs text-on-surface-variant uppercase tracking-widest bg-surface-high/30">
                   <th className="px-6 py-4">Rank</th>
                   <th className="px-6 py-4">Agent</th>
                   <th className="px-6 py-4">City</th>
                   <th className="px-6 py-4 text-right">Points</th>
                   <th className="px-6 py-4 text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-outline-variant/10">
                 {paginatedLeaderboard.map((item, idx) => (
                   <motion.tr 
                     key={item.rank}
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     transition={{ delay: idx * 0.05 }}
                     className={`hover:bg-surface-high/40 transition-colors group ${item.id === user?.id ? 'bg-primary/5' : ''}`}
                   >
                     <td className="px-6 py-4 font-display font-bold text-on-surface">
                       {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : `#${item.rank}`}
                     </td>
                     <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full overflow-hidden border border-outline-variant/20">
                            <img src={item.avatar} alt="" className="w-full h-full object-cover" />
                         </div>
                         <span className="font-body text-body-sm font-bold text-on-surface">{item.name}</span>
                         {item.id === user?.id && <span className="px-2 py-0.5 rounded bg-primary text-surface text-label-xs font-bold uppercase">You</span>}
                       </div>
                     </td>
                     <td className="px-6 py-4 text-body-sm text-on-surface-variant font-medium">{item.city}</td>
                     <td className="px-6 py-4 text-right text-body-sm font-bold text-on-surface">{item.points.toLocaleString()}</td>
                     <td className="px-6 py-4 text-right">
                       <button className="p-1 px-3 rounded-lg bg-surface-highest text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all text-label-xs font-bold inline-flex items-center gap-1 group/btn">
                         Detail <ChevronRight className="w-3 h-3 group-hover/btn:translate-x-1 transition-transform" />
                       </button>
                     </td>
                   </motion.tr>
                 ))}
               </tbody>
             </table>

             <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={(page) => setCurrentPage(page)}
                className="mt-4 border-t border-outline-variant/10"
             />
          </motion.div>
        </>
      )) : (
        /* ── Rewards Tab ─────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
          <div className="lg:col-span-6 space-y-6">
            {dynamicRewardTiers.map(tier => {
              const progress = Math.min(100, (tier.current / tier.thresholdPoints) * 100);
              const TierIcon = tier.meta.icon;
              const isUnlocked = progress === 100;

              return (
                <motion.div 
                  key={tier.id}
                  variants={itemVariants}
                  className={`glass-card rounded-2xl p-8 relative overflow-hidden transition-all duration-500 ${isUnlocked ? 'border-primary/50' : 'opacity-80'}`}
                >
                  <div className={`absolute top-0 right-0 w-48 h-48 ${tier.meta.bgColor} rounded-full blur-3xl pointer-events-none`} />
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-8 relative z-10">
                    <div className={`w-20 h-20 rounded-2xl ${tier.meta.bgColor} ${tier.meta.color} flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform`}>
                      <TierIcon className="w-10 h-10" />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-display text-display-xs font-bold text-on-surface">{tier.name}</h4>
                          <p className="text-body-sm text-on-surface-variant font-medium mt-1">Unlock with {tier.thresholdPoints.toLocaleString()} total points</p>
                        </div>
                        <div className="text-right">
                           <div className="text-title-md font-bold text-on-surface">{isUnlocked ? 'UNLOCKED' : `${tier.current.toLocaleString()} / ${tier.thresholdPoints.toLocaleString()}`}</div>
                           <div className="text-label-xs text-on-surface-variant mt-1">{isUnlocked ? 'Telah mencapai target' : `${(tier.thresholdPoints - tier.current).toLocaleString()} pts tersisa`}</div>
                        </div>
                      </div>

                      <div className="w-full h-3 bg-surface-highest rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          className={`h-full ${tier.meta.color.replace('text-', 'bg-')}`}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        {tier.meta.benefits.map((benefit, i) => (
                           <div key={i} className="px-3 py-1 rounded-md bg-surface-highest text-on-surface-variant text-label-xs font-bold flex items-center gap-1.5">
                             <div className={`w-1.5 h-1.5 rounded-full ${tier.meta.color.replace('text-', 'bg-')}`} />
                             {benefit}
                           </div>
                        ))}
                      </div>
                    </div>

                    {!isUnlocked && (
                      <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-outline-variant/10 bg-surface-high/30">
                        <Gift className="w-6 h-6 text-on-surface-variant mb-2" />
                        <span className="text-label-sm font-bold text-on-surface-variant">Locked Reward</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Reward Badges & Accomplishments */}
          <div className="lg:col-span-4 space-y-6">
             <motion.div variants={itemVariants} className="glass-card rounded-2xl p-6 bg-gradient-to-br from-primary/10 via-surface-low to-secondary/10 border-primary/20">
                <h4 className="font-display text-title-md font-bold text-on-surface mb-6 flex items-center gap-2">
                  <Medal className="w-5 h-5 text-primary" /> Active Achievements
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Pioneer', icon: Star, color: 'text-blue-400' },
                    { label: 'Quick Start', icon: Zap, color: 'text-yellow-400' },
                    { label: 'Area Master', icon: MapPin, icon2: TrendingUp, color: 'text-green-400' },
                    { label: 'Referral Pro', icon: Users, color: 'text-purple-400' },
                  ].map((ach, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 p-4 rounded-xl bg-surface-high/60 border border-outline-variant/10 group cursor-help">
                      <div className={`w-12 h-12 rounded-full bg-surface shadow-inner flex items-center justify-center ${ach.color} group-hover:scale-110 transition-transform`}>
                        <ach.icon className="w-6 h-6" />
                      </div>
                      <span className="text-label-xs font-bold text-on-surface-variant group-hover:text-on-surface transition-colors">{ach.label}</span>
                    </div>
                  ))}
                  <div className="col-span-2 p-4 rounded-xl border-2 border-dashed border-outline-variant/20 flex flex-col items-center justify-center text-on-surface-variant opacity-60">
                    <Medal className="w-8 h-8 mb-2" />
                    <span className="text-label-xs font-bold font-display">8 Locked Achievements</span>
                  </div>
                </div>
             </motion.div>

             <motion.div variants={itemVariants} className="glass-card rounded-2xl p-6">
                <h4 className="font-display text-title-md font-bold text-on-surface mb-4">Mekanisme Poin</h4>
                <div className="space-y-4">
                  {[
                    { label: 'Penjualan Bike', pts: '250 pts / item', color: 'bg-primary' },
                    { label: 'Penjualan Elektronik', pts: '100 pts / item', color: 'bg-secondary' },
                    { label: 'Penjualan Furnitur', pts: '150 pts / item', color: 'bg-tertiary' },
                    { label: 'Daily Knowledge Check', pts: '25 pts / day', color: 'bg-slate-400' },
                  ].map((rule, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-high transition-colors">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${rule.color}`} />
                         <span className="text-body-sm text-on-surface-variant font-medium">{rule.label}</span>
                      </div>
                      <span className="text-label-xs font-extrabold text-on-surface">{rule.pts}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-6 py-3 rounded-xl border border-outline-variant/20 text-on-surface-variant font-bold text-label-sm hover:bg-surface-high transition-all">
                  Pelajari Lebih Lengkap
                </button>
             </motion.div>
          </div>
        </div>
      )}

      {/* ── Footer Motivation ────────────────────────── */}
      <motion.div 
        variants={itemVariants}
        className="text-center py-12"
      >
        <p className="text-body-md text-on-surface-variant font-medium italic">
          "Kesuksesan bukan tentang di mana Anda berpijak hari ini,<br />tetapi tentang seberapa jauh Anda telah melangkah dari hari kemarin."
        </p>
      </motion.div>
    </motion.div>
  );
};

export default AgentLeaderboardPage;
