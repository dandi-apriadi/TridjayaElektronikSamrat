import React, { useState } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface Campaign {
  campaign_id: string;
  campaign_name: string;
  total_events: number;
  conversions: number;
  conversion_rate?: number;
  total_revenue: number;
  currency: string;
}

interface CampaignTableProps {
  campaigns: Campaign[];
  onSort?: (field: string) => void;
}

type SortField = 'conversion_rate' | 'total_revenue' | 'total_events';
type SortDirection = 'asc' | 'desc';

const CampaignTable: React.FC<CampaignTableProps> = ({ campaigns, onSort }) => {
  const [sortField, setSortField] = useState<SortField>('conversion_rate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    if (onSort) {
      onSort(field);
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const aValue = a[sortField] || 0;
    const bValue = b[sortField] || 0;
    return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-on-surface-variant" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-primary" />
    ) : (
      <ArrowDown className="w-4 h-4 text-primary" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-variant/20">
            <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">
              Campaign Name
            </th>
            <th 
              className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant cursor-pointer hover:text-on-surface"
              onClick={() => handleSort('total_events')}
            >
              <div className="flex items-center justify-end gap-1">
                Events
                <SortIcon field="total_events" />
              </div>
            </th>
            <th className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant">
              Conversions
            </th>
            <th 
              className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant cursor-pointer hover:text-on-surface"
              onClick={() => handleSort('conversion_rate')}
            >
              <div className="flex items-center justify-end gap-1">
                Conv. Rate
                <SortIcon field="conversion_rate" />
              </div>
            </th>
            <th 
              className="text-right py-3 px-4 text-label-sm font-medium text-on-surface-variant cursor-pointer hover:text-on-surface"
              onClick={() => handleSort('total_revenue')}
            >
              <div className="flex items-center justify-end gap-1">
                Revenue
                <SortIcon field="total_revenue" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedCampaigns.map((campaign) => (
            <tr key={campaign.campaign_id} className="border-b border-outline-variant/10 hover:bg-surface-high/50">
              <td className="py-3 px-4 text-body-sm text-on-surface font-medium">
                {campaign.campaign_name}
              </td>
              <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                {campaign.total_events.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                {campaign.conversions.toLocaleString()}
              </td>
              <td className="py-3 px-4 text-body-sm text-on-surface text-right">
                <span className={`font-medium ${
                  (campaign.conversion_rate || 0) > 0.05 ? 'text-success' : 
                  (campaign.conversion_rate || 0) > 0.02 ? 'text-warning' : 
                  'text-on-surface'
                }`}>
                  {((campaign.conversion_rate || 0) * 100).toFixed(2)}%
                </span>
              </td>
              <td className="py-3 px-4 text-body-sm text-on-surface text-right font-medium">
                {campaign.currency} {campaign.total_revenue.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sortedCampaigns.length === 0 && (
        <div className="text-center py-8 text-on-surface-variant">
          No campaigns found
        </div>
      )}
    </div>
  );
};

export default CampaignTable;
