import React, { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Pencil, Trash2, Link as LinkIcon, Building2, Upload, GripVertical, ArrowDown, ArrowUp } from 'lucide-react';
import Pagination from '../../components/ui/Pagination';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { usePartnerStore } from '../../store/usePartnerStore';
import type { PartnerItem } from '../../types';
import { getImageUrl } from '../../utils/apiClient';
import { toast } from '../../store/useNotificationStore';

type PartnerForm = {
  name: string;
  logoUrl: string;
  logoFile?: File;
  websiteUrl: string;
  sortOrder: number;
  isActive: boolean;
};

const initialForm: PartnerForm = {
  name: '',
  logoUrl: '',
  websiteUrl: '',
  sortOrder: 0,
  isActive: true,
};

const AdminPartnersPage: React.FC = () => {
  const { partners, isLoading, error, fetchPartners, createPartner, updatePartner, updatePartnerOrder, deletePartner } = usePartnerStore();
  const [form, setForm] = useState<PartnerForm>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isUploadingLogo] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    fetchPartners(true, true);
  }, [fetchPartners]);

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });
  }, [partners]);

  const totalPages = Math.ceil(sortedPartners.length / itemsPerPage);
  const paginated = sortedPartners.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Set default sort order for new partner
  useEffect(() => {
    if (!editingId && partners.length > 0) {
      const maxOrder = Math.max(...partners.map(p => p.sortOrder), 0);
      setForm(prev => ({ ...prev, sortOrder: maxOrder + 10 }));
    } else if (!editingId && partners.length === 0) {
      setForm(prev => ({ ...prev, sortOrder: 10 }));
    }
  }, [partners, editingId]);

  const handleEdit = (partner: PartnerItem) => {
    setEditingId(partner.id);
    setForm({
      name: partner.name,
      logoUrl: partner.logoUrl,
      websiteUrl: partner.websiteUrl || '',
      sortOrder: partner.sortOrder,
      isActive: partner.isActive,
    });
    setSubmitError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm);
    setSubmitError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!form.name.trim() || (!form.logoUrl.trim() && !form.logoFile)) {
      setSubmitError('Nama partner dan logo wajib diisi.');
      return;
    }

    const payload = {
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim(),
      logo: form.logoFile, // This will be handled as multipart
      websiteUrl: form.websiteUrl.trim() || null,
      isActive: form.isActive,
    };

    const success = editingId
      ? await updatePartner(editingId, payload)
      : await createPartner(payload);

    if (!success) {
      setSubmitError('Gagal menyimpan partner. Silakan cek kembali data Anda.');
      return;
    }

    resetForm();
    await fetchPartners(true, true);
  };

  const handleLogoUpload = (file: File) => {
    setSubmitError(null);
    // Create local preview URL
    const previewUrl = URL.createObjectURL(file);
    setForm((prev) => ({ 
      ...prev, 
      logoUrl: previewUrl,
      logoFile: file 
    }));
  };

  const applyPartnerOrder = async (items: PartnerItem[], successMessage = 'Urutan partner diperbarui') => {
    const updates = items.map((item, index) => ({
      id: item.id,
      sortOrder: (index + 1) * 10,
    }));

    const success = await updatePartnerOrder(updates);
    if (success) {
      toast.success(successMessage);
    } else {
      toast.error('Gagal mengurutkan partner');
    }
  };

  const movePartner = async (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= sortedPartners.length) return;

    const reordered = [...sortedPartners];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(nextIndex, 0, moved);
    await applyPartnerOrder(reordered);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('Hapus partner ini?');
    if (!confirmed) return;

    await deletePartner(id);
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const items = Array.from(sortedPartners);
    const pageOffset = (currentPage - 1) * itemsPerPage;
    const sourceIndex = pageOffset + result.source.index;
    const destinationIndex = pageOffset + result.destination.index;
    const [reorderedItem] = items.splice(sourceIndex, 1);
    items.splice(destinationIndex, 0, reorderedItem);

    await applyPartnerOrder(items);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" /> Manajemen Partner Brand
          </h3>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Tambahkan logo partner untuk ditampilkan otomatis di halaman publik.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <span className="text-label-sm text-on-surface-variant">Nama Partner</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20 focus:border-primary/40 focus:outline-none"
              placeholder="Contoh: GODA"
              required
            />
          </label>

          <label className="space-y-1">
            <span className="text-label-sm text-on-surface-variant">Logo Partner</span>
            <div className="space-y-2">
              <label className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20 hover:border-primary/40 cursor-pointer flex items-center justify-between gap-3">
                <span className="text-body-sm text-on-surface-variant inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  {isUploadingLogo ? 'Mengunggah logo...' : 'Pilih file logo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={isUploadingLogo}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleLogoUpload(file);
                    }
                    e.currentTarget.value = '';
                  }}
                />
              </label>

              {form.logoUrl && (
                <div className="flex items-center gap-3 p-2 rounded-lg border border-outline-variant/10 bg-surface-high">
                  <div className="w-16 h-12 rounded-md bg-surface border border-outline-variant/10 p-2 flex items-center justify-center">
                    <img src={getImageUrl(form.logoUrl)} alt="Preview logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <p className="text-label-sm text-on-surface-variant break-all">{form.logoUrl}</p>
                </div>
              )}
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-label-sm text-on-surface-variant">Website Partner (opsional)</span>
            <input
              type="url"
              value={form.websiteUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20 focus:border-primary/40 focus:outline-none"
              placeholder="https://partner.com"
            />
          </label>

          <div className="grid grid-cols-1 gap-3">
            <label className="space-y-1">
              <span className="text-label-sm text-on-surface-variant">Status</span>
              <select
                value={form.isActive ? 'active' : 'inactive'}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'active' }))}
                className="w-full px-3 py-2 rounded-lg bg-surface-high border border-outline-variant/20 focus:border-primary/40 focus:outline-none"
              >
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </label>
          </div>
        </div>

        {submitError && <p className="text-error text-body-sm">{submitError}</p>}
        {error && <p className="text-error text-body-sm">{error}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-primary/20 text-primary font-semibold inline-flex items-center gap-2 hover:bg-primary/30 transition-colors"
          >
            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? 'Simpan Perubahan' : 'Tambah Partner'}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 rounded-lg bg-surface-high text-on-surface-variant font-semibold hover:text-on-surface transition-colors"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="glass-card rounded-xl p-6">
        {isLoading && partners.length === 0 && <div className="text-on-surface-variant animate-pulse">Memuat partner...</div>}

        {!isLoading && sortedPartners.length === 0 && (
          <div className="text-center py-10 text-on-surface-variant">Belum ada data partner. Tambahkan partner pertama Anda.</div>
        )}

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="partners">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {paginated.map((partner, index) => (
                  <Draggable key={partner.id} draggableId={partner.id} index={index}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={`p-4 rounded-lg border border-outline-variant/10 flex flex-col md:flex-row md:items-center gap-3 justify-between bg-surface-container ${
                          snapshot.isDragging ? 'shadow-neon-cyan/40 border-primary/40 ring-1 ring-primary/40' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div {...provided.dragHandleProps} className="text-on-surface-variant hover:text-primary transition-colors cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <div className="w-16 h-12 rounded-md bg-surface-high border border-outline-variant/10 p-2 flex items-center justify-center shrink-0">
                            <img src={getImageUrl(partner.logoUrl)} alt={partner.name} className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-on-surface truncate">{partner.name}</p>
                            <div className="text-label-sm text-on-surface-variant flex items-center gap-2">
                              <span>Urutan: {partner.sortOrder}</span>
                              <span className={`px-2 py-0.5 rounded ${partner.isActive ? 'bg-secondary/15 text-secondary' : 'bg-surface-high text-on-surface-variant'}`}>
                                {partner.isActive ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </div>
                            {partner.websiteUrl && (
                              <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="text-primary text-label-sm inline-flex items-center gap-1 mt-1">
                                <LinkIcon className="w-3.5 h-3.5" /> {partner.websiteUrl}
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                          <button
                            type="button"
                            onClick={() => movePartner((currentPage - 1) * itemsPerPage + index, -1)}
                            disabled={(currentPage - 1) * itemsPerPage + index === 0 || isLoading}
                            className="p-2 rounded-md bg-surface-high text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Naikkan ${partner.name}`}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePartner((currentPage - 1) * itemsPerPage + index, 1)}
                            disabled={(currentPage - 1) * itemsPerPage + index >= sortedPartners.length - 1 || isLoading}
                            className="p-2 rounded-md bg-surface-high text-on-surface-variant hover:text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
                            aria-label={`Turunkan ${partner.name}`}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(partner)}
                            className="px-3 py-1.5 rounded-md bg-surface-high text-on-surface-variant text-label-sm font-semibold inline-flex items-center gap-1 hover:text-on-surface"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(partner.id)}
                            className="px-3 py-1.5 rounded-md bg-error/15 text-error text-label-sm font-semibold inline-flex items-center gap-1 hover:bg-error/25"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => setCurrentPage(page)}
          className="mt-6 border-t border-outline-variant/10"
        />
      </div>
    </div>
  );
};

export default AdminPartnersPage;
