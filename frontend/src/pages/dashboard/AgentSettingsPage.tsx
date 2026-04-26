import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  Lock, 
  Shield, 
  Save, 
  AlertCircle, 
  CreditCard,
  KeyRound
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';

const AgentSettingsPage: React.FC = () => {
  const { user, updateProfile, updatePassword } = useAuthStore();
  
  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [bankAccount, setBankAccount] = useState(user?.bank_account || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    
    const success = await updateProfile({ name, bank_account: bankAccount });
    if (success) {
      toast.success('Profil Diperbarui', 'Data akun Anda telah berhasil disimpan.');
    } else {
      toast.error('Gagal', 'Terjadi kesalahan saat memperbarui profil.');
    }
    setIsUpdatingProfile(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi Gagal', 'Kata sandi baru dan konfirmasi tidak cocok.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Terlalu Pendek', 'Kata sandi baru minimal 8 karakter.');
      return;
    }

    setIsUpdatingPassword(true);
    const success = await updatePassword(oldPassword, newPassword);
    if (success) {
      toast.success('Password Diubah', 'Kata sandi Anda telah berhasil diperbarui.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error('Gagal', 'Pastikan kata sandi lama Anda benar.');
    }
    setIsUpdatingPassword(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 100 } }
  };

  return (
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible"
      className="max-w-4xl mx-auto space-y-8"
    >
      <motion.div variants={itemVariants}>
        <h2 className="font-display text-headline-sm font-bold text-on-surface flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" /> Pengaturan Akun
        </h2>
        <p className="text-on-surface-variant mt-2">
          Kelola informasi profil, rekening bank, dan keamanan akun Anda dalam satu tempat.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profile & Bank Settings */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <h3 className="font-display text-title-md font-bold text-on-surface mb-6 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" /> Informasi Profil
            </h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Nama Lengkap</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="Nama Anda"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Nomor Rekening Bank</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="text"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm outline-none focus:ring-2 focus:ring-primary/40 font-mono"
                    placeholder="Contoh: BRI 1234-5678-9012"
                  />
                </div>
                <p className="text-[10px] text-on-surface-variant mt-1 italic flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Masukkan nama bank dan nomor rekening untuk mempermudah Payout.
                </p>
              </div>

              <button
                type="submit"
                disabled={isUpdatingProfile}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-bold text-label-md flex items-center justify-center gap-2 hover:bg-primary-light shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
              >
                {isUpdatingProfile ? 'Menyimpan...' : <><Save className="w-4 h-4" /> Simpan Perubahan</>}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Password Settings */}
        <motion.div variants={itemVariants} className="space-y-6">
          <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-tertiary/40 to-transparent" />
            <h3 className="font-display text-title-md font-bold text-on-surface mb-6 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-tertiary" /> Keamanan Akun
            </h3>
            
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kata Sandi Lama</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm outline-none focus:ring-2 focus:ring-tertiary/40"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm outline-none focus:ring-2 focus:ring-tertiary/40"
                    placeholder="Min. 8 karakter"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-label-sm font-semibold text-on-surface-variant">Konfirmasi Kata Sandi Baru</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant/50" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-surface-high border border-outline-variant/20 rounded-xl text-body-sm outline-none focus:ring-2 focus:ring-tertiary/40"
                    placeholder="Ulangi kata sandi"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full py-3 rounded-xl bg-tertiary text-on-tertiary font-bold text-label-md flex items-center justify-center gap-2 hover:bg-tertiary-light shadow-lg shadow-tertiary/20 transition-all disabled:opacity-50"
              >
                {isUpdatingPassword ? 'Memproses...' : <><Lock className="w-4 h-4" /> Perbarui Password</>}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default AgentSettingsPage;
