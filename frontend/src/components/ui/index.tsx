import React from 'react';
export * from './PartnerLogos';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Zap, Shield, Award, Clock, Share2 } from 'lucide-react';
import type { Product } from '../../types';
import { formatPrice } from '../../data';
import { getImageUrl } from '../../utils/apiClient';
import { useMinInstallment } from '../../hooks/useMinInstallment';
import { recordTelemetry } from '../../utils/telemetry';

interface ProductCardProps {
  product: Product;
  index?: number;
  isCompact?: boolean;
}

const badgeConfig = {
  eco: { label: '🌱 Eco Friendly', className: 'bg-secondary/20 text-secondary border border-secondary/30' },
  new: { label: '✨ Baru', className: 'bg-primary/20 text-primary border border-primary/30' },
  sale: { label: '🔥 Sale', className: 'bg-error/20 text-error border border-error/30' },
  popular: { label: '⭐ Terlaris', className: 'bg-tertiary/20 text-tertiary border border-tertiary/30' },
  limited: { label: '⚡ Terbatas', className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30' },
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index = 0, isCompact }) => {
  const minInstallment = useMinInstallment(product);
  
  // By default show images, unless explicitly told to be compact (Lite Mode)
  const effectiveShowImages = isCompact !== undefined ? !isCompact : true;

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const url = `${window.location.origin}/produk/${product.slug}`;
    const shareData = {
      title: product.name,
      text: `Lihat ${product.name} di Tridjaya Manado!`,
      url: url,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(url);
      // We could use a toast here if available
    }
    
    recordTelemetry('click', {
      path: window.location.pathname,
      source: 'internal',
      metadata: {
        contentType: 'product',
        contentSlug: product.slug,
        action: 'share_product',
        location: 'product_card'
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.06, 0.5), ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl glass-card cursor-pointer"
    >
      <Link
        to={`/produk/${product.slug}`}
        onClick={() => {
          recordTelemetry('click', {
            path: `/produk/${product.slug}`,
            source: 'internal',
            metadata: {
              contentType: 'product',
              contentSlug: product.slug,
              contentKey: `product:${product.slug}`,
              contentTitle: product.name,
              action: 'open_product_detail',
              location: 'product_card',
            },
          });
        }}
        className="block"
      >
        {effectiveShowImages ? (
          <>
            {/* Standard Image View */}
            <div className="relative overflow-hidden bg-surface-high aspect-[4/3]">
              <img
                src={getImageUrl(product.image)}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t dark:from-surface/90 from-surface/30 via-transparent to-transparent" />
              
              {product.badge && badgeConfig[product.badge.toLowerCase() as keyof typeof badgeConfig] ? (
                <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-label-md font-bold uppercase tracking-wider backdrop-blur-sm ${badgeConfig[product.badge.toLowerCase() as keyof typeof badgeConfig].className}`}>
                  {product.badgeText || badgeConfig[product.badge.toLowerCase() as keyof typeof badgeConfig].label}
                </div>
              ) : product.badge ? (
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-label-md font-bold uppercase tracking-wider backdrop-blur-sm bg-surface/50 text-white border border-white/20">
                  {product.badgeText || product.badge}
                </div>
              ) : null}

              {product.stock === 'indent' && (
                <div className="absolute top-3 right-12 px-2.5 py-1 rounded-lg text-label-sm bg-surface-high/80 backdrop-blur-sm text-on-surface-variant">
                  <Clock className="w-3 h-3 inline mr-1" />Indent
                </div>
              )}

              <button
                onClick={handleShare}
                className="absolute top-3 right-3 w-8 h-8 rounded-lg glass-dark flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors z-20"
                title="Bagikan produk"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <div className="mb-1">
                <span className="text-label-sm text-on-surface-variant uppercase tracking-widest">{product.subcategory}</span>
              </div>
              <h3 className="font-display text-title-md font-bold text-on-surface mb-2 group-hover:text-primary transition-colors duration-200">
                {product.name}
              </h3>
              <p className="font-body text-body-sm text-on-surface-variant line-clamp-2 mb-3">
                {product.shortDesc}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <div className="font-display text-headline-sm font-bold gradient-text-primary">
                    {formatPrice(product.price)}
                  </div>
                  {(minInstallment || product.priceInstallment) && (
                    <div className="font-body text-body-sm text-on-surface-variant">
                      Cicil dari {formatPrice(minInstallment || product.priceInstallment || 0)}/bln
                    </div>
                  )}
                </div>
                <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center group-hover:shadow-neon-cyan-sm transition-shadow duration-300">
                  <ArrowRight className="w-4 h-4 text-surface" />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Compact View (No Image) - More Informative */
          <div className="p-4 flex flex-col h-full">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20`}>
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                {product.badge && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary px-2 py-1 rounded-lg bg-primary/5 border border-primary/10">
                    {product.badge}
                  </span>
                )}
                <button
                  onClick={handleShare}
                  className="w-8 h-8 rounded-lg glass-dark flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
                  title="Bagikan produk"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 min-w-0 mb-4">
              <span className="text-[11px] text-primary font-bold uppercase tracking-[0.2em] block mb-1 opacity-80">{product.subcategory}</span>
              <h3 className="font-display text-title-sm font-bold text-on-surface line-clamp-2 group-hover:text-primary transition-colors mb-2 leading-snug">
                {product.name}
              </h3>
              <p className="font-body text-body-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                {product.shortDesc}
              </p>
            </div>

            <div className="pt-3 border-t border-white/10 mt-auto">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-title-md font-bold text-primary">
                    {formatPrice(product.price)}
                  </div>
                  <div className="font-body text-[10px] text-on-surface-variant font-medium">
                    Cicilan: {formatPrice(minInstallment || product.priceInstallment || 0)}/bln
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg glass-dark flex items-center justify-center group-hover:bg-primary transition-all">
                  <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-surface group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
};

/* ========================
   BENTO CARD
======================== */
interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'lime' | 'magenta';
  href?: string;
  delay?: number;
}

export const BentoCard: React.FC<BentoCardProps> = ({
  children,
  className = '',
  glowColor = 'cyan',
  href,
  delay = 0,
}) => {
  const glowClass = {
    cyan: 'hover:shadow-neon-cyan',
    lime: 'hover:shadow-neon-lime',
    magenta: 'hover:shadow-neon-magenta',
  }[glowColor];

  const card = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={{ y: -4, scale: 1.005 }}
      className={`glass-card rounded-2xl overflow-hidden transition-all duration-300 ${glowClass} ${className}`}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return <Link to={href} className="block">{card}</Link>;
  }

  return card;
};

/* ========================
   BADGE
======================== */
interface BadgeProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'primary', size = 'md' }) => {
  const variantClass = {
    primary: 'bg-primary/15 text-primary border-primary/30',
    secondary: 'bg-secondary/15 text-secondary border-secondary/30',
    tertiary: 'bg-tertiary/15 text-tertiary border-tertiary/30',
    success: 'bg-green-500/15 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    error: 'bg-error/15 text-error border-error/30',
  }[variant];

  const sizeClass = {
    sm: 'px-2 py-0.5 text-label-sm',
    md: 'px-3 py-1 text-label-md',
  }[size];

  return (
    <span className={`inline-flex items-center rounded-lg border font-semibold uppercase tracking-wider backdrop-blur-sm ${variantClass} ${sizeClass}`}>
      {label}
    </span>
  );
};

/* ========================
   SECTION HEADER
======================== */
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  className = '',
}) => {
  const alignClass = align === 'center' ? 'text-center items-center' : 'text-left items-start';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className={`flex flex-col gap-3 mb-12 ${alignClass} ${className}`}
    >
      {eyebrow && (
        <span className="font-body text-label-md text-primary uppercase tracking-widest font-bold">
          {eyebrow}
        </span>
      )}
      <h2 className="font-display text-headline-lg font-bold text-on-surface text-balance leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="font-body text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};

/* ========================
   STATS ROW
======================== */
const stats = [
  { icon: Award, value: '15+', label: 'Tahun Berpengalaman', color: 'text-primary' },
  { icon: Zap, value: '500+', label: 'Unit Terjual / Bulan', color: 'text-secondary' },
  { icon: Shield, value: '10.000+', label: 'Pelanggan Aktif', color: 'text-tertiary' },
];

export const StatsRow: React.FC = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {stats.map(({ icon: Icon, value, label, color }, i) => (
      <motion.div
        key={label}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.1 }}
        className="glass-card rounded-2xl p-5 text-center"
      >
        <div className={`w-10 h-10 rounded-xl bg-surface-high mx-auto mb-3 flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className={`font-display text-display-sm font-bold ${color} mb-1`}>{value}</div>
        <div className="font-body text-body-sm text-on-surface-variant">{label}</div>
      </motion.div>
    ))}
  </div>
);
