import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import logoHorizontal from '../../assets/images/logo-horizontal.webp';

const Footer: React.FC = () => {
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const handleNewsletterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newsletterEmail.trim()) {
      return;
    }

    const subject = encodeURIComponent('Berlangganan Info Promo Tridjaya Manado');
    const body = encodeURIComponent(
      `Halo tim Tridjaya Manado,\n\nSaya ingin berlangganan update promo terbaru.\nEmail: ${newsletterEmail}\n\nTerima kasih.`
    );

    window.location.href = `mailto:dandimamonto.tridjaya03@gmail.com?subject=${subject}&body=${body}`;
    setNewsletterEmail('');
  };

  return (
    <footer className="relative bg-surface-low overflow-hidden">
      {/* Top glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      {/* Mesh background */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative">
        {/* CTA Banner */}
        <div className="py-12 border-b border-outline-variant/20">
          <div className="glass-card rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="font-display text-headline-sm text-on-surface font-bold mb-1">
                Siap Jadi Bagian dari Keluarga Tridjaya?
              </h3>
              <p className="font-body text-body-md text-on-surface-variant">
                Daftarkan diri sebagai agen resmi dan mulai perjalanan bisnis Anda hari ini.
              </p>
            </div>
            <Link
              to="/daftar-agen"
              className="flex items-center gap-2 px-6 py-3 gradient-primary rounded-xl font-body text-body-md font-bold text-surface whitespace-nowrap hover:shadow-neon-cyan transition-all duration-300 group"
            >
              Daftar Sekarang
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Main footer */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <img src={logoHorizontal} alt="Tridjaya Logo" className="h-16 w-auto object-contain" />
            </Link>
            <p className="font-body text-body-md text-on-surface-variant leading-relaxed mb-5">
              Distributor sepeda listrik, elektronik, dan furnitur premium di Sulawesi. Terpercaya sejak 2010.
            </p>
            <div className="flex items-center gap-3">
              <a
                  href="https://www.instagram.com/tridjayasamrat"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-9 h-9 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-primary hover:shadow-neon-cyan-sm transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                </a>
                <a
                  href="https://www.youtube.com/@tridjayasamrat"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="YouTube"
                  className="w-9 h-9 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-primary hover:shadow-neon-cyan-sm transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M2.5 7.1C2.5 7.1 2.5 4.6 12 4.6C21.5 4.6 21.5 7.1 21.5 7.1V16.9C21.5 16.9 21.5 19.4 12 19.4C2.5 19.4 2.5 16.9 2.5 16.9V7.1Z"/><path d="M9.8 14.5L15.5 11.7L9.8 8.9V14.5Z"/></svg>
                </a>
                <a
                  href="https://www.facebook.com/tridjayasamrat"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-lg glass-card flex items-center justify-center text-on-surface-variant hover:text-primary hover:shadow-neon-cyan-sm transition-all duration-200"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                </a>
            </div>
          </div>

          {/* Produk */}
          <div>
            <h4 className="font-display text-title-sm font-semibold text-on-surface mb-4">Produk</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Sepeda Listrik', href: '/produk?kategori=Sepeda+Listrik' },
                { label: 'Motor Listrik', href: '/produk?kategori=Motor+Listrik' },
                { label: 'Elektronik & Furnitur', href: '/produk?kategori=Elektronik' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="font-body text-body-md text-on-surface-variant hover:text-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Perusahaan */}
          <div>
            <h4 className="font-display text-title-sm font-semibold text-on-surface mb-4">Perusahaan</h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Tentang Kami', href: '/tentang' },
                { label: 'Karier', href: '/karier' },
                { label: 'Blog & Tips', href: '/blog' },
                { label: 'Promo Terkini', href: '/promo' },
                { label: 'Program Agen', href: '/daftar-agen' },
                { label: 'Syarat & Ketentuan', href: '/syarat-layanan' },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link
                    to={href}
                    className="font-body text-body-md text-on-surface-variant hover:text-primary transition-colors duration-150"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Kontak */}
          <div>
            <h4 className="font-display text-title-sm font-semibold text-on-surface mb-4">Hubungi Kami</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://wa.me/6285161542103"
                  className="flex items-center gap-3 font-body text-body-md text-on-surface-variant hover:text-primary transition-colors duration-150"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-high flex items-center justify-center flex-shrink-0">
                    <Phone className="w-3.5 h-3.5 text-primary" />
                  </div>
                  +62 851-6154-2103
                </a>
              </li>
              <li>
                <a
                  href="mailto:dandimamonto.tridjaya03@gmail.com"
                  className="flex items-center gap-3 font-body text-body-md text-on-surface-variant hover:text-primary transition-colors duration-150"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-high flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                  </div>
                  dandimamonto.tridjaya03@gmail.com
                </a>
              </li>
              <li>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-highest flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="font-body text-body-md text-on-surface-variant">
                      <strong>Cabang Samrat:</strong><br />
                      Jl. Sam Ratulangi No. 147, Wenang Utara,<br />Manado, Sulawesi Utara
                    </span>
                    <span className="font-body text-body-md text-on-surface-variant">
                      <strong>Cabang Bahu:</strong><br />
                      Jl. Wolter Monginsidi (Bahu), Malalayang,<br />Manado, Sulawesi Utara
                    </span>
                  </div>
                </div>
              </li>
            </ul>

            {/* Newsletter */}
            <div className="mt-6">
              <p className="font-body text-body-sm text-on-surface-variant mb-2">Info promo terbaru via email:</p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email kamu..."
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  className="flex-1 bg-surface-high border-0 rounded-lg px-3 py-2 font-body text-body-sm text-on-surface placeholder-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary/50"
                  required
                />
                <button type="submit" className="px-3 py-2 gradient-primary rounded-lg text-surface" aria-label="Berlangganan newsletter">
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="py-6 border-t border-outline-variant/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-body text-body-sm text-on-surface-variant">
            © 2025 Tridjaya Manado. Semua hak dilindungi undang-undang.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/kebijakan-privasi" className="font-body text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              Kebijakan Privasi
            </Link>
            <span className="w-1 h-1 rounded-full bg-outline-variant" />
            <Link to="/syarat-layanan" className="font-body text-body-sm text-on-surface-variant hover:text-primary transition-colors">
              Syarat Layanan
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
