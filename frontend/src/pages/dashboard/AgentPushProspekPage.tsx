import React, { useState } from 'react';
import { Send, CheckCircle2, Clock, User, Phone, Package, MessageSquare, TrendingUp, AlertCircle, Search, ChevronDown } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { useAgentStore } from '../../store/useAgentStore';
import { useProductStore } from '../../store/useProductStore';
import { agentLeadSchema, getFirstZodIssue } from '../../validators/adminSchemas';
import { toast } from '../../store/useNotificationStore';
import type { Lead } from '../../store/useAgentStore';

const products = ['Goda GD120', 'Winfly W200', 'Smart TV OLED 55"', 'Sofa Premium L', 'Sofa Flexi 2', 'AC Inverter 1.5PK', 'Lainnya'];
const sources = ['WhatsApp', 'Instagram', 'Facebook', 'Referral Teman', 'Walk-in', 'Blog/Website', 'Lainnya'];

const AgentPushProspekPage: React.FC = () => {
  const { leads, stats, createLead, fetchLeads, fetchStats } = useAgentStore();
  const { products: storeProducts, fetchProducts } = useProductStore();
  const [form, setForm] = useState({
    name: '',
    phone: '',
    product: '',
    source: '',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [productSearch, setProductSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const itemsPerPage = 6;

  React.useEffect(() => {
    fetchLeads();
    fetchStats();
    fetchProducts();
  }, [fetchLeads, fetchStats, fetchProducts]);

  // Combined product list
  const allProductsList = React.useMemo(() => {
    const fromStore = storeProducts.map(p => p.name);
    return [...new Set([...fromStore, ...products])];
  }, [storeProducts]);

  const filteredProducts = allProductsList.filter(p => 
    p.toLowerCase().includes(productSearch.toLowerCase())
  );

  const totalPages = Math.ceil(leads.length / itemsPerPage);
  const paginated = leads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const monthlyLeads = leads.filter((lead) => lead.createdAt.slice(0, 7) === currentMonthKey);
  const monthlyClosedWon = monthlyLeads.filter((lead) => lead.status === 'Closed Won').length;
  const monthlyTarget = Math.max(30, Math.round((stats?.salesCount ?? 0) * 1.25));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setValidationError(null);

    // Validate with Zod schema
    const validation = agentLeadSchema.safeParse({
      customerName: form.name,
      phoneNumber: form.phone,
      interestedProduct: form.product,
      source: form.source as any,
      notes: form.notes,
      status: 'Follow Up'
    });

    if (!validation.success) {
      const errorMessage = getFirstZodIssue(validation.error);
      setValidationError(errorMessage);
      toast.error('Validasi Gagal', errorMessage);
      return;
    }

    const success = await createLead({
      customerName: form.name,
      phoneNumber: form.phone,
      interestedProduct: form.product,
      notes: form.notes + (form.source ? ` (Source: ${form.source})` : ''),
      status: 'Follow Up'
    });

    if (success) {
      setForm({ name: '', phone: '', product: '', source: '', notes: '' });
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }
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
          <div className="font-display text-headline-sm text-primary font-bold mt-1">{leads.length}</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="text-label-sm text-on-surface-variant">Target Bulanan</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">{monthlyTarget} Prospek</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1 text-label-sm text-on-surface-variant"><TrendingUp className="w-3.5 h-3.5" /> Konversi Bulan Ini</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">{monthlyClosedWon} / {monthlyLeads.length || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
          <h4 className="font-display text-title-sm font-bold text-on-surface mb-5">Form Input Prospek</h4>
          {validationError && (
            <div className="mb-4 p-3 rounded-lg bg-error/15 border border-error/30 flex items-start gap-2 text-error text-body-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>{validationError}</div>
            </div>
          )}
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
                className="w-full px-3 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50 transition-all"
              />
            </div>

            <div>
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <Phone className="w-3.5 h-3.5" /> No. HP / WhatsApp *
              </label>
              <input
                type="tel"
                placeholder="Contoh: 085161542103"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg outline-none focus:ring-2 focus:ring-primary/40 font-body text-body-sm placeholder:text-on-surface-variant/50 transition-all"
              />
            </div>

            <div className="relative">
              <label className="text-label-sm font-semibold text-on-surface-variant flex items-center gap-1 mb-1.5">
                <Package className="w-3.5 h-3.5" /> Produk yang Diminati *
              </label>
              
              <div 
                className="relative cursor-pointer"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <div className={`w-full px-3 py-2.5 bg-surface-high border border-outline-variant/20 rounded-lg flex items-center justify-between transition-all ${isDropdownOpen ? 'ring-2 ring-primary/40' : ''}`}>
                  <span className={`text-body-sm ${form.product ? 'text-on-surface' : 'text-on-surface-variant/50'}`}>
                    {form.product || '-- Pilih Produk --'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-surface-high border border-outline-variant/20 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 border-b border-outline-variant/10">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/50" />
                      <input
                        type="text"
                        autoFocus
                        placeholder="Cari produk..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full pl-9 pr-3 py-2 bg-surface-low border border-outline-variant/10 rounded-lg outline-none text-body-sm focus:ring-1 focus:ring-primary/30 transition-all"
                      />
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, product: p }));
                            setIsDropdownOpen(false);
                            setProductSearch('');
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg text-body-sm transition-colors flex items-center justify-between hover:bg-primary/10 hover:text-primary ${form.product === p ? 'bg-primary/20 text-primary font-bold' : 'text-on-surface'}`}
                        >
                          {p}
                          {form.product === p && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-center">
                        <p className="text-label-sm text-on-surface-variant mb-2">Produk tidak ditemukan</p>
                        <button
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, product: productSearch }));
                            setIsDropdownOpen(false);
                            setProductSearch('');
                          }}
                          className="text-label-sm font-bold text-primary hover:underline"
                        >
                          Gunakan "{productSearch}" sebagai input manual
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Close dropdown on outside click - invisible overlay */}
              {isDropdownOpen && (
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsDropdownOpen(false)}
                />
              )}
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
            {paginated.map((p: Lead) => (
              <div key={p.id} className="p-3 rounded-lg border border-outline-variant/10 bg-surface-low/30 hover:bg-surface-high/40 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-on-surface text-body-sm">{p.customerName}</div>
                  <span className={`px-2 py-0.5 rounded-md text-label-xs font-bold inline-flex items-center gap-1 ${p.status === 'Closed Won' ? 'bg-secondary/15 text-secondary' : 'bg-tertiary/15 text-tertiary'}`}>
                    {p.status === 'Closed Won' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {p.status}
                  </span>
                </div>
                <div className="text-label-xs text-on-surface-variant">{p.phoneNumber} · {p.interestedProduct}</div>
                <div className="text-label-xs text-on-surface-variant">{p.createdAt}</div>
                {p.notes && <div className="mt-1.5 text-label-xs italic text-on-surface-variant/70">"{p.notes}"</div>}
              </div>
            ))}
            {leads.length === 0 && (
              <p className="text-body-sm text-on-surface-variant text-center py-6">Belum ada prospek yang di-push hari ini.</p>
            )}
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => setCurrentPage(page)}
            className="mt-6 border-t border-outline-variant/10"
          />
        </div>
      </div>
    </div>
  );
};

export default AgentPushProspekPage;
