import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Headphones, MessageCircle, Phone, Mail, Clock,
  CheckCircle2, AlertCircle, ArrowUpRight, Zap,
} from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useAgentStore } from '../../store/useAgentStore';
import { toast } from '../../store/useNotificationStore';

const priorityCls: Record<string, string> = {
  high:   'bg-error/15 text-error',
  medium: 'bg-tertiary/15 text-tertiary',
  low:    'bg-surface-highest text-on-surface-variant',
};
const statusCls: Record<string, string> = {
  open:        'bg-primary/15 text-primary',
  in_progress: 'bg-tertiary/15 text-tertiary',
  resolved:    'bg-secondary/15 text-secondary',
};

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

const AgentSupportPage: React.FC = () => {
  const { supportTickets, fetchSupportTickets, createSupportTicket, isLoading } = useAgentStore();
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [newTicketMsg, setNewTicketMsg] = useState('');
  const [newTicketPriority, setNewTicketPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ticketSent, setTicketSent] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

  useEffect(() => {
    fetchSupportTickets();
  }, [fetchSupportTickets]);

  const totalPages = Math.ceil(supportTickets.length / itemsPerPage);
  const paginated = supportTickets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatStatusLabel = (status: 'open' | 'in_progress' | 'resolved') => {
    if (status === 'in_progress') return 'In Progress';
    if (status === 'resolved') return 'Resolved';
    return 'Open';
  };

  const formatCreatedAt = (createdAt?: string) => {
    if (!createdAt) return '-';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return createdAt;
    return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const handleSubmitTicket = async () => {
    if (!newTicketSubject.trim()) {
      toast.warning('Judul tiket wajib diisi');
      return;
    }

    const ok = await createSupportTicket(newTicketSubject, newTicketMsg, newTicketPriority);
    if (!ok) {
      toast.error('Gagal membuat tiket', 'Silakan coba lagi dalam beberapa saat.');
      return;
    }

    setTicketSent(true);
    setNewTicketSubject('');
    setNewTicketMsg('');
    setNewTicketPriority('medium');
    setTimeout(() => setTicketSent(false), 2500);
  };

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Bantuan & Support</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Headphones className="w-6 h-6 text-primary" /> Help Center
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Tim admin siap membantu. Hubungi kami via WA, email, atau buka ticket support.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-label-sm font-bold inline-flex items-center gap-1.5">
              <span className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
              Admin Online
            </span>
          </div>
        </div>
      </motion.div>

      {/* Quick Contact */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            label: 'WhatsApp Admin',
            desc: 'Respons tercepat · Jam 08.00–21.00 WIB',
            icon: MessageCircle,
            color: 'text-[#25D366]',
            bg: 'bg-[#25D366]/10 border-[#25D366]/20',
            action: 'Chat Sekarang',
            href: 'https://wa.me/6285161542103?text=Halo Admin Tridjaya Manado, saya butuh bantuan.',
          },
          {
            label: 'Telepon Admin',
            desc: '+62 851-6154-2103 · Jam kerja',
            icon: Phone,
            color: 'text-primary',
            bg: 'bg-primary/10 border-primary/20',
            action: 'Hubungi',
            href: 'https://wa.me/6285161542103',
          },
          {
            label: 'Email Dukungan',
            desc: 'dandimamonto.tridjaya03@gmail.com · Balas <24 jam',
            icon: Mail,
            color: 'text-tertiary',
            bg: 'bg-tertiary/10 border-tertiary/20',
            action: 'Kirim Email',
            href: 'mailto:dandimamonto.tridjaya03@gmail.com?subject=Bantuan Agen',
          },
        ].map((c) => (
          <motion.div key={c.label} variants={iv} className={`glass-card rounded-xl p-5 border ${c.bg} relative overflow-hidden`}>
            <div className={`p-2.5 rounded-lg bg-opacity-20 ${c.color} w-fit mb-3`}><c.icon className="w-5 h-5" /></div>
            <div className="font-display font-bold text-on-surface text-title-sm mb-0.5">{c.label}</div>
            <div className="text-label-sm text-on-surface-variant mb-4">{c.desc}</div>
            <a href={c.href} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-label-sm ${c.color} bg-surface-high hover:bg-surface-highest transition-colors`}>
              {c.action} <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </motion.div>
        ))}
      </div>

      {/* Ticket History + New Ticket */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Tickets */}
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <h3 className="font-display text-title-md font-bold text-on-surface mb-5">Riwayat Ticket Saya</h3>
          <div className="space-y-3">
            {supportTickets.length === 0 && (
              <div className="p-4 rounded-xl border border-outline-variant/10 text-body-sm text-on-surface-variant">
                Belum ada tiket. Buat tiket baru jika membutuhkan bantuan admin.
              </div>
            )}
            {paginated.map((t) => (
              <div key={t.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-outline-variant/10 hover:bg-surface-high/30 transition-colors">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.status === 'resolved' ? 'bg-secondary/15' : t.status === 'in_progress' ? 'bg-tertiary/15' : 'bg-primary/15'}`}>
                  {t.status === 'resolved'
                    ? <CheckCircle2 className="w-4 h-4 text-secondary" />
                    : <AlertCircle className={`w-4 h-4 ${t.status === 'in_progress' ? 'text-tertiary' : 'text-primary'}`} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-on-surface text-body-sm">{t.subject}</div>
                  {t.message && <div className="text-label-xs text-on-surface-variant mt-1 line-clamp-2">{t.message}</div>}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-label-xs text-on-surface-variant">{t.id}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-label-xs font-bold ${priorityCls[t.priority]}`}>
                      {t.priority === 'high' ? 'Tinggi' : t.priority === 'medium' ? 'Normal' : 'Rendah'}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-md text-label-xs font-bold ${statusCls[t.status]}`}>
                      {formatStatusLabel(t.status)}
                    </span>
                  </div>
                  <div className="text-label-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />{formatCreatedAt(t.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            className="mt-6 border-t border-outline-variant/10"
          />
        </motion.div>

        {/* New Ticket */}
        <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
          <h3 className="font-display text-title-md font-bold text-on-surface mb-2">Buka Ticket Baru</h3>
          <p className="text-body-sm text-on-surface-variant mb-5">Deskripsikan masalah Anda dan tim kami akan merespons secepatnya.</p>
          {ticketSent ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-secondary mx-auto mb-3" />
              <p className="font-bold text-on-surface">Ticket terkirim!</p>
              <p className="text-body-sm text-on-surface-variant mt-1">Admin akan membalas dalam 1×24 jam.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant font-semibold block mb-1.5">Judul Masalah *</label>
                <input type="text" placeholder="Contoh: Komisi tidak masuk..." value={newTicketSubject}
                  onChange={(e) => setNewTicketSubject(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant font-semibold block mb-1.5">Deskripsi</label>
                <textarea rows={4} placeholder="Jelaskan masalah secara detail..." value={newTicketMsg}
                  onChange={(e) => setNewTicketMsg(e.target.value)}
                  className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm resize-none"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant font-semibold block mb-1.5">Prioritas</label>
                <select
                  value={newTicketPriority}
                  onChange={(e) => setNewTicketPriority(e.target.value as 'low' | 'medium' | 'high')}
                  className="w-full px-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm"
                >
                  <option value="low">Rendah</option>
                  <option value="medium">Normal</option>
                  <option value="high">Tinggi</option>
                </select>
              </div>
              <button type="button" onClick={handleSubmitTicket}
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-primary/20 text-primary font-bold text-body-sm hover:bg-primary/30 transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <Zap className="w-4 h-4" /> {isLoading ? 'Mengirim...' : 'Kirim Ticket'}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AgentSupportPage;
