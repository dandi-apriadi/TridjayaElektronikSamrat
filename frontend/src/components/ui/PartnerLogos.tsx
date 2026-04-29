import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePartnerStore } from '../../store/usePartnerStore';
import { getImageUrl } from '../../utils/apiClient';

const shadowPalette = [
  'hover:shadow-[0_0_16px_rgba(143,245,255,0.3)]',
  'hover:shadow-[0_0_16px_rgba(99,102,241,0.3)]',
  'hover:shadow-[0_0_16px_rgba(255,255,255,0.15)]',
  'hover:shadow-[0_0_16px_rgba(162,243,31,0.3)]',
];

export const PartnerLogos: React.FC = () => {
  const { partners, isLoading, fetchPartners } = usePartnerStore();

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [partners]);

  const uniquePartners = useMemo(() => {
    const seen = new Set<string>();

    return sortedPartners.filter((partner) => {
      const normalizedName = partner.name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      
      if (!normalizedName || seen.has(normalizedName)) {
        return false;
      }

      seen.add(normalizedName);
      return true;
    });
  }, [sortedPartners]);

  if (isLoading && partners.length === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="glass-card rounded-2xl h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!isLoading && uniquePartners.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant">
        Logo partner akan tampil di sini setelah ditambahkan dari admin panel.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {uniquePartners.map((partner, i) => (
        <motion.div
          key={partner.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.4) }}
          className={`glass-card rounded-2xl p-8 flex items-center justify-center group border-outline-variant/10 hover:border-primary/20 hover:-translate-y-1 ${shadowPalette[i % shadowPalette.length]}`}
          style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease' }}
        >
          {partner.websiteUrl ? (
            <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={getImageUrl(partner.logoUrl)}
                alt={partner.name}
                className="h-10 md:h-14 w-auto object-contain opacity-90 grayscale-[0.3] group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300"
              />
            </a>
          ) : (
            <img
              src={getImageUrl(partner.logoUrl)}
              alt={partner.name}
              className="h-10 md:h-14 w-auto object-contain opacity-90 grayscale-[0.3] group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};
