import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Plus, Loader2 } from 'lucide-react';
import { toast } from '../../store/useNotificationStore';
import { useAuthStore } from '../../store/authStore';
import { readApiError } from '../../utils/apiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  campaignId: string;
  onSuccess: () => void;
}

const AddWaRecipientModal: React.FC<Props> = ({ isOpen, onClose, campaignId, onSuccess }) => {
  const { accessToken } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Data penerima belum lengkap', 'Nama dan nomor WhatsApp wajib diisi');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${campaignId}/recipients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: formData.phone,
          variables: { name: formData.name }
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menambahkan penerima'));
      
      toast.success('Penerima ditambahkan');
      setFormData({ name: '', phone: '' });
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Kesalahan', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md glass-card rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" /> Tambah Penerima
                </h3>
                <button onClick={onClose} className="p-2 hover:bg-surface-high rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1.5 uppercase tracking-wider font-bold">Nama Lengkap</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-label-sm text-on-surface-variant mb-1.5 uppercase tracking-wider font-bold">Nomor WhatsApp</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      placeholder="Contoh: 081234567890"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none text-on-surface font-body"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 gradient-primary text-surface rounded-xl font-bold hover:shadow-neon-cyan transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Tambah Sekarang
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddWaRecipientModal;
