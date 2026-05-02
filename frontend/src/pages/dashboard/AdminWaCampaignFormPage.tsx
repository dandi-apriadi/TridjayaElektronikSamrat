import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Save, Upload, Plus, Trash2,
  FileUp, AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/useNotificationStore';

const cv = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const iv = { hidden: { y: 12, opacity: 0 }, visible: { y: 0, opacity: 1 } };

interface ManualRecipient {
  id: string;
  phone: string;
  variables: Record<string, string>;
}

const AdminWaCampaignFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { accessToken } = useAuthStore();
  const [campaignName, setCampaignName] = useState('');
  const [config, setConfig] = useState('{}');
  const [manualRecipients, setManualRecipients] = useState<ManualRecipient[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [configError, setConfigError] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newVars, setNewVars] = useState('{}');
  const [showNewVars, setShowNewVars] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    if (!id || id === 'new') return;
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/status`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch campaign');
      const data = await res.json();
      const c = data.data?.campaign;
      if (c) {
        setCampaignName(c.name);
        setConfig(JSON.stringify(c.config || {}, null, 2));
      }
    } catch (error) {
      toast.error('Gagal memuat campaign', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const validateConfig = () => {
    try {
      JSON.parse(config);
      setConfigError('');
      return true;
    } catch (e) {
      setConfigError(`Invalid JSON: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return false;
    }
  };

  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Validation error', 'Campaign name is required');
      return;
    }
    if (!validateConfig()) return;

    setIsSaving(true);
    try {
      const url = id && id !== 'new' ? `/api/wa/campaigns/${id}` : '/api/wa/campaigns';
      const method = id && id !== 'new' ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: campaignName,
          config: JSON.parse(config),
        }),
      });

      if (!res.ok) throw new Error('Failed to save campaign');
      const data = await res.json();
      const newId = data.data?.id;

      toast.success('Berhasil', 'Campaign tersimpan');
      if (!id || id === 'new') {
        navigate(`/dashboard/admin/wa/campaign/${newId}`);
      } else {
        fetchCampaign();
      }
    } catch (error) {
      toast.error('Gagal menyimpan campaign', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddManualRecipient = () => {
    if (!newPhone.trim()) {
      toast.error('Validation error', 'Phone number is required');
      return;
    }
    try {
      const vars = JSON.parse(newVars);
      setManualRecipients([
        ...manualRecipients,
        { id: `manual-${Date.now()}`, phone: newPhone, variables: vars },
      ]);
      setNewPhone('');
      setNewVars('{}');
    } catch (e) {
      toast.error('Invalid JSON', 'Variables must be valid JSON');
    }
  };

  const handleUploadRecipients = async (file: File) => {
    if (!id || id === 'new') {
      toast.error('Save campaign first', 'Please save the campaign before uploading recipients');
      return;
    }
    if (!['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.type)) {
      toast.error('Invalid file type', 'Please upload an Excel file');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/wa/campaigns/${id}/recipients`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to upload recipients');
      const data = await res.json();
      toast.success('Berhasil', `${data.data?.addedCount} recipients added`);
      fetchCampaign();
    } catch (error) {
      toast.error('Gagal upload recipients', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUploadManualRecipients = async () => {
    if (!id || id === 'new') {
      toast.error('Save campaign first', 'Please save the campaign before uploading recipients');
      return;
    }
    if (manualRecipients.length === 0) {
      toast.error('No recipients', 'Please add at least one recipient');
      return;
    }

    setIsUploading(true);
    try {
      const res = await fetch(`/api/wa/campaigns/${id}/recipients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: manualRecipients.map(r => ({
            phone: r.phone,
            variables: r.variables,
          })),
        }),
      });

      if (!res.ok) throw new Error('Failed to upload recipients');
      const data = await res.json();
      toast.success('Berhasil', `${data.data?.addedCount} recipients added`);
      setManualRecipients([]);
      fetchCampaign();
    } catch (error) {
      toast.error('Gagal upload recipients', error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/admin/wa/campaigns')}
          className="p-2 hover:bg-surface-high rounded-xl transition-all text-on-surface-variant hover:text-on-surface border border-outline-variant/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-display font-bold text-on-surface">
          {id && id !== 'new' ? 'Edit Campaign' : 'Create Campaign'}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-6">
            <h2 className="text-lg font-display font-bold text-on-surface mb-6">Campaign Details</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g., Promo Flash Sale"
                  className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                  Configuration (JSON)
                </label>
                <textarea
                  value={config}
                  onChange={e => {
                    setConfig(e.target.value);
                    if (configError) setConfigError('');
                  }}
                  onBlur={validateConfig}
                  rows={8}
                  className={`w-full px-4 py-3 bg-surface-high/30 border rounded-xl font-mono text-sm focus:outline-none focus:ring-2 transition-all text-on-surface ${configError ? 'border-red-500 focus:ring-red-500/20' : 'border-outline-variant/30 focus:ring-primary/20 focus:bg-surface-high'}`}
                />
                {configError && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-red-400 font-bold ml-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{configError}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveCampaign}
                  disabled={isSaving}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 gradient-primary text-surface rounded-2xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold"
                >
                  <Save className="w-5 h-5" />
                  <span>Save Campaign</span>
                </button>
              </div>
            </div>
          </motion.div>

          {id && id !== 'new' && (
            <>
              <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-6">
                <h2 className="text-lg font-display font-bold text-on-surface mb-2">Upload Recipients (Excel)</h2>
                <p className="text-sm font-body text-on-surface-variant mb-6">
                  Upload an Excel file with columns: <span className="text-primary font-bold">Phone</span> (required) and any variable columns.
                </p>
                <div
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) handleUploadRecipients(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-outline-variant/30 rounded-2xl p-10 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <FileUp className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-4 group-hover:text-primary transition-colors" />
                  <p className="text-sm text-on-surface-variant mb-2">Drag and drop Excel file here or</p>
                  <label className="inline-block">
                    <span className="text-primary font-bold hover:shadow-neon-cyan transition-all px-6 py-2 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer">click to select</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.xlsm"
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleUploadRecipients(e.target.files[0]);
                      }}
                      disabled={isUploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </motion.div>

              <motion.div variants={iv} className="glass-card rounded-2xl border border-outline-variant/10 p-6">
                <h2 className="text-lg font-display font-bold text-on-surface mb-6">Add Manual Recipients</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="628123456789"
                      className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40"
                    />
                  </div>

                  <div>
                    <label className="flex items-center justify-between text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2 ml-1">
                      <span>Variables (JSON)</span>
                      <button
                        onClick={() => setShowNewVars(!showNewVars)}
                        className="text-[10px] text-primary hover:text-primary-dim font-bold"
                      >
                        {showNewVars ? 'HIDE EDITOR' : 'SHOW EDITOR'}
                      </button>
                    </label>
                    {showNewVars && (
                      <textarea
                        value={newVars}
                        onChange={e => setNewVars(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface placeholder:text-on-surface-variant/40 mb-3"
                      />
                    )}
                    <input
                      type="text"
                      value={newVars}
                      onChange={e => setNewVars(e.target.value)}
                      onFocus={() => !showNewVars && setShowNewVars(true)}
                      placeholder="{}"
                      className={`w-full px-4 py-3 bg-surface-high/30 border border-outline-variant/30 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface-high transition-all text-on-surface ${showNewVars ? 'hidden' : ''}`}
                    />
                  </div>

                  <button
                    onClick={handleAddManualRecipient}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-high/50 border border-outline-variant/30 rounded-xl hover:bg-surface-high text-on-surface-variant hover:text-on-surface transition-all font-bold"
                  >
                    <Plus className="w-5 h-5" />
                    <span>Add Recipient</span>
                  </button>

                  {manualRecipients.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 ml-1">
                        Pending Recipients ({manualRecipients.length})
                      </h3>
                      <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                        {manualRecipients.map((r) => (
                          <div key={r.id} className="flex items-center justify-between p-3 bg-surface-high/30 border border-outline-variant/10 rounded-xl">
                            <div>
                              <p className="text-sm font-mono text-on-surface">{r.phone}</p>
                              <p className="text-[10px] text-on-surface-variant mt-1 font-body">{Object.keys(r.variables).join(', ')}</p>
                            </div>
                            <button
                              onClick={() =>
                                setManualRecipients(
                                  manualRecipients.filter(x => x.id !== r.id)
                                )
                              }
                              className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleUploadManualRecipients}
                        disabled={isUploading}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 gradient-primary text-surface rounded-xl hover:shadow-neon-cyan disabled:opacity-50 transition-all font-bold"
                      >
                        <Upload className="w-5 h-5" />
                        <span>Upload {manualRecipients.length} Recipients</span>
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </div>

        <div className="lg:col-span-1">
          <motion.div variants={iv} className="glass-card rounded-2xl border border-primary/20 bg-primary/5 p-6 shadow-neon-cyan/5">
            <h3 className="text-sm font-display font-bold text-primary mb-4 uppercase tracking-widest">Configuration Guide</h3>
            <div className="text-xs font-body text-on-surface-variant space-y-4">
              <p>
                <strong className="text-on-surface">dedupe_days:</strong> Number of days to check for duplicates
              </p>
              <p>
                <strong className="text-on-surface">message_template:</strong> WhatsApp message with {'{variables}'} placeholders
              </p>
              <p>
                <strong className="text-on-surface">accounts:</strong> List of WA account IDs to use for sending
              </p>
              <details className="mt-4 group">
                <summary className="cursor-pointer font-bold text-primary hover:text-primary-dim transition-colors flex items-center gap-2">
                  <span>Example Config</span>
                </summary>
                <pre className="text-[10px] bg-surface-high/50 rounded-xl p-4 mt-3 overflow-x-auto border border-outline-variant/10 text-primary-dim font-mono leading-relaxed">
{`{
  "dedupe_days": 30,
  "message_template": "Hi {{name}}, your code is {{code}}",
  "accounts": ["acc1", "acc2"]
}`}
                </pre>
              </details>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminWaCampaignFormPage;
