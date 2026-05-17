// Types untuk semua entitas utama

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: 'bike' | 'electronics' | 'furniture';
  subcategory: string;
  price: number;
  displayPrice?: number;
  priceMarkup?: {
    id: string;
    scope: 'all' | 'category' | 'product';
    targetValue?: string | null;
    markupType: 'amount' | 'percent';
    markupValue: number;
  } | null;
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
  stock: 'available' | 'indent' | 'hidden' | 'limited' | 'out_of_stock' | 'discontinued';
  stockQuantity?: number | null;
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

export interface CabangItem {
  id: string;
  nama: string;
  alamat: string;
  kota: string;
  telepon: string;
  koordinatorId?: string | null;
  koordinatorNama: string;
  isActive: boolean;
  jumlahKaryawan: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LandingMetricSpec {
  iconKey: string;
  value: string;
  label: string;
}

export interface LandingHeroSlideData {
  id: string;
  eyebrow: string;
  title: string;
  accent: string;
  copy: string;
  href: string;
  cta: string;
  bgImageUrl: string;
  productImageUrl: string;
  productAlt: string;
  iconKey: string;
  price: string;
  oldPrice: string;
  detailLine: string;
  metrics: LandingMetricSpec[];
  specs: LandingMetricSpec[];
  sortOrder: number;
  isActive: boolean;
}

export interface LandingCategoryPanelData {
  id: string;
  label: string;
  copy: string;
  href: string;
  imageUrl: string;
  tags: string[];
  tone: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingSmartRideData {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  mainImageUrl: string;
  mainImageAlt: string;
  overlayTitle: string;
  overlayCopy: string;
  stats: Array<{ value: string; label: string }>;
  isActive: boolean;
}

export interface LandingSmartRideFeatureData {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LandingHomeData {
  heroSlides: LandingHeroSlideData[];
  categoryPanels: LandingCategoryPanelData[];
  smartRide: LandingSmartRideData | null;
  smartRideFeatures: LandingSmartRideFeatureData[];
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
  createdByName?: string;
  createdByEmail?: string;
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
  status: 'pending' | 'paused' | 'sent' | 'skipped' | 'failed' | 'delivered' | 'read';
  lastAttemptAt?: string;
  deliveredAt?: string;
  readAt?: string;
  repliedAt?: string;
  lastError?: string;
  createdAt?: string;
}
