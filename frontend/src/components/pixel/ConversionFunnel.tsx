import React from 'react';

interface ConversionFunnelProps {
  pageViews: number;
  addToCarts: number;
  checkouts: number;
  purchases: number;
}

const ConversionFunnel: React.FC<ConversionFunnelProps> = ({
  pageViews,
  addToCarts,
  checkouts,
  purchases,
}) => {
  const calculateDropoff = (current: number, previous: number) => {
    if (previous === 0) return 0;
    return ((1 - current / previous) * 100).toFixed(1);
  };

  const calculateConversionRate = (current: number, initial: number) => {
    if (initial === 0) return 0;
    return ((current / initial) * 100).toFixed(1);
  };

  const stages = [
    { label: 'Page Views', value: pageViews, width: 100 },
    { label: 'Add to Cart', value: addToCarts, width: pageViews > 0 ? (addToCarts / pageViews) * 100 : 0 },
    { label: 'Checkout', value: checkouts, width: pageViews > 0 ? (checkouts / pageViews) * 100 : 0 },
    { label: 'Purchase', value: purchases, width: pageViews > 0 ? (purchases / pageViews) * 100 : 0 },
  ];

  return (
    <div className="space-y-4">
      {stages.map((stage, index) => (
        <div key={stage.label} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {index + 1}
              </div>
              <div>
                <p className="text-label-md font-medium text-on-surface">{stage.label}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {stage.value.toLocaleString()} events
                </p>
              </div>
            </div>
            <div className="text-right">
              {index > 0 && (
                <>
                  <p className="text-label-sm font-medium text-on-surface">
                    {calculateConversionRate(stage.value, pageViews)}% conversion
                  </p>
                  <p className="text-body-xs text-error">
                    {calculateDropoff(stage.value, stages[index - 1].value)}% drop-off
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="relative h-12 bg-surface-high rounded-lg overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary transition-all duration-500"
              style={{ width: `${Math.max(stage.width, 5)}%` }}
            >
              <div className="flex items-center justify-center h-full text-white font-medium text-sm">
                {stage.width > 15 && `${stage.width.toFixed(0)}%`}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConversionFunnel;
