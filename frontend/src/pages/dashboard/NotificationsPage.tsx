import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  Info,
  MessageCircle,
  ArrowRight,
  Clock3,
  RefreshCcw,
} from 'lucide-react';
import { useDashboardNotificationsStore } from '../../store/useDashboardNotificationsStore';
import { toast } from '../../store/useNotificationStore';

type NotificationLevel = 'critical' | 'success' | 'info';

const levelStyle: Record<NotificationLevel, { icon: React.ReactNode; className: string }> = {
  critical: {
    icon: <AlertTriangle className="w-4 h-4" />,
    className: 'bg-error/15 text-error border-error/30',
  },
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    className: 'bg-secondary/15 text-secondary border-secondary/30',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    className: 'bg-primary/15 text-primary border-primary/30',
  },
};

function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return 'Baru saja';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return 'Baru saja';

  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return 'Baru saja';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

function resolveLevel(type: string): NotificationLevel {
  if (type.includes('registration') || type.includes('claim')) {
    return 'critical';
  }
  if (type.includes('updated') || type.includes('completed')) {
    return 'success';
  }
  return 'info';
}

const NotificationsPage: React.FC = () => {
  const {
    items,
    unreadCount,
    isLoading,
    isUpdating,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  } = useDashboardNotificationsStore();

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAll = async () => {
    const success = await markAllAsRead();
    if (success) {
      toast.success('Semua notifikasi ditandai sudah dibaca');
    } else {
      toast.error('Gagal memperbarui notifikasi');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <section className="glass-card rounded-xl p-6 md:p-7 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-widest font-semibold">Notification Center</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface mt-1 inline-flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              Notifikasi Dashboard
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Pantau aktivitas penting agar tim dapat merespon lebih cepat dan terarah.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-high text-on-surface-variant text-label-sm font-semibold hover:text-on-surface transition-colors"
              disabled={isLoading}
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleMarkAll}
              disabled={unreadCount === 0 || isUpdating}
              className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-label-sm font-bold disabled:opacity-40"
            >
              Tandai Semua Dibaca
            </button>
            <div className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-label-sm font-bold">
              {unreadCount} belum dibaca
            </div>
          </div>
        </div>
      </section>

      <section className="glass-card rounded-xl p-4 md:p-5">
        <div className="space-y-3">
          {items.length === 0 && !isLoading && (
            <div className="rounded-xl border border-outline-variant/10 bg-surface-low/30 p-5 text-body-sm text-on-surface-variant">
              Belum ada notifikasi untuk akun Anda.
            </div>
          )}
          {items.map((item) => {
            const level = resolveLevel(item.type);
            const style = levelStyle[level];
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 md:p-5 transition-colors ${
                  item.isRead
                    ? 'border-outline-variant/10 bg-surface-low/30 hover:bg-surface-high/20'
                    : 'border-primary/35 bg-primary/5'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-sm border ${style.className}`}>
                        {style.icon}
                        {level === 'critical' ? 'Penting' : level === 'success' ? 'Update' : 'Info'}
                      </span>
                      {!item.isRead && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-label-sm border border-primary/30 bg-primary/15 text-primary">
                          Baru
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant">
                        <Clock3 className="w-3.5 h-3.5" />
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <h3 className="font-display text-title-md font-bold text-on-surface truncate">{item.title}</h3>
                    <p className="text-body-sm text-on-surface-variant mt-1.5">{item.message || 'Tidak ada detail tambahan.'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!item.isRead && (
                      <button
                        onClick={() => void markAsRead(item.id)}
                        className="inline-flex items-center gap-1 text-on-surface-variant text-label-sm font-semibold hover:text-on-surface transition-colors whitespace-nowrap"
                      >
                        Tandai Dibaca
                      </button>
                    )}
                    {item.actionPath && (
                      <Link
                        to={item.actionPath}
                        onClick={() => {
                          if (!item.isRead) {
                            void markAsRead(item.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 text-primary text-label-sm font-bold hover:gap-2 transition-all whitespace-nowrap"
                      >
                        Lihat
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="glass-card rounded-xl p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display text-title-md font-bold text-on-surface">Butuh tindak lanjut cepat?</h4>
            <p className="text-body-sm text-on-surface-variant mt-1.5">
              Gunakan halaman ini sebagai ringkasan operasional. Notifikasi baru akan muncul otomatis dari event backend.
            </p>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default NotificationsPage;
