import React from 'react';
import { BatteryCharging, Sofa, Tv } from 'lucide-react';

const knowledgeCards = [
  {
    title: 'Goda GD120',
    type: 'Bike Specs',
    icon: BatteryCharging,
    points: ['Range 70 km', 'Motor 1200W', 'DP mulai Rp 1.250.000'],
  },
  {
    title: 'Smart TV OLED 55"',
    type: 'Electronic Specs',
    icon: Tv,
    points: ['4K + HDR10', 'Google TV', 'Garansi panel 3 tahun'],
  },
  {
    title: 'Sofa Premium L',
    type: 'Furniture Materials',
    icon: Sofa,
    points: ['Fabric anti noda', 'Rangka kayu solid', 'Busa high density'],
  },
];

const AgentKnowledgePage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface">Product Knowledge</h3>
        <p className="text-body-sm text-on-surface-variant mt-1">Akses cepat harga, stok, dan selling point produk untuk closing lebih cepat.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {knowledgeCards.map((card) => (
          <div key={card.title} className="glass-card rounded-2xl p-5 border border-outline-variant/15">
            <div className="inline-flex items-center gap-2 text-label-sm text-primary uppercase tracking-wide mb-2">
              <card.icon className="w-4 h-4" /> {card.type}
            </div>
            <h4 className="font-semibold text-on-surface mb-3">{card.title}</h4>
            <ul className="space-y-2 text-body-sm text-on-surface-variant">
              {card.points.map((point) => (
                <li key={point}>• {point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AgentKnowledgePage;