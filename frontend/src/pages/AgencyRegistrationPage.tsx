import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, Check, Shield, TrendingUp, Handshake, Users, 
  ChevronRight, Phone, Send, Info, Award,
  FileText, Camera, Upload
} from 'lucide-react';
import { toast } from '../store/useNotificationStore';
import { Badge, SectionHeader } from '../components/ui';
import { apiFetch } from '../utils/apiClient';

const steps = [
  { id: 1, title: 'Data Diri', subtitle: 'Informasi personal' },
  { id: 2, title: 'Data Lokasi', subtitle: 'Wilayah pemasaran' },
  { id: 3, title: 'Preferensi', subtitle: 'Kategori produk' },
  { id: 4, title: 'Dokumen', subtitle: 'Upload Foto & KTP' },
];

const AgencyRegistrationPage: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    whatsapp: '',
    province: 'Sulawesi Utara',
    city: '',
    address: '',
    preferredProducts: ['bike'] as string[],
  });

  const [files, setFiles] = useState<{
    profilePhoto: File | null;
    ktpPhoto: File | null;
  }>({
    profilePhoto: null,
    ktpPhoto: null,
  });

  const [previews, setPreviews] = useState<{
    profilePhoto: string | null;
    ktpPhoto: string | null;
  }>({
    profilePhoto: null,
    ktpPhoto: null,
  });

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return formData.fullName.trim() !== '' && 
               formData.email.trim() !== '' && 
               formData.whatsapp.trim() !== '';
      case 2:
        return formData.city.trim() !== '';
      case 3:
        return formData.preferredProducts.length > 0;
      case 4:
        return files.profilePhoto !== null && files.ktpPhoto !== null;
      default:
        return true;
    }
  };

  const nextStep = () => {
    if (isStepValid()) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (id: string) => {
    setFormData(prev => {
      const current = prev.preferredProducts;
      if (current.includes(id)) {
        return { ...prev, preferredProducts: current.filter(item => item !== id) };
      } else {
        return { ...prev, preferredProducts: [...current, id] };
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profilePhoto' | 'ktpPhoto') => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('File Tidak Valid', 'Silakan pilih file gambar saja (JPG, PNG, WebP).');
        return;
      }
      setFiles(prev => ({ ...prev, [type]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Safety check: ensure we are on the last step
    if (currentStep < steps.length) {
      nextStep();
      return;
    }

    setIsSubmitting(true);
    
    try {
      const data = new FormData();
      data.append('fullName', formData.fullName);
      data.append('email', formData.email);
      data.append('whatsapp', formData.whatsapp);
      data.append('province', formData.province);
      data.append('city', formData.city);
      data.append('address', formData.address);
      data.append('preferredProducts', JSON.stringify(formData.preferredProducts));
      
      if (files.profilePhoto) data.append('profilePhoto', files.profilePhoto);
      if (files.ktpPhoto) data.append('ktpPhoto', files.ktpPhoto);

      const response = await apiFetch('/api/agent-registrations', {
        method: 'POST',
        skipAuth: true,
        body: data,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Gagal mengirim pendaftaran');
      }

      setFormSubmitted(true);
      toast.success('Pendaftaran Berhasil Dikirim', 'Tim kami akan menghubungi Anda dalam waktu dekat melalui WhatsApp.');
    } catch (error: any) {
      toast.error('Gagal Mengirim', error.message || 'Terjadi kesalahan sistem. Silakan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent form submission on Enter key if not on last step
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentStep < steps.length) {
      e.preventDefault();
      nextStep();
    }
  };

  return (
    <>
      <section className="relative pt-28 pb-16 overflow-hidden mesh-bg">
        <div className="container-custom relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge label="Program Kemitraan" variant="secondary" />
              <h1 className="font-display text-display-sm font-bold text-white mt-4 mb-4 leading-tight">
                Jadilah <span className="gradient-text-neon">Agen Resmi</span> Tridjaya Group
              </h1>
              <p className="font-body text-body-lg text-on-surface-variant mb-8 leading-relaxed">
                Bergabunglah dengan jaringan distributor terbesar di Sulawesi. Berdayakan diri Anda dengan bisnis mandiri bersama dukungan teknologi dan logistik dari kami.
              </p>

              <div className="space-y-6">
                {[
                  { icon: TrendingUp, title: 'Komisi Menarik & Bonus', desc: 'Dapatkan bagi hasil yang kompetitif dan bonus target bulanan bagi agen berprestasi.' },
                  { icon: Handshake, title: 'Dukungan Marketing', desc: 'Kami sediakan banner, brosur, materi sosial media, dan support iklan digital.' },
                  { icon: Shield, title: 'Proteksi Wilayah', desc: 'Satu agen per wilayah untuk memastikan ekosistem bisnis yang sehat dan eksklusif.' },
                  { icon: Zap, title: 'Produk Inovatif', desc: 'Akses penuh ke semua brand motor listrik terbaru: Goda, Winfly, dan Nuv.' },
                ].map((benefit, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0 mt-1">
                      <benefit.icon className="w-5 h-5 text-surface" />
                    </div>
                    <div>
                      <h3 className="font-display text-title-sm font-bold text-white mb-1">{benefit.title}</h3>
                      <p className="font-body text-body-md text-on-surface-variant">{benefit.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-10 p-6 glass-card rounded-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-secondary" />
                </div>
                <div>
                  <div className="font-display text-title-sm font-bold text-white">500+ Agen Aktif</div>
                  <div className="font-body text-body-sm text-on-surface-variant">Bergabung dengan komunitas agen kami di seluruh Sulawesi.</div>
                </div>
              </div>
            </motion.div>

            {/* Registration Form */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="glass-card rounded-3xl p-8 md:p-10 shadow-ambient-dark border border-white/5 relative z-10">
                <AnimatePresence mode="wait">
                  {!formSubmitted ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <h3 className="font-display text-headline-sm font-bold text-white mb-6">Formulir Pendaftaran</h3>
                      
                      {/* Stepper */}
                      <div className="flex items-center gap-3 mb-8">
                        {steps.map((step) => (
                          <div key={step.id} className="flex-1">
                            <div className={`h-1.5 rounded-full mb-2 transition-all duration-300 ${currentStep >= step.id ? 'gradient-primary' : 'bg-surface-highest'}`} />
                            <div className="hidden sm:block">
                              <div className={`font-body text-label-sm uppercase tracking-wider ${currentStep === step.id ? 'text-primary font-bold' : 'text-on-surface-variant'}`}>{step.title}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-5">
                        {currentStep === 1 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div>
                              <label className="block font-body text-label-md text-on-surface-variant mb-2">Nama Lengkap</label>
                              <input 
                                type="text" 
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                placeholder="Masukkan nama sesuai KTP" 
                                className="w-full bg-surface-highest border-0 rounded-xl px-4 py-3.5 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50" 
                                required 
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block font-body text-label-md text-on-surface-variant mb-2">Email</label>
                                <input 
                                  type="email" 
                                  name="email"
                                  value={formData.email}
                                  onChange={handleInputChange}
                                  placeholder="example@gmail.com" 
                                  className="w-full bg-surface-highest border-0 rounded-xl px-4 py-3.5 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50" 
                                  required 
                                />
                              </div>
                              <div>
                                <label className="block font-body text-label-md text-on-surface-variant mb-2">WhatsApp</label>
                                <div className="relative">
                                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-body text-body-md">+62</span>
                                  <input 
                                    type="tel" 
                                    name="whatsapp"
                                    value={formData.whatsapp}
                                    onChange={handleInputChange}
                                    placeholder="852xxxx" 
                                    className="w-full bg-surface-highest border-0 rounded-xl pl-12 pr-4 py-3.5 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50" 
                                    required 
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 2 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div>
                              <label className="block font-body text-label-md text-on-surface-variant mb-2">Provinsi Domisili</label>
                              <select 
                                name="province"
                                value={formData.province}
                                onChange={handleInputChange}
                                className="w-full bg-surface-highest border-0 rounded-xl px-4 py-3.5 font-body text-body-md text-white focus:outline-none focus:ring-1 focus:ring-primary/50"
                              >
                                <option>Sulawesi Selatan</option>
                                <option>Sulawesi Tengah</option>
                                <option>Sulawesi Tenggara</option>
                                <option>Sulawesi Utara</option>
                                <option>Gorontalo</option>
                                <option>Sulawesi Barat</option>
                              </select>
                            </div>
                            <div>
                              <label className="block font-body text-label-md text-on-surface-variant mb-2">Kota / Kabupaten</label>
                              <input 
                                type="text" 
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                placeholder="Contoh: Manado" 
                                className="w-full bg-surface-highest border-0 rounded-xl px-4 py-3.5 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50" 
                                required 
                              />
                            </div>
                            <div>
                              <label className="block font-body text-label-md text-on-surface-variant mb-2">Alamat Lengkap (Opsional)</label>
                              <textarea 
                                name="address"
                                value={formData.address}
                                onChange={handleInputChange}
                                rows={2} 
                                placeholder="Sebutkan alamat calon lokasi galeri/toko jika ada" 
                                className="w-full bg-surface-highest border-0 rounded-xl px-4 py-3.5 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50"
                              ></textarea>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 3 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <div>
                              <label className="block font-body text-label-md text-on-surface-variant mb-3">Produk yang Ingin Dipasarkan</label>
                              <div className="grid grid-cols-1 gap-3">
                                {[
                                  { id: 'bike', label: 'Sepeda Listrik (Goda, Winfly, Nuv)', icon: Zap },
                                  { id: 'electro', label: 'Elektronik & TV', icon: Award },
                                  { id: 'furniture', label: 'Sofa & Furnitur', icon: Info },
                                ].map((choice) => (
                                  <label key={choice.id} className="flex items-center gap-3 p-4 rounded-xl glass-dark border border-white/5 cursor-pointer hover:border-primary/30 transition-all">
                                    <input 
                                      type="checkbox" 
                                      checked={formData.preferredProducts.includes(choice.id)}
                                      onChange={() => handleCheckboxChange(choice.id)}
                                      className="w-5 h-5 rounded border-white/10 bg-surface-highest text-primary focus:ring-primary" 
                                    />
                                    <div className="flex items-center gap-3">
                                      <choice.icon className="w-5 h-5 text-primary" />
                                      <span className="font-body text-body-md text-white">{choice.label}</span>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                              <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                                <span className="text-primary font-bold">Catatan:</span> Langkah selanjutnya adalah mengunggah foto profil dan foto KTP untuk verifikasi identitas resmi agen.
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {currentStep === 4 && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                            <div>
                              <label className="font-body text-label-md text-on-surface-variant mb-4 flex items-center gap-2">
                                <Camera className="w-4 h-4 text-primary" />
                                Foto Profil & KTP
                              </label>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Profile Photo */}
                                <div className="space-y-2">
                                  <div className="font-body text-label-sm text-on-surface-variant">Foto Profil (3x4/Pas Foto)</div>
                                  <label className="relative flex flex-col items-center justify-center aspect-[3/4] rounded-2xl glass-dark border-2 border-dashed border-white/10 cursor-pointer overflow-hidden group hover:border-primary/50 transition-all">
                                    {previews.profilePhoto ? (
                                      <>
                                        <img src={previews.profilePhoto} alt="Profile Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Upload className="w-8 h-8 text-white" />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex flex-col items-center gap-2 text-on-surface-variant group-hover:text-primary transition-colors">
                                        <Upload className="w-8 h-8" />
                                        <span className="text-label-sm">Upload Foto</span>
                                      </div>
                                    )}
                                    <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFileChange(e, 'profilePhoto')} />
                                  </label>
                                </div>

                                {/* KTP Photo */}
                                <div className="space-y-2">
                                  <div className="font-body text-label-sm text-on-surface-variant">Foto KTP Asli</div>
                                  <label className="relative flex flex-col items-center justify-center aspect-[3/2] rounded-2xl glass-dark border-2 border-dashed border-white/10 cursor-pointer overflow-hidden group hover:border-primary/50 transition-all">
                                    {previews.ktpPhoto ? (
                                      <>
                                        <img src={previews.ktpPhoto} alt="KTP Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Upload className="w-8 h-8 text-white" />
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex flex-col items-center gap-2 text-on-surface-variant group-hover:text-primary transition-colors">
                                        <FileText className="w-8 h-8" />
                                        <span className="text-label-sm">Upload KTP</span>
                                      </div>
                                    )}
                                    <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleFileChange(e, 'ktpPhoto')} />
                                  </label>
                                </div>
                              </div>
                            </div>

                            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                              <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                                <span className="text-primary font-bold">Privasi Data:</span> Dokumen Anda akan dijaga kerahasiaannya dan hanya digunakan untuk proses verifikasi kemitraan resmi.
                              </p>
                            </div>
                          </motion.div>
                        )}

                        <div className="flex items-center gap-3 pt-4">
                          {currentStep > 1 && (
                            <button
                              type="button"
                              onClick={prevStep}
                              className="px-6 py-3.5 glass-dark border border-outline-variant rounded-xl font-body text-title-sm font-semibold text-white hover:border-primary/50 transition-all"
                            >
                              Kembali
                            </button>
                          )}
                          {currentStep < steps.length ? (
                            <button
                              type="button"
                              onClick={nextStep}
                              disabled={!isStepValid()}
                              className={`flex-1 flex items-center justify-center gap-2 py-3.5 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all ${!isStepValid() ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                            >
                              Lanjut
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={isSubmitting || !isStepValid()}
                              className={`flex-1 flex items-center justify-center gap-2 py-3.5 gradient-primary rounded-xl font-display text-title-sm font-bold text-surface shadow-neon-cyan-sm hover:shadow-neon-cyan transition-all ${isSubmitting || !isStepValid() ? 'opacity-70 cursor-not-allowed grayscale' : ''}`}
                            >
                              {isSubmitting ? 'Mengirim...' : 'Kirim Pendaftaran'}
                              {!isSubmitting && <Send className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center py-10"
                    >
                      <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 shadow-neon-cyan">
                        <Check className="w-10 h-10 text-surface" strokeWidth={3} />
                      </div>
                      <h3 className="font-display text-headline-sm font-bold text-white mb-2">Pendaftaran Terkirim!</h3>
                      <p className="font-body text-body-md text-on-surface-variant mb-8 leading-relaxed">
                        Terima kasih, data Anda telah kami terima. Tim Customer Experience kami akan menghubungi Anda melalui WhatsApp dalam waktu dekat.
                      </p>
                      <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-8 py-3.5 glass-dark border border-primary/20 rounded-xl font-display text-title-sm font-bold text-white hover:border-primary/50 transition-all"
                      >
                        Kembali ke Beranda
                      </Link>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Decorative background glow */}
              <div className="absolute -top-20 -right-20 w-80 h-80 bg-primary/10 rounded-full blur-3xl -z-10" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl -z-10" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ Mini */}
      <section className="pb-20 bg-surface/90 backdrop-blur-sm">
        <div className="container-custom">
          <SectionHeader
            title="Sering Ditanyakan"
            align="center"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              { q: 'Berapa biaya pendaftaran agen?', a: 'Pendaftaran agen resmi Tridjaya Group bersifat gratis. Anda hanya perlu menyetujui komitmen volume penjualan.' },
              { q: 'Apakah ada minimal pembelian?', a: 'Ya, terdapat minimal stok awal sesuai dengan level keagenan (Bronze, Silver, Gold).' },
              { q: 'Bagaimana dengan pengiriman?', a: 'Pengiriman unit ke lokasi agen sepenuhnya ditangani oleh armada logistik Tridjaya Group.' },
              { q: 'Dukungan apa yang diberikan?', a: 'Training produk, mentoring sales, materi marketing, dan akses ke sistem monitoring agen.' },
            ].map((faq, i) => (
              <div key={i} className="glass-card rounded-2xl p-6">
                <h4 className="font-display text-title-sm font-bold text-white mb-2">{faq.q}</h4>
                <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <p className="font-body text-body-md text-on-surface-variant mb-4">Masih punya pertanyaan?</p>
            <a
              href="https://wa.me/6285161542103"
              className="inline-flex items-center gap-2 font-display text-title-sm font-bold text-secondary hover:underline"
            >
              <Phone className="w-4 h-4" /> Hubungi Business Development Kami
            </a>
          </div>
        </div>
      </section>
    </>
  );
};

export default AgencyRegistrationPage;
