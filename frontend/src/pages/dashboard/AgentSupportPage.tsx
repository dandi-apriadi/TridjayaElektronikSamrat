import React from 'react';
import { Headset, LifeBuoy, MessageSquareWarning } from 'lucide-react';

const tickets = [
  { id: 'SUP-402', title: 'Referral link tidak aktif', category: 'Teknis', status: 'In Progress' },
  { id: 'SUP-397', title: 'Konfirmasi payout belum masuk', category: 'Keuangan', status: 'Waiting Admin' },
  { id: 'SUP-391', title: 'Harga produk berbeda dengan katalog', category: 'Katalog', status: 'Resolved' },
];

const AgentSupportPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface inline-flex items-center gap-2">
          <Headset className="w-5 h-5 text-primary" /> Support Center
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Hubungi tim support untuk isu teknis, finansial, atau pembaruan data produk.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card rounded-2xl p-5 border border-outline-variant/15">
          <h4 className="font-semibold text-on-surface mb-3 inline-flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-secondary" /> Kanal Bantuan
          </h4>
          <ul className="space-y-2 text-body-sm text-on-surface-variant">
            <li>• Live chat operasional: 08.00 - 20.00 WITA</li>
            <li>• Email: <a href="mailto:support@tridjaya.co.id" className="text-primary hover:underline">support@tridjaya.co.id</a></li>
            <li>• Hotline prioritas: <a href="tel:+6281200007788" className="text-primary hover:underline">+62 812-0000-7788</a></li>
          </ul>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-outline-variant/15">
          <h4 className="font-semibold text-on-surface mb-3 inline-flex items-center gap-2">
            <MessageSquareWarning className="w-4 h-4 text-tertiary" /> Buat Tiket Baru
          </h4>
          <a
            href="mailto:support@tridjaya.co.id?subject=Tiket%20Support%20Baru%20Agen"
            className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-semibold inline-block"
          >
            Open Ticket
          </a>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="text-label-sm text-on-surface-variant border-b border-outline-variant/20">
              <th className="py-3 pr-3">ID Tiket</th>
              <th className="py-3 pr-3">Judul</th>
              <th className="py-3 pr-3">Kategori</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-b border-outline-variant/10">
                <td className="py-3 pr-3 text-on-surface-variant">{ticket.id}</td>
                <td className="py-3 pr-3 text-on-surface font-semibold">{ticket.title}</td>
                <td className="py-3 pr-3 text-on-surface-variant">{ticket.category}</td>
                <td className="py-3 text-on-surface-variant">{ticket.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AgentSupportPage;