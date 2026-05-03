import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, ExternalLink, QrCode, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import { buildReferralLink } from '../../utils/apiClient';

const SalesReferralPage: React.FC = () => {
  const { user } = useAuthStore();

  const referralSlug = user?.referral_slug?.trim() || '';
  const catalogLink = useMemo(() => {
    if (!referralSlug) return '';
    return buildReferralLink(referralSlug);
  }, [referralSlug]);

  const whatsappLink = useMemo(() => {
    const digits = user?.whatsapp?.replace(/\D/g, '') || '';
    return digits ? `https://wa.me/${digits}` : '';
  }, [user?.whatsapp]);

  const copyLink = async () => {
    if (!catalogLink) return;
    await navigator.clipboard.writeText(catalogLink);
    toast.success('Link disalin', 'Referral catalog link sudah disalin ke clipboard.');
  };

  const copySlug = async () => {
    if (!referralSlug) return;
    await navigator.clipboard.writeText(referralSlug);
    toast.success('Ref code disalin', 'Slug referral sudah disalin.');
  };

  const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
  const itemAnim = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemAnim} className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Sales Referral</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Share2 className="w-7 h-7 text-primary" /> Referral & Share Link
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1 max-w-2xl">
              Bagikan catalog link dengan ref code sales. Saat customer membuka link ini, tombol hubungi kami akan diarahkan ke WhatsApp sales yang sesuai.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-surface-high/60 p-3">
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">Ref Code</div>
              <div className="font-display text-headline-sm font-bold text-primary">{referralSlug || '-'}</div>
            </div>
            <div className="rounded-xl bg-surface-high/60 p-3">
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">WhatsApp</div>
              <div className="font-display text-headline-sm font-bold text-secondary">{user?.whatsapp || '-'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <motion.div variants={itemAnim} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-primary" />
            <h3 className="font-display text-title-md font-bold text-on-surface">Link Catalog Referral</h3>
          </div>

          {referralSlug ? (
            <>
              <div className="rounded-2xl bg-surface-high/50 border border-outline-variant/15 p-4 break-all text-body-sm text-on-surface-variant">
                {catalogLink}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={copyLink} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 transition-colors">
                  <Copy className="w-4 h-4" /> Copy Link Catalog
                </button>
                <button type="button" onClick={copySlug} className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-high text-on-surface font-bold hover:bg-surface-highest transition-colors">
                  <QrCode className="w-4 h-4" /> Copy Ref Code
                </button>
                <a href={catalogLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-outline-variant/20 text-on-surface font-bold hover:border-primary/40 hover:text-primary transition-colors">
                  <ExternalLink className="w-4 h-4" /> Buka Link
                </a>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-warning/10 border border-warning/20 p-4 text-body-sm text-on-surface-variant">
              Akun ini belum punya ref code. Pastikan admin mengisi role sales dan menyimpan profil agar referral slug terbentuk.
            </div>
          )}
        </motion.div>

        <motion.div variants={itemAnim} className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-secondary" />
            <h3 className="font-display text-title-md font-bold text-on-surface">Kontak Sales</h3>
          </div>

          <div className="rounded-2xl bg-surface-high/50 border border-outline-variant/15 p-4 space-y-2">
            <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Nama</div>
            <div className="font-semibold text-on-surface">{user?.name || '-'}</div>
            <div className="text-label-xs uppercase tracking-widest text-on-surface-variant mt-3">WhatsApp</div>
            <div className="font-semibold text-on-surface">{user?.whatsapp || '-'}</div>
          </div>

          {whatsappLink ? (
            <a href={whatsappLink} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] text-white font-bold hover:opacity-95 transition-colors">
              <MessageCircle className="w-4 h-4" /> Buka WhatsApp
            </a>
          ) : null}

          <div className="text-body-sm text-on-surface-variant leading-relaxed">
            Gunakan link referral ini saat share ke customer. Ref code akan terbawa ke katalog dan tombol <span className="text-on-surface font-semibold">Hubungi Kami</span> di halaman produk publik akan mengarah ke WhatsApp sales yang sesuai.
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SalesReferralPage;
