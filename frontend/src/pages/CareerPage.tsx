import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, MapPin, Clock, Users, Target, Rocket, ChevronDown, Search, ArrowRight } from 'lucide-react';
import { jobListings } from '../data';
import { Badge, SectionHeader } from '../components/ui';

const CareerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'tech' | 'marketing'>('all');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const filteredJobs = activeTab === 'all'
    ? jobListings
    : jobListings.filter(job => {
        if (activeTab === 'sales') return job.department.toLowerCase().includes('sales');
        if (activeTab === 'tech') return job.department.toLowerCase().includes('technical');
        if (activeTab === 'marketing') return job.department.toLowerCase().includes('marketing') || job.department.toLowerCase().includes('experience');
        return true;
      });

  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden mesh-bg">
        <div className="container-custom relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Badge label="Join Our Team" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-white mt-4 mb-4">
              Bangun Masa Depan <span className="gradient-text-neon">Bersama Kami</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant max-w-2xl mx-auto mb-10 leading-relaxed">
              Kami mencari talenta berbakat yang bersemangat untuk merevolusi ekosistem mobilitas dan elektronik di Sulawesi. Mari tumbuh bersama Tridjaya Samrat.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Users, title: 'Budaya Kerja Kolaboratif', desc: 'Lingkungan kerja yang suportif dan dinamis untuk pertumbuhan karir.' },
                { icon: Rocket, title: 'Inovasi Tanpa Henti', desc: 'Terlibat dalam proyek teknologi kendaraan listrik masa depan.' },
                { icon: Target, title: 'Dampak Nyata', desc: 'Membangun ekosistem berkelanjutan untuk masyarakat Sulawesi.' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i }}
                  className="glass-card rounded-2xl p-6 text-center"
                >
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-surface" />
                  </div>
                  <h3 className="font-display text-title-sm font-bold text-white mb-2">{item.title}</h3>
                  <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Openings */}
      <section className="pb-20">
        <div className="container-custom">
          <SectionHeader
            title="Lowongan Aktif"
            subtitle="Temukan peran yang sesuai dengan keahlian dan passion Anda."
            align="left"
          />

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap mb-8">
            {[
              { id: 'all', label: 'Semua Lowongan' },
              { id: 'sales', label: 'Penjualan' },
              { id: 'tech', label: 'Teknis & Support' },
              { id: 'marketing', label: 'Marketing & CX' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-5 py-2.5 rounded-xl font-body text-body-md font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'gradient-primary text-surface shadow-neon-cyan-sm'
                    : 'glass-card text-on-surface-variant hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Job List */}
          <div className="flex flex-col gap-4">
            {filteredJobs.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="glass-card rounded-2xl overflow-hidden active:shadow-neon-cyan focus-within:shadow-neon-cyan transition-shadow"
              >
                <div
                  className="p-6 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                >
                  <div>
                    <h3 className="font-display text-title-md font-bold text-white mb-2 group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center gap-1.5 text-on-surface-variant font-body text-body-sm">
                        <Briefcase className="w-3.5 h-3.5 text-primary" />
                        {job.department}
                      </div>
                      <div className="flex items-center gap-1.5 text-on-surface-variant font-body text-body-sm">
                        <MapPin className="w-3.5 h-3.5 text-secondary" />
                        {job.location}
                      </div>
                      <div className="flex items-center gap-1.5 text-on-surface-variant font-body text-body-sm">
                        <Clock className="w-3.5 h-3.5 text-tertiary" />
                        {job.type === 'fulltime' ? 'Full Time' : job.type}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto mt-2 md:mt-0">
                    <div className="hidden sm:block">
                      <Badge label={job.level} variant="secondary" size="sm" />
                    </div>
                    <div className={`w-10 h-10 rounded-lg glass-dark flex items-center justify-center transition-transform duration-300 ${expandedJob === job.id ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-5 h-5 text-on-surface-variant" />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedJob === job.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-surface-highest/30 border-t border-outline-variant/10"
                    >
                      <div className="p-6 md:p-8">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          <div>
                            <h4 className="font-display text-title-sm font-bold text-white mb-3">Deskripsi Peran</h4>
                            <p className="font-body text-body-md text-on-surface-variant leading-relaxed mb-6">
                              {job.description}
                            </p>
                            <h4 className="font-display text-title-sm font-bold text-white mb-3">Tanggung Jawab & Kualifikasi</h4>
                            <ul className="space-y-2 mb-6">
                              {job.requirements.map((req, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-on-surface-variant font-body text-body-md">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                                  {req}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-display text-title-sm font-bold text-white mb-3">Benefit</h4>
                            <ul className="space-y-2 mb-8">
                              {job.benefits.map((benefit, idx) => (
                                <li key={idx} className="flex items-start gap-3 text-on-surface-variant font-body text-body-md">
                                  <div className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 flex-shrink-0" />
                                  {benefit}
                                </li>
                              ))}
                            </ul>
                            <div className="glass-card rounded-2xl p-6 bg-surface-highest/50">
                              <h4 className="font-display text-title-sm font-bold text-white mb-2">Tertarik Bergabung?</h4>
                              <p className="font-body text-body-sm text-on-surface-variant mb-4">
                                Kirim CV dan Portfolio Anda ke <span className="text-primary font-semibold">hrd@tridjaya.com</span> dengan subjek: [Hiring] - [Posisi Anda]
                              </p>
                              <a
                                href="mailto:hrd@tridjaya.com"
                                className="flex items-center justify-center gap-2 w-full py-3 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all"
                              >
                                Lamar Sekarang
                                <ArrowRight className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>

          {filteredJobs.length === 0 && (
            <div className="text-center py-20 glass-card rounded-3xl mt-8">
              <Search className="w-12 h-12 text-on-surface-variant mx-auto mb-4" />
              <p className="font-display text-headline-sm text-white mb-2">Belum ada posisi yang sesuai</p>
              <p className="font-body text-body-md text-on-surface-variant">
                Silakan cek kembali di lain waktu atau kirimkan CV umum Anda ke hrd@tridjaya.com
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Talent Community CTA */}
      <section className="pb-20">
        <div className="container-custom">
          <div className="relative overflow-hidden rounded-3xl glass-card p-10 md:p-16 text-center">
            <div className="absolute inset-0 mesh-bg opacity-30" />
            <div className="relative z-10">
              <h2 className="font-display text-headline-md font-bold text-white mb-4">Tidak Menemukan Posisi yang Cocok?</h2>
              <p className="font-body text-body-lg text-on-surface-variant max-w-xl mx-auto mb-8 leading-relaxed">
                Kami selalu mencari talenta luar biasa. Jadilah bagian dari database talenta kami dan kami akan menghubungi Anda jika ada posisi yang sesuai.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a
                  href="mailto:hrd@tridjaya.com?subject=%5BHiring%5D%20CV%20Umum%20-%20Tridjaya%20Samrat"
                  className="px-8 py-3.5 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all"
                >
                  Kirim CV Umum
                </a>
                <a
                  href="https://www.linkedin.com/company/tridjaya-samrat"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3.5 glass-dark border border-outline-variant rounded-xl font-display text-title-sm font-semibold text-white hover:border-primary/50 transition-all"
                >
                  Ikuti LinkedIn Kami
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default CareerPage;
