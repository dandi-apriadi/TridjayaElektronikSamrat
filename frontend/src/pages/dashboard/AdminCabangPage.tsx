import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Edit2, Loader2, MapPin, Plus, Trash2, X } from 'lucide-react';
import { useCabangStore } from '../../store/useCabangStore';
import type { CabangItem } from '../../types';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

type CabangFormState = {
  nama: string;
  alamat: string;
  kota: string;
  telepon: string;
  isActive: boolean;
};

const emptyForm: CabangFormState = {
  nama: '',
  alamat: '',
  kota: '',
  telepon: '',
  isActive: true,
};

const AdminCabangPage: React.FC = () => {
  const cabangList = useCabangStore((state) => state.cabang);
  const isLoading = useCabangStore((state) => state.isLoading);
  const error = useCabangStore((state) => state.error);
  const fetchCabang = useCabangStore((state) => state.fetchCabang);
  const createCabang = useCabangStore((state) => state.createCabang);
  const updateCabang = useCabangStore((state) => state.updateCabang);
  const deleteCabang = useCabangStore((state) => state.deleteCabang);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CabangFormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void fetchCabang();
  }, [fetchCabang]);

  const totalKaryawan = useMemo(() => cabangList.reduce((sum, cabang) => sum + cabang.jumlahKaryawan, 0), [cabangList]);
  const activeCabang = useMemo(() => cabangList.filter((cabang) => cabang.isActive).length, [cabangList]);

  const openCreateForm = () => {
    setEditId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (cabang: CabangItem) => {
    setEditId(cabang.id);
    setFormData({
      nama: cabang.nama,
      alamat: cabang.alamat,
      kota: cabang.kota,
      telepon: cabang.telepon,
      isActive: cabang.isActive,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const payload = {
      nama: formData.nama.trim(),
      alamat: formData.alamat.trim(),
      kota: formData.kota.trim(),
      telepon: formData.telepon.trim(),
      isActive: formData.isActive,
    };

    const success = editId
      ? await updateCabang(editId, payload)
      : await createCabang(payload);

    setIsSubmitting(false);
    if (success) {
      closeForm();
    }
  };

  const handleDelete = async (cab: CabangItem) => {
    const confirmed = window.confirm(`Hapus cabang ${cab.nama}?`);
    if (!confirmed) return;
    await deleteCabang(cab.id);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.section variants={itemVariants} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-headline-sm font-bold text-on-surface">Cabang management</h1>
          <p className="mt-1 max-w-2xl text-body-sm text-on-surface-variant">Data cabang diambil langsung dari backend, jadi input ulang bisa dilakukan tanpa data dummy yang mengganggu.</p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Tambah cabang
        </button>
      </motion.section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/10 bg-surface-high/70 p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total cabang</div>
          <div className="mt-2 font-display text-headline-sm font-bold text-primary tabular-nums">{cabangList.length}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/10 bg-surface-high/70 p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Cabang aktif</div>
          <div className="mt-2 font-display text-headline-sm font-bold text-secondary tabular-nums">{activeCabang}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="rounded-xl border border-outline-variant/10 bg-surface-high/70 p-5">
          <div className="text-label-xs uppercase tracking-widest text-on-surface-variant">Total karyawan</div>
          <div className="mt-2 font-display text-headline-sm font-bold text-on-surface tabular-nums">{totalKaryawan}</div>
        </motion.div>
      </section>

      {showForm && (
        <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/10 bg-surface-high/60 p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface">{editId ? 'Edit cabang' : 'Tambah cabang baru'}</h2>
              <p className="mt-1 text-label-sm text-on-surface-variant">Simpan data cabang langsung ke backend.</p>
            </div>
            <button type="button" onClick={closeForm} className="rounded-lg p-2 text-on-surface-variant transition hover:bg-on-surface/5 hover:text-on-surface">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Nama cabang *</span>
              <input
                value={formData.nama}
                onChange={(event) => setFormData((current) => ({ ...current, nama: event.target.value }))}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-body-md outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                placeholder="Samrat"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-label-sm font-semibold text-on-surface-variant">Kota *</span>
              <input
                value={formData.kota}
                onChange={(event) => setFormData((current) => ({ ...current, kota: event.target.value }))}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-body-md outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                placeholder="Manado"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-label-sm font-semibold text-on-surface-variant">Alamat</span>
              <input
                value={formData.alamat}
                onChange={(event) => setFormData((current) => ({ ...current, alamat: event.target.value }))}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-body-md outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                placeholder="Jl. Sam Ratulangi No. 7"
              />
            </label>

            <label className="space-y-1.5 sm:col-span-2">
              <span className="text-label-sm font-semibold text-on-surface-variant">Telepon</span>
              <input
                value={formData.telepon}
                onChange={(event) => setFormData((current) => ({ ...current, telepon: event.target.value }))}
                className="w-full rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 text-body-md outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                placeholder="0431-123456"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface px-4 py-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-outline-variant/40 text-primary focus:ring-primary/40"
              />
              <span className="text-label-sm font-semibold text-on-surface-variant">Cabang aktif</span>
            </label>

            <div className="flex gap-3 sm:col-span-2">
              <button
                type="submit"
                disabled={isSubmitting || isLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-label-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editId ? 'Simpan perubahan' : 'Tambah cabang'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-xl bg-surface-high px-5 py-2.5 text-label-sm font-semibold text-on-surface transition-colors hover:bg-surface-high/80"
              >
                Batal
              </button>
            </div>
          </form>
        </motion.section>
      )}

      {error ? (
        <motion.div variants={itemVariants} className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-body-sm text-error">
          {error}
        </motion.div>
      ) : null}

      <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/10 bg-surface-high/60 p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-title-md font-bold text-on-surface">Daftar cabang</h2>
            <p className="mt-1 text-label-sm text-on-surface-variant">Semua perubahan akan disimpan ke backend dan langsung dirender ulang dari server.</p>
          </div>
          <button
            type="button"
            onClick={() => void fetchCabang(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-label-sm font-semibold text-on-surface transition hover:bg-surface-high"
          >
            <Loader2 className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-outline-variant/10">
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Cabang</th>
                <th className="px-4 py-3 text-left text-label-xs uppercase tracking-widest text-on-surface-variant">Alamat</th>
                <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Karyawan</th>
                <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Status</th>
                <th className="px-4 py-3 text-center text-label-xs uppercase tracking-widest text-on-surface-variant">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && cabangList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-body-sm text-on-surface-variant">
                    Memuat data cabang...
                  </td>
                </tr>
              ) : cabangList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <div className="text-body-sm font-semibold text-on-surface">Belum ada data cabang</div>
                    <div className="mt-1 text-label-sm text-on-surface-variant">Input cabang dari awal akan langsung tersimpan ke backend.</div>
                  </td>
                </tr>
              ) : (
                cabangList.map((cab) => (
                  <tr key={cab.id} className="border-b border-outline-variant/5 transition hover:bg-surface-high/60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <div>
                          <div className="text-body-sm font-semibold text-on-surface">{cab.nama}</div>
                          <div className="flex items-center gap-1 text-label-xs text-on-surface-variant">
                            <MapPin className="h-3 w-3" />
                            {cab.kota}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-body-sm text-on-surface-variant">{cab.alamat || '-'}</td>
                    <td className="px-4 py-3 text-center text-body-sm font-semibold text-on-surface tabular-nums">{cab.jumlahKaryawan}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-label-xs font-semibold ${cab.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                        {cab.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(cab)}
                          className="rounded-lg p-2 text-on-surface-variant transition hover:bg-on-surface/5 hover:text-primary"
                          title="Edit cabang"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(cab)}
                          className="rounded-lg p-2 text-on-surface-variant transition hover:bg-on-surface/5 hover:text-error"
                          title="Hapus cabang"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.section>
    </motion.div>
  );
};

export default AdminCabangPage;
