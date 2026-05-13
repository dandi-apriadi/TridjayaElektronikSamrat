import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import CircuitBackground from '../ui/CircuitBackground';

const Layout: React.FC = () => {
  // Detect mobile untuk optimasi animasi
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice || isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Animasi ringan untuk mobile, lebih kaya untuk desktop
  const pageTransition = isMobile
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -8 },
      };

  return (
    <div className="min-h-screen relative overflow-x-hidden page-shell">
      {/* Layer -2: Absolute Base Surface */}
      <div className="fixed inset-0 bg-surface z-[-2]" />

      {/* Layer -1: Circuit Animation */}
      {!isMobile && <CircuitBackground />}

      {/* Layer 0: Main Content */}
      <div className="relative z-0 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key="public-layout"
              initial={pageTransition.initial}
              animate={pageTransition.animate}
              exit={pageTransition.exit}
              transition={{ duration: isMobile ? 0.2 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="reveal-fade"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
