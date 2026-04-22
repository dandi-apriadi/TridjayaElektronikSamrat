import React, { useState } from 'react';
import { Send, CheckCircle2, Clock, User, Phone, Package, MessageSquare, TrendingUp } from 'lucide-react';

const defaultForm = {
  name: '',
  phone: '',
  product: '',
  source: '',
  notes: '',
};

type ProspectEntry = typeof defaultForm & { id: string; submittedAt: string; status: string };

const initialPushed: ProspectEntry[] = [
  { id: 'P-0041', name: 'Andi Wijaya', phone: '0812-3344-5566', product: 'Goda GD120', source: 'WhatsApp', notes: 'Tertarik DP mulai 1.25jt', submittedAt: '10:30', status: 'Diproses' },
  { id: 'P-0040', name: 'Dewi Lestari', phone: '0822-9988-7766', product: 'Smart TV OLED 55"', source: 'Instagram', notes: 'Mau cicilan 12 bulan', submittedAt: '08:15', status: 'Menunggu' },
];

const products = ['Goda GD120', 'Winfly W200', 'Smart TV OLED 55"', 'Sofa Premium L', 'Sofa Flexi 2', 'AC Inverter 1.5PK', 'Lainnya'];
const sources = ['WhatsApp', 'Instagram', 'Facebook', 'Referral Teman', 'Walk-in', 'Blog/Website', 'Lainnya'];

const AgentPushProspekPage: React.FC = () => {
  const [form, setForm] = useState(defaultForm);
  const [pushed, setPushed] = useState<ProspectEntry[]>(initialPushed);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<typeof defaultForm>>({});

  const validate = () => {
    const e: Partial<typeof defaultForm> = {};
    if (!form.name.trim()) e.name = 'Nama wajib diisi';
    if (!form.phone.trim()) e.phone = 'No. HP wajib diisi';
    if (!form.product) e.product = 'Pilih produk';
    if (!form.source) e.source = 'Pilih sumber';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    const newEntry: ProspectEntry = {
      ...form,
      id: `P-${(1000 + pushed.length + 1).toString().padStart(4, '0')}`,
      submittedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      status: 'Menunggu',
    };
    setPushed((prev) => [newEntry, ...prev]);
    setForm(defaultForm);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" /> Push Prospek Baru
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Catat dan kirimkan prospek pelanggan baru ke sistem Tridjaya untuk ditindaklanjuti tim sales.</p>
      </div>

      {/* KPI Mini */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Push Hari Ini</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{pushed.length}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Target Bulanan</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">30 Prospek</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant"><TrendingUp className="w-3.5 h-3.5" /> Konversi Bulan Ini</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">12 / 28</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
          <h4 className="font-display text-title-sm font-bold text-on-surface mb-5">Form Input Prospek</h4>
          {submitted && (
            <div className="mb-4 p-3 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center gap-2 text-secondary font-semibold text-body-sm">
              <CheckCircle2 className="w-5 h-5" /> Prospek berhasil dikirim ke sistem!
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <User className="w-3.5 h-3.5" /> Nama Calon Pembeli *
              </label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                className={`w-full px-3 py-2.5 bg-surface-high border rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50 transition-all ${errors.name ? 'border-error' : 'border-outline-variant/20'}`}
              />
              {errors.name && <p className="text-error text-label-xs mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <Phone className="w-3.5 h-3.5" /> No. HP / WhatsApp *
              </label>
              <input
                type="tel"
                placeholder="Contoh: 0812-3456-7890"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={`w-full px-3 py-2.5 bg-surface-high border rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50 transition-all ${errors.phone ? 'border-error' : 'border-outline-variant/20'}`}
              />
              {errors.phone && <p className="text-error text-label-xs mt-1">{errors.phone}</p>}
            </div>

            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <Package className="w-3.5 h-3.5" /> Produk yang Diminati *
              </label>
              <select
                value={form.product}
                onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}
                className={`w-full px-3 py-2.5 bg-surface-high border rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm text-on-surface transition-all ${errors.product ? 'border-error' : 'border-outline-variant/20'}`}
              >
                <option value="">-- Pilih Produk --</option>
                {products.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              {errors.product && <p className="text-error text-label-xs mt-1">{errors.product}</p>}
            </div>

            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant mb-1.5 block">Sumber Prospek *</label>
              <div className="flex flex-wrap gap-2">
                {sources.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, source: s }))}
                    className={`px-3 py-1.5 rounded-md text-label-sm font-semibold transition-all ${form.source === s ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-surface-high text-on-surface-variant border border-outline-variant/10 hover:border-primary/20'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errors.source && <p className="text-error text-label-xs mt-1">{errors.source}</p>}
            </div>

            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Catatan Tambahan
              </label>
              <textarea
                rows={3}
                placeholder="Informasi tambahan, misalnya: tertarik cicilan, tanya stok, dll."
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50 resize-none transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-primary text-on-primary font-bold font-display text-body-md inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Send className="w-5 h-5" /> Kirim Prospek
            </button>
          </form>
        </div>

        {/* Recent Pushes */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <h4 className="font-display text-title-sm font-bold text-on-surface">Prospek Hari Ini</h4>
          </div>
          <div className="space-y-3">
            {pushed.map((p) => (
              <div key={p.id} className="p-3 rounded-lg border border-outline-variant/10 bg-surface-low/30 hover:bg-surface-high/40 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-on-surface text-body-sm">{p.name}</div>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${p.status === 'Diproses' ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary'}`}>
                    {p.status === 'Diproses' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {p.status}
                  </span>
                </div>
                <div className="text-label-xs text-on-surface-variant">{p.phone} · {p.product}</div>
                <div className="text-label-xs text-on-surface-variant">Sumber: {p.source} · {p.submittedAt}</div>
                {p.notes && <div className="mt-1.5 text-label-xs italic text-on-surface-variant/70">"{p.notes}"</div>}
              </div>
            ))}
            {pushed.length === 0 && (
              <p className="text-body-sm text-on-surface-variant text-center py-6">Belum ada prospek yang di-push hari ini.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPushProspekPage;
