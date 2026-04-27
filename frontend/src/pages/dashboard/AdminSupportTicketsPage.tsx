import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertCircle, MessageSquare, User, Mail } from 'lucide-react';
import { useAdminNetworkStore } from '../../store/useAdminNetworkStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } },
};

const statusMeta: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  open: {
    label: 'Open',
    cls: 'bg-primary/15 text-primary',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
  },
  in_progress: {
    label: 'In Progress',
    cls: 'bg-tertiary/15 text-tertiary',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  resolved: {
    label: 'Resolved',
    cls: 'bg-secondary/15 text-secondary',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
};

const priorityMeta: Record<string, { label: string; cls: string }> = {
  high: { label: 'Tinggi', cls: 'bg-error/15 text-error' },
  medium: { label: 'Normal', cls: 'bg-tertiary/15 text-tertiary' },
  low: { label: 'Rendah', cls: 'bg-surface-highest text-on-surface-variant' },
};

const AdminSupportTicketsPage: React.FC = () => {
  const { supportTickets, isLoading, fetchSupportTickets, updateSupportTicketStatus } = useAdminNetworkStore();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchSupportTickets();
  }, [fetchSupportTickets]);

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'all') return supportTickets;
    return supportTickets.filter((ticket) => ticket.status === statusFilter);
  }, [statusFilter, supportTickets]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const paginated = filteredTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const counts = useMemo(() => {
    return {
      total: supportTickets.length,
      open: supportTickets.filter((ticket) => ticket.status === 'open').length,
      inProgress: supportTickets.filter((ticket) => ticket.status === 'in_progress').length,
      resolved: supportTickets.filter((ticket) => ticket.status === 'resolved').length,
    };
  }, [supportTickets]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  const setStatus = async (id: string, status: 'open' | 'in_progress' | 'resolved') => {
    setUpdatingId(id);
    const ok = await updateSupportTicketStatus(id, status);
    if (!ok) {
      toast.error('Gagal update tiket', 'Status tiket tidak dapat diperbarui.');
    } else {
      toast.success('Status tiket diperbarui');
    }
    setUpdatingId(null);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Support Desk</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" /> Manajemen Ticket Support
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Pantau, proses, dan selesaikan semua ticket dari agen secara terpusat.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'open' | 'in_progress' | 'resolved')}
              className="px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="all">Semua Status</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Ticket', value: counts.total, cls: 'text-primary', icon: MessageSquare },
          { label: 'Open', value: counts.open, cls: 'text-primary', icon: AlertCircle },
          { label: 'In Progress', value: counts.inProgress, cls: 'text-tertiary', icon: Clock },
          { label: 'Resolved', value: counts.resolved, cls: 'text-secondary', icon: CheckCircle2 },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.label} variants={itemVariants} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between">
                <span className="text-label-sm text-on-surface-variant">{item.label}</span>
                <Icon className={`w-4 h-4 ${item.cls}`} />
              </div>
              <div className={`font-display text-headline-sm font-bold mt-2 ${item.cls}`}>{item.value}</div>
            </motion.div>
          );
        })}
      </div>

      <motion.div variants={itemVariants} className="glass-card rounded-xl p-4 sm:p-6">
        {isLoading ? (
          <div className="text-body-sm text-on-surface-variant py-8">Memuat ticket support...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-body-sm text-on-surface-variant py-8">Belum ada ticket untuk filter saat ini.</div>
        ) : (
          <div className="space-y-3">
            {paginated.map((ticket) => {
              const status = statusMeta[ticket.status] ?? statusMeta.open;
              const priority = priorityMeta[ticket.priority] ?? priorityMeta.medium;
              return (
                <div key={ticket.id} className="rounded-xl border border-outline-variant/15 p-4 bg-surface-high/20">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                    <div className="space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-on-surface text-body-sm">{ticket.subject}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-xs font-bold ${priority.cls}`}>
                          {priority.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-label-xs font-bold ${status.cls}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </div>
                      {ticket.message && (
                        <p className="text-body-sm text-on-surface-variant whitespace-pre-wrap">{ticket.message}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-label-xs text-on-surface-variant">
                        <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{ticket.agentName ?? '-'}</span>
                        <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{ticket.agentEmail ?? '-'}</span>
                        <span>ID: {ticket.id}</span>
                        <span>Dibuat: {formatDate(ticket.createdAt)}</span>
                        <span>Update: {formatDate(ticket.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:flex-col lg:items-stretch">
                      <button
                        type="button"
                        onClick={() => setStatus(ticket.id, 'open')}
                        disabled={updatingId === ticket.id || ticket.status === 'open'}
                        className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-label-sm font-semibold disabled:opacity-50"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(ticket.id, 'in_progress')}
                        disabled={updatingId === ticket.id || ticket.status === 'in_progress'}
                        className="px-3 py-1.5 rounded-md bg-tertiary/15 text-tertiary text-label-sm font-semibold disabled:opacity-50"
                      >
                        Process
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus(ticket.id, 'resolved')}
                        disabled={updatingId === ticket.id || ticket.status === 'resolved'}
                        className="px-3 py-1.5 rounded-md bg-secondary/15 text-secondary text-label-sm font-semibold disabled:opacity-50"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => setCurrentPage(page)}
              className="mt-6 border-t border-outline-variant/10"
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminSupportTicketsPage;
