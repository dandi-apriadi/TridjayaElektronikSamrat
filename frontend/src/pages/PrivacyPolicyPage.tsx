import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Database, ArrowLeft } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <section className="pt-28 pb-20 bg-surface/90 backdrop-blur-sm">
      <div className="container-custom max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>

        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-label-sm font-semibold uppercase tracking-wide">
            <ShieldCheck className="w-4 h-4" /> Kebijakan Privasi
          </div>
          <h1 className="font-display text-headline-md font-bold text-on-surface mb-2">Kebijakan Privasi Tridjaya Manado</h1>
          <p className="text-body-sm text-on-surface-variant mb-8">Terakhir diperbarui: 19 April 2026</p>

          <div className="space-y-7 text-body-md text-on-surface-variant leading-relaxed">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2 inline-flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" /> Data yang Kami Kumpulkan
              </h2>
              <p>
                Kami mengumpulkan data yang Anda berikan secara sukarela, seperti nama, email, nomor telepon, serta informasi minat produk
                saat Anda mengisi formulir pendaftaran agen, menghubungi kami, atau berlangganan informasi promo.
              </p>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2 inline-flex items-center gap-2">
                <Database className="w-4 h-4 text-secondary" /> Penggunaan Data
              </h2>
              <ul className="space-y-2">
                <li>• Memproses permintaan informasi, pendaftaran, dan layanan purna jual.</li>
                <li>• Mengirim pembaruan promo, katalog, atau informasi program agen.</li>
                <li>• Meningkatkan kualitas layanan, analitik internal, dan keamanan sistem.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2">Perlindungan dan Retensi Data</h2>
              <p>
                Data disimpan dengan kontrol akses berbasis peran, enkripsi pada saluran komunikasi, serta audit berkala untuk mencegah akses
                tidak sah. Data pribadi disimpan selama diperlukan untuk tujuan operasional dan kepatuhan hukum yang berlaku.
              </p>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2">Hak Pengguna</h2>
              <p>
                Anda berhak meminta akses, koreksi, atau penghapusan data pribadi Anda. Permintaan dapat dikirim melalui email ke
                <a href="mailto:dandimamonto.tridjaya03@gmail.com" className="text-primary font-semibold hover:underline"> dandimamonto.tridjaya03@gmail.com</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PrivacyPolicyPage;
