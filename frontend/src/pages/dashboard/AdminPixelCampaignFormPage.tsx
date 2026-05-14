import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from '../../store/useNotificationStore';
import TrackingUrlGenerator from '../../components/pixel/TrackingUrlGenerator';

interface Pixel {
  id: string;
  pixel_id: string;
  name: string;
}

interface CustomConversion {
  id?: string;
  name: string;
  event_type: string;
  rules: string;
  conversion_value: number;
  currency: string;
}

interface CampaignFormData {
  name: string;
  pixel_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_admin: string;
  utm_content: string;
  utm_term: string;
}

const AdminPixelCampaignFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    pixel_id: '',
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_admin: '',
    utm_content: '',
    utm_term: '',
  });

  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [customConversions, setCustomConversions] = useState<CustomConversion[]>([]);
  const [newConversion, setNewConversion] = useState<CustomConversion>({
    name: '',
    event_type: 'Purchase',
    rules: '{}',
    conversion_value: 0,
    currency: 'USD',
  });
  const [showConversionForm, setShowConversionForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPixels();
    if (isEdit && id) {
      fetchCampaign(id);
      fetchCustomConversions(id);
    }
  }, [id, isEdit]);

  const fetchPixels = async () => {
    try {
      const response = await fetch('/api/pixels', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        setPixels(result.data.pixels || []);
      }
    } catch (error) {
      console.error('Failed to fetch pixels:', error);
    }
  };

  const fetchCampaign = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        setFormData(result.data.campaign);
      }
    } catch (error) {
      console.error('Failed to fetch campaign:', error);
    }
  };

  const fetchCustomConversions = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/conversions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const result = await response.json();
        setCustomConversions(result.data.conversions || []);
      }
    } catch (error) {
      console.error('Failed to fetch custom conversions:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = isEdit ? `/api/campaigns/${id}` : '/api/campaigns';
      const method = isEdit ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Campaign tersimpan');
        navigate('/dashboard/admin/pixel-campaigns');
      } else {
        const error = await response.json();
        toast.error('Gagal menyimpan campaign', error.message || 'Terjadi kesalahan');
      }
    } catch (error) {
      console.error('Failed to save campaign:', error);
      toast.error('Gagal menyimpan campaign', 'Terjadi kesalahan jaringan atau server');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConversion = async () => {
    if (!id) return;

    try {
      const response = await fetch(`/api/campaigns/${id}/conversions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newConversion),
      });

      if (response.ok) {
        fetchCustomConversions(id);
        setNewConversion({
          name: '',
          event_type: 'Purchase',
          rules: '{}',
          conversion_value: 0,
          currency: 'USD',
        });
        setShowConversionForm(false);
      }
    } catch (error) {
      console.error('Failed to add conversion:', error);
    }
  };

  const handleDeleteConversion = async (conversionId: string) => {
    if (!id) return;

    try {
      const response = await fetch(`/api/campaigns/${id}/conversions/${conversionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        fetchCustomConversions(id);
      }
    } catch (error) {
      console.error('Failed to delete conversion:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/admin/pixel-campaigns')}
          className="p-2 rounded-lg hover:bg-surface-high transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-title-lg font-bold text-on-surface mb-2">
            {isEdit ? 'Edit Campaign' : 'Create New Campaign'}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Configure campaign tracking parameters
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field"
                placeholder="Enter campaign name"
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Pixel *
              </label>
              <select
                value={formData.pixel_id}
                onChange={(e) => setFormData({ ...formData, pixel_id: e.target.value })}
                className="input-field"
                required
                disabled={isEdit}
              >
                <option value="">Select a pixel</option>
                {pixels.map((pixel) => (
                  <option key={pixel.id} value={pixel.id}>
                    {pixel.name} ({pixel.pixel_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* UTM Parameters */}
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">UTM Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Source *
              </label>
              <input
                type="text"
                value={formData.utm_source}
                onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                className="input-field"
                placeholder="e.g., facebook, google"
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Medium *
              </label>
              <input
                type="text"
                value={formData.utm_medium}
                onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                className="input-field"
                placeholder="e.g., cpc, banner"
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Campaign *
              </label>
              <input
                type="text"
                value={formData.utm_campaign}
                onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                className="input-field"
                placeholder="e.g., summer_sale"
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Admin (Auto-filled)
              </label>
              <input
                type="text"
                value={formData.utm_admin}
                className="input-field bg-surface-high"
                placeholder="Auto-generated"
                readOnly
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Content
              </label>
              <input
                type="text"
                value={formData.utm_content}
                onChange={(e) => setFormData({ ...formData, utm_content: e.target.value })}
                className="input-field"
                placeholder="e.g., banner_top"
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                UTM Term
              </label>
              <input
                type="text"
                value={formData.utm_term}
                onChange={(e) => setFormData({ ...formData, utm_term: e.target.value })}
                className="input-field"
                placeholder="e.g., running+shoes"
              />
            </div>
          </div>
        </div>

        {/* Custom Conversions (only for edit mode) */}
        {isEdit && (
          <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-title-md font-bold text-on-surface">Custom Conversions</h2>
              <button
                type="button"
                onClick={() => setShowConversionForm(!showConversionForm)}
                className="btn-secondary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Conversion
              </button>
            </div>

            {showConversionForm && (
              <div className="mb-4 p-4 bg-surface-high rounded-lg space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={newConversion.name}
                    onChange={(e) => setNewConversion({ ...newConversion, name: e.target.value })}
                    className="input-field"
                    placeholder="Conversion name"
                  />
                  <select
                    value={newConversion.event_type}
                    onChange={(e) => setNewConversion({ ...newConversion, event_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="Purchase">Purchase</option>
                    <option value="Lead">Lead</option>
                    <option value="AddToCart">Add to Cart</option>
                    <option value="CompleteRegistration">Complete Registration</option>
                  </select>
                  <input
                    type="number"
                    value={newConversion.conversion_value}
                    onChange={(e) => setNewConversion({ ...newConversion, conversion_value: parseFloat(e.target.value) })}
                    className="input-field"
                    placeholder="Value"
                  />
                  <input
                    type="text"
                    value={newConversion.currency}
                    onChange={(e) => setNewConversion({ ...newConversion, currency: e.target.value })}
                    className="input-field"
                    placeholder="Currency (USD, IDR)"
                  />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={handleAddConversion} className="btn-primary">
                    Save Conversion
                  </button>
                  <button type="button" onClick={() => setShowConversionForm(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {customConversions.map((conversion) => (
                <div key={conversion.id} className="flex items-center justify-between p-3 bg-surface-high rounded-lg">
                  <div>
                    <p className="text-body-md font-medium text-on-surface">{conversion.name}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {conversion.event_type} • {conversion.currency} {conversion.conversion_value}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => conversion.id && handleDeleteConversion(conversion.id)}
                    className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tracking URL Generator (only for edit mode) */}
        {isEdit && (
          <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
            <TrackingUrlGenerator campaign={formData} />
          </div>
        )}

        {/* Form Actions */}
        <div className="flex gap-4">
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/admin/pixel-campaigns')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminPixelCampaignFormPage;
