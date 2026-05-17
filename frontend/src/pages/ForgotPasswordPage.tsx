import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, Sparkles, ShieldCheck, RefreshCcw, CheckCircle2, Loader2 } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import logoPng from '../assets/images/logo.webp';
import { apiFetch } from '../utils/apiClient';
import { HCaptcha, isHCaptchaEnabled } from '../components/security/HCaptcha';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get('forgot-password-email') ?? '').trim();

    if (isHCaptchaEnabled && !captchaToken) {
      setErrorMessage('Silakan selesaikan verifikasi keamanan terlebih dahulu.');
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        skipAuth: true,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: submittedEmail, captchaToken }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || 'Permintaan reset gagal');
      }

      setSubmitted(true);
    } catch (error) {
      setCaptchaToken('');
      setCaptchaResetKey(prev => prev + 1);
      setErrorMessage(error instanceof Error ? error.message : 'Permintaan reset gagal, silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navbar />

      {/* Animated Background Elements - Match public pages */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-tertiary/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 mesh-bg opacity-40" />
      </div>

      <div className="relative z-10 container-custom min-h-screen flex items-center py-28 lg:py-32">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-14 items-center w-full">
          <motion.section
            initial={{ opacity: 0, x: -24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="max-w-2xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark border border-primary/20 mb-6">
              <Sparkles className="w-4 h-4 text-secondary" />
              <span className="font-body text-label-md font-bold text-secondary uppercase tracking-widest">
                Forgot Password
              </span>
            </div>

            <h1 className="font-display text-display-sm md:text-display-lg font-bold text-on-surface leading-[1.02] tracking-tight mb-6">
              Reset akses <span className="gradient-text-primary">portal internal</span> dengan aman
            </h1>

            <p className="font-body text-body-lg md:text-title-sm text-on-surface-variant max-w-xl leading-relaxed mb-8">
              Masukkan email yang terdaftar untuk menerima instruksi reset password. Alurnya tetap konsisten dengan gaya visual halaman publik lain: tegas, premium, dan ringan.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: ShieldCheck, title: 'Aman', description: 'Permintaan reset diproses secara server-side.' },
                { icon: RefreshCcw, title: 'Cepat', description: 'Instruksi dikirim segera setelah validasi email.' },
                { icon: CheckCircle2, title: 'Jelas', description: 'Satu alur untuk semua role pengguna.' },
              ].map((item, index) => {
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
                  <img src={logoPng} alt="Tridjaya Group" className="h-14 w-auto object-contain" />
                </div>
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl glass-card border border-outline-variant/10">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="font-body text-label-sm font-semibold text-on-surface-variant">Secure reset</span>
                </div>
              </div>

              <div className="mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark border border-primary/20 mb-4">
                  <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                  <span className="font-body text-label-md font-bold text-secondary uppercase tracking-widest">
                    Password Recovery
                  </span>
                </div>
                <h2 className="font-display text-headline-sm font-bold text-on-surface mb-2">
                  Kirim Instruksi Reset
                </h2>
                <p className="font-body text-body-md text-on-surface-variant">
                  Kami akan mengirimkan tautan reset ke email yang terdaftar.
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
                    name="forgot-password-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    onInput={(event) => setEmail((event.target as HTMLInputElement).value)}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="user@gmail.com"
                    className="w-full px-4 py-3.5 rounded-xl glass-dark border border-outline-variant/30 hover:border-outline-variant/50 focus:border-primary/50 font-body text-body-md text-white placeholder-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/40 focus:ring-offset-2 focus:ring-offset-surface transition-all duration-200"
                    required
                  />
                </label>

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

                {submitted ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="rounded-2xl glass-premium border border-primary/20 p-4 hover:border-primary/40 hover:shadow-neon-cyan-sm transition-all duration-300"
                  >
                    <p className="font-body text-body-sm text-on-surface-variant leading-relaxed">
                      Jika email terdaftar, instruksi reset sudah dikirim. Silakan cek inbox atau folder spam.
                    </p>
                  </motion.div>
                ) : null}

                {!submitted ? (
                  <HCaptcha
                    resetKey={captchaResetKey}
                    onVerify={setCaptchaToken}
                    onExpire={() => setCaptchaToken('')}
                    onError={() => setCaptchaToken('')}
                  />
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl gradient-primary text-surface font-body text-body-md font-semibold shadow-neon-cyan-sm hover:shadow-neon-cyan-md hover:scale-[1.02] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-neon-cyan-sm"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      Mengirim instruksi...
                    </>
                  ) : (
                    <>
                      Kirim Instruksi Reset
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between gap-3 text-body-sm font-medium">
                  <Link to="/login" className="text-on-surface-variant hover:text-primary transition-colors">
                    Kembali ke login
                  </Link>
                  <span className="text-on-surface-variant/70">Backend endpoint: /api/auth/forgot-password</span>
                </div>
              </form>
            </div>
          </motion.section>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
