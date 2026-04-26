import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, Scale, Handshake, ArrowLeft } from 'lucide-react';

const TermsOfServicePage: React.FC = () => {
  return (
    <section className="pt-28 pb-20 bg-surface/90 backdrop-blur-sm">
      <div className="container-custom max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-body-sm text-on-surface-variant hover:text-primary transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>

        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg bg-secondary/15 text-secondary text-label-sm font-semibold uppercase tracking-wide">
            <FileCheck2 className="w-4 h-4" /> Syarat Layanan
          </div>
          <h1 className="font-display text-headline-md font-bold text-on-surface mb-2">Syarat dan Ketentuan Layanan</h1>
          <p className="text-body-sm text-on-surface-variant mb-8">Berlaku sejak: 19 April 2026</p>

          <div className="space-y-7 text-body-md text-on-surface-variant leading-relaxed">
            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2 inline-flex items-center gap-2">
                <Scale className="w-4 h-4 text-secondary" /> Ruang Lingkup Layanan
              </h2>
              <p>
                Tridjaya Samrat menyediakan informasi produk, promo, pendaftaran kemitraan agen, dan kanal komunikasi penjualan melalui
                website resmi. Semua penggunaan layanan tunduk pada syarat ini dan hukum yang berlaku di Indonesia.
              </p>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2">Kewajiban Pengguna</h2>
              <ul className="space-y-2">
                <li>• Memberikan data yang akurat dan tidak menyesatkan.</li>
                <li>• Tidak menggunakan platform untuk aktivitas ilegal, spam, atau penyalahgunaan sistem.</li>
                <li>• Mematuhi ketentuan transaksi, promo, dan kebijakan pembiayaan yang berlaku.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2 inline-flex items-center gap-2">
                <Handshake className="w-4 h-4 text-primary" /> Ketentuan Program Agen
              </h2>
              <p>
                Persetujuan sebagai agen bersifat selektif berdasarkan verifikasi data, wilayah operasional, dan evaluasi internal. Tridjaya
                berhak menolak atau menonaktifkan akun agen yang melanggar kebijakan operasional, etika bisnis, atau ketentuan pembayaran.
              </p>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2">Batasan Tanggung Jawab</h2>
              <p>
                Informasi harga, stok, dan promo dapat berubah sewaktu-waktu sesuai kebijakan perusahaan dan ketersediaan produk. Kami
                berupaya menjaga akurasi data, namun keputusan transaksi akhir mengikuti konfirmasi resmi tim penjualan.
              </p>
            </div>

            <div>
              <h2 className="font-display text-title-md font-bold text-on-surface mb-2">Kontak Resmi</h2>
              <p>
                Untuk pertanyaan legal dan syarat layanan, hubungi
                <a href="mailto:dandimamonto.tridjaya03@gmail.com" className="text-primary font-semibold hover:underline"> dandimamonto.tridjaya03@gmail.com</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TermsOfServicePage;