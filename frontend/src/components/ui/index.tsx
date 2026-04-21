import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Zap, Shield, Award, Clock } from 'lucide-react';
import type { Product } from '../../types';
import { formatPrice } from '../../data';

interface ProductCardProps {
  product: Product;
  index?: number;
}

const badgeConfig = {
  eco: { label: '🌱 Eco Friendly', className: 'bg-secondary/20 text-secondary border border-secondary/30' },
  new: { label: '✨ Baru', className: 'bg-primary/20 text-primary border border-primary/30' },
  sale: { label: '🔥 Sale', className: 'bg-error/20 text-error border border-error/30' },
  popular: { label: '⭐ Terlaris', className: 'bg-tertiary/20 text-tertiary border border-tertiary/30' },
  limited: { label: '⚡ Terbatas', className: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/30' },
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, index = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.34, 1.56, 0.64, 1] }}
      whileHover={{ y: -6, scale: 1.01 }}
      className="group relative overflow-hidden rounded-2xl glass-card cursor-pointer"
    >
      <Link to={`/produk/${product.slug}`} className="block">
        {/* Image */}
        <div className="relative overflow-hidden bg-surface-high aspect-[4/3]">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t dark:from-surface/90 from-surface/30 via-transparent to-transparent" />

          {/* Badge */}
          {product.badge && (
            <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-label-md font-bold uppercase tracking-wider backdrop-blur-sm ${badgeConfig[product.badge].className}`}>
              {product.badgeText || badgeConfig[product.badge].label}
            </div>
          )}

          {/* Stock status */}
          {product.stock === 'indent' && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-label-sm bg-surface-high/80 backdrop-blur-sm text-on-surface-variant">
              <Clock className="w-3 h-3 inline mr-1" />Indent
            </div>
          )}
        </div>

        {/* Content */}
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

          {/* Rating */}
          <div className="flex items-center gap-1.5 mb-3">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'text-yellow-400 fill-yellow-400' : 'text-outline-variant'}`}
                />
              ))}
            </div>
            <span className="font-body text-body-sm text-on-surface-variant">
              {product.rating} ({product.reviewCount})
            </span>
          </div>

          {/* Price */}
          <div className="flex items-end justify-between">
            <div>
              <div className="font-display text-headline-sm font-bold gradient-text-primary">
                {formatPrice(product.price)}
              </div>
              {product.priceInstallment && (
                <div className="font-body text-body-sm text-on-surface-variant">
                  Cicil dari {formatPrice(product.priceInstallment)}/bln
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center group-hover:shadow-neon-cyan-sm transition-shadow duration-300">
              <ArrowRight className="w-4 h-4 text-surface" />
            </div>
          </div>
        </div>
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
  { icon: Star, value: '4.8/5', label: 'Rating Kepuasan', color: 'text-yellow-400' },
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
