import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, CheckCircle2, Copy, Package, Send, Shield, Truck, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import { apiFetch } from '../../utils/apiClient';

interface DeliveryScheduleItem {
  id: string;
  customer_name: string;
  item_name: string;
  payment_status: string;
  address: string;
  sales_user_id: string;
  sales_name: string;
  sender_branch: string;
  referral_slug?: string | null;
  created_at?: string | null;
}

const paymentOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit', label: 'Credit' },
  { value: 'cod', label: 'COD' },
];

const SalesDeliveryPage: React.FC = () => {
  const { user } = useAuthStore();
  const [customerName, setCustomerName] = useState('');
  const [itemName, setItemName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'cash' | 'credit' | 'cod'>('cash');
  const [address, setAddress] = useState('');
  const [salesName, setSalesName] = useState(user?.name || '');
  const [senderBranch, setSenderBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [items, setItems] = useState<DeliveryScheduleItem[]>([]);

  const title = 'Jadwal Pengiriman';

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const response = await apiFetch('/api/sales/delivery-schedules');
      if (!response.ok) {
        throw new Error('Gagal mengambil jadwal pengiriman');
      }
      const payload = await response.json();
      setItems(payload.data?.items || []);
    } catch (error) {
      toast.error('Gagal memuat data', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSalesName(user?.name || '');
    void loadSchedules();
  }, [user?.name]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !itemName.trim() || !address.trim() || !salesName.trim() || !senderBranch.trim()) {
      toast.error('Data belum lengkap', 'Semua field wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await apiFetch('/api/sales/delivery-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          itemName,
          paymentStatus,
          address,
          salesName,
          senderBranch,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.message || payload.error || 'Gagal menyimpan jadwal';
        throw new Error(message);
      }

      toast.success('Jadwal tersimpan', 'Data pengiriman berhasil masuk ke database.');
      setCustomerName('');
      setItemName('');
      setPaymentStatus('cash');
      setAddress('');
      setSenderBranch('');
      await loadSchedules();
    } catch (error) {
      toast.error('Gagal menyimpan', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyDeliverySummary = async (item: DeliveryScheduleItem) => {
    const text = [
      `Nama Cust: ${item.customer_name}`,
      `Nama Barang: ${item.item_name}`,
      `Status Pembayaran: ${item.payment_status.toUpperCase()}`,
      `Alamat: ${item.address}`,
      `Nama Sales: ${item.sales_name}`,
      `Cabang Pengirim: ${item.sender_branch}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Disalin', 'Ringkasan jadwal pengiriman telah disalin.');
  };

  const container = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const itemAnim = { hidden: { y: 14, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

  return (
    <motion.div variants={container} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemAnim} className="glass-card rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">Operasional Sales</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Truck className="w-7 h-7 text-primary" /> {title}
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1 max-w-2xl">
              Upload jadwal pengiriman dan simpan informasi customer, barang, pembayaran, alamat, sales, dan cabang pengirim ke database.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-surface-high/60 p-3">
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">Total Jadwal</div>
              <div className="font-display text-headline-sm font-bold text-primary">{items.length}</div>
            </div>
            <div className="rounded-xl bg-surface-high/60 p-3">
              <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">Role Aktif</div>
              <div className="font-display text-headline-sm font-bold text-secondary">{user?.role || '-'}</div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_0.95fr] gap-6">
        <motion.form variants={itemAnim} onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Send className="w-5 h-5 text-primary" />
            <h3 className="font-display text-title-md font-bold text-on-surface">Input Jadwal Pengiriman</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Nama Cust</span>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nama customer" />
            </label>
            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Nama Barang</span>
              <input value={itemName} onChange={(e) => setItemName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nama barang" />
            </label>
            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Status Pembayaran</span>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'cash' | 'credit' | 'cod')} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40">
                {paymentOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Nama Sales</span>
              <input value={salesName} onChange={(e) => setSalesName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40" placeholder="Nama sales" />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-label-sm font-semibold text-on-surface-variant">Alamat</span>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40 resize-none" placeholder="Alamat pengiriman" />
            </label>
            <label className="space-y-1.5 md:col-span-2">
              <span className="text-label-sm font-semibold text-on-surface-variant">Cabang Pengirim</span>
              <input value={senderBranch} onChange={(e) => setSenderBranch(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-surface-high border border-outline-variant/20 outline-none focus:ring-2 focus:ring-primary/40" placeholder="Cabang pengirim" />
            </label>
          </div>

          <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 transition-colors disabled:opacity-60">
            {isSubmitting ? <div className="w-4 h-4 rounded-full border-2 border-on-primary/30 border-t-on-primary animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {isSubmitting ? 'Menyimpan...' : 'Simpan Jadwal'}
          </button>
        </motion.form>

        <motion.div variants={itemAnim} className="glass-card rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-secondary" />
              <h3 className="font-display text-title-md font-bold text-on-surface">Riwayat Jadwal</h3>
            </div>
            <button type="button" onClick={() => void loadSchedules()} className="text-label-sm text-primary font-semibold inline-flex items-center gap-1 hover:underline">
              Muat ulang
            </button>
          </div>

          <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="text-body-sm text-on-surface-variant">Memuat data jadwal...</div>
            ) : items.length === 0 ? (
              <div className="text-body-sm text-on-surface-variant">Belum ada jadwal pengiriman.</div>
            ) : (
              items.map((item) => (
                <div key={item.id} className="rounded-2xl border border-outline-variant/15 bg-surface-high/40 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-on-surface">{item.customer_name}</div>
                      <div className="text-label-xs text-on-surface-variant">{item.item_name}</div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-primary/15 text-primary uppercase tracking-wider">
                      {item.payment_status}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-body-sm text-on-surface-variant">
                    <div className="inline-flex items-center gap-2"><User className="w-3.5 h-3.5" /> {item.sales_name}</div>
                    <div className="inline-flex items-center gap-2"><Package className="w-3.5 h-3.5" /> {item.sender_branch}</div>
                    <div className="sm:col-span-2 inline-flex items-start gap-2"><Shield className="w-3.5 h-3.5 mt-0.5" /> {item.address}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="text-label-xs text-on-surface-variant">
                      {item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-'}
                    </div>
                    <button type="button" onClick={() => void copyDeliverySummary(item)} className="inline-flex items-center gap-1.5 text-label-sm font-semibold text-primary hover:underline">
                      <Copy className="w-3.5 h-3.5" /> Salin
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default SalesDeliveryPage;
