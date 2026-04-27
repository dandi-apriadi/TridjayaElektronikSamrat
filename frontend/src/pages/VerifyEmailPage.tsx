import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import Navbar from '../components/layout/Navbar';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';

type Status = 'pending' | 'success' | 'error';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('pending');
  const [message, setMessage] = useState('Memverifikasi akun Anda...');

  useEffect(() => {
    const token = searchParams.get('token')?.trim() ?? '';
    if (!token) {
      setStatus('error');
      setMessage('Token verifikasi tidak ditemukan pada URL.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const payload = await response.json().catch(() => null);
        if (cancelled) return;
        if (!response.ok) {
          setStatus('error');
          setMessage(payload?.message || 'Verifikasi gagal. Token mungkin sudah kadaluarsa.');
          return;
        }
        setStatus('success');
        setMessage(payload?.message || 'Email berhasil diverifikasi.');
      } catch {
        if (cancelled) return;
        setStatus('error');
        setMessage('Verifikasi gagal. Periksa koneksi Anda dan coba lagi.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navbar />
      <div className="relative z-10 container-custom min-h-screen flex items-center py-28 lg:py-32">
        <div className="glass-card rounded-3xl p-10 border border-outline-variant/20 max-w-lg mx-auto text-center space-y-4">
          {status === 'pending' && <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-12 h-12 text-secondary mx-auto" />}
          {status === 'error' && <ShieldAlert className="w-12 h-12 text-error mx-auto" />}
          <h1 className="font-display text-headline-md font-bold text-on-surface">
            {status === 'success' ? 'Akun terverifikasi' : status === 'error' ? 'Verifikasi gagal' : 'Memverifikasi...'}
          </h1>
          <p className="font-body text-body-md text-on-surface-variant">{message}</p>
          {status !== 'pending' && (
            <Link to="/login" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 transition">
              Lanjut ke Login
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
