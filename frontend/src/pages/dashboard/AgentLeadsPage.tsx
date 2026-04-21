import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

const leads = [
  { name: 'Andi Jaya', product: 'Goda GD120', stage: 'Follow Up', source: 'WhatsApp', slug: 'goda-gd120' },
  { name: 'Rina Melati', product: 'Sofa Premium L', stage: 'Negotiation', source: 'Referral Link', slug: 'sofa-premium-l' },
  { name: 'Hendra Saputra', product: 'Winfly W200', stage: 'Payment Pending', source: 'Instagram', slug: 'winfly-w200' },
];

const AgentLeadsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface">My Leads</h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Kelola prospek, pantau status pipeline, dan lakukan follow-up terjadwal.</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leads.map((lead) => (
          <div key={lead.name} className="glass-card rounded-2xl p-5 border border-outline-variant/15 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="font-semibold text-on-surface">{lead.name}</div>
              <div className="text-body-sm text-on-surface-variant">
                <Link to={`/produk/${lead.slug}`} className="hover:text-primary transition-colors">{lead.product}</Link> • {lead.source}
              </div>
            </div>
            <div className="text-label-sm text-on-surface-variant">{lead.stage}</div>
            <a
              href={`https://wa.me/628529999999?text=${encodeURIComponent(`Halo ${lead.name}, kami follow up ketertarikan Anda pada ${lead.product}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-xl bg-primary/20 text-primary font-semibold inline-flex items-center gap-2 w-fit"
            >
              <MessageCircle className="w-4 h-4" /> Follow Up
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentLeadsPage;