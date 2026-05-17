import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Plus, Edit2, Trash2, MapPin, User } from 'lucide-react';

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const itemVariants = { hidden: { y: 16, opacity: 0 }, visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 110, damping: 18 } } };

interface Cabang {
  id: string;
  nama: string;
  alamat: string;
  kota: string;
  telepon: string;
  koordinatorNama: string;
  isActive: boolean;
  jumlahKaryawan: number;
}

// Dummy data
const initialCabang: Cabang[] = [
  { id: 'cab-01', nama: 'Manado Pusat', alamat: 'Jl. Sam Ratulangi No. 45', kota: 'Manado', telepon: '0431-123456', koordinatorNama: 'Gunawan', isActive: true, jumlahKaryawan: 12 },
  { id: 'cab-02', nama: 'Tomohon', alamat: 'Jl. Raya Tomohon No. 12', kota: 'Tomohon', telepon: '0431-234567', koordinatorNama: 'Ricky Mamahit', isActive: true, jumlahKaryawan: 8 },
  { id: 'cab-03', nama: 'Bitung', alamat: 'Jl. Yos Sudarso No. 78', kota: 'Bitung', telepon: '0438-345678', koordinatorNama: 'Denny Pangalila', isActive: true, jumlahKaryawan: 9 },
  { id: 'cab-04', nama: 'Minahasa', alamat: 'Jl. Trans Sulawesi No. 33', kota: 'Tondano', telepon: '0431-456789', koordinatorNama: 'Mario Tendean', isActive: true, jumlahKaryawan: 7 },
  { id: 'cab-05', nama: 'Kotamobagu', alamat: 'Jl. Ahmad Yani No. 56', kota: 'Kotamobagu', telepon: '0434-567890', koordinatorNama: 'Steffy Lumowa', isActive: true, jumlahKaryawan: 6 },
  { id: 'cab-06', nama: 'Tondano', alamat: 'Jl. Manguni No. 21', kota: 'Tondano', telepon: '0431-678901', koordinatorNama: 'Grace Maramis', isActive: true, jumlahKaryawan: 5 },
  { id: 'cab-07', nama: 'Airmadidi', alamat: 'Jl. Raya Airmadidi No. 8', kota: 'Airmadidi', telepon: '0431-789012', koordinatorNama: 'Feby Kalalo', isActive: true, jumlahKaryawan: 5 },
  { id: 'cab-08', nama: 'Langowan', alamat: 'Jl. Pasar Langowan No. 15', kota: 'Langowan', telepon: '0431-890123', koordinatorNama: 'Jefri Sumolang', isActive: true, jumlahKaryawan: 4 },
  { id: 'cab-09', nama: 'Ratahan', alamat: 'Jl. Trans Minahasa No. 42', kota: 'Ratahan', telepon: '0431-901234', koordinatorNama: 'Novita Runtuwene', isActive: true, jumlahKaryawan: 4 },
  { id: 'cab-10', nama: 'Amurang', alamat: 'Jl. Pantai Amurang No. 7', kota: 'Amurang', telepon: '0431-012345', koordinatorNama: 'Hendra Waworuntu', isActive: true, jumlahKaryawan: 5 },
  { id: 'cab-11', nama: 'Tahuna', alamat: 'Jl. Pelabuhan Tahuna No. 3', kota: 'Tahuna', telepon: '0432-123456', koordinatorNama: 'Melisa Tumewu', isActive: true, jumlahKaryawan: 4 },
  { id: 'cab-12', nama: 'Tagulandang', alamat: 'Jl. Utama Tagulandang No. 1', kota: 'Tagulandang', telepon: '0432-234567', koordinatorNama: 'Agus Pinontoan', isActive: true, jumlahKaryawan: 3 },
  { id: 'cab-13', nama: 'Lirung', alamat: 'Jl. Raya Lirung No. 9', kota: 'Lirung', telepon: '0432-345678', koordinatorNama: 'Budi Lasut', isActive: true, jumlahKaryawan: 3 },
  { id: 'cab-14', nama: 'Ondong', alamat: 'Jl. Ondong Siau No. 5', kota: 'Ondong', telepon: '0432-456789', koordinatorNama: 'Christin Mokoginta', isActive: true, jumlahKaryawan: 3 },
  { id: 'cab-15', nama: 'Beo', alamat: 'Jl. Beo Talaud No. 2', kota: 'Beo', telepon: '0432-567890', koordinatorNama: 'Rivaldo Lolowang', isActive: true, jumlahKaryawan: 3 },
  { id: 'cab-16', nama: 'Melonguane', alamat: 'Jl. Melonguane No. 11', kota: 'Melonguane', telepon: '0432-678901', koordinatorNama: 'Siska Mawuntu', isActive: true, jumlahKaryawan: 3 },
];

const AdminCabangPage: React.FC = () => {
  const [cabangList] = useState<Cabang[]>(initialCabang);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: '', alamat: '', kota: '', telepon: '', koordinatorNama: '' });

  const totalKaryawan = cabangList.reduce((s, c) => s + c.jumlahKaryawan, 0);
  const activeCabang = cabangList.filter((c) => c.isActive).length;

  const handleEdit = (cab: Cabang) => {
    setEditId(cab.id);
    setFormData({ nama: cab.nama, alamat: cab.alamat, kota: cab.kota, telepon: cab.telepon, koordinatorNama: cab.koordinatorNama });
    setShowForm(true);
  };

  const handleNew = () => {
    setEditId(null);
    setFormData({ nama: '', alamat: '', kota: '', telepon: '', koordinatorNama: '' });
    setShowForm(true);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-sm font-bold text-on-surface">Cabang Management</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">Kelola seluruh cabang Tridjaya Elektronik</p>
        </div>
        <button onClick={handleNew} className="px-4 py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-2 text-label-sm">
          <Plus className="w-4 h-4" />Tambah Cabang
        </button>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Cabang</div>
          <div className="font-display text-headline-sm font-bold text-primary">{cabangList.length}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/40 to-transparent" />
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Cabang Aktif</div>
          <div className="font-display text-headline-sm font-bold text-secondary">{activeCabang}</div>
        </motion.div>
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
          <div className="text-label-xs text-on-surface-variant uppercase tracking-widest mb-1">Total Karyawan</div>
          <div className="font-display text-headline-sm font-bold text-on-surface">{totalKaryawan}</div>
        </motion.div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
          <h3 className="font-display text-title-md font-bold text-on-surface mb-4">{editId ? 'Edit Cabang' : 'Tambah Cabang Baru'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant font-semibold">Nama Cabang *</label>
              <input type="text" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} placeholder="Manado Pusat" className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 text-body-md" />
            </div>
            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant font-semibold">Kota *</label>
              <input type="text" value={formData.kota} onChange={(e) => setFormData({ ...formData, kota: e.target.value })} placeholder="Manado" className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 text-body-md" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-label-sm text-on-surface-variant font-semibold">Alamat</label>
              <input type="text" value={formData.alamat} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} placeholder="Jl. Sam Ratulangi No. 45" className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 text-body-md" />
            </div>
            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant font-semibold">Telepon</label>
              <input type="text" value={formData.telepon} onChange={(e) => setFormData({ ...formData, telepon: e.target.value })} placeholder="0431-123456" className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 text-body-md" />
            </div>
            <div className="space-y-1.5">
              <label className="text-label-sm text-on-surface-variant font-semibold">Koordinator</label>
              <input type="text" value={formData.koordinatorNama} onChange={(e) => setFormData({ ...formData, koordinatorNama: e.target.value })} placeholder="Nama koordinator" className="w-full px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-xl outline-none focus:ring-2 focus:ring-primary/40 text-body-md" />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button className="px-5 py-2.5 bg-primary text-on-primary font-semibold rounded-xl hover:bg-primary/90 transition-colors text-label-sm">{editId ? 'Simpan' : 'Tambah'}</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 bg-surface-high text-on-surface font-semibold rounded-xl hover:bg-surface-high/80 transition-colors text-label-sm">Batal</button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <motion.div variants={itemVariants} className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Daftar Cabang</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Cabang</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Alamat</th>
                <th className="text-left text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Koordinator</th>
                <th className="text-center text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Karyawan</th>
                <th className="text-center text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Status</th>
                <th className="text-center text-label-xs text-on-surface-variant uppercase tracking-widest py-3 px-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cabangList.map((cab) => (
                <tr key={cab.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <div>
                        <div className="text-body-sm font-semibold text-on-surface">{cab.nama}</div>
                        <div className="text-label-xs text-on-surface-variant flex items-center gap-1"><MapPin className="w-3 h-3" />{cab.kota}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-body-sm text-on-surface-variant">{cab.alamat}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-on-surface-variant" />
                      <span className="text-body-sm text-on-surface">{cab.koordinatorNama}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-body-sm text-on-surface text-center font-semibold">{cab.jumlahKaryawan}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-label-xs font-semibold ${cab.isActive ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>
                      {cab.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => handleEdit(cab)} className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-white/5 text-on-surface-variant hover:text-error transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminCabangPage;
