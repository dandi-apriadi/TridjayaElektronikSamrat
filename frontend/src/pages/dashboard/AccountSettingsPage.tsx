import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  CreditCard,
  KeyRound,
  Lock,
  Save,
  Shield,
  User,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';
import { isAdminSalesRole } from '../../utils/roles';

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

const AccountSettingsPage: React.FC = () => {
  const { user, updateProfile, updatePassword } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [bankAccount, setBankAccount] = useState(user?.bank_account || '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const canEditBankAccount = user?.role === 'agent' || isAdminSalesRole(user?.role);

  const handleUpdateProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsUpdatingProfile(true);

    const payload = canEditBankAccount
      ? { name: name.trim(), bank_account: bankAccount.trim() }
      : { name: name.trim() };
    const success = await updateProfile(payload);

    if (success) {
      toast.success('Profil diperbarui', 'Data akun berhasil disimpan.');
    } else {
      toast.error('Gagal menyimpan', 'Periksa koneksi atau coba beberapa saat lagi.');
    }
    setIsUpdatingProfile(false);
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi tidak cocok', 'Kata sandi baru dan konfirmasi harus sama.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password terlalu pendek', 'Kata sandi baru minimal 8 karakter.');
      return;
    }

    setIsUpdatingPassword(true);
    const success = await updatePassword(oldPassword, newPassword);
    if (success) {
      toast.success('Password diperbarui', 'Kata sandi akun Anda sudah diganti.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error('Gagal mengganti password', 'Pastikan kata sandi lama benar.');
    }
    setIsUpdatingPassword(false);
  };

  return (
    <motion.div initial="hidden" animate="visible" className="mx-auto max-w-5xl space-y-6">
      <motion.div variants={itemVariants}>
        <p className="text-label-xs font-bold uppercase tracking-widest text-primary">Pengaturan akun</p>
        <h1 className="mt-1 text-headline-sm font-black text-on-surface">Profil dan keamanan</h1>
        <p className="mt-2 max-w-3xl text-body-sm text-on-surface-variant">
          Kelola nama akun dan ganti password untuk menjaga akses dashboard tetap aman.
        </p>
      </motion.div>

      {user?.must_change_password && (
        <motion.div variants={itemVariants} className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="font-bold text-on-surface">Password wajib diganti.</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Masukkan password lama dan password baru sebelum melanjutkan aktivitas dashboard.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-title-md font-black text-on-surface">Informasi profil</h2>
              <p className="text-label-sm text-on-surface-variant">{user?.role || 'user'}</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-label-sm font-bold text-on-surface-variant">Nama lengkap</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-4 text-body-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                placeholder="Nama Anda"
                required
              />
            </label>

            {canEditBankAccount && (
              <label className="block space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">Rekening bank</span>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(event) => setBankAccount(event.target.value)}
                    className="h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-10 text-body-sm text-on-surface outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                    placeholder="Contoh: BRI 1234-5678-9012"
                  />
                </div>
                <p className="flex items-center gap-1 text-label-xs text-on-surface-variant">
                  <AlertCircle className="h-3 w-3" />
                  Dipakai untuk kebutuhan payout atau administrasi sales/agent.
                </p>
              </label>
            )}

            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-label-sm font-bold text-on-primary transition hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {isUpdatingProfile ? 'Menyimpan...' : 'Simpan profil'}
            </button>
          </form>
        </motion.section>

        <motion.section variants={itemVariants} className="rounded-xl border border-outline-variant/20 bg-surface p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-lg bg-tertiary/10 p-2 text-tertiary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-title-md font-black text-on-surface">Ganti password</h2>
              <p className="text-label-sm text-on-surface-variant">Minimal 8 karakter.</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {[
              { label: 'Password lama', value: oldPassword, setter: setOldPassword, placeholder: 'Masukkan password lama' },
              { label: 'Password baru', value: newPassword, setter: setNewPassword, placeholder: 'Minimal 8 karakter' },
              { label: 'Konfirmasi password baru', value: confirmPassword, setter: setConfirmPassword, placeholder: 'Ulangi password baru' },
            ].map((field) => (
              <label key={field.label} className="block space-y-1.5">
                <span className="text-label-sm font-bold text-on-surface-variant">{field.label}</span>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                  <input
                    type="password"
                    value={field.value}
                    onChange={(event) => field.setter(event.target.value)}
                    className="h-11 w-full rounded-lg border border-outline-variant/20 bg-surface-high px-10 text-body-sm text-on-surface outline-none focus:border-tertiary/50 focus:ring-2 focus:ring-tertiary/15"
                    placeholder={field.placeholder}
                    required
                  />
                </div>
              </label>
            ))}

            <button
              type="submit"
              disabled={isUpdatingPassword}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-tertiary px-4 text-label-sm font-bold text-on-tertiary transition hover:bg-tertiary/90 disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {isUpdatingPassword ? 'Memproses...' : 'Perbarui password'}
            </button>
          </form>
        </motion.section>
      </div>
    </motion.div>
  );
};

export default AccountSettingsPage;
