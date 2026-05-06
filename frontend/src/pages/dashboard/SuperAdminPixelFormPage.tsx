import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, X, UserPlus, Trash2, Loader2, AlertCircle, Check, GripVertical } from 'lucide-react';

interface PixelFormData {
  pixel_id: string;
  name: string;
  business_manager_id: string;
  access_token: string;
  status: 'active' | 'inactive' | 'suspended';
  config: {
    domain_verification_status?: string;
    event_priorities?: string[];
  };
}

interface AssignedAdmin {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  permissions: Record<string, boolean>;
  assigned_at: string;
}

const DEFAULT_EVENT_TYPES = [
  'PageView',
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'Purchase',
  'Lead',
  'CompleteRegistration',
  'AddPaymentInfo'
];

const SuperAdminPixelFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState<PixelFormData>({
    pixel_id: '',
    name: '',
    business_manager_id: '',
    access_token: '',
    status: 'active',
    config: {
      event_priorities: [...DEFAULT_EVENT_TYPES]
    }
  });

  const [assignedAdmins, setAssignedAdmins] = useState<AssignedAdmin[]>([]);
  const [adminSearchEmail, setAdminSearchEmail] = useState('');
  const [searchedUser, setSearchedUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (isEdit && id) {
      fetchPixelData();
      fetchAssignedAdmins();
    }
    // Scroll to admins section if hash is present
    if (location.hash === '#admins') {
      setTimeout(() => {
        document.getElementById('admins-section')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [id, isEdit]);

  const fetchPixelData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pixels/${id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch pixel');
      const result = await response.json();
      const pixel = result.data;
      setFormData({
        pixel_id: pixel.pixel_id,
        name: pixel.name,
        business_manager_id: pixel.business_manager_id,
        access_token: '', // Don't populate for security
        status: pixel.status,
        config: pixel.config ? JSON.parse(pixel.config) : { event_priorities: [...DEFAULT_EVENT_TYPES] }
      });
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch pixel:', err);
      setError(err.message || 'Failed to load pixel data');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedAdmins = async () => {
    try {
      const response = await fetch(`/api/pixels/${id}/admins`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch admins');
      const result = await response.json();
      setAssignedAdmins(result.data);
    } catch (err: any) {
      console.error('Failed to fetch assigned admins:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: any = {
        name: formData.name,
        business_manager_id: formData.business_manager_id,
        status: formData.status,
        config: JSON.stringify(formData.config)
      };

      if (!isEdit) {
        payload.pixel_id = formData.pixel_id;
      }

      if (formData.access_token) {
        payload.access_token = formData.access_token;
      }

      if (isEdit) {
        const response = await fetch(`/api/pixels/${id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to update pixel');
        setSuccess('Pixel updated successfully');
      } else {
        const response = await fetch('/api/pixels', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Failed to create pixel');
        setSuccess('Pixel created successfully');
        setTimeout(() => navigate('/dashboard/super-admin/pixels'), 1500);
      }
    } catch (err: any) {
      console.error('Failed to save pixel:', err);
      setError(err.response?.data?.message || 'Failed to save pixel');
    } finally {
      setSaving(false);
    }
  };

  const searchUserByEmail = async () => {
    if (!adminSearchEmail.trim()) return;

    try {
      const response = await fetch(`/api/admin/users?email=${encodeURIComponent(adminSearchEmail)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to search user');
      const result = await response.json();
      const users = result.data;
      const user = users.find((u: any) => u.email === adminSearchEmail && u.role === 'admin');
      
      if (user) {
        setSearchedUser(user);
        setError(null);
      } else {
        setSearchedUser(null);
        setError('No admin user found with that email');
      }
    } catch (err: any) {
      console.error('Failed to search user:', err);
      setError(err.message || 'Failed to search user');
      setSearchedUser(null);
    }
  };

  const assignAdmin = async () => {
    if (!searchedUser || !id) return;

    try {
      const response = await fetch(`/api/pixels/${id}/admins`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: searchedUser.id,
          permissions: { can_create_campaigns: true, can_view_analytics: true }
        }),
      });
      if (!response.ok) throw new Error('Failed to assign admin');
      setSuccess('Admin assigned successfully');
      setAdminSearchEmail('');
      setSearchedUser(null);
      await fetchAssignedAdmins();
    } catch (err: any) {
      console.error('Failed to assign admin:', err);
      setError(err.message || 'Failed to assign admin');
    }
  };

  const revokeAdmin = async (userId: string) => {
    if (!id || !confirm('Are you sure you want to revoke this admin\'s access?')) return;

    try {
      const response = await fetch(`/api/pixels/${id}/admins/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to revoke admin');
      setSuccess('Admin access revoked');
      await fetchAssignedAdmins();
    } catch (err: any) {
      console.error('Failed to revoke admin:', err);
      setError(err.message || 'Failed to revoke admin access');
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newPriorities = [...(formData.config.event_priorities || [])];
    const draggedItem = newPriorities[draggedIndex];
    newPriorities.splice(draggedIndex, 1);
    newPriorities.splice(index, 0, draggedItem);

    setFormData({
      ...formData,
      config: { ...formData.config, event_priorities: newPriorities }
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/super-admin/pixels')}
          className="p-2 rounded-lg hover:bg-surface-high transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-title-lg font-bold text-on-surface mb-2">
            {isEdit ? 'Edit Pixel' : 'Create New Pixel'}
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Configure Meta Pixel settings and assign admins
          </p>
        </div>
      </div>

      {error && (
        <div className="glass-card p-4 rounded-xl border border-error/20 bg-error/5 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <p className="text-error">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="glass-card p-4 rounded-xl border border-green-500/20 bg-green-500/5 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-600">{success}</p>
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Pixel ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter Meta Pixel ID"
                value={formData.pixel_id}
                onChange={(e) => setFormData({ ...formData, pixel_id: e.target.value })}
                disabled={isEdit}
                required
              />
              <p className="text-label-sm text-on-surface-variant mt-1">
                The unique Pixel ID from Meta Business Manager
              </p>
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Pixel Name <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter pixel name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Business Manager ID <span className="text-error">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter Business Manager ID"
                value={formData.business_manager_id}
                onChange={(e) => setFormData({ ...formData, business_manager_id: e.target.value })}
                required
              />
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Access Token {!isEdit && <span className="text-error">*</span>}
              </label>
              <input
                type="password"
                className="input-field"
                placeholder={isEdit ? 'Leave blank to keep current token' : 'Enter Meta API access token'}
                value={formData.access_token}
                onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                required={!isEdit}
              />
              <p className="text-label-sm text-on-surface-variant mt-1">
                {isEdit ? 'Only enter a new token if you want to update it' : 'This will be encrypted before storage'}
              </p>
            </div>

            <div>
              <label className="block text-label-md font-bold text-on-surface mb-2">
                Status
              </label>
              <select
                className="input-field"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
        </div>

        {/* Domain Verification */}
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">Domain Verification</h2>
          <div className="bg-surface-container-high p-4 rounded-lg">
            <h3 className="font-semibold text-on-surface mb-2">Instructions:</h3>
            <ol className="list-decimal list-inside space-y-2 text-body-sm text-on-surface-variant">
              <li>Go to Meta Business Manager → Business Settings → Brand Safety → Domains</li>
              <li>Add your domain and verify ownership using one of the provided methods</li>
              <li>Once verified, events from your domain will be accepted by Meta</li>
              <li>Domain verification is required for iOS 14.5+ tracking</li>
            </ol>
          </div>
        </div>

        {/* Event Priorities */}
        <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">Event Priority Configuration</h2>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Drag to reorder events by priority for Aggregated Event Measurement (AEM). Only the top 8 events will be tracked for iOS 14.5+ users.
          </p>
          <div className="space-y-2">
            {(formData.config.event_priorities || []).slice(0, 8).map((event, index) => (
              <div
                key={event}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 p-3 rounded-lg border border-outline-variant/20 bg-surface-container cursor-move hover:bg-surface-container-high transition-colors ${
                  draggedIndex === index ? 'opacity-50' : ''
                }`}
              >
                <GripVertical className="w-5 h-5 text-on-surface-variant" />
                <span className="font-semibold text-on-surface-variant mr-2">{index + 1}</span>
                <span className="text-on-surface">{event}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                {isEdit ? 'Update Pixel' : 'Create Pixel'}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/dashboard/super-admin/pixels')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Assigned Admins Section - Only show in edit mode */}
      {isEdit && (
        <div id="admins-section" className="glass-card p-6 rounded-xl border border-outline-variant/20">
          <h2 className="text-title-md font-bold text-on-surface mb-4">Assigned Admins</h2>
          
          {/* Search and Assign */}
          <div className="mb-6 p-4 bg-surface-container-high rounded-lg">
            <h3 className="font-semibold text-on-surface mb-3">Assign New Admin</h3>
            <div className="flex gap-2">
              <input
                type="email"
                className="input-field flex-1"
                placeholder="Enter admin email address"
                value={adminSearchEmail}
                onChange={(e) => setAdminSearchEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), searchUserByEmail())}
              />
              <button
                type="button"
                onClick={searchUserByEmail}
                className="btn-secondary"
              >
                Search
              </button>
            </div>
            {searchedUser && (
              <div className="mt-3 p-3 bg-surface-container rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-semibold text-on-surface">{searchedUser.name}</p>
                  <p className="text-body-sm text-on-surface-variant">{searchedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={assignAdmin}
                  className="btn-primary flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Assign
                </button>
              </div>
            )}
          </div>

          {/* Assigned Admins List */}
          {assignedAdmins.length === 0 ? (
            <p className="text-on-surface-variant text-center py-8">No admins assigned yet</p>
          ) : (
            <div className="space-y-2">
              {assignedAdmins.map((admin) => (
                <div
                  key={admin.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-outline-variant/20 bg-surface-container"
                >
                  <div>
                    <p className="font-semibold text-on-surface">{admin.user_name}</p>
                    <p className="text-body-sm text-on-surface-variant">{admin.user_email}</p>
                    <p className="text-label-xs text-on-surface-variant mt-1">
                      Assigned: {new Date(admin.assigned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeAdmin(admin.user_id)}
                    className="p-2 rounded-lg hover:bg-error/10 text-error transition-colors"
                    title="Revoke Access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export default SuperAdminPixelFormPage;
