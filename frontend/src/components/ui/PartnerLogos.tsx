import React, { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { usePartnerStore } from '../../store/usePartnerStore';
import { getImageUrl } from '../../utils/apiClient';

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
          <div key={item} className="rounded-2xl border border-outline-variant/30 bg-surface-container h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!isLoading && uniquePartners.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container p-8 text-center text-on-surface/50">
        Logo partner akan tampil di sini setelah ditambahkan dari admin panel.
      </div>
    );
  }

  // Triple the partners for a very smooth, long loop
  const marqueePartners = [...uniquePartners, ...uniquePartners, ...uniquePartners];

  return (
    <div className="relative w-full overflow-hidden py-14">
      {/* Seamless Fading Edges - Responsive to theme */}
      <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-32 bg-gradient-to-r from-surface to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-20 h-full w-32 bg-gradient-to-l from-surface to-transparent" />

      <div className="flex w-full">
        <motion.div
          className="flex shrink-0 gap-8"
          animate={{
            x: [0, -1200], 
          }}
          transition={{
            duration: 40,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ x: "-33.33%" }}
        >
          {marqueePartners.map((partner, i) => (
            <div
              key={`${partner.id}-${i}`}
              className="group relative flex h-24 w-40 shrink-0 items-center justify-center transition-all duration-500 hover:-translate-y-1.5"
            >
              <div className="flex h-full w-full items-center justify-center rounded-2xl border border-outline-variant/30 bg-surface-container p-5 backdrop-blur-[2px] transition-all duration-500 group-hover:border-primary/30 group-hover:bg-surface-container-high">
                {partner.websiteUrl ? (
                  <a href={partner.websiteUrl} target="_blank" rel="noreferrer" className="flex h-full w-full items-center justify-center">
                    <img
                      src={getImageUrl(partner.logoUrl)}
                      alt={partner.name}
                      className="max-h-full max-w-full object-contain opacity-40 grayscale transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105"
                    />
                  </a>
                ) : (
                  <img
                    src={getImageUrl(partner.logoUrl)}
                    alt={partner.name}
                    className="max-h-full max-w-full object-contain opacity-40 grayscale transition-all duration-700 group-hover:opacity-100 group-hover:grayscale-0 group-hover:scale-105"
                  />
                )}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Modern Indicator Dots */}
      <div className="mt-12 flex justify-center gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-1 w-8 rounded-full bg-on-surface/20"
          >
            <motion.div 
              className="h-full rounded-full bg-primary/40"
              animate={{ width: ["0%", "100%", "0%"] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeInOut" }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
