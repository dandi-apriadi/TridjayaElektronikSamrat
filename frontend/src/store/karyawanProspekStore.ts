import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ProspekStatus = 'deal' | 'not_deal' | 'fu_ulang' | 'tanya_tanya' | 'polling';

export interface KaryawanProspekEntry {
  id: string;
  karyawanId: string;
  karyawanName: string;
  cabang: string;
  divisi: string;
  namaProspek: string;
  noWhatsapp: string;
  minatBarang: string;
  keteranganProspek: string;
  statusProspek: ProspekStatus;
  keteranganFincoy: string;
  tanggal: string;
  createdAt: string;
}

export const statusLabel: Record<ProspekStatus, string> = {
  deal: 'Deal',
  not_deal: 'Not Deal',
  fu_ulang: 'FU Ulang',
  tanya_tanya: 'Tanya-tanya',
  polling: 'Polling',
};

export const statusColor: Record<ProspekStatus, string> = {
  deal: 'bg-secondary/10 text-secondary border-secondary/20',
  not_deal: 'bg-error/10 text-error border-error/20',
  fu_ulang: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  tanya_tanya: 'bg-primary/10 text-primary border-primary/20',
  polling: 'bg-tertiary/10 text-tertiary border-tertiary/20',
};

export const formatProspekDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const daysAgo = (days: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return formatProspekDateKey(date);
};

export const normalizeWhatsapp = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

export const buildWhatsappUrl = (phone: string, name: string) => {
  const normalized = normalizeWhatsapp(phone);
  const message = `Halo ${name}, saya dari Tridjaya Manado ingin follow up minat produk yang sebelumnya dibahas.`;
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : '#';
};

interface SeedUser {
  id?: string;
  name?: string;
  divisi?: string;
}

interface KaryawanProspekState {
  prospek: KaryawanProspekEntry[];
  addProspek: (entry: Omit<KaryawanProspekEntry, 'id'>) => void;
  ensureSeedForUser: (user: SeedUser | null | undefined) => void;
}

const createSeedRows = (user: SeedUser): KaryawanProspekEntry[] => {
  const ownerId = user.id || 'emp-local';
  const ownerName = user.name || 'Karyawan Tridjaya';
  const divisi = user.divisi || 'Sales';

  return [
    ['1', 'BUDI SANTOSO', '081234567890', 'TV LED 43 INCH', 'Minta simulasi cicilan dan promo akhir pekan.', 'fu_ulang', 'FIF', 0, '08:30'],
    ['2', 'SITI RAHAYU', '082345678901', 'KULKAS 2 PINTU', 'Siap datang ke toko setelah jam kerja.', 'deal', 'Spektra', 0, '09:15'],
    ['3', 'AHMAD FAUZI', '083456789012', 'AC 1 PK', 'Masih bandingkan harga dengan toko sebelah.', 'tanya_tanya', '', 0, '10:00'],
    ['4', 'MELDA KANDEWANGKO', '085240001122', 'MESIN CUCI 2 TABUNG', 'Minta dihubungi sore untuk DP.', 'fu_ulang', 'Adira', 1, '15:40'],
    ['5', 'FERDI LUMEMBAN', '081355667788', 'SAIGE POLARIS', 'Belum cocok di tenor, minta opsi lebih ringan.', 'polling', 'FIF', 2, '12:10'],
    ['6', 'NOVA WUISAN', '082198765432', 'SMART TV 50 INCH', 'Setuju harga promo, menunggu konfirmasi keluarga.', 'deal', 'Tunai', 3, '16:20'],
    ['7', 'RIZKY MANGINDAAN', '081244556677', 'FREEZER BOX', 'Butuh stok cepat untuk usaha.', 'tanya_tanya', '', 4, '11:05'],
    ['8', 'CLARA RUNTU', '085256789123', 'KIPAS ANGIN', 'Nomor tidak aktif saat follow up kedua.', 'not_deal', '', 5, '14:15'],
    ['9', 'HENDRA TUMBELAKA', '081390112233', 'SPRING BED', 'Minta brosur ukuran dan warna.', 'fu_ulang', 'Spektra', 6, '09:50'],
    ['10', 'YULIANA LASUT', '082292334455', 'KOMPOR TANAM', 'Masih tanya-tanya fitur garansi.', 'tanya_tanya', '', 8, '13:25'],
    ['11', 'ANDRE ROMPAS', '081247890123', 'LAPTOP ASUS', 'Butuh cicilan kantor, minta invoice sementara.', 'deal', 'Kredit Plus', 10, '10:45'],
    ['12', 'TESSA KAWATU', '085341234567', 'DISPENSER GALON BAWAH', 'Akan follow up setelah gajian.', 'fu_ulang', 'FIF', 12, '17:05'],
    ['13', 'MARLON PAAT', '082345111222', 'SPEAKER AKTIF', 'Harga belum masuk budget.', 'not_deal', '', 16, '11:35'],
    ['14', 'EKA TUMUNDO', '081356222333', 'SEPEDA LISTRIK', 'Masih polling warna untuk anak.', 'polling', 'Adira', 20, '15:00'],
    ['15', 'RENI WOROTIKAN', '085299887766', 'KULKAS 1 PINTU', 'Minta pengiriman area Minahasa.', 'deal', 'Tunai', 25, '12:40'],
  ].map((row) => ({
    id: `${ownerId}-seed-${row[0]}`,
    karyawanId: ownerId,
    karyawanName: ownerName,
    cabang: 'Manado',
    divisi,
    namaProspek: row[1] as string,
    noWhatsapp: row[2] as string,
    minatBarang: row[3] as string,
    keteranganProspek: row[4] as string,
    statusProspek: row[5] as ProspekStatus,
    keteranganFincoy: row[6] as string,
    tanggal: daysAgo(row[7] as number),
    createdAt: row[8] as string,
  }));
};

export const useKaryawanProspekStore = create<KaryawanProspekState>()(
  persist(
    (set, get) => ({
      prospek: [],
      addProspek: (entry) => {
        const id = `prospek-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((state) => ({ prospek: [{ ...entry, id }, ...state.prospek] }));
      },
      ensureSeedForUser: (user) => {
        const ownerId = user?.id || 'emp-local';
        const hasSeed = get().prospek.some((item) => item.karyawanId === ownerId && item.id.startsWith(`${ownerId}-seed-`));
        if (hasSeed) return;
        set((state) => ({ prospek: [...createSeedRows(user || {}), ...state.prospek] }));
      },
    }),
    {
      name: 'tridjaya-karyawan-prospek',
      version: 1,
    },
  ),
);
