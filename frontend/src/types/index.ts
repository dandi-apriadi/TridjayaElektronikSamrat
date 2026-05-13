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
  views?: number;
  leads?: number;
  conversions?: number;
  conversionRate?: number;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  rating?: number | null;
  review?: string | null;
  ratings?: ProductRating[];
  specs: Record<string, string>;
  description: string;
  shortDesc: string;
  stock: 'available' | 'indent' | 'hidden';
  colors?: string[];
  highlights?: string[];
  sellingPoints?: string[];
  objections?: string[];
}

export interface ProductRating {
  score: number;
  review?: string | null;
}

export interface CreditPlan {
  customerType: 'NEW' | 'RO';
  tenor: '6x' | '9x' | '12x' | '15x';
  monthlyInstallment: number;
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

export interface PartnerItem {
  id: string;
  name: string;
  logoUrl: string;
  websiteUrl?: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type Theme = 'dark' | 'light';

export interface WaAccount {
  id: string;
  name: string;
  gatewayConfig: Record<string, any>;
  enabled: boolean;
  status?: 'connected' | 'disconnected' | 'connecting' | 'qr_ready' | 'reconnecting' | 'error';
  phoneNumber?: string;
  lastConnectedAt?: string;
  lastError?: string;
  messageCountToday?: number;
  createdBy?: string;
  createdAt?: string;
}

export interface WaCampaign {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  config: Record<string, any>;
  createdBy?: string;
  createdAt?: string;
  startedAt?: string;
  recipientTotal: number;
  recipientSent: number;
  recipientSkipped: number;
  recipientFailed: number;
}

export interface WaRecipient {
  id: string;
  phone: string;
  name?: string;
  variables: Record<string, any>;
  status: 'pending' | 'sent' | 'skipped' | 'failed' | 'delivered' | 'read';
  lastAttemptAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
  lastError?: string;
  createdAt?: string;
}
