import type { UserRole } from '../store/authStore';

export const getDashboardHomeByRole = (role?: UserRole | null): string => {
  if (role === 'admin') return '/dashboard/admin';
  if (role === 'owner') return '/dashboard/owner';
  if (role === 'pic_raport') return '/dashboard/pic-raport';
  if (role === 'karyawan') return '/dashboard/karyawan';
  if (role === 'operator') return '/dashboard/admin/wa/campaigns';
  if (role === 'sales') return '/dashboard/sales';
  return '/dashboard/agent';
};

const allowedPrefixesByRole: Record<UserRole, string[]> = {
  admin: ['/dashboard/admin', '/dashboard/settings'],
  owner: ['/dashboard/owner', '/dashboard/settings'],
  pic_raport: ['/dashboard/pic-raport', '/dashboard/settings'],
  karyawan: ['/dashboard/karyawan', '/dashboard/settings'],
  operator: [
    '/dashboard/settings',
    '/dashboard/admin/catalog',
    '/dashboard/admin/categories',
    '/dashboard/admin/promo',
    '/dashboard/admin/content',
    '/dashboard/admin/partners',
    '/dashboard/admin/notifications',
    '/dashboard/admin/wa',
    '/dashboard/admin/pixel',
  ],
  sales: [
    '/dashboard/settings',
    '/dashboard/sales',
    '/dashboard/admin/wa',
  ],
  agent: [
    '/dashboard/settings',
    '/dashboard/agent',
  ],
};

export const canAccessDashboardPath = (role: UserRole | undefined | null, path: string): boolean => {
  if (!role) return false;
  const allowedPrefixes = allowedPrefixesByRole[role] || [];
  return allowedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};
