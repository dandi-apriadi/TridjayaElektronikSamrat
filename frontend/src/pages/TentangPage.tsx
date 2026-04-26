import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Users, MapPin, Zap, Star, TrendingUp, Handshake } from 'lucide-react';
import { Badge, SectionHeader, StatsRow, PartnerLogos } from '../components/ui';
import sofaImg from '../assets/images/sofa.webp';
import blogHeroImg from '../assets/images/blog-hero.webp';

const TentangPage: React.FC = () => {
  return (
    <>
      {/* Hero */}
      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <img src={blogHeroImg} alt="Tridjaya Office" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-surface via-surface/80 to-surface" />
        </div>
        <div className="relative z-10 container-custom text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <Badge label="Company Profile" variant="primary" />
            <h1 className="font-display text-display-sm font-bold text-on-surface mt-4 mb-4">
              Memberdayakan Sulawesi Dengan <span className="gradient-text-primary">Inovasi Berkelanjutan</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant leading-relaxed">
              Tridjaya Samrat adalah mitra terpercaya Anda untuk solusi mobilitas listrik, elektronik premium, dan furnitur berkualitas di wilayah Sulawesi.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Story */}
      <section className="pb-20 bg-surface/90">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="rounded-2xl overflow-hidden glass-card aspect-[4/3] relative !backdrop-blur-none">
                <img src={sofaImg} alt="Visi Kami" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface/60 to-transparent" />
              </div>
              <div className="absolute -bottom-6 -right-6 w-48 h-48 rounded-2xl bg-surface/80 border border-primary/20 shadow-ambient p-6 hidden md:block">
                <div className="font-display text-display-sm font-bold text-primary mb-1">15+</div>
                <div className="font-body text-body-sm text-on-surface-variant leading-tight">Tahun melayani pelanggan di Sulawesi</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <SectionHeader
                eyebrow="Cerita Kami"
                title="Lebih dari Sekadar Bisnis"
                align="left"
                className="mb-6"
              />
              <div className="space-y-4 font-body text-body-lg text-on-surface-variant leading-relaxed">
                <p>
                  Didirikan pada tahun 2010 di Manado, Tridjaya Samrat bermula sebagai toko elektronik sederhana dengan visi untuk menyediakan akses mudah bagi masyarakat lokal terhadap teknologi berkualitas.
                </p>
                <p>
                  Selama lebih dari satu dekade, kami telah berevolusi menjadi salah satu distributor multi-brand terbesar di Sulawesi, tidak hanya menyediakan elektronik dan furnitur, tetapi juga memimpin transisi menuju mobilitas hijau melalui kemitraan strategis dengan brand sepeda listrik ternama seperti Goda, Winfly, dan Nuv.
                </p>
                <p>
                  Kekuatan kami terletak pada layanan purna jual yang andal dan komitmen untuk membangun kemitraan yang saling menguntungkan dengan ribuan agen kami di seluruh pelosok Sulawesi.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Vision Mission */}
      <section className="section-padding bg-surface-low/95">
        <div className="container-custom">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-3xl p-8 lg:p-12 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-24 h-24 text-primary" />
              </div>
              <div className="relative z-10">
                <span className="font-body text-label-md text-primary uppercase tracking-widest font-bold mb-4 block">Visi Kami</span>
                <h3 className="font-display text-headline-sm font-bold text-on-surface mb-4 leading-tight">Menjadi Pioneer Ekosistem Gaya Hidup Berkelanjutan di Sulawesi</h3>
                <p className="font-body text-body-lg text-on-surface-variant leading-relaxed">
                  Menjadi pemimpin pasar yang menginspirasi masyarakat Sulawesi untuk mengadopsi teknologi modern dan ramah lingkungan melalui produk berkualitas dan layanan yang tak tertandingi.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="glass-card rounded-3xl p-8 lg:p-12 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <Handshake className="w-24 h-24 text-secondary" />
              </div>
              <div className="relative z-10">
                <span className="font-body text-label-md text-secondary uppercase tracking-widest font-bold mb-4 block">Misi Kami</span>
                <ul className="space-y-4">
                  {[
                    "Menghadirkan produk mobilitas & rumah tangga berkualitas dengan harga kompetitif.",
                    "Membangun jaringan purna jual dan servis yang menjangkau seluruh wilayah Sulawesi.",
                    "Memberdayakan masyarakat melalui program kemitraan agen yang inklusif.",
                    "Terus berinovasi dalam pembiayaan yang memudahkan semua kalangan masyarakat."
                  ].map((misi, i) => (
                    <li key={i} className="flex items-start gap-4 text-on-surface-variant font-body text-body-lg">
                      <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <div className="w-2 h-2 rounded-full bg-secondary" />
                      </div>
                      {misi}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="section-padding">
        <div className="container-custom text-center">
          <SectionHeader
            eyebrow="Nilai Inti Kami"
            title="Prinsip yang Menggerakkan Kami"
            className="mb-16"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Integritas', desc: 'Kejujuran dan transparansi dalam setiap interaksi bisnis.', color: 'text-primary' },
              { icon: Users, title: 'Berpusat pada Pelanggan', desc: 'Memahami dan melebihi kebutuhan pelanggan kami.', color: 'text-secondary' },
              { icon: Zap, title: 'Inovasi', desc: 'Selalu mencari cara baru untuk memberikan nilai tambah.', color: 'text-tertiary' },
              { icon: Star, title: 'Keunggulan', desc: 'Standar kualitas tertinggi dalam produk dan layanan.', color: 'text-yellow-400' },
            ].map((value, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card rounded-2xl p-8 hover:shadow-neon-cyan transition-all"
              >
                <div className={`w-14 h-14 rounded-2xl bg-surface-highest flex items-center justify-center mx-auto mb-6 ${value.color}`}>
                  <value.icon className="w-7 h-7" />
                </div>
                <h3 className="font-display text-title-md font-bold text-on-surface mb-3">{value.title}</h3>
                <p className="font-body text-body-md text-on-surface-variant">{value.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section-padding bg-surface-low/95">
        <div className="container-custom">
          <StatsRow />
        </div>
      </section>

      {/* Partners Ecosystem */}
      <section className="section-padding border-b border-outline-variant/10">
        <div className="container-custom">
          <SectionHeader
            eyebrow="Ekosistem Mitra"
            title="Membangun Masa Depan Bersama Brand Terbaik"
            align="center"
          />
          <div className="mt-12">
            <PartnerLogos />
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <SectionHeader
                eyebrow="Kehadiran Kami"
                title="Hadir di Jantung Sulawesi"
                align="left"
                className="mb-6"
              />
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0 mt-1">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-display text-title-sm font-bold text-on-surface mb-1">Kantor Pusat Samrat (Manado)</h4>
                    <p className="font-body text-body-md text-on-surface-variant leading-relaxed">
                      Jl. Sam Ratulangi No. 7, Wenang Utara, Kec. Wenang,<br />Kota Manado, Sulawesi Utara 95111
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center flex-shrink-0 mt-1">
                    <Users className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h4 className="font-display text-title-sm font-bold text-on-surface mb-1">Cabang Bahu & Jaringan Sulawesi</h4>
                    <p className="font-body text-body-md text-on-surface-variant leading-relaxed">
                      Selain di Bahu (Jl. Wolter Monginsidi), kami memiliki jaringan distribusi luas di seluruh Sulawesi Utara, Gorontalo, hingga Sulawesi Tengah.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-card rounded-2xl h-80 overflow-hidden relative"
            >
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.492029433547!2d124.83416237586232!3d1.4773809611508069!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x328775d731b447b9%3A0xa03d8aa65f4f3ec!2sTridjaya%20Elektronik%20Samrat!5e0!3m2!1sid!2sid!4v1776568679656!5m2!1sid!2sid"
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy" 
                referrerPolicy="no-referrer-when-downgrade"
                className="grayscale-[0.2] dark:invert-[0.9] dark:hue-rotate-180 transition-all duration-300"
              />
            </motion.div>
          </div>
        </div>
      </section>
    </>
  );
};

export default TentangPage;
