export const ADMIN_SALES_ROLE = 'admin-sales';

export const isAdminSalesRole = (role?: string | null) =>
  role === ADMIN_SALES_ROLE || role === 'admin_sales' || role === 'sales';

export const normalizeAccessRole = (role?: string | null) => {
  if (isAdminSalesRole(role)) return ADMIN_SALES_ROLE;
  return role || '';
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
