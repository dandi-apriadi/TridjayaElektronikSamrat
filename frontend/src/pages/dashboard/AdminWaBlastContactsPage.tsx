import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Trash2, Search, Upload, Download,
  FileSpreadsheet, FileUp, Users, Edit2,
  Loader2, CheckCircle2, X, Database
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import Pagination from '../../components/ui/Pagination';
import { readApiError } from '../../utils/apiError';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

interface BlastContact {
  id: string;
  phone: string;
  name: string;
  labels: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

const AdminWaBlastContactsPage: React.FC = () => {
  const navigate = useNavigate();
  const { accessToken } = useAuthStore();
  const [contacts, setContacts] = useState<BlastContact[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editContact, setEditContact] = useState<BlastContact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchContacts();
  }, [currentPage, search]);

  const fetchContacts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        per_page: String(itemsPerPage),
      });
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/wa/blast-contacts?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat kontak'));
      const data = await res.json();
      setContacts(data.data?.items || []);
      setTotal(data.data?.total || 0);
    } catch (error) {
      toast.error('Gagal memuat kontak', error instanceof Error ? error.message : '');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Hapus kontak ini?')) return;
    try {
      const res = await fetch(`/api/wa/blast-contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus kontak'));
      toast.success('Kontak dihapus');
      fetchContacts();
    } catch (error) {
      toast.error('Gagal menghapus kontak', error instanceof Error ? error.message : 'Terjadi kesalahan');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Hapus ${selectedIds.size} kontak terpilih?`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/wa/blast-contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }).catch(() => {});
    }
    setSelectedIds(new Set());
    toast.success('Kontak dihapus');
    fetchContacts();
  };

  const handleUpload = async (file: File) => {
    const validExt = file.name.match(/\.(xlsx|xls|csv)$/i);
    if (!validExt) {
      toast.error('Format tidak didukung', 'Upload file .xlsx, .xls, atau .csv');
      return;
    }
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/wa/blast-contacts/upload-excel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Upload gagal'));
      const data = await res.json().catch(() => null);
      const ins = data?.data?.inserted || 0;
      const skip = data?.data?.skipped || 0;
      const inv = data?.data?.invalid?.length || 0;
      let msg = `${ins} kontak ditambahkan`;
      if (skip > 0) msg += `, ${skip} di-skip`;
      if (inv > 0) msg += `, ${inv} invalid`;
      toast.success('Import berhasil', msg);
      fetchContacts();
    } catch (error) {
      toast.error('Gagal upload', error instanceof Error ? error.message : '');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/templates/Format Template.xlsx';
    link.download = 'Format Template.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map(c => c.id)));
    }
  };

  const totalPages = Math.ceil(total / itemsPerPage);

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/admin/wa/campaigns')}
          className="p-2 hover:bg-surface-high rounded-xl transition-all text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-display font-bold text-on-surface flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Database Kontak Blast
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Simpan kontak pelanggan untuk digunakan di campaign WA Blast
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-outline-variant/30 rounded-xl hover:bg-surface-high transition-all text-on-surface-variant hover:text-on-surface"
          >
            <Download className="w-4 h-4" />
            Template
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 text-sm border border-primary/30 bg-primary/10 rounded-xl hover:bg-primary/20 transition-all text-primary cursor-pointer font-bold">
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Import Excel'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
              disabled={isUploading}
              className="hidden"
            />
          </label>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan transition-all font-bold text-sm"
          >
            <Plus className="w-4 h-4" />
            Tambah
          </button>
        </div>
      </div>

      {/* Stats */}
      <motion.div variants={iv} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface-variant">Total Kontak</p>
              <p className="text-2xl font-display font-bold text-on-surface">{total.toLocaleString('id-ID')}</p>
            </div>
            <Users className="w-5 h-5 text-primary/60" />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface-variant">Terpilih</p>
              <p className="text-2xl font-display font-bold text-on-surface">{selectedIds.size}</p>
            </div>
            <CheckCircle2 className="w-5 h-5 text-secondary/60" />
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 border border-outline-variant/10">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-on-surface-variant">Halaman</p>
              <p className="text-2xl font-display font-bold text-on-surface">{currentPage}/{totalPages || 1}</p>
            </div>
            <FileSpreadsheet className="w-5 h-5 text-on-surface-variant/40" />
          </div>
        </div>
      </motion.div>

      {/* Search & Actions */}
      <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 overflow-hidden">
        <div className="p-4 border-b border-outline-variant/10 flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-surface-container/30">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Cari nama atau nomor..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-3 py-2 bg-surface-high/50 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-on-surface-variant/50 text-sm"
            />
          </div>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 px-3 py-2 text-sm bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl hover:bg-red-500/20 transition-all font-bold"
            >
              <Trash2 className="w-4 h-4" />
              Hapus ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-container/50 border-b border-outline-variant/10">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={contacts.length > 0 && selectedIds.size === contacts.length}
                    onChange={toggleSelectAll}
                    className="rounded border-outline-variant/50"
                  />
                </th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Nomor</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Nama</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Label</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Ditambahkan</th>
                <th className="px-4 py-3 text-left font-display font-bold text-on-surface-variant uppercase tracking-wider text-[11px]">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && contacts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-on-surface-variant">Belum ada kontak. Import dari Excel atau tambah manual.</td></tr>
              ) : (
                contacts.map(c => (
                  <tr key={c.id} className="border-b border-outline-variant/5 hover:bg-surface-high/20 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="rounded border-outline-variant/50"
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-on-surface">{c.phone}</td>
                    <td className="px-4 py-3 text-on-surface font-medium">{c.name || '-'}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-xs">{c.labels || '-'}</td>
                    <td className="px-4 py-3 text-on-surface-variant text-[11px]">{new Date(c.created_at).toLocaleDateString('id-ID')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditContact(c)} className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t border-outline-variant/10 bg-surface-container/30">
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </motion.div>

      {/* Upload Drop Zone */}
      <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-6">
        <h3 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-primary" />
          Import dari Excel / CSV
        </h3>
        <div className="flex items-center gap-4 mb-3">
          <div className="overflow-x-auto flex-1">
            <table className="text-[10px] font-mono text-on-surface-variant w-full max-w-sm">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left p-1.5 text-primary font-bold">No</th>
                  <th className="text-left p-1.5 text-primary font-bold">Nama</th>
                  <th className="text-left p-1.5 text-primary font-bold">Wa</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="p-1.5">1</td><td className="p-1.5">Budi Santoso</td><td className="p-1.5">628123456789</td></tr>
                <tr><td className="p-1.5">2</td><td className="p-1.5">Andi Wijaya</td><td className="p-1.5">628987654321</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onDragOver={e => e.preventDefault()}
          className="border-2 border-dashed border-outline-variant/30 rounded-xl p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <FileUp className="w-8 h-8 text-on-surface-variant/20 mx-auto mb-2 group-hover:text-primary transition-colors" />
          <p className="text-xs text-on-surface-variant mb-2">Drag & drop file atau klik untuk upload</p>
          <label className="inline-block">
            <span className="text-primary font-bold px-5 py-2 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer text-sm hover:bg-primary/20 transition-all">
              {isUploading ? 'Mengupload...' : 'Pilih File'}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); e.target.value = ''; }}
              disabled={isUploading}
              className="hidden"
            />
          </label>
          <p className="text-[10px] text-on-surface-variant/40 mt-2">Format: .xlsx, .xls, .csv — Kolom wajib: Wa, Nama (No opsional)</p>
        </div>
      </motion.div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || editContact) && (
          <AddEditContactModal
            contact={editContact}
            onClose={() => { setShowAddModal(false); setEditContact(null); }}
            onSaved={() => { setShowAddModal(false); setEditContact(null); fetchContacts(); }}
            accessToken={accessToken}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Add/Edit Modal Component
const AddEditContactModal: React.FC<{
  contact: BlastContact | null;
  onClose: () => void;
  onSaved: () => void;
  accessToken: string | null;
}> = ({ contact, onClose, onSaved, accessToken }) => {
  const [phone, setPhone] = useState(contact?.phone || '');
  const [name, setName] = useState(contact?.name || '');
  const [labels, setLabels] = useState(contact?.labels || '');
  const [notes, setNotes] = useState(contact?.notes || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!phone.trim()) {
      toast.error('Nomor telepon wajib diisi');
      return;
    }
    setIsSaving(true);
    try {
      const url = contact ? `/api/wa/blast-contacts/${contact.id}` : '/api/wa/blast-contacts';
      const method = contact ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, name, labels, notes }),
      });
      if (!res.ok) {
        throw new Error(await readApiError(res, 'Gagal menyimpan'));
      }
      toast.success(contact ? 'Kontak diperbarui' : 'Kontak ditambahkan');
      onSaved();
    } catch (error) {
      toast.error('Gagal menyimpan kontak', error instanceof Error ? error.message : 'Terjadi kesalahan');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="glass-card rounded-2xl border border-outline-variant/20 p-6 w-full max-w-md space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-on-surface">
            {contact ? 'Edit Kontak' : 'Tambah Kontak'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-high rounded-lg text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nomor Telepon *</label>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="628123456789"
              className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Nama</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nama konsumen"
              className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Label</label>
            <input
              type="text"
              value={labels}
              onChange={e => setLabels(e.target.value)}
              placeholder="VIP, Pelanggan Baru, dll"
              className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-1">Catatan</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Catatan tambahan..."
              rows={2}
              className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          {isSaving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </motion.div>
    </motion.div>
  );
};

export default AdminWaBlastContactsPage;
