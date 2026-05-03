/**
 * Referral Session Manager
 *
 * Menyimpan referral code di localStorage dengan expiry 1 jam.
 * Referral aktif jika:
 *   1. Belum expired (< 1 jam sejak pertama kali disimpan), ATAU
 *   2. Ada referral baru yang masuk (langsung menggantikan yang lama)
 *
 * Key: 'tridjaya-referral-session'
 * Value: { code: string, savedAt: number (unix ms) }
 */

const STORAGE_KEY = 'tridjaya-referral-session';
const EXPIRY_MS = 60 * 60 * 1000; // 1 jam

interface ReferralSession {
  code: string;
  savedAt: number;
}

/**
 * Simpan referral code baru.
 * Selalu menggantikan yang lama (referral baru = reset timer).
 */
export function saveReferralCode(code: string): void {
  if (!code?.trim()) return;
  const session: ReferralSession = {
    code: code.trim(),
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    // Juga simpan di key lama untuk backward compatibility
    localStorage.setItem('tridjaya-referral-code', code.trim());
  } catch {
    // localStorage mungkin tidak tersedia (private mode, dll)
  }
}

/**
 * Ambil referral code yang masih aktif (belum expired).
 * Returns null jika tidak ada atau sudah expired.
 */
export function getActiveReferralCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Fallback: cek key lama (tanpa expiry) — migrasi dari sistem lama
      const legacy = localStorage.getItem('tridjaya-referral-code');
      return legacy?.trim() || null;
    }

    const session: ReferralSession = JSON.parse(raw);
    const age = Date.now() - session.savedAt;

    if (age > EXPIRY_MS) {
      // Expired — hapus dari storage
      clearReferralCode();
      return null;
    }

    return session.code;
  } catch {
    return null;
  }
}

/**
 * Sisa waktu aktif referral dalam milidetik.
 * Returns 0 jika tidak ada atau sudah expired.
 */
export function getReferralTimeRemaining(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const session: ReferralSession = JSON.parse(raw);
    const remaining = EXPIRY_MS - (Date.now() - session.savedAt);
    return Math.max(0, remaining);
  } catch {
    return 0;
  }
}

/**
 * Hapus referral session.
 */
export function clearReferralCode(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('tridjaya-referral-code');
  } catch {
    // ignore
  }
}
