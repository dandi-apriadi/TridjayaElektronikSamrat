import React from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar';
import Footer from './Footer';
import CircuitBackground from '../ui/CircuitBackground';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen relative overflow-x-hidden page-shell">
      {/* Layer -2: Absolute Base Surface */}
      <div className="fixed inset-0 bg-surface z-[-2]" />
      
      {/* Layer -1: Circuit Animation */}
      <CircuitBackground />
      
      {/* Layer 0: Main Content */}
      <div className="relative z-0 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key="public-layout"
              initial={{ opacity: 0, y: 12, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -12, filter: 'blur(10px)' }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
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
