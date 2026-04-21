import React from 'react';
import { motion } from 'framer-motion';
import logoGoda from '../../assets/images/logo-goda.webp';
import logoUwinfly from '../../assets/images/logo-uwinfly.webp';
import logoSaige from '../../assets/images/logo-saige.webp';
import logoTridjayaMoubel from '../../assets/images/logo-tridjaya-moubel.webp';

const partners = [
  { name: 'GODA', logo: logoGoda, color: 'hover:shadow-neon-cyan/40' },
  { name: 'U-Winfly', logo: logoUwinfly, color: 'hover:shadow-indigo-500/40' },
  { name: 'Saige', logo: logoSaige, color: 'hover:shadow-white/20' },
  { name: 'Tridjaya Moubel', logo: logoTridjayaMoubel, color: 'hover:shadow-secondary/40' },
];

export const PartnerLogos: React.FC = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {partners.map((partner, i) => (
        <motion.div
          key={partner.name}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ y: -5, scale: 1.02 }}
          className={`glass-card rounded-2xl p-8 flex items-center justify-center transition-all duration-300 group ${partner.color} border-outline-variant/10 hover:border-primary/20`}
        >
          <img
            src={partner.logo}
            alt={partner.name}
            className="h-12 md:h-16 w-auto object-contain opacity-60 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-500"
          />
        </motion.div>
      ))}
    </div>
  );
};
