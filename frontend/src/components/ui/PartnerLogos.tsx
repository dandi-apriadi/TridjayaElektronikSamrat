import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePartnerStore } from '../../store/usePartnerStore';
import { getImageUrl } from '../../utils/apiClient';

const shadowPalette = [
  'hover:shadow-neon-cyan/40',
  'hover:shadow-indigo-500/40',
  'hover:shadow-white/20',
  'hover:shadow-secondary/40',
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
      // Normalize name: remove special chars, trim, and lowercase
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className={`glass-card rounded-2xl p-8 flex items-center justify-center transition-all duration-300 group ${shadowPalette[i % shadowPalette.length]} border-outline-variant/10 hover:border-primary/20`}
        >
          {partner.websiteUrl ? (
            <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="block">
              <img
                src={getImageUrl(partner.logoUrl)}
                alt={partner.name}
                className="h-10 md:h-14 w-auto object-contain opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
              />
            </a>
          ) : (
            <img
              src={getImageUrl(partner.logoUrl)}
              alt={partner.name}
              className="h-10 md:h-14 w-auto object-contain opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};
