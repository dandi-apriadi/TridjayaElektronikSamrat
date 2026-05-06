import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricsCardProps {
  label: string;
  value: string | number;
  trend?: number;
  currency?: string;
  icon?: React.ReactNode;
}

const MetricsCard: React.FC<MetricsCardProps> = ({
  label,
  value,
  trend,
  currency,
  icon,
}) => {
  const formattedValue = typeof value === 'number' 
    ? currency 
      ? `${currency} ${value.toLocaleString()}`
      : value.toLocaleString()
    : value;

  return (
    <div className="glass-card p-4 rounded-xl border border-outline-variant/20">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-label-sm text-on-surface-variant mb-1">{label}</p>
          <p className="text-title-lg font-bold text-on-surface mb-2">{formattedValue}</p>
          {trend !== undefined && (
            <div className="flex items-center gap-1">
              {trend >= 0 ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-error" />
              )}
              <span className={`text-label-sm font-medium ${trend >= 0 ? 'text-success' : 'text-error'}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              <span className="text-label-sm text-on-surface-variant">vs last period</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 rounded-lg bg-primary/10">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricsCard;
