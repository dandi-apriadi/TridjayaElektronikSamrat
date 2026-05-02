import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload } from 'lucide-react';
import AdminProductBulkImport from '../../components/AdminProductBulkImport';

const containerVariants = { 
  hidden: { opacity: 0 }, 
  visible: { 
    opacity: 1, 
    transition: { staggerChildren: 0.06 } 
  } 
};

const itemVariants = { 
  hidden: { y: 16, opacity: 0 }, 
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { type: 'spring' as const, stiffness: 110, damping: 18 } 
  } 
};

const AdminProductBulkImportPage: React.FC = () => {
  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible" 
      className="space-y-6"
    >
      {/* Header with Back Button */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <Link
          to="/dashboard/admin/catalog"
          className="p-2 rounded-lg hover:bg-surface-high transition-colors"
          title="Kembali ke Katalog"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-on-surface flex items-center gap-2">
            <Upload className="w-8 h-8" />
            Bulk Import Produk
          </h1>
          <p className="text-on-surface-variant mt-1">Update data katalog produk secara massal dari file Excel</p>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div variants={itemVariants}>
        <AdminProductBulkImport />
      </motion.div>

      {/* Help Section */}
      <motion.div variants={itemVariants} className="glass-card rounded-lg p-6 border border-outline">
        <h3 className="text-lg font-semibold text-on-surface mb-4">📖 Panduan Penggunaan</h3>
        <div className="grid md:grid-cols-2 gap-6 text-sm text-on-surface-variant">
          <div>
            <h4 className="font-semibold text-on-surface mb-3">Format File Excel</h4>
            <ul className="list-disc list-inside space-y-2">
              <li>Kolom <code className="bg-surface-container px-2 py-1 rounded">nama</code> - Nama produk (wajib)</li>
              <li>Kolom <code className="bg-surface-container px-2 py-1 rounded">harga</code> - Harga produk</li>
              <li>Kolom <code className="bg-surface-container px-2 py-1 rounded">stok</code> - Status stok (available/limited/out_of_stock)</li>
              <li>Kolom <code className="bg-surface-container px-2 py-1 rounded">kategori</code> - Kategori produk</li>
              <li>Kolom lainnya bersifat opsional</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-on-surface mb-3">Proses Matching</h4>
            <ul className="list-disc list-inside space-y-2 text-on-surface-variant">
              <li>✅ <strong>Matched</strong> - Produk ditemukan, akan di-update</li>
              <li>➕ <strong>Baru</strong> - Produk belum ada, akan dibuat</li>
              <li>💰 <strong>Perubahan Harga</strong> - Harga akan langsung diupdate</li>
              <li>❌ <strong>Error</strong> - Ada masalah, silakan perbaiki</li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Tips Section */}
      <motion.div variants={itemVariants} className="glass-card rounded-lg p-6 border border-outline">
        <h3 className="text-lg font-semibold text-on-surface mb-4">💡 Tips</h3>
        <ul className="space-y-2 text-sm text-on-surface-variant">
          <li>• <strong>Pencocokan Nama:</strong> Sistem akan mencocokkan produk berdasarkan nama secara otomatis dengan smart matching (case-insensitive dan fuzzy search)</li>
          <li>• <strong>Preview Dulu:</strong> Selalu lihat preview sebelum memproses untuk memastikan data benar</li>
          <li>• <strong>Backup Data:</strong> Simpan backup data produk sebelum melakukan import massal</li>
          <li>• <strong>Kolom Opsional:</strong> Hanya kolom nama yang wajib ada, sisanya bisa dikosongkan</li>
          <li>• <strong>Format Harga:</strong> Gunakan angka saja tanpa simbol mata uang</li>
        </ul>
      </motion.div>
    </motion.div>
  );
};

export default AdminProductBulkImportPage;
