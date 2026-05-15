import React, { useState, useEffect } from 'react';
import { FlaskConical, AlertCircle, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../utils/apiClient';

interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
}

const AdminPixelEventTesterPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [eventType, setEventType] = useState('PageView');
  const [testEventCode, setTestEventCode] = useState('');
  const [eventSourceUrl, setEventSourceUrl] = useState('https://example.com/test');
  const [userAgent, setUserAgent] = useState(navigator.userAgent);
  
  // Optional fields
  const [fbp, setFbp] = useState('');
  const [fbc, setFbc] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  // Event-specific fields
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [orderId, setOrderId] = useState('');
  const [contentIds, setContentIds] = useState('');
  const [leadId, setLeadId] = useState('');
  
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const response = await apiFetch('/api/campaigns');
      if (response.ok) {
        const result = await response.json();
        setCampaigns(result.data.campaigns || []);
      }
    } catch (error) {
      console.error('Failed to fetch campaigns:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const customData: any = {};
      
      if (eventType === 'Purchase') {
        if (value) customData.value = parseFloat(value);
        if (currency) customData.currency = currency;
        if (orderId) customData.order_id = orderId;
        if (contentIds) customData.content_ids = contentIds.split(',').map(id => id.trim());
      } else if (eventType === 'Lead') {
        if (leadId) customData.lead_id = leadId;
      } else if (eventType === 'AddToCart' || eventType === 'ViewContent') {
        if (value) customData.value = parseFloat(value);
        if (currency) customData.currency = currency;
        if (contentIds) customData.content_ids = contentIds.split(',').map(id => id.trim());
      }

      const userData: any = {};
      if (email) userData.email = email;
      if (phone) userData.phone = phone;

      const payload = {
        campaign_id: selectedCampaign,
        event_type: eventType,
        event_source_url: eventSourceUrl,
        user_agent: userAgent,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
        user_data: Object.keys(userData).length > 0 ? userData : undefined,
        custom_data: Object.keys(customData).length > 0 ? customData : undefined,
        test_event_code: testEventCode,
      };

      const res = await apiFetch('/api/pixel-events/test', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      
      if (res.ok) {
        setResponse(result.data);
      } else {
        setError(result.message || 'Failed to send test event');
      }
    } catch (err) {
      setError('Failed to send test event');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-lg font-bold text-on-surface mb-2">Pixel Event Tester</h1>
        <p className="text-body-md text-on-surface-variant">
          Test pixel events before launching campaigns
        </p>
      </div>

      <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Campaign Selection */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-2">
              Campaign *
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className="input-field"
              required
            >
              <option value="">Select a campaign</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-2">
              Event Type *
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="input-field"
            >
              <option value="PageView">PageView</option>
              <option value="ViewContent">ViewContent</option>
              <option value="AddToCart">AddToCart</option>
              <option value="InitiateCheckout">InitiateCheckout</option>
              <option value="Purchase">Purchase</option>
              <option value="Lead">Lead</option>
              <option value="CompleteRegistration">CompleteRegistration</option>
            </select>
          </div>

          {/* Test Event Code */}
          <div>
            <label className="block text-label-md font-bold text-on-surface mb-2">
              Test Event Code *
            </label>
            <input
              type="text"
              value={testEventCode}
              onChange={(e) => setTestEventCode(e.target.value)}
              className="input-field"
              placeholder="Enter test event code from Meta"
              required
            />
            <p className="text-body-xs text-on-surface-variant mt-1">
              Get this from Meta Events Manager → Test Events
            </p>
          </div>

          {/* Basic Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Event Source URL *
              </label>
              <input
                type="url"
                value={eventSourceUrl}
                onChange={(e) => setEventSourceUrl(e.target.value)}
                className="input-field"
                placeholder="https://example.com/page"
                required
              />
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                User Agent
              </label>
              <input
                type="text"
                value={userAgent}
                onChange={(e) => setUserAgent(e.target.value)}
                className="input-field"
                placeholder="Browser user agent"
              />
            </div>
          </div>

          {/* Optional Cookie Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                FBP Cookie (optional)
              </label>
              <input
                type="text"
                value={fbp}
                onChange={(e) => setFbp(e.target.value)}
                className="input-field"
                placeholder="_fbp cookie value"
              />
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                FBC Cookie (optional)
              </label>
              <input
                type="text"
                value={fbc}
                onChange={(e) => setFbc(e.target.value)}
                className="input-field"
                placeholder="_fbc cookie value"
              />
            </div>
          </div>

          {/* Optional User Data (for hashing test) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Email (optional, will be hashed)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Phone (optional, will be hashed)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="+1234567890"
              />
            </div>
          </div>

          {/* Event-Specific Fields */}
          {(eventType === 'Purchase' || eventType === 'AddToCart' || eventType === 'ViewContent') && (
            <div className="p-4 bg-surface-high rounded-lg space-y-4">
              <h3 className="text-label-md font-bold text-on-surface">Event-Specific Data</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-label-sm font-medium text-on-surface mb-2">
                    Value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="input-field"
                    placeholder="99.99"
                  />
                </div>
                <div>
                  <label className="block text-label-sm font-medium text-on-surface mb-2">
                    Currency
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="input-field"
                    placeholder="USD"
                  />
                </div>
                {eventType === 'Purchase' && (
                  <div>
                    <label className="block text-label-sm font-medium text-on-surface mb-2">
                      Order ID
                    </label>
                    <input
                      type="text"
                      value={orderId}
                      onChange={(e) => setOrderId(e.target.value)}
                      className="input-field"
                      placeholder="ORDER-123"
                    />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-2">
                  Content IDs (comma-separated)
                </label>
                <input
                  type="text"
                  value={contentIds}
                  onChange={(e) => setContentIds(e.target.value)}
                  className="input-field"
                  placeholder="product-1, product-2"
                />
              </div>
            </div>
          )}

          {eventType === 'Lead' && (
            <div className="p-4 bg-surface-high rounded-lg">
              <h3 className="text-label-md font-bold text-on-surface mb-4">Lead Data</h3>
              <div>
                <label className="block text-label-sm font-medium text-on-surface mb-2">
                  Lead ID
                </label>
                <input
                  type="text"
                  value={leadId}
                  onChange={(e) => setLeadId(e.target.value)}
                  className="input-field"
                  placeholder="LEAD-123"
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary flex items-center gap-2" disabled={loading}>
            <FlaskConical className="w-5 h-5" />
            {loading ? 'Sending...' : 'Send Test Event'}
          </button>
        </form>

        {/* Response Display */}
        {error && (
          <div className="mt-6 p-4 rounded-lg bg-error/10 border border-error/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-label-md font-bold text-error mb-1">Error</h3>
                <p className="text-body-sm text-error">{error}</p>
              </div>
            </div>
          </div>
        )}

        {response && (
          <div className="mt-6 p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-start gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-label-md font-bold text-success mb-1">Success</h3>
                <p className="text-body-sm text-on-surface">Test event sent successfully</p>
              </div>
            </div>
            <div className="mt-4">
              <h4 className="text-label-sm font-bold text-on-surface mb-2">Meta API Response:</h4>
              <pre className="text-xs bg-surface-high p-3 rounded overflow-x-auto">
                {JSON.stringify(response, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPixelEventTesterPage;
