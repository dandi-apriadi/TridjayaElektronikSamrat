import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Megaphone, Plus } from 'lucide-react';

const promos = [
  { id: 'PR-991', title: 'Electric Freedom April', period: '01 Apr - 30 Apr', discount: 'Rp 1.500.000', products: 6, status: 'Active' },
  { id: 'PR-988', title: 'Cooling Days', period: '10 Apr - 25 Apr', discount: '10%', products: 4, status: 'Active' },
  { id: 'PR-979', title: 'Comfort Weekend', period: '15 Mar - 31 Mar', discount: 'Rp 750.000', products: 3, status: 'Archived' },
];

const AdminPromoPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-title-md font-bold text-on-surface">Manajemen Promo</h3>
          <p className="text-body-sm text-on-surface-variant mt-1">Kelola campaign aktif, jadwal promo, dan linked product.</p>
        </div>
        <a href="mailto:promo@tridjaya.co.id?subject=Permintaan%20Campaign%20Promo%20Baru" className="px-4 py-2 rounded-xl bg-tertiary/20 text-tertiary font-semibold inline-flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" /> Buat Campaign
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {promos.map((promo) => (
          <div key={promo.id} className="glass-card rounded-2xl p-5 border border-outline-variant/15">
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-sm text-on-surface-variant">{promo.id}</span>
              <span className="text-label-sm px-2 py-1 rounded-md bg-surface-high text-on-surface-variant">{promo.status}</span>
            </div>
            <h4 className="font-semibold text-on-surface inline-flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" /> {promo.title}
            </h4>
            <div className="text-body-sm text-on-surface-variant mt-2 inline-flex items-center gap-2">
              <CalendarRange className="w-4 h-4" /> {promo.period}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-label-sm text-on-surface-variant">Nilai Promo</div>
                <div className="font-bold text-primary">{promo.discount}</div>
              </div>
              <div className="text-right">
                <div className="text-label-sm text-on-surface-variant">Produk</div>
                <div className="font-bold text-on-surface">{promo.products}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-outline-variant/15 flex items-center justify-between">
              <Link to="/promo" className="text-label-sm text-primary font-semibold hover:underline">
                Preview halaman promo
              </Link>
              <Link to="/dashboard/admin/catalog" className="text-label-sm text-on-surface-variant hover:text-on-surface transition-colors">
                Lihat produk terkait
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminPromoPage;