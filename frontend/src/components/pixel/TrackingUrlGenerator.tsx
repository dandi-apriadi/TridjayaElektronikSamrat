import React, { useState, useEffect } from 'react';
import { Copy, Check, Link2 } from 'lucide-react';

interface CampaignRecord {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_admin: string;
  utm_content?: string;
  utm_term?: string;
}

interface TrackingUrlGeneratorProps {
  campaign: CampaignRecord;
}

const TrackingUrlGenerator: React.FC<TrackingUrlGeneratorProps> = ({ campaign }) => {
  const [baseUrl, setBaseUrl] = useState('https://example.com');
  const [utmContent, setUtmContent] = useState(campaign.utm_content || '');
  const [utmTerm, setUtmTerm] = useState(campaign.utm_term || '');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    generateUrl();
  }, [baseUrl, utmContent, utmTerm, campaign]);

  const generateUrl = () => {
    const params = new URLSearchParams();
    
    // Required UTM parameters from campaign
    if (campaign.utm_source) params.append('utm_source', campaign.utm_source);
    if (campaign.utm_medium) params.append('utm_medium', campaign.utm_medium);
    if (campaign.utm_campaign) params.append('utm_campaign', campaign.utm_campaign);
    if (campaign.utm_admin) params.append('utm_admin', campaign.utm_admin);
    
    // Optional UTM parameters
    if (utmContent) params.append('utm_content', utmContent);
    if (utmTerm) params.append('utm_term', utmTerm);

    // Construct the full URL
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}${params.toString()}`;
    setGeneratedUrl(url);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Link2 className="w-5 h-5 text-primary" />
        <h3 className="text-title-sm font-bold text-on-surface">Tracking URL Generator</h3>
      </div>

      {/* Base URL Input */}
      <div>
        <label className="block text-label-sm font-medium text-on-surface mb-2">
          Base URL *
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="input-field"
          placeholder="https://example.com/landing-page"
        />
        <p className="text-body-xs text-on-surface-variant mt-1">
          Enter the landing page URL where you want to track visitors
        </p>
      </div>

      {/* Auto-populated UTM Parameters (read-only) */}
      <div className="p-4 bg-surface-high rounded-lg space-y-3">
        <p className="text-label-xs font-medium text-on-surface-variant">
          Campaign UTM Parameters (from campaign settings)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-label-xs text-on-surface-variant mb-1">UTM Source</label>
            <input
              type="text"
              value={campaign.utm_source}
              className="input-field text-sm bg-surface"
              readOnly
            />
          </div>
          <div>
            <label className="block text-label-xs text-on-surface-variant mb-1">UTM Medium</label>
            <input
              type="text"
              value={campaign.utm_medium}
              className="input-field text-sm bg-surface"
              readOnly
            />
          </div>
          <div>
            <label className="block text-label-xs text-on-surface-variant mb-1">UTM Campaign</label>
            <input
              type="text"
              value={campaign.utm_campaign}
              className="input-field text-sm bg-surface"
              readOnly
            />
          </div>
          <div>
            <label className="block text-label-xs text-on-surface-variant mb-1">UTM Admin</label>
            <input
              type="text"
              value={campaign.utm_admin}
              className="input-field text-sm bg-surface"
              readOnly
            />
          </div>
        </div>
      </div>

      {/* Optional UTM Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-label-sm font-medium text-on-surface mb-2">
            UTM Content (optional)
          </label>
          <input
            type="text"
            value={utmContent}
            onChange={(e) => setUtmContent(e.target.value)}
            className="input-field"
            placeholder="e.g., banner_top, sidebar_ad"
          />
        </div>
        <div>
          <label className="block text-label-sm font-medium text-on-surface mb-2">
            UTM Term (optional)
          </label>
          <input
            type="text"
            value={utmTerm}
            onChange={(e) => setUtmTerm(e.target.value)}
            className="input-field"
            placeholder="e.g., running+shoes"
          />
        </div>
      </div>

      {/* Generated URL Preview */}
      <div>
        <label className="block text-label-sm font-medium text-on-surface mb-2">
          Generated Tracking URL
        </label>
        <div className="flex gap-2">
          <div className="flex-1 p-3 bg-surface-high rounded-lg border border-outline-variant/20 overflow-x-auto">
            <code className="text-xs text-primary break-all">{generatedUrl}</code>
          </div>
          <button
            type="button"
            onClick={handleCopyUrl}
            className="btn-secondary flex items-center gap-2 flex-shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy URL
              </>
            )}
          </button>
        </div>
        <p className="text-body-xs text-on-surface-variant mt-2">
          Use this URL in your ads, emails, or social media posts to track campaign performance
        </p>
      </div>
    </div>
  );
};

export default TrackingUrlGenerator;
