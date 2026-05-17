import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Layers3,
  Plus,
  Search,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { usePicRaportStore } from '../../store/picRaportStore';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };
const itemVariants = { hidden: { y: 10, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const PicRaportMasterPage: React.FC = () => {
  const divisions = usePicRaportStore((state) => state.divisions);
  const addDivision = usePicRaportStore((state) => state.addDivision);
  const updateDivision = usePicRaportStore((state) => state.updateDivision);
  const deleteDivision = usePicRaportStore((state) => state.deleteDivision);
  const moveDivision = usePicRaportStore((state) => state.moveDivision);
  const addJobdesk = usePicRaportStore((state) => state.addJobdesk);
  const updateJobdesk = usePicRaportStore((state) => state.updateJobdesk);
  const deleteJobdesk = usePicRaportStore((state) => state.deleteJobdesk);
  const moveJobdesk = usePicRaportStore((state) => state.moveJobdesk);
  const fetchDivisions = usePicRaportStore((state) => state.fetchDivisions);
  const masterError = usePicRaportStore((state) => state.error);
  const [search, setSearch] = useState('');
  const [newDivision, setNewDivision] = useState('');
  const [activeDivisionId, setActiveDivisionId] = useState(divisions[0]?.id || '');
  const [jobdeskDrafts, setJobdeskDrafts] = useState<Record<string, string>>({});
  const [editingDivisionName, setEditingDivisionName] = useState('');
  const [editingJobdeskIndex, setEditingJobdeskIndex] = useState<number | null>(null);
  const [editingJobdeskText, setEditingJobdeskText] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const filteredDivisions = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return divisions;
    return divisions.filter((division) =>
      `${division.posisi} ${division.jobdesks.join(' ')}`.toLowerCase().includes(value)
    );
  }, [divisions, search]);

  const activeDivision =
    divisions.find((division) => division.id === activeDivisionId) ||
    filteredDivisions[0] ||
    divisions[0];
  const totalJobdesks = divisions.reduce((sum, division) => sum + division.jobdesks.length, 0);

  useEffect(() => {
    fetchDivisions();
  }, [fetchDivisions]);

  useEffect(() => {
    if (!activeDivision && divisions[0]) {
      setActiveDivisionId(divisions[0].id);
    }
    if (activeDivision && search && !filteredDivisions.some((division) => division.id === activeDivision.id)) {
      setActiveDivisionId(filteredDivisions[0]?.id || divisions[0]?.id || '');
    }
  }, [activeDivision, divisions, filteredDivisions, search]);

  useEffect(() => {
    if (!activeDivision) return;
    setEditingDivisionName(activeDivision.posisi);
    setEditingJobdeskIndex(null);
    setEditingJobdeskText('');
  }, [activeDivision?.id, activeDivision?.posisi]);

  const flashSaved = (message: string) => {
    setSavedMessage(message);
    window.setTimeout(() => setSavedMessage(''), 2200);
  };

  const handleAddDivision = () => {
    const trimmed = newDivision.trim();
    if (!trimmed) return;
    addDivision(trimmed);
    setNewDivision('');
    flashSaved('Divisi tersimpan.');
  };

  const handleAddJobdesk = (divisionId: string) => {
    const draft = jobdeskDrafts[divisionId] || '';
    if (!draft.trim()) return;
    addJobdesk(divisionId, draft);
    setJobdeskDrafts((prev) => ({ ...prev, [divisionId]: '' }));
    flashSaved('Jobdesk ditambahkan.');
  };

  const handleUpdateDivision = () => {
    if (!activeDivision) return;
    updateDivision(activeDivision.id, editingDivisionName);
    flashSaved('Divisi diperbarui.');
  };

  const handleDeleteDivision = (divisionId: string) => {
    if (!window.confirm('Hapus divisi ini beserta semua jobdesk di dalamnya?')) return;
    deleteDivision(divisionId);
    setActiveDivisionId(divisions.find((division) => division.id !== divisionId)?.id || '');
    flashSaved('Divisi dihapus.');
  };

  const startEditJobdesk = (index: number, text: string) => {
    setEditingJobdeskIndex(index);
    setEditingJobdeskText(text);
  };

  const handleUpdateJobdesk = () => {
    if (!activeDivision || editingJobdeskIndex === null) return;
    updateJobdesk(activeDivision.id, editingJobdeskIndex, editingJobdeskText);
    setEditingJobdeskIndex(null);
    setEditingJobdeskText('');
    flashSaved('Jobdesk diperbarui.');
  };

  const handleDeleteJobdesk = (index: number) => {
    if (!activeDivision) return;
    if (!window.confirm('Hapus jobdesk ini?')) return;
    deleteJobdesk(activeDivision.id, index);
    flashSaved('Jobdesk dihapus.');
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      <motion.div variants={itemVariants} className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link to="/dashboard/pic-raport" className="mb-4 inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-sm font-bold text-on-surface-variant transition hover:text-primary">
            <ArrowLeft className="h-4 w-4" />
            Review
          </Link>
          <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Master Divisi & Jobdesk</p>
          <h1 className="mt-1 text-headline-sm font-black text-on-surface">Struktur penilaian raport</h1>
          <p className="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
            {divisions.length} divisi aktif dengan {totalJobdesks} butir jobdesk.
          </p>
        </div>
        {savedMessage && (
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-secondary/20 bg-secondary/10 px-3 text-label-sm font-bold text-secondary">
            <CheckCircle2 className="h-4 w-4" />
            {savedMessage}
          </div>
        )}
        {masterError && (
          <div className="inline-flex h-10 items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-3 text-label-sm font-bold text-error">
            {masterError}
          </div>
        )}
      </motion.div>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Divisi', value: divisions.length, icon: Layers3, tone: 'text-primary' },
          { label: 'Jobdesk', value: totalJobdesks, icon: ClipboardList, tone: 'text-secondary' },
          { label: 'Rata-rata', value: divisions.length ? Math.round(totalJobdesks / divisions.length) : 0, icon: BriefcaseBusiness, tone: 'text-on-surface' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <motion.div key={item.label} variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-label-sm font-bold text-on-surface-variant">{item.label}</p>
                  <p className={`mt-1 text-headline-sm font-black ${item.tone}`}>{item.value}</p>
                </div>
                <div className="rounded-lg bg-surface-high p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </section>

      <motion.section variants={itemVariants} className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          <div className="border-b border-outline-variant/10 p-4">
            <h2 className="text-title-sm font-black text-on-surface">Daftar divisi</h2>
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari divisi atau jobdesk"
                className="h-10 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-9 text-label-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          <div className="max-h-[540px] overflow-y-auto p-2">
            {filteredDivisions.map((division) => {
              const active = activeDivision?.id === division.id;
              return (
                <button
                  key={division.id}
                  type="button"
                  onClick={() => setActiveDivisionId(division.id)}
                  className={`mb-1 flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition ${
                    active ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-high'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-label-sm font-black">{division.posisi}</p>
                    <p className={`mt-0.5 text-label-xs font-bold ${active ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{division.jobdesks.length} jobdesk</p>
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[11px] font-black ${active ? 'bg-on-primary/15' : 'bg-surface-high text-primary'}`}>
                    {division.id}
                  </span>
                </button>
              );
            })}
            {filteredDivisions.length === 0 && (
              <div className="py-10 text-center text-label-sm font-bold text-on-surface-variant">Tidak ada hasil.</div>
            )}
          </div>

          <div className="border-t border-outline-variant/10 p-4">
            <label className="text-label-sm font-bold text-on-surface-variant">Divisi baru</label>
            <div className="mt-2 flex gap-2">
              <input
                value={newDivision}
                onChange={(event) => setNewDivision(event.target.value)}
                placeholder="Nama divisi"
                className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
              />
              <button type="button" onClick={handleAddDivision} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-3 text-label-sm font-bold text-on-primary transition hover:bg-primary/90">
                <Plus className="h-4 w-4" />
                Tambah
              </button>
            </div>
          </div>
        </aside>

        <div className="rounded-xl border border-outline-variant/20 bg-surface shadow-sm">
          {activeDivision ? (
            <>
              <div className="border-b border-outline-variant/10 p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-label-xs font-bold text-primary">
                      <BriefcaseBusiness className="h-3.5 w-3.5" />
                      {activeDivision.id}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <input
                        value={editingDivisionName}
                        onChange={(event) => setEditingDivisionName(event.target.value)}
                        className="h-11 min-w-0 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-title-sm font-black text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                        aria-label="Nama divisi"
                      />
                      <button
                        type="button"
                        onClick={handleUpdateDivision}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-secondary/25 bg-secondary/10 px-3 text-label-sm font-bold text-secondary transition hover:bg-secondary hover:text-on-secondary"
                      >
                        <Save className="h-4 w-4" />
                        Simpan
                      </button>
                    </div>
                    <p className="mt-2 text-body-sm text-on-surface-variant">{activeDivision.jobdesks.length} jobdesk aktif.</p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[300px]">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => moveDivision(activeDivision.id, -1)}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-outline-variant/20 bg-surface-high text-on-surface-variant transition hover:text-primary"
                        aria-label="Naikkan divisi"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveDivision(activeDivision.id, 1)}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-outline-variant/20 bg-surface-high text-on-surface-variant transition hover:text-primary"
                        aria-label="Turunkan divisi"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDivision(activeDivision.id)}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-error/25 bg-error/10 px-3 text-label-sm font-bold text-error transition hover:bg-error hover:text-on-error"
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus Divisi
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={jobdeskDrafts[activeDivision.id] || ''}
                        onChange={(event) => setJobdeskDrafts((prev) => ({ ...prev, [activeDivision.id]: event.target.value }))}
                        placeholder="Tambah jobdesk"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant/20 bg-surface-high px-3 text-label-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                      />
                      <button type="button" onClick={() => handleAddJobdesk(activeDivision.id)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 text-label-sm font-bold text-primary transition hover:bg-primary hover:text-on-primary">
                        <Plus className="h-4 w-4" />
                        Jobdesk
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2 p-5 md:grid-cols-2">
                {activeDivision.jobdesks.map((jobdesk, index) => (
                  <div key={`${activeDivision.id}-${index}`} className="flex items-start gap-3 rounded-lg border border-outline-variant/10 bg-surface-high/35 p-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-label-xs font-black text-primary">{index + 1}</span>
                    {editingJobdeskIndex === index ? (
                      <div className="min-w-0 flex-1 space-y-2">
                        <textarea
                          value={editingJobdeskText}
                          onChange={(event) => setEditingJobdeskText(event.target.value)}
                          rows={3}
                          className="w-full resize-none rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-body-sm font-semibold text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={handleUpdateJobdesk} className="inline-flex h-8 items-center gap-2 rounded-lg bg-primary px-3 text-label-xs font-bold text-on-primary">
                            <Save className="h-3.5 w-3.5" />
                            Simpan
                          </button>
                          <button type="button" onClick={() => setEditingJobdeskIndex(null)} className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface px-3 text-label-xs font-bold text-on-surface-variant">
                            <X className="h-3.5 w-3.5" />
                            Batal
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="min-w-0 flex-1 text-body-sm font-semibold text-on-surface">{jobdesk}</p>
                        <div className="flex shrink-0 gap-1">
                          <button type="button" onClick={() => moveJobdesk(activeDivision.id, index, -1)} className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-on-surface-variant hover:text-primary" aria-label="Naikkan jobdesk">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => moveJobdesk(activeDivision.id, index, 1)} className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-on-surface-variant hover:text-primary" aria-label="Turunkan jobdesk">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => startEditJobdesk(index, jobdesk)} className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-on-surface-variant hover:text-primary" aria-label="Edit jobdesk">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => handleDeleteJobdesk(index)} className="grid h-8 w-8 place-items-center rounded-lg bg-error/10 text-error hover:bg-error hover:text-on-error" aria-label="Hapus jobdesk">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {activeDivision.jobdesks.length === 0 && (
                  <div className="col-span-full rounded-lg border border-dashed border-outline-variant/20 bg-surface-high/20 py-12 text-center text-body-sm font-bold text-on-surface-variant">
                    Belum ada jobdesk di divisi ini.
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid min-h-[420px] place-items-center p-6 text-center">
              <div>
                <ClipboardList className="mx-auto h-8 w-8 text-on-surface-variant" />
                <p className="mt-3 text-body-sm font-bold text-on-surface">Pilih divisi untuk dikelola.</p>
              </div>
            </div>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
};

export default PicRaportMasterPage;
