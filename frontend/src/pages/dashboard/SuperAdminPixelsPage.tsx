import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Plus, BarChart3, Edit, UserPlus, Power, Loader2, AlertCircle, ArrowUpRight } from 'lucide-react';

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

interface Pixel {
  id: string;
  pixel_id: string;
  name: string;
  business_manager_id: string;
  status: 'active' | 'inactive' | 'suspended';
  assigned_admins_count: number;
  total_events: number;
  created_at: string;
}

const SuperAdminPixelsPage: React.FC = () => {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPixels();
  }, []);

  const fetchPixels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/pixels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        setPixels(result.data.pixels || []);
        setError(null);
      } else {
        const error = await response.json();
        setError(error.message || 'Failed to load pixels');
      }
    } catch (err: any) {
      console.error('Failed to fetch pixels:', err);
      setError('Failed to load pixels');
    } finally {
      setLoading(false);
    }
  };

  const togglePixelStatus = async (pixelId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await fetch(`/api/pixels/${pixelId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        await fetchPixels();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update pixel status');
      }
    } catch (err: any) {
      console.error('Failed to update pixel status:', err);
      alert('Failed to update pixel status');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-500/10 text-green-600 border-green-500/20',
      inactive: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      suspended: 'bg-red-500/10 text-red-600 border-red-500/20',
    };
    return (
      <span className={`px-2 py-1 rounded-md text-label-sm border ${styles[status as keyof typeof styles] || styles.inactive}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* ── Header Banner ─────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="absolute -right-16 -top-16 w-56 h-56 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">
              Pixel Management 🎯
            </p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface">
              Manage Pixels
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Create and manage Meta Pixels for the platform
            </p>
          </div>
          <Link
            to="/dashboard/super-admin/pixels/new"
            className="px-4 py-2.5 rounded-lg bg-primary text-on-primary font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Pixel
          </Link>
        </div>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="glass-card p-4 rounded-xl border border-error/20 bg-error/5 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-error" />
          <p className="text-error">{error}</p>
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="glass-card rounded-xl border border-outline-variant/20 overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        {pixels.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="font-semibold text-on-surface mb-1">No pixels configured yet</p>
              <Link
                to="/dashboard/super-admin/pixels/new"
                className="text-primary hover:underline mt-2 inline-flex items-center gap-1"
              >
                Create your first pixel <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-high border-b border-outline-variant/20">
                <tr>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Pixel ID
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Business Manager
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Assigned Admins
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Total Events
                  </th>
                  <th className="px-6 py-3 text-left text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {pixels.map((pixel) => (
                  <motion.tr 
                    key={pixel.id} 
                    whileHover={{ backgroundColor: 'rgba(255, 255, 255, 0.02)' }}
                    className="transition-colors"
                  >
                    <td className="px-6 py-4 text-body-sm text-on-surface font-mono">
                      {pixel.pixel_id}
                    </td>
                    <td className="px-6 py-4 text-body-sm text-on-surface font-medium">
                      {pixel.name}
                    </td>
                    <td className="px-6 py-4 text-body-sm text-on-surface-variant">
                      {pixel.business_manager_id}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(pixel.status)}
                    </td>
                    <td className="px-6 py-4 text-body-sm text-on-surface">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-xs">
                          {pixel.assigned_admins_count}
                        </div>
                        <span className="text-on-surface-variant text-label-xs">admins</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-body-sm text-on-surface font-semibold">
                      {pixel.total_events.toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/dashboard/super-admin/pixels/${pixel.id}`}
                          className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/dashboard/super-admin/pixels/${pixel.id}#admins`}
                          className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant hover:text-secondary transition-colors"
                          title="Assign Admin"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => togglePixelStatus(pixel.id, pixel.status)}
                          className={`p-2 rounded-lg hover:bg-surface-high transition-colors ${
                            pixel.status === 'active' ? 'text-green-600 hover:text-red-600' : 'text-yellow-600 hover:text-green-600'
                          }`}
                          title={pixel.status === 'active' ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};


export default SuperAdminPixelsPage;
