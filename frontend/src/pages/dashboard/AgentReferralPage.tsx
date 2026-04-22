import React, { useState } from 'react';
import { Copy, Check, Share2, ExternalLink, TrendingUp, Users, MousePointerClick, QrCode } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const weeklyClicks = [
  { day: 'Sen', clicks: 42 },
  { day: 'Sel', clicks: 58 },
  { day: 'Rab', clicks: 71 },
  { day: 'Kam', clicks: 65 },
  { day: 'Jum', clicks: 89 },
  { day: 'Sab', clicks: 104 },
  { day: 'Min', clicks: 77 },
];

const maxClicks = Math.max(...weeklyClicks.map((d) => d.clicks));

const AgentReferralPage: React.FC = () => {
  const { user } = useAuthStore();
  const agentCode = user?.name?.replace(/\s+/g, '').slice(0, 6).toUpperCase() || 'AGT001';
  const referralLink = `https://tridjaya.co.id/?ref=${agentCode}`;

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waMessage = encodeURIComponent(
    `Halo! Saya adalah agen resmi Tridjaya Samrat.\n\nDapatkan sepeda listrik, elektronik & furnitur premium langsung dari distributor!\n\nCek katalog lengkap di: ${referralLink}`
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card rounded-xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
          <Share2 className="w-5 h-5 text-primary" /> Referral & Link Agen
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Gunakan link unik Anda untuk menjangkau lebih banyak calon pembeli dan lacak performa setiap kampanye.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mb-1"><MousePointerClick className="w-3.5 h-3.5" /> Total Klik (Bulan Ini)</div>
          <div className="font-display text-headline-sm text-primary font-bold">506</div>
          <div className="text-label-xs text-secondary mt-1">↑ +18% vs bulan lalu</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mb-1"><Users className="w-3.5 h-3.5" /> Konversi dari Link</div>
          <div className="font-display text-headline-sm text-secondary font-bold">38 Prospek</div>
          <div className="text-label-xs text-on-surface-variant mt-1">Conv. Rate 7.5%</div>
        </div>
        <div className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant mb-1"><TrendingUp className="w-3.5 h-3.5" /> Penjualan via Link</div>
          <div className="font-display text-headline-sm text-on-surface font-bold">9 Unit</div>
          <div className="text-label-xs text-primary mt-1">Rp 2.700.000 komisi</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Link Card */}
        <div className="lg:col-span-2 space-y-4">
          {/* Referral Link */}
          <div className="glass-card rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />
            <div className="text-label-sm text-on-surface-variant font-semibold mb-2">Link Referral Unik Anda</div>
            <div className="flex items-center gap-3">
              <div className="flex-1 px-4 py-3 bg-surface-high border border-outline-variant/20 rounded-lg font-body text-body-sm text-primary font-semibold truncate">
                {referralLink}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`flex-shrink-0 px-4 py-3 rounded-lg font-semibold text-label-sm inline-flex items-center gap-2 transition-all ${copied ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
              >
                {copied ? <><Check className="w-4 h-4" /> Disalin!</> : <><Copy className="w-4 h-4" /> Salin Link</>}
              </button>
            </div>
            <p className="text-label-xs text-on-surface-variant mt-2">Kode Agen: <strong className="text-on-surface">{agentCode}</strong> — link ini melacak klik dan konversi yang berasal dari Anda.</p>
          </div>

          {/* Share Buttons */}
          <div className="glass-card rounded-xl p-5">
            <div className="text-label-sm text-on-surface-variant font-semibold mb-3">Bagikan Via</div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`https://wa.me/?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-[#25D366]/15 text-[#25D366] font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-[#25D366]/25 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> WhatsApp
              </a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-blue-500/15 text-blue-400 font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-blue-500/25 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Facebook
              </a>
              <a
                href={`https://www.instagram.com/`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-pink-500/15 text-pink-400 font-semibold text-label-sm inline-flex items-center gap-2 hover:bg-pink-500/25 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Instagram Bio
              </a>
              <a
                href={referralLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-lg bg-surface-high text-on-surface-variant font-semibold text-label-sm inline-flex items-center gap-2 hover:text-on-surface transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> Buka Link
              </a>
            </div>
          </div>

          {/* Weekly Bar Chart */}
          <div className="glass-card rounded-xl p-6">
            <h4 className="font-display text-title-sm font-bold text-on-surface mb-4">Klik per Hari (7 Hari Terakhir)</h4>
            <div className="flex items-end justify-between gap-2 h-32">
              {weeklyClicks.map((d) => (
                <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
                  <div className="text-label-xs text-primary font-bold">{d.clicks}</div>
                  <div
                    className="w-full rounded-t-sm bg-primary/60 hover:bg-primary transition-all"
                    style={{ height: `${(d.clicks / maxClicks) * 100}%`, minHeight: '4px' }}
                  />
                  <div className="text-label-xs text-on-surface-variant">{d.day}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* QR Code Panel */}
        <div className="glass-card rounded-xl p-6 flex flex-col items-center justify-start gap-4">
          <div className="flex items-center gap-2 self-start">
            <QrCode className="w-5 h-5 text-primary" />
            <h4 className="font-display text-title-sm font-bold text-on-surface">QR Code Agen</h4>
          </div>
          {/* QR Code placeholder — can be replaced with a real QR library */}
          <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-40 h-40">
              {/* Top-left finder pattern */}
              <rect x="10" y="10" width="22" height="22" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="15" y="15" width="12" height="12" fill="#111" />
              {/* Top-right finder pattern */}
              <rect x="68" y="10" width="22" height="22" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="73" y="15" width="12" height="12" fill="#111" />
              {/* Bottom-left finder pattern */}
              <rect x="10" y="68" width="22" height="22" fill="none" stroke="#111" strokeWidth="3" />
              <rect x="15" y="73" width="12" height="12" fill="#111" />
              {/* Data modules (decorative) */}
              {[38,42,50,54,62,38,46,58,42,50,54,38,42,50,62].map((x, i) => (
                <rect key={i} x={x} y={10 + (i % 7) * 5} width="3" height="3" fill="#111" />
              ))}
              {[38,42,50,54,62,38,46,58,42,50].map((y, i) => (
                <rect key={`v${i}`} x={10 + (i % 5) * 5} y={y} width="3" height="3" fill="#111" />
              ))}
              {[38,46,54,62,38,46,54,38,46,54,62,38,46].map((x, i) => (
                <rect key={`d${i}`} x={x} y={40 + (i % 6) * 5} width="3" height="3" fill="#111" />
              ))}
            </svg>
          </div>
          <div className="text-center">
            <div className="font-bold text-on-surface text-body-sm">{agentCode}</div>
            <div className="text-label-xs text-on-surface-variant mt-1">Scan untuk mengunjungi katalog dengan referral Anda</div>
          </div>
          <button
            type="button"
            className="w-full py-2.5 rounded-lg border border-outline-variant/20 text-on-surface-variant text-label-sm font-semibold hover:bg-surface-high transition-colors"
          >
            Download QR Code
          </button>
          <div className="w-full p-3 rounded-lg bg-surface-low border border-outline-variant/10 text-label-xs text-on-surface-variant">
            Cetak QR code ini dan tempel di brosur, spanduk, atau kartu nama Anda untuk mendapatkan lebih banyak klik.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentReferralPage;
