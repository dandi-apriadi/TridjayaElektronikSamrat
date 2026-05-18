export const ADMIN_SALES_ROLE = 'admin-sales';

export const isAdminSalesRole = (role?: string | null) =>
  normalizeAccessRole(role) === ADMIN_SALES_ROLE;

export const normalizeAccessRole = (role?: string | null) => {
  const normalized = (role || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  if (normalized === 'admin-sales' || normalized === 'sales') return ADMIN_SALES_ROLE;
  if (normalized === 'pic-raport') return 'pic_raport';
  return normalized;
};

export const normalizeTargetKategori = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'sales' ? 'sales' : 'non_sales';
};

export const isSalesTargetKategori = (jabatan?: string | null, divisi?: string | null) => {
  const normalized = (jabatan || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized) return normalized === 'sales';
  return (divisi || '').toLowerCase().includes('sales');
};

export const targetKategoriLabel = (value?: string | null) =>
  normalizeTargetKategori(value) === 'sales' ? 'Sales' : 'Non-Sales';
