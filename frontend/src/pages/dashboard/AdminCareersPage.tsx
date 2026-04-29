import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Plus, Trash2, Edit2, Users, Eye, X,
  CheckCircle2, Clock, Search,
  Phone, Mail, GraduationCap, MapPin, Link2, Globe,
  ToggleLeft, ToggleRight
} from 'lucide-react';
import { useCareerStore, type JobApplication, type JobListing } from '../../store/useCareerStore';
import { toast } from '../../store/useNotificationStore';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const iv = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1 } };

const statusCfg: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',    cls: 'bg-yellow-500/15 text-yellow-400' },
  reviewed:  { label: 'Direview',   cls: 'bg-primary/15 text-primary' },
  interview: { label: 'Interview',  cls: 'bg-tertiary/15 text-tertiary' },
  accepted:  { label: 'Diterima',   cls: 'bg-secondary/15 text-secondary' },
  rejected:  { label: 'Ditolak',    cls: 'bg-red-500/15 text-red-400' },
};

// ──────── Applicant Detail Modal ────────
const ApplicantModal: React.FC<{ app: JobApplication; onClose: () => void; onStatus: (id: string, s: JobApplication['status']) => void }> = ({ app, onClose, onStatus }) => (
  <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass-card rounded-2xl p-8 border border-outline-variant/20" onClick={e => e.stopPropagation()}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-display text-title-lg font-bold text-on-surface">{app.fullName}</h3>
          <p className="text-primary text-body-sm font-semibold">{app.jobTitle}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant"><X className="w-5 h-5" /></button>
      </div>

      <div className="space-y-3 text-body-sm mb-6">
        {[
          { icon: Mail,         val: app.email },
          { icon: Phone,        val: app.phone },
          { icon: MapPin,       val: app.address || '-' },
          { icon: GraduationCap, val: `${app.education}${app.major ? ' – ' + app.major : ''}` },
        ].map(({ icon: Icon, val }, i) => (
          <div key={i} className="flex items-start gap-3 text-on-surface-variant">
            <Icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <span>{val}</span>
          </div>
        ))}
        {app.linkedIn && <div className="flex items-center gap-3 text-on-surface-variant"><Link2 className="w-4 h-4 text-primary" /><a href={app.linkedIn} target="_blank" rel="noreferrer" className="text-primary underline truncate">{app.linkedIn}</a></div>}
        {app.portfolioUrl && <div className="flex items-center gap-3 text-on-surface-variant"><Globe className="w-4 h-4 text-primary" /><a href={app.portfolioUrl} target="_blank" rel="noreferrer" className="text-primary underline truncate">{app.portfolioUrl}</a></div>}
      </div>

      {app.experience && <div className="mb-4"><p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Pengalaman</p><p className="text-body-sm text-on-surface-variant bg-surface-high rounded-xl p-4 leading-relaxed">{app.experience}</p></div>}
      {app.coverLetter && <div className="mb-6"><p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Motivasi</p><p className="text-body-sm text-on-surface-variant bg-surface-high rounded-xl p-4 leading-relaxed">{app.coverLetter}</p></div>}

      <div>
        <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">Ubah Status</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(statusCfg) as JobApplication['status'][]).map(s => (
            <button key={s} onClick={() => onStatus(app.id, s)}
              className={`px-3 py-1.5 rounded-lg text-label-sm font-bold transition-all ${app.status === s ? statusCfg[s].cls + ' ring-2 ring-current' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
              {statusCfg[s].label}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ──────── Job Form Modal ────────
const emptyJob = (): Omit<JobListing, 'id' | 'createdAt' | 'applicantsCount'> => ({
  title: '', department: '', location: 'Manado, Sulawesi Utara',
  type: 'fulltime', level: 'Junior', description: '',
  requirements: [''], benefits: [''], isActive: true, deadline: '',
});

const JobFormModal: React.FC<{ job?: JobListing; onClose: () => void; onSave: (data: Omit<JobListing, 'id' | 'createdAt' | 'applicantsCount'>) => void }> = ({ job, onClose, onSave }) => {
  const [form, setForm] = useState(job ? {
    title: job.title, department: job.department, location: job.location,
    type: job.type, level: job.level, description: job.description,
    requirements: job.requirements, benefits: job.benefits,
    isActive: job.isActive, deadline: job.deadline || '',
  } : emptyJob());

  const setArr = (field: 'requirements' | 'benefits', idx: number, val: string) => {
    setForm(p => ({ ...p, [field]: p[field].map((v, i) => i === idx ? val : v) }));
  };
  const addArr = (field: 'requirements' | 'benefits') => setForm(p => ({ ...p, [field]: [...p[field], ''] }));
  const remArr = (field: 'requirements' | 'benefits', idx: number) =>
    setForm(p => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto glass-card rounded-2xl p-8 border border-outline-variant/20" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-title-lg font-bold text-on-surface">{job ? 'Edit Lowongan' : 'Tambah Lowongan'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-high text-on-surface-variant"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-4">
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Judul Posisi *" />

          <div className="grid grid-cols-2 gap-4">
            <input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
              className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Departemen (contoh: Sales)" />
            <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
              placeholder="Lokasi" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as JobListing['type'] }))}
              className="bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40">
              {['fulltime','parttime','contract','internship'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.level} onChange={e => setForm(p => ({ ...p, level: e.target.value as JobListing['level'] }))}
              className="bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40">
              {['Junior','Mid','Senior','Manager'].map(l => <option key={l}>{l}</option>)}
            </select>
            <input type="date" value={form.deadline} onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
              className="bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>

          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3}
            className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
            placeholder="Deskripsi posisi..." />

          {(['requirements', 'benefits'] as const).map(field => (
            <div key={field}>
              <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-2">{field === 'requirements' ? 'Kualifikasi' : 'Benefit'}</p>
              {form[field].map((v, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <input value={v} onChange={e => setArr(field, idx, e.target.value)}
                    className="flex-1 bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-2.5 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder={`${field === 'requirements' ? 'Kualifikasi' : 'Benefit'} ${idx + 1}`} />
                  <button onClick={() => remArr(field, idx)} className="p-2 rounded-lg hover:bg-red-500/10 text-on-surface-variant hover:text-red-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button onClick={() => addArr(field)} className="text-label-sm text-primary font-semibold flex items-center gap-1 mt-1">
                <Plus className="w-3.5 h-3.5" /> Tambah
              </button>
            </div>
          ))}

          <label className="flex items-center gap-3 cursor-pointer">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))} className="text-on-surface-variant">
              {form.isActive ? <ToggleRight className="w-7 h-7 text-secondary" /> : <ToggleLeft className="w-7 h-7" />}
            </button>
            <span className="text-body-md text-on-surface font-semibold">{form.isActive ? 'Lowongan Aktif' : 'Lowongan Nonaktif'}</span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-outline-variant/10">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl glass-card font-bold text-on-surface-variant">Batal</button>
            <button onClick={() => { if (!form.title || !form.department) { toast.error('Judul dan departemen wajib diisi'); return; } onSave(form); onClose(); }}
              className="flex-1 py-3 rounded-xl gradient-primary font-bold text-surface">Simpan</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ──────── Main Admin Page ────────
const AdminCareersPage: React.FC = () => {
  const { jobs, applications, isLoading, error, fetchJobs, fetchApplications, createJob, updateJob, deleteJob, updateApplicationStatus } = useCareerStore();
  const [tab, setTab] = useState<'jobs' | 'applicants'>('jobs');
  const [search, setSearch] = useState('');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [editingJob, setEditingJob] = useState<JobListing | undefined>(undefined);
  const [showJobForm, setShowJobForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('Semua');

  useEffect(() => { fetchJobs(); fetchApplications(); }, [fetchJobs, fetchApplications]);

  const filteredApps = applications.filter(a => {
    const matchSearch = `${a.fullName} ${a.jobTitle} ${a.email}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Semua' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const handleStatusChange = async (id: string, status: JobApplication['status']) => {
    await updateApplicationStatus(id, status);
    if (selectedApp?.id === id) setSelectedApp(prev => prev ? { ...prev, status } : null);
    toast.success('Status diperbarui');
  };

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 pb-10">

      {/* Header */}
      <motion.div variants={iv} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-widest mb-1">HR Management</p>
            <h2 className="font-display text-headline-sm font-bold text-on-surface inline-flex items-center gap-3">
              <Briefcase className="w-6 h-6 text-primary" /> Manajemen Karier
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">Kelola lowongan pekerjaan dan pantau data pelamar secara terpusat.</p>
          </div>
          {tab === 'jobs' && (
            <button onClick={() => { setEditingJob(undefined); setShowJobForm(true); }}
              className="flex items-center gap-2 px-5 py-2.5 gradient-primary rounded-xl font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all">
              <Plus className="w-4 h-4" /> Tambah Lowongan
            </button>
          )}
        </div>
      </motion.div>

      {/* Loading/Error State */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 glass-card rounded-xl">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
          <p className="text-on-surface-variant font-medium">Memuat data...</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-8 glass-card rounded-xl border border-red-500/20 text-center">
          <p className="text-red-400 font-bold mb-2">Terjadi Kesalahan</p>
          <p className="text-on-surface-variant text-body-sm mb-4">{error}</p>
          <button onClick={() => { fetchJobs(); fetchApplications(); }} className="px-4 py-2 bg-surface-high rounded-lg text-primary font-bold">Coba Lagi</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Lowongan', value: jobs.length, icon: Briefcase, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Lowongan Aktif', value: jobs.filter(j => j.isActive).length, icon: CheckCircle2, color: 'text-secondary', bg: 'bg-secondary/10' },
          { label: 'Total Pelamar', value: applications.length, icon: Users, color: 'text-tertiary', bg: 'bg-tertiary/10' },
          { label: 'Menunggu Review', value: applications.filter(a => a.status === 'pending').length, icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        ].map(k => (
          <motion.div key={k.label} variants={iv} className="glass-card rounded-xl p-5 border border-outline-variant/10">
            <div className={`p-2.5 rounded-lg ${k.bg} ${k.color} w-fit mb-3`}><k.icon className="w-4 h-4" /></div>
            <div className="text-label-xs text-on-surface-variant uppercase tracking-widest">{k.label}</div>
            <div className="font-display text-headline-sm font-bold text-on-surface mt-1">{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <motion.div variants={iv} className="glass-card rounded-xl overflow-hidden">
        <div className="flex border-b border-outline-variant/10">
          {[{ id: 'jobs', label: 'Lowongan', icon: Briefcase }, { id: 'applicants', label: 'Pelamar', icon: Users }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-2 px-6 py-4 font-bold text-body-sm transition-all ${tab === t.id ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
              <t.icon className="w-4 h-4" />{t.label}
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-surface-high">{t.id === 'jobs' ? jobs.length : applications.length}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === 'jobs' ? 'Cari lowongan...' : 'Cari pelamar...'}
                className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-on-surface-variant/50" />
            </div>
            {tab === 'applicants' && (
              <div className="flex gap-2 flex-wrap">
                {['Semua', ...Object.keys(statusCfg)].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${filterStatus === s ? 'bg-primary/20 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-on-surface'}`}>
                    {s === 'Semua' ? 'Semua' : statusCfg[s].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Jobs Tab */}
          {tab === 'jobs' && (
            <div className="space-y-3">
              {jobs.filter(j => j.title.toLowerCase().includes(search.toLowerCase())).map(job => (
                <div key={job.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-surface-high/50 border border-outline-variant/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-on-surface text-body-md">{job.title}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.isActive ? 'bg-secondary/15 text-secondary' : 'bg-surface-highest text-on-surface-variant'}`}>
                        {job.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-label-xs text-on-surface-variant">
                      <span>{job.department}</span><span>·</span><span>{job.location}</span><span>·</span>
                      <span>{job.level}</span><span>·</span>
                      <span>{applications.filter(a => a.jobId === job.id).length} pelamar</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => { setTab('applicants'); setSearch(job.title); }}
                      className="p-2 rounded-lg bg-surface-highest text-on-surface-variant hover:text-primary transition-colors" title="Lihat Pelamar">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setEditingJob(job); setShowJobForm(true); }}
                      className="p-2 rounded-lg bg-surface-highest text-on-surface-variant hover:text-secondary transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={async () => { await deleteJob(job.id); toast.success('Lowongan dihapus'); }}
                      className="p-2 rounded-lg bg-surface-highest text-on-surface-variant hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {jobs.length === 0 && <p className="text-center py-12 text-on-surface-variant text-body-sm italic">Belum ada lowongan. Klik "Tambah Lowongan" untuk mulai.</p>}
            </div>
          )}

          {/* Applicants Tab */}
          {tab === 'applicants' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="text-label-xs text-on-surface-variant border-b border-outline-variant/20 uppercase tracking-widest">
                    <th className="py-3 px-4">Pelamar</th>
                    <th className="py-3 px-4">Posisi</th>
                    <th className="py-3 px-4">Pendidikan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map(app => {
                    const sc = statusCfg[app.status] || statusCfg.pending;
                    return (
                      <tr key={app.id} className="border-b border-outline-variant/10 hover:bg-surface-high/30 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center font-bold text-on-primary text-xs">
                              {app.fullName ? app.fullName[0] : '?'}
                            </div>
                            <div>
                              <div className="font-bold text-on-surface text-body-sm">{app.fullName}</div>
                              <div className="text-[10px] text-on-surface-variant">{app.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-body-sm text-on-surface">{app.jobTitle}</td>
                        <td className="py-4 px-4 text-body-sm text-on-surface-variant">{app.education}</td>
                        <td className="py-4 px-4">
                          <select value={app.status} onChange={e => handleStatusChange(app.id, e.target.value as JobApplication['status'])}
                            className={`px-3 py-1.5 rounded-lg text-label-xs font-bold outline-none border border-transparent focus:border-primary/40 appearance-none cursor-pointer ${sc.cls}`}>
                            {(Object.keys(statusCfg) as JobApplication['status'][]).map(s => (
                              <option key={s} value={s} className="bg-surface text-on-surface">{statusCfg[s].label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-4 px-4 text-body-sm text-on-surface-variant">{app.appliedAt}</td>
                        <td className="py-4 px-4">
                          <button onClick={() => setSelectedApp(app)} className="p-2 rounded-lg bg-surface-high text-on-surface-variant hover:text-primary transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredApps.length === 0 && (
                    <tr><td colSpan={6} className="py-12 text-center text-on-surface-variant text-body-sm italic">Belum ada pelamar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modals */}
      {selectedApp && <ApplicantModal app={selectedApp} onClose={() => setSelectedApp(null)} onStatus={handleStatusChange} />}
      {showJobForm && (
        <JobFormModal job={editingJob} onClose={() => setShowJobForm(false)}
          onSave={async data => {
            if (editingJob) { await updateJob(editingJob.id, data); toast.success('Lowongan diperbarui'); }
            else { await createJob(data); toast.success('Lowongan ditambahkan'); }
          }} />
      )}
    </motion.div>
  );
};

export default AdminCareersPage;
