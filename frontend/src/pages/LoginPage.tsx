import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, Lock, Mail, ShieldCheck, Sparkles, Zap, Loader2, ChevronRight, CheckCircle2 } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import CircuitBackground from '../components/ui/CircuitBackground';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/useNotificationStore';
import logoHorizontal from '../assets/images/logo-horizontal.webp';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Role otomatis di server',
    description: 'Admin, agent, editor, dan operator dibedakan oleh backend, bukan pilihan manual.',
  },
  {
    icon: Zap,
    title: 'Portal terpadu',
    description: 'Satu pintu untuk masuk ke dashboard internal tanpa menu login terpisah.',
  },
  {
    icon: Building2,
    title: 'Akses yang lebih aman',
    description: 'Autentikasi, refresh token, dan pembatasan akses dijalankan dari server Rust.',
  },
];

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const user = await login({ email, password, remember });
      if (user.must_change_password) {
        toast.warning(
          'Ganti Password',
          'Silakan atur password baru sebelum mengakses fitur lain.'
        );
        // Untuk role agent kita arahkan ke halaman settings yang sudah punya
        // form ganti password. Untuk role lain (admin/editor/operator) sementara
        // diarahkan ke dashboard utama dengan banner; profil mereka juga sudah
        // bisa ganti password lewat endpoint /api/auth/change-password.
        if (user.role === 'agent') {
          navigate('/dashboard/agent/settings?force=password');
        } else {
          navigate('/dashboard');
        }
      } else {
        toast.success('Login Berhasil', 'Selamat datang di Portal Internal Tridjaya Manado.');
        navigate('/dashboard');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Login gagal, silakan coba lagi.';
      setErrorMessage(msg);
      toast.error('Gagal Masuk', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navbar />

      {/* Animated Background Elements - Match public pages */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <CircuitBackground />
        
        <motion.div 
          animate={{ 
            y: [-20, 20, -20],
            x: [-10, 10, -10],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            y: [20, -20, 20],
            x: [10, -10, 10],
            scale: [1.1, 1, 1.1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px]" 
        />
        <motion.div 
          animate={{ 
            y: [-30, 30, -30],
            x: [20, -20, 20],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-tertiary/10 rounded-full blur-[120px]" 
        />
        <div className="absolute inset-0 mesh-bg opacity-30" />
      </div>

      <div className="relative z-10 container-custom min-h-screen flex items-center py-28 lg:py-32">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center w-full">
          <motion.section
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="font-body text-label-md font-bold text-secondary uppercase tracking-widest">
                Portal Internal
              </span>
            </div>

            <h1 className="font-display text-display-sm md:text-display-lg font-bold text-on-surface leading-[1.02] tracking-tight mb-6">
              Masuk ke <span className="gradient-text-primary">satu portal</span> yang terasa seperti bagian dari halaman publik
            </h1>

            <p className="font-body text-body-lg md:text-title-sm text-on-surface-variant max-w-xl leading-relaxed mb-8">
              Desain ini diselaraskan dengan halaman publik lain: atmosfir premium, komposisi hero yang tegas, dan fokus ke satu tindakan utama. Role pengguna tetap ditentukan otomatis oleh backend Rust setelah login berhasil.
            </p>

            <div className="flex flex-wrap items-center gap-3 mb-8">
              <Link
                to="/"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-card border border-outline-variant/20 hover:border-primary/50 font-body text-body-md font-semibold text-on-surface-variant hover:text-primary transition-all duration-300 hover:shadow-neon-cyan-sm"
              >
                Kembali ke publik
                <ChevronRight className="w-4 h-4" />
              </Link>
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-dark border border-primary/20 font-body text-body-md font-semibold text-primary hover:shadow-neon-cyan-sm transition-all duration-300">
                <CheckCircle2 className="w-4 h-4" />
                Satu login untuk semua role
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {benefits.map((item, index) => {
                const Icon = item.icon;

                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: index * 0.08 }}
                    className="glass-card rounded-2xl p-4 border border-outline-variant/10 hover:border-primary/30 hover:shadow-neon-cyan-sm hover:bg-surface-container/80 transition-all duration-300"
                  >
                    <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors duration-300">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="font-display text-title-sm font-bold text-on-surface mb-2">
                      {item.title}
                    </h2>
                    <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                      {item.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-6 rounded-3xl glass-premium border border-primary/20 p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 hover:shadow-neon-cyan-sm transition-all duration-300">
              <div className="w-12 h-12 rounded-2xl bg-secondary/15 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-secondary" />
              </div>
              <div className="flex-1">
                <div className="font-display text-title-md font-bold text-on-surface mb-1">
                  Tampilan dibuat serasi dengan landing page
                </div>
                <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                  Background lembut, glass card, dan aksen neon mengikuti bahasa visual dari halaman publik lain agar alurnya terasa satu ekosistem.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            className="relative"
          >
            <div className="absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 blur-3xl" />
            <div className="glass-premium rounded-[2rem] p-6 md:p-8 shadow-neon-cyan-sm hover:shadow-neon-cyan-md transition-all duration-300 border border-white/5 overflow-hidden relative group">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-tertiary opacity-100 group-hover:opacity-100 transition-opacity duration-300" />

              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <img src={logoHorizontal} alt="Tridjaya Manado" className="h-14 w-auto object-contain" />
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-outline-variant/10">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="font-body text-label-sm font-semibold text-on-surface-variant">Secure access</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark border border-primary/20 mb-4">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span className="font-body text-label-md font-bold text-secondary uppercase tracking-widest">
                    Access Portal
                  </span>
                </div>
                <h2 className="font-display text-headline-sm font-bold text-on-surface mb-2">
                  Login ke Portal Internal
                </h2>
                <p className="font-body text-body-md text-on-surface-variant">
                  Masukkan email dan password Anda. Role akan dipetakan otomatis oleh backend Rust setelah autentikasi berhasil.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <label className="block">
                  <span className="flex items-center gap-2 font-body text-label-sm font-semibold text-on-surface-variant mb-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </span>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="user@gmail.com"
                    className="w-full px-4 py-3.5 rounded-xl glass-dark border border-outline-variant/30 hover:border-outline-variant/50 focus:border-primary/50 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface transition-all duration-200"
                    required
                  />
                </label>

                <label className="block">
                  <span className="flex items-center gap-2 font-body text-label-sm font-semibold text-on-surface-variant mb-2">
                    <Lock className="w-4 h-4" />
                    Password
                  </span>
                  <input
                    type="password"
                    name="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Masukkan password"
                    className="w-full px-4 py-3.5 rounded-xl glass-dark border border-outline-variant/30 hover:border-outline-variant/50 focus:border-primary/50 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface transition-all duration-200"
                    required
                  />
                </label>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        className="peer appearance-none w-5 h-5 rounded-md border border-outline-variant/30 checked:bg-primary checked:border-primary transition-all duration-200"
                      />
                      <CheckCircle2 className="absolute w-3.5 h-3.5 text-surface opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                    </div>
                    <span className="font-body text-body-sm text-on-surface-variant group-hover:text-on-surface transition-colors">
                      Ingat Saya
                    </span>
                  </label>
                  
                  <Link
                    to="/forgot-password"
                    className="font-body text-body-sm font-semibold text-primary hover:text-primary/80 hover:underline transition-all duration-200"
                  >
                    Lupa password?
                  </Link>
                </div>

                {errorMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-body-sm font-medium text-error shadow-sm"
                  >
                    {errorMessage}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl gradient-primary text-surface font-body text-body-md font-semibold shadow-neon-cyan-sm hover:shadow-neon-cyan-md hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-neon-cyan-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Menyiapkan Portal...
                    </>
                  ) : (
                    <>
                      Masuk ke Portal
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>

                <div className="rounded-2xl glass-premium border border-primary/20 p-4 hover:border-primary/40 hover:shadow-neon-cyan-sm transition-all duration-300">
                  <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                    Backend menetapkan akses berdasarkan role pengguna. Satu halaman login untuk semua level akses.
                  </p>
                </div>
              </form>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
