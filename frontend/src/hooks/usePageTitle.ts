import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'Tridjaya';

// Static route → title map
const ROUTE_TITLES: Record<string, string> = {
  '/': `${SITE} — Beranda`,
  '/produk': `Katalog Produk — ${SITE}`,
  '/promo': `Promo — ${SITE}`,
  '/blog': `Blog — ${SITE}`,
  '/tentang': `Tentang Kami — ${SITE}`,
  '/karier': `Karier — ${SITE}`,
  '/daftar-agen': `Daftar Agen — ${SITE}`,
  '/kebijakan-privasi': `Kebijakan Privasi — ${SITE}`,
  '/syarat-layanan': `Syarat Layanan — ${SITE}`,
  '/login': `Login — ${SITE}`,
  '/forgot-password': `Lupa Password — ${SITE}`,
  '/reset-password': `Reset Password — ${SITE}`,
  '/verify-email': `Verifikasi Email — ${SITE}`,
  // Dashboard — Admin
  '/dashboard': `Dashboard — ${SITE}`,
  '/dashboard/settings': `Pengaturan Akun — ${SITE}`,
  '/dashboard/admin': `Admin — ${SITE}`,
  '/dashboard/admin/agents': `Manajemen Agen — ${SITE}`,
  '/dashboard/admin/agents/directory': `Direktori Agen — ${SITE}`,
  '/dashboard/admin/catalog': `Katalog Admin — ${SITE}`,
  '/dashboard/admin/categories': `Kategori Produk — ${SITE}`,
  '/dashboard/admin/catalog/new': `Tambah Produk — ${SITE}`,
  '/dashboard/admin/catalog/bulk-import': `Bulk Import — ${SITE}`,
  '/dashboard/admin/promo': `Promo Admin — ${SITE}`,
  '/dashboard/admin/promo/new': `Tambah Promo — ${SITE}`,
  '/dashboard/admin/content': `Konten Blog — ${SITE}`,
  '/dashboard/admin/content/new': `Tulis Artikel — ${SITE}`,
  '/dashboard/admin/telemetry': `Telemetri — ${SITE}`,
  '/dashboard/admin/users': `Pengguna — ${SITE}`,
  '/dashboard/admin/users/new': `Tambah Pengguna — ${SITE}`,
  '/dashboard/admin/finance': `Keuangan — ${SITE}`,
  '/dashboard/admin/partners': `Partner — ${SITE}`,
  '/dashboard/admin/leaderboard': `Leaderboard — ${SITE}`,
  '/dashboard/admin/leads': `Leads — ${SITE}`,
  '/dashboard/admin/careers': `Lowongan Kerja — ${SITE}`,
  '/dashboard/admin/notifications': `Notifikasi — ${SITE}`,
  '/dashboard/admin/wa/campaigns': `WA Campaigns — ${SITE}`,
  '/dashboard/admin/wa/accounts': `WA Accounts — ${SITE}`,
  '/dashboard/admin/wa/campaign/new': `Buat Campaign WA — ${SITE}`,
  // Dashboard — Agen
  '/dashboard/agent': `Dashboard Agen — ${SITE}`,
  '/dashboard/agent/knowledge': `Product Knowledge — ${SITE}`,
  '/dashboard/agent/leads': `Leads Saya — ${SITE}`,
  '/dashboard/agent/earnings': `Komisi — ${SITE}`,
  '/dashboard/agent/push': `Push Prospek — ${SITE}`,
  '/dashboard/agent/prospek': `Submit Prospek — ${SITE}`,
  '/dashboard/agent/prospek/database': `Database Prospek — ${SITE}`,
  '/dashboard/agent/leaderboard': `Leaderboard — ${SITE}`,
  '/dashboard/agent/settings': `Pengaturan — ${SITE}`,
  '/dashboard/agent/notifications': `Notifikasi — ${SITE}`,
  // Dashboard — Sales
  '/dashboard/sales': `Dashboard Sales — ${SITE}`,
  '/dashboard/sales/knowledge': `Product Knowledge — ${SITE}`,
  '/dashboard/sales/delivery': `Jadwal Pengiriman — ${SITE}`,
  '/dashboard/sales/prospek': `Submit Prospek — ${SITE}`,
  '/dashboard/sales/prospek/database': `Database Prospek — ${SITE}`,
  '/dashboard/sales/referral': `Referral — ${SITE}`,
  '/dashboard/sales/settings': `Pengaturan — ${SITE}`,
  '/dashboard/sales/notifications': `Notifikasi — ${SITE}`,
  '/dashboard/operator/prospek': `Submit Prospek — ${SITE}`,
  '/dashboard/operator/prospek/database': `Database Prospek — ${SITE}`,
  // Dashboard — PIC Raport
  '/dashboard/pic-raport': `PIC Raport — ${SITE}`,
  '/dashboard/pic-raport/history': `History Raport — ${SITE}`,
  '/dashboard/pic-raport/master': `Master Jobdesk — ${SITE}`,
  // Dashboard — Karyawan
  '/dashboard/karyawan': `Dashboard Karyawan — ${SITE}`,
  '/dashboard/karyawan/prospek': `Submit Prospek — ${SITE}`,
  '/dashboard/karyawan/prospek/database': `Database Prospek — ${SITE}`,
  '/dashboard/karyawan/raport': `Raport Harian — ${SITE}`,
  '/dashboard/karyawan/raport/history': `History Raport — ${SITE}`,
};

export function usePageTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Exact match first
    if (ROUTE_TITLES[pathname]) {
      document.title = ROUTE_TITLES[pathname];
      return;
    }

    // Dynamic routes — match by prefix pattern
    if (pathname.startsWith('/produk/')) {
      document.title = `Produk — ${SITE}`;
      return;
    }
    if (pathname.startsWith('/promo/')) {
      document.title = `Detail Promo — ${SITE}`;
      return;
    }
    if (pathname.startsWith('/blog/')) {
      document.title = `Artikel — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/admin\/catalog\/edit\//)) {
      document.title = `Edit Produk — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/admin\/promo\/edit\//)) {
      document.title = `Edit Promo — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/admin\/content\/edit\//)) {
      document.title = `Edit Artikel — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/admin\/users\/edit\//)) {
      document.title = `Edit Pengguna — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/admin\/wa\/campaign\//)) {
      document.title = `Detail Campaign WA — ${SITE}`;
      return;
    }
    if (pathname.match(/^\/dashboard\/pic-raport\/karyawan\//)) {
      document.title = `Detail Karyawan — ${SITE}`;
      return;
    }

    // Fallback
    document.title = `${SITE} — Distributor Elektronik Manado`;
  }, [pathname]);
}
