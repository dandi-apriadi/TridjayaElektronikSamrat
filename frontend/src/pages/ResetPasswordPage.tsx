import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Lock, ShieldCheck } from 'lucide-react';
import Navbar from '../components/layout/Navbar';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token')?.trim() ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setErrorMessage('Token reset tidak ditemukan pada URL.');
    }
  }, [token]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Token reset tidak valid.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password baru minimal 8 karakter.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Konfirmasi password tidak sama.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Reset password gagal');
      }
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Reset password gagal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navbar />
      <div className="relative z-10 container-custom min-h-screen flex items-center py-28 lg:py-32">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 items-center w-full">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass-dark border border-primary/20 mb-6">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span className="font-body text-label-md font-bold text-primary uppercase tracking-widest">
                Reset Password
              </span>
            </div>
            <h1 className="font-display text-display-sm md:text-display-lg font-bold text-on-surface leading-[1.02] tracking-tight mb-6">
              Atur ulang <span className="gradient-text-primary">password Anda</span>
            </h1>
            <p className="font-body text-body-lg text-on-surface-variant max-w-lg leading-relaxed">
              Masukkan password baru. Setelah disimpan, semua sesi aktif akan otomatis logout dan Anda dapat masuk kembali dengan password baru.
            </p>
          </motion.section>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="glass-card rounded-3xl p-8 border border-outline-variant/20 max-w-md w-full"
          >
            {success ? (
              <div className="text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-secondary mx-auto" />
                <h2 className="font-display text-headline-sm font-bold text-on-surface">Password berhasil direset</h2>
                <p className="font-body text-body-md text-on-surface-variant">
                  Anda akan diarahkan ke halaman login...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-label-md font-bold text-on-surface mb-2" htmlFor="new-password">
                    Password baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:border-primary focus:outline-none"
                      minLength={8}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-label-md font-bold text-on-surface mb-2" htmlFor="confirm-password">
                    Konfirmasi password baru
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/30 bg-surface text-on-surface focus:border-primary focus:outline-none"
                      minLength={8}
                      required
                    />
                  </div>
                </div>

                {errorMessage && (
                  <p className="text-label-sm text-error">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !token}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-60 hover:opacity-95 transition"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Simpan password baru
                </button>

                <p className="text-center text-body-sm text-on-surface-variant">
                  Kembali ke <Link className="text-primary font-bold" to="/login">login</Link>
                </p>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
