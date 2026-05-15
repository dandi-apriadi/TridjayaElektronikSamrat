import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Send, Check, Plus } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import type { WaCampaign } from '../../types';
import { readApiError } from '../../utils/apiError';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: string[];
  onSuccess: () => void;
}

const SelectCampaignModal: React.FC<Props> = ({ isOpen, onClose, selectedLeadIds, onSuccess }) => {
  const { accessToken } = useAuthStore();
  const [campaigns, setCampaigns] = useState<WaCampaign[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchCampaigns();
    }
  }, [isOpen]);

  const fetchCampaigns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wa/campaigns', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat campaign'));
      const data = await res.json();
      // Only show draft or running campaigns
      setCampaigns((data.data?.items || []).filter((c: any) => c.status !== 'completed'));
    } catch (error) {
      toast.error('Gagal memuat daftar campaign', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedId) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${selectedId}/recipients/from-leads`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_ids: selectedLeadIds
        }),
      });

      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menambahkan ke blast'));
      const data = await res.json();
      
      toast.success(`Berhasil menambahkan ${data.data.inserted} prospek ke blast`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Gagal menambahkan ke blast', error instanceof Error ? error.message : 'Terjadi kesalahan');
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
            className="relative w-full max-w-lg glass-card rounded-2xl border border-outline-variant/20 shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-2">
                  <Send className="w-5 h-5 text-primary" /> Tambahkan ke WA Blast
                </h3>
                <button onClick={onClose} className="p-2 hover:bg-surface-high rounded-full transition-colors">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-body-sm text-on-surface-variant">
                  Pilih campaign WhatsApp Blast untuk menambahkan <span className="text-primary font-bold">{selectedLeadIds.length}</span> prospek terpilih.
                </p>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 mb-6 pr-2 custom-scrollbar">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="text-center py-8 text-on-surface-variant italic text-body-sm">
                    Tidak ada campaign aktif. Buat campaign baru terlebih dahulu.
                  </div>
                ) : (
                  campaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                        selectedId === c.id
                          ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(var(--color-primary),0.1)]'
                          : 'bg-surface-high/30 border-outline-variant/10 hover:border-primary/30'
                      }`}
                    >
                      <div>
                        <div className={`font-bold text-body-md ${selectedId === c.id ? 'text-primary' : 'text-on-surface'}`}>
                          {c.name}
                        </div>
                        <div className="text-[10px] text-on-surface-variant mt-0.5 flex items-center gap-2">
                          <span className="uppercase">{c.status}</span>
                          <span>•</span>
                          <span>{c.recipientTotal} Penerima</span>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all ${
                        selectedId === c.id ? 'bg-primary border-primary text-surface' : 'border-outline-variant/30 group-hover:border-primary/50'
                      }`}>
                        {selectedId === c.id && <Check className="w-4 h-4" />}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-surface-high text-on-surface font-bold rounded-xl hover:bg-surface-highest transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!selectedId || isSubmitting}
                  className="flex-[2] py-3 gradient-primary text-surface font-bold rounded-xl hover:shadow-neon-cyan transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Proses Sekarang
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SelectCampaignModal;
