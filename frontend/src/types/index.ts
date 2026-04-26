// Types untuk semua entitas utama

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: 'bike' | 'electronics' | 'furniture';
  subcategory: string;
  price: number;
  priceInstallment?: number;
  dpMin?: number;
  image: string;
  images?: string[];
  badge?: 'eco' | 'new' | 'sale' | 'popular' | 'limited';
  badgeText?: string;
  rating: number;
  reviewCount: number;
  views?: number;
  leads?: number;
  conversions?: number;
  conversionRate?: number;
  specs: Record<string, string>;
  description: string;
  shortDesc: string;
  stock: 'available' | 'indent' | 'hidden';
  colors?: string[];
  highlights?: string[];
  sellingPoints?: string[];
  objections?: string[];
}

export interface PromoItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  discount: number;
  originalPrice: number;
  promoPrice: number;
  image: string;
  badge: string;
  validUntil: string;
  category: string;
  variant: 'hero' | 'standard' | 'mini';
  productIds?: string[];
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  authorRole: string;
  authorImage: string;
  heroImage: string;
  category: string;
  tags: string[];
  publishedAt: string;
  readTime: number;
  featured: boolean;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'fulltime' | 'parttime' | 'contract';
  level: 'junior' | 'mid' | 'senior';
  description: string;
  requirements: string[];
  benefits: string[];
  postedAt: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

export type Theme = 'dark' | 'light';
