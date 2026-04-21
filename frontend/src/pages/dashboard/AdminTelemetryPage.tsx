import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const trafficData = [
  { day: 'Mon', clicks: 1280, leads: 74 },
  { day: 'Tue', clicks: 1460, leads: 82 },
  { day: 'Wed', clicks: 1650, leads: 90 },
  { day: 'Thu', clicks: 1720, leads: 96 },
  { day: 'Fri', clicks: 1810, leads: 101 },
  { day: 'Sat', clicks: 1540, leads: 87 },
  { day: 'Sun', clicks: 1320, leads: 73 },
];

const sourceRows = [
  { source: 'WhatsApp CTA', clicks: 3240, conversion: '6.4%' },
  { source: 'Referral Link Agent', clicks: 2910, conversion: '8.1%' },
  { source: 'Promo Landing', clicks: 1880, conversion: '5.2%' },
];

const AdminTelemetryPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Total Click (7 hari)</div>
          <div className="font-display text-headline-sm text-on-surface font-bold mt-1">10,780</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Total Lead</div>
          <div className="font-display text-headline-sm text-primary font-bold mt-1">603</div>
        </div>
        <div className="glass-card rounded-2xl p-5">
          <div className="text-label-sm text-on-surface-variant">Conversion Rate</div>
          <div className="font-display text-headline-sm text-secondary font-bold mt-1">5.59%</div>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Trend Klik vs Lead</h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#484847" vertical={false} />
              <XAxis dataKey="day" stroke="#ADAAAA" tickLine={false} axisLine={false} />
              <YAxis stroke="#ADAAAA" tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', borderColor: '#484847', borderRadius: '12px' }} />
              <Line type="monotone" dataKey="clicks" stroke="#8FF5FF" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="leads" stroke="#A2F31F" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6">
        <h3 className="font-display text-title-md font-bold text-on-surface mb-4">Sumber Konversi</h3>
        <div className="space-y-3">
          {sourceRows.map((row) => (
            <div key={row.source} className="border border-outline-variant/15 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-on-surface">{row.source}</div>
                <div className="text-label-sm text-on-surface-variant">{row.clicks.toLocaleString('id-ID')} klik</div>
              </div>
              <div className="font-bold text-primary">{row.conversion}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminTelemetryPage;