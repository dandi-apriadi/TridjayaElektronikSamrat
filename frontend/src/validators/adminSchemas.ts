import { z } from 'zod';

export const adminProductSchema = z.object({
  name: z.string().trim().min(3, 'Nama produk minimal 3 karakter'),
  slug: z.string().trim().min(3, 'Slug minimal 3 karakter').regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda minus'),
  category: z.string().min(1, 'Kategori wajib diisi'),
  subcategory: z.string().trim().optional(),
  price: z.number().nonnegative('Harga retail tidak boleh negatif'),
  priceInstallment: z.number().nonnegative('Harga cicilan tidak boleh negatif').optional(),
  dpMin: z.number().nonnegative('DP minimum tidak boleh negatif').optional(),
  stock: z.enum(['available', 'indent', 'hidden']),
  image: z.string().trim().optional().default(''), 
  images: z.array(z.string().trim()).optional().default([]),
  description: z.string().trim().optional().default(''),
  shortDesc: z.string().trim().optional().default(''),
  badge: z.enum(['eco', 'new', 'sale', 'popular', 'limited', '']).optional().transform(v => v === '' ? undefined : v),
  specs: z.record(z.string(), z.string()).optional().default({}),
  colors: z.array(z.string()).optional().default([]),
  highlights: z.array(z.string()).optional().default([]),
  sellingPoints: z.array(z.string()).optional().default([]),
  objections: z.array(z.string()).optional().default([]),
});

export const adminPromoSchema = z.object({
  title: z.string().trim().min(3, 'Judul promo minimal 3 karakter'),
  subtitle: z.string().trim().min(3, 'Subjudul promo minimal 3 karakter'),
  description: z.string().trim().min(20, 'Deskripsi promo minimal 20 karakter'),
  discount: z.number().min(0, 'Diskon tidak boleh negatif').max(100, 'Diskon maksimal 100%'),
  originalPrice: z.number().nonnegative('Harga asli tidak boleh negatif'),
  promoPrice: z.number().nonnegative('Harga promo tidak boleh negatif'),
  image: z.string().trim().url('URL banner promo tidak valid'),
  badge: z.string().trim().min(2, 'Badge promo wajib diisi'),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal promo tidak valid (YYYY-MM-DD)'),
  category: z.string().trim().min(2, 'Kategori promo wajib diisi'),
  variant: z.enum(['hero', 'standard', 'mini']),
});

export const getFirstZodIssue = (error: z.ZodError): string => {
  return error.issues[0]?.message || 'Input tidak valid';
};

// ============================================================================
// ARTICLE SCHEMA
// ============================================================================
export const adminArticleSchema = z.object({
  title: z.string().trim().min(5, 'Judul artikel minimal 5 karakter').max(200, 'Judul artikel maksimal 200 karakter'),
  slug: z.string().trim().min(1, 'Slug wajib diisi').max(100, 'Slug maksimal 100 karakter'),
  excerpt: z.string().trim().min(10, 'Ringkasan minimal 10 karakter').max(300, 'Ringkasan maksimal 300 karakter'),
  content: z.string().trim().min(50, 'Konten artikel minimal 50 karakter').max(10000, 'Konten artikel maksimal 10000 karakter'),
  author: z.string().trim().min(2, 'Author wajib diisi'),
  publishedAt: z.string().min(1, 'Tanggal publikasi wajib diisi'),
  readTime: z.number().nonnegative('Waktu baca harus angka positif (menit)'),
  heroImage: z.string().trim().url('URL gambar hero tidak valid').optional(),
  tags: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
});

export type AdminArticleInput = z.infer<typeof adminArticleSchema>;

// ============================================================================
// LEAD/PROSPEK SCHEMA
// ============================================================================
export const agentLeadSchema = z.object({
  customerName: z.string().trim().min(2, 'Nama calon pembeli minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  phoneNumber: z.string().trim().min(7, 'No. HP minimal 7 digit').max(20, 'No. HP maksimal 20 karakter').regex(/^[0-9\s\-\+()]+$/, 'No. HP hanya boleh berisi angka dan simbol'),
  interestedProduct: z.string().min(1, 'Pilih produk yang diminati'),
  source: z.enum(['WhatsApp', 'Instagram', 'Facebook', 'Referral Teman', 'Walk-in', 'Blog/Website', 'Lainnya']),
  notes: z.string().trim().max(500, 'Catatan maksimal 500 karakter').optional(),
  status: z.string().optional(),
});

export type AgentLeadInput = z.infer<typeof agentLeadSchema>;

// ============================================================================
// USER SCHEMA (for admin user management)
// ============================================================================
export const adminUserSchema = z.object({
  email: z.string().trim().email('Email tidak valid').max(100, 'Email maksimal 100 karakter'),
  name: z.string().trim().min(2, 'Nama minimal 2 karakter').max(100, 'Nama maksimal 100 karakter'),
  role: z.enum(['admin', 'agent', 'editor', 'operator']),
  password: z.string().min(8, 'Password minimal 8 karakter').max(50, 'Password maksimal 50 karakter').optional(),
  avatar: z.string().trim().optional(),
  is_active: z.boolean().optional(),
});

export type AdminUserInput = z.infer<typeof adminUserSchema>;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format all validation errors for display
 */
export function formatZodErrors(errors: z.ZodIssue[]): Record<string, string> {
  const formatted: Record<string, string> = {};
  errors.forEach((err) => {
    const path = err.path.join('.');
    formatted[path] = err.message;
  });
  return formatted;
}
