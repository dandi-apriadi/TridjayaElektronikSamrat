import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CircuitBackground from '../ui/CircuitBackground';

const Layout: React.FC = () => {
  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* Layer -2: Absolute Base Surface */}
      <div className="fixed inset-0 bg-surface z-[-2]" />
      
      {/* Layer -1: Circuit Animation */}
      <CircuitBackground />
      
      {/* Layer 0: Main Content */}
      <div className="relative z-0 flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
