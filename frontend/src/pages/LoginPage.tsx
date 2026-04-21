import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Shield, User, ArrowRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../store/authStore';
import logoPng from '../assets/images/logo.webp';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState<UserRole | null>(null);

  const handleQuickLogin = async (role: UserRole) => {
    setLoading(role);
    const email = role === 'admin' ? 'admin@tridjaya.com' : 'agent@tridjaya.com';
    try {
      await login(email, role);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login failed', error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 -left-12 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-12 w-96 h-96 bg-secondary/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 mesh-bg opacity-30" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass-premium rounded-3xl p-8 md:p-10 text-center shadow-2xl">
          <div className="flex justify-center mb-6">
            <img src={logoPng} alt="Tridjaya Samrat" className="h-24 w-auto object-contain" />
          </div>

          <h1 className="font-display text-headline-md font-bold text-on-surface mb-2">
            Portal Internal
          </h1>
          <p className="font-body text-body-md text-on-surface-variant mb-10">
            Selamat datang kembali. Silakan masuk untuk mengakses pusat kendali Anda.
          </p>

          <div className="space-y-4">
            {/* Quick Login for Testing */}
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleQuickLogin('admin')}
                disabled={!!loading}
                className="group relative flex items-center gap-4 p-4 glass-card rounded-2xl border border-primary/20 hover:border-primary/50 hover:shadow-neon-cyan-sm transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-title-sm font-bold text-on-surface text-balance">
                    {loading === 'admin' ? 'Menyiapkan Dashboard...' : 'Masuk sebagai Admin'}
                  </div>
                  <div className="font-body text-label-sm text-on-surface-variant">Manajemen agen & katalog</div>
                </div>
                {loading === 'admin' ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                )}
              </button>

              <button
                onClick={() => handleQuickLogin('agent')}
                disabled={!!loading}
                className="group relative flex items-center gap-4 p-4 glass-card rounded-2xl border border-secondary/20 hover:border-secondary/50 hover:shadow-neon-lime-sm transition-all text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <User className="w-6 h-6 text-secondary" />
                </div>
                <div className="flex-1">
                  <div className="font-display text-title-sm font-bold text-on-surface text-balance">
                  {loading === 'agent' ? 'Menyiapkan Command Center...' : 'Masuk sebagai Agen'}
                  </div>
                  <div className="font-body text-label-sm text-on-surface-variant">Leads & riwayat komisi</div>
                </div>
                {loading === 'agent' ? (
                  <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5 text-on-surface-variant group-hover:translate-x-1 transition-transform" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-outline-variant/20">
            <p className="font-body text-body-xs text-on-surface-variant opacity-60">
              Tridjaya Samrat &copy; 2025. All Rights Reserved.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
