import React from 'react';
import { Link } from 'react-router-dom';
import { Box, Pencil, Plus } from 'lucide-react';

const products = [
  { sku: 'BK-GD120', name: 'Goda GD120', category: 'Bike', stock: 'Available', price: 'Rp 17.500.000', slug: 'goda-gd120' },
  { sku: 'BK-WF200', name: 'Winfly W200', category: 'Bike', stock: 'Indent', price: 'Rp 19.900.000', slug: 'winfly-w200' },
  { sku: 'EL-TV55', name: 'Smart TV 55"', category: 'Electronic', stock: 'Available', price: 'Rp 8.250.000', slug: 'smart-tv-65' },
  { sku: 'FR-SFLX2', name: 'Sofa Flexi 2', category: 'Furniture', stock: 'Hidden', price: 'Rp 6.800.000', slug: 'sofa-premium-l' },
];

const AdminCatalogPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface">Catalog Central</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">Source of truth harga, stok, dan spesifikasi untuk seluruh agen.</p>
        </div>
        <a href="mailto:catalog@tridjaya.co.id?subject=Permintaan%20Tambah%20Produk%20Baru" className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-semibold inline-flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> Tambah Produk
        </a>
      </div>

      <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-on-surface-variant">Validasi perubahan harga harus sinkron dengan tim sales dan promo.</p>
        <Link to="/produk/home" className="text-label-sm text-primary font-semibold hover:underline">
          Lihat katalog publik
        </Link>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[720px]">
            <thead>
              <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
                <th className="py-3 pr-3">SKU</th>
                <th className="py-3 pr-3">Produk</th>
                <th className="py-3 pr-3">Kategori</th>
                <th className="py-3 pr-3">Stok</th>
                <th className="py-3 pr-3">Harga OTR</th>
                <th className="py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.sku} className="border-b border-outline-variant/10">
                  <td className="py-3 pr-3 text-on-surface-variant">{product.sku}</td>
                  <td className="py-3 pr-3 text-on-surface font-semibold inline-flex items-center gap-2"><Box className="w-4 h-4 text-primary" /> {product.name}</td>
                  <td className="py-3 pr-3 text-on-surface-variant">{product.category}</td>
                  <td className="py-3 pr-3">
                    <span className="px-2 py-1 rounded-md text-label-sm bg-surface-high text-on-surface-variant">{product.stock}</span>
                  </td>
                  <td className="py-3 pr-3 text-on-surface">{product.price}</td>
                  <td className="py-3">
                    <Link to={`/produk/${product.slug}`} className="px-3 py-1.5 rounded-lg bg-surface-high text-on-surface-variant text-label-sm font-semibold inline-flex items-center gap-1 hover:text-on-surface transition-colors">
                      <Pencil className="w-4 h-4" /> Preview
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCatalogPage;