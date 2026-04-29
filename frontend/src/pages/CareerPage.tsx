import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, MapPin, Clock, ChevronDown, ArrowRight,
  CheckCircle2, Send, X, User, Mail, Phone, GraduationCap,
  FileText, Link2, Globe, Loader2, Building2, Users, Rocket, Target
} from 'lucide-react';
import { Badge, SectionHeader } from '../components/ui';
import { useCareerStore, type JobListing } from '../store/useCareerStore';
import { toast } from '../store/useNotificationStore';

// ──────────────────────────────────
// Application Modal
// ──────────────────────────────────
interface ApplyModalProps { job: JobListing; onClose: () => void; }

const ApplyModal: React.FC<ApplyModalProps> = ({ job, onClose }) => {
  const { submitApplication, isSubmitting } = useCareerStore();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', address: '',
    education: 'SMA/SMK', major: '', experience: '', coverLetter: '',
    linkedIn: '', portfolioUrl: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.phone || !form.experience) {
      toast.error('Harap lengkapi semua bidang yang wajib diisi.');
      return;
    }
    const ok = await submitApplication({ ...form, jobId: job.id, jobTitle: job.title });
    if (ok) {
      setSubmitted(true);
      toast.success('Lamaran berhasil dikirim!', 'Tim kami akan menghubungi Anda segera.');
    } else {
      toast.error('Gagal mengirim lamaran', 'Silakan coba kembali.');
    }
  };

  return (
    <div className="fixed inset-0 z-[99] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl p-8 border border-outline-variant/20 relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-surface-high text-on-surface-variant transition-colors">
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-10">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
              <CheckCircle2 className="w-20 h-20 text-secondary mx-auto mb-6" />
            </motion.div>
            <h3 className="font-display text-headline-sm font-bold text-on-surface mb-3">Lamaran Terkirim!</h3>
            <p className="font-body text-body-md text-on-surface-variant mb-6 max-w-sm mx-auto">
              Terima kasih telah melamar posisi <strong>{job.title}</strong>. Tim HR kami akan meninjau lamaran Anda dan menghubungi dalam 5-7 hari kerja.
            </p>
            <button onClick={onClose} className="px-8 py-3 gradient-primary rounded-xl font-bold text-surface">
              Tutup
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h3 className="font-display text-headline-sm font-bold text-on-surface">Formulir Lamaran</h3>
              <p className="text-on-surface-variant text-body-sm mt-1">Posisi: <span className="text-primary font-semibold">{job.title}</span></p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Personal Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    <User className="inline w-3.5 h-3.5 mr-1" />Nama Lengkap *
                  </label>
                  <input name="fullName" value={form.fullName} onChange={handleChange} required
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Nama sesuai KTP" />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    <Phone className="inline w-3.5 h-3.5 mr-1" />No. WhatsApp *
                  </label>
                  <input name="phone" value={form.phone} onChange={handleChange} required type="tel"
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="08xx-xxxx-xxxx" />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  <Mail className="inline w-3.5 h-3.5 mr-1" />Email *
                </label>
                <input name="email" value={form.email} onChange={handleChange} required type="email"
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="contoh@email.com" />
              </div>

              <div>
                <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  <MapPin className="inline w-3.5 h-3.5 mr-1" />Alamat Domisili
                </label>
                <input name="address" value={form.address} onChange={handleChange}
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Kelurahan, Kecamatan, Kota" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    <GraduationCap className="inline w-3.5 h-3.5 mr-1" />Pendidikan Terakhir
                  </label>
                  <select name="education" value={form.education} onChange={handleChange}
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40">
                    {['SMA/SMK', 'D3', 'S1', 'S2', 'Lainnya'].map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    Jurusan / Program Studi
                  </label>
                  <input name="major" value={form.major} onChange={handleChange}
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Teknik Elektro, Manajemen, dll." />
                </div>
              </div>

              <div>
                <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  Pengalaman Kerja Relevan *
                </label>
                <textarea name="experience" value={form.experience} onChange={handleChange} required rows={3}
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Ceritakan pengalaman kerja Anda yang relevan, atau 'Belum ada pengalaman' jika fresh graduate..." />
              </div>

              <div>
                <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                  <FileText className="inline w-3.5 h-3.5 mr-1" />Motivasi / Surat Lamaran Singkat
                </label>
                <textarea name="coverLetter" value={form.coverLetter} onChange={handleChange} rows={4}
                  className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                  placeholder="Mengapa Anda tertarik bergabung dengan Tridjaya? Apa yang bisa Anda kontribusikan?" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    <Link2 className="inline w-3.5 h-3.5 mr-1" />LinkedIn (opsional)
                  </label>
                  <input name="linkedIn" value={form.linkedIn} onChange={handleChange} type="url"
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="https://linkedin.com/in/..." />
                </div>
                <div>
                  <label className="block text-label-sm font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1" />Portfolio/CV Link (opsional)
                  </label>
                  <input name="portfolioUrl" value={form.portfolioUrl} onChange={handleChange} type="url"
                    className="w-full bg-surface-high border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="https://drive.google.com/..." />
                </div>
              </div>

              <div className="pt-2 border-t border-outline-variant/10 flex items-center gap-4">
                <button type="button" onClick={onClose}
                  className="flex-1 py-3.5 rounded-xl glass-card font-bold text-on-surface-variant hover:text-on-surface transition-colors">
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="flex-1 py-3.5 rounded-xl gradient-primary font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  {isSubmitting ? 'Mengirim...' : 'Kirim Lamaran'}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

// ──────────────────────────────────
// Career Page
// ──────────────────────────────────
const CareerPage: React.FC = () => {
  const { jobs, isLoading, error, fetchJobs } = useCareerStore();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [applyingJob, setApplyingJob] = useState<JobListing | null>(null);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const activeJobs = jobs.filter(j => j.isActive);

  const typeLabel: Record<string, string> = {
    fulltime: 'Full Time', parttime: 'Part Time',
    contract: 'Kontrak', internship: 'Magang',
  };

  return (
    <>
      <title>Karier – Tridjaya Manado</title>

      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/8 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-secondary/8 rounded-full blur-[80px]" />
        </div>

        <div className="relative z-10 container-custom text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <Badge label="Karier Bersama Kami" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-on-surface mt-4 mb-4">
              Bangun Masa Depan <span className="gradient-text-primary">Bersama Tridjaya</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
              Bergabunglah dengan tim kami dan jadilah bagian dari revolusi ekosistem mobilitas listrik dan elektronik di Sulawesi.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {[
                { icon: Users, title: 'Budaya Kolaboratif', desc: 'Lingkungan kerja yang suportif dan dinamis.' },
                { icon: Rocket, title: 'Inovasi Tanpa Henti', desc: 'Terlibat langsung dalam proyek teknologi masa depan.' },
                { icon: Target, title: 'Dampak Nyata', desc: 'Membangun ekosistem berkelanjutan untuk Sulawesi.' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className="glass-card rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-surface" />
                  </div>
                  <h3 className="font-display text-title-sm font-bold text-on-surface mb-2">{item.title}</h3>
                  <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Job Listings */}
      <section className="pb-24 bg-surface/90">
        <div className="container-custom">
          <SectionHeader
            eyebrow={`${activeJobs.length} Posisi Tersedia`}
            title="Lowongan Aktif"
            subtitle="Temukan peran yang sesuai dengan keahlian dan passion Anda."
            align="left"
            className="mb-10"
          />

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-on-surface-variant font-medium">Mencari lowongan terbaik untuk Anda...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="p-12 glass-card rounded-3xl border border-red-500/20 text-center">
              <p className="text-on-surface-variant text-body-md mb-4">{error}</p>
              <button onClick={() => fetchJobs()} className="px-6 py-2 gradient-primary rounded-xl font-bold text-surface">Coba Lagi</button>
            </div>
          )}

          {!isLoading && !error && activeJobs.length === 0 ? (
            <div className="glass-card rounded-3xl p-16 text-center">
              <Briefcase className="w-16 h-16 text-on-surface-variant/30 mx-auto mb-6" />
              <h3 className="font-display text-headline-sm text-on-surface mb-2">Belum Ada Lowongan</h3>
              <p className="text-on-surface-variant text-body-md">Silakan cek kembali dalam waktu dekat.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {activeJobs.map((job, i) => (
                <motion.div key={job.id}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.06, 0.3), ease: [0.22, 1, 0.36, 1] }}
                  className="glass-card rounded-2xl overflow-hidden">
                  {/* Job Header */}
                  <div className="p-6 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}>
                    <div className="flex-1">
                      <h3 className="font-display text-title-md font-bold text-on-surface mb-2">{job.title}</h3>
                      <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-body text-body-sm">
                        <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary" />{job.department}</span>
                        <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-secondary" />{job.location}</span>
                        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-tertiary" />{typeLabel[job.type] || job.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-lg bg-secondary/10 text-secondary text-label-sm font-bold">{job.level}</span>
                      {job.deadline && (
                        <span className="text-label-xs text-on-surface-variant hidden sm:block">Deadline: {new Date(job.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                      <div className={`w-9 h-9 rounded-lg glass-dark flex items-center justify-center transition-transform duration-300 ${expandedJob === job.id ? 'rotate-180' : ''}`}>
                        <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <AnimatePresence>
                    {expandedJob === job.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-outline-variant/10 bg-surface-highest/20">
                        <div className="p-6 md:p-8">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div>
                              <h4 className="font-display text-title-sm font-bold text-on-surface mb-3">Deskripsi Posisi</h4>
                              <p className="font-body text-body-md text-on-surface-variant leading-relaxed mb-6">{job.description}</p>
                              <h4 className="font-display text-title-sm font-bold text-on-surface mb-3">Kualifikasi</h4>
                              <ul className="space-y-2">
                                {job.requirements.map((r, idx) => (
                                  <li key={idx} className="flex items-start gap-3 text-on-surface-variant font-body text-body-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />{r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h4 className="font-display text-title-sm font-bold text-on-surface mb-3">Yang Kami Tawarkan</h4>
                              <ul className="space-y-2 mb-8">
                                {job.benefits.map((b, idx) => (
                                  <li key={idx} className="flex items-start gap-3 text-on-surface-variant font-body text-body-md">
                                    <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />{b}
                                  </li>
                                ))}
                              </ul>
                              <button
                                onClick={() => setApplyingJob(job)}
                                className="w-full flex items-center justify-center gap-3 px-8 py-4 gradient-primary rounded-2xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all group">
                                Lamar Sekarang <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="pb-20 bg-surface/90">
        <div className="container-custom">
          <div className="relative overflow-hidden rounded-3xl glass-card p-10 md:p-16 text-center">
            <div className="absolute inset-0 opacity-5 bg-gradient-to-br from-primary to-secondary" />
            <div className="relative z-10">
              <h2 className="font-display text-headline-md font-bold text-on-surface mb-4">Tidak Ada Posisi yang Cocok?</h2>
              <p className="font-body text-body-lg text-on-surface-variant max-w-xl mx-auto mb-8 leading-relaxed">
                Kami selalu mencari talenta hebat. Kirim CV umum Anda dan kami akan menghubungi jika ada posisi yang sesuai.
              </p>
              <a href="mailto:dandimamonto.tridjaya03@gmail.com?subject=%5BHiring%5D%20CV%20Umum"
                className="inline-flex items-center gap-2 px-8 py-4 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all">
                Kirim CV Umum <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Application Modal */}
      <AnimatePresence>
        {applyingJob && <ApplyModal job={applyingJob} onClose={() => setApplyingJob(null)} />}
      </AnimatePresence>
    </>
  );
};

export default CareerPage;
