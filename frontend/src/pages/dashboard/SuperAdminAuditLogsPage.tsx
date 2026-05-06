import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string;
  old_value: string | null;
  new_value: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string;
  created_at: string;
}

const SuperAdminAuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionType) params.append('action_type', actionType);
      if (resourceType) params.append('resource_type', resourceType);
      if (userSearch) params.append('user_id', userSearch);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);

      const response = await fetch(
        `/api/pixel-analytics/audit-logs?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setLogs(result.data.logs);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setActionType('');
    setResourceType('');
    setUserSearch('');
    setStartDate('');
    setEndDate('');
  };

  const toggleLogExpansion = (logId: string) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  const renderValueDiff = (oldValue: string | null, newValue: string | null) => {
    if (!oldValue && !newValue) return null;
    
    try {
      const oldObj = oldValue ? JSON.parse(oldValue) : {};
      const newObj = newValue ? JSON.parse(newValue) : {};
      
      return (
        <div className="mt-2 space-y-2">
          {oldValue && (
            <div>
              <p className="text-label-xs font-medium text-on-surface-variant mb-1">Old Value:</p>
              <pre className="text-xs bg-surface-high p-2 rounded overflow-x-auto">
                {JSON.stringify(oldObj, null, 2)}
              </pre>
            </div>
          )}
          {newValue && (
            <div>
              <p className="text-label-xs font-medium text-on-surface-variant mb-1">New Value:</p>
              <pre className="text-xs bg-surface-high p-2 rounded overflow-x-auto">
                {JSON.stringify(newObj, null, 2)}
              </pre>
            </div>
          )}
        </div>
      );
    } catch {
      return (
        <div className="mt-2 space-y-2">
          {oldValue && <p className="text-xs text-on-surface-variant">Old: {oldValue}</p>}
          {newValue && <p className="text-xs text-on-surface-variant">New: {newValue}</p>}
        </div>
      );
    }
  };

  const actionTypes = [
    'pixel.created',
    'pixel.updated',
    'pixel.deleted',
    'admin.assigned',
    'admin.revoked',
    'campaign.created',
    'campaign.updated',
    'campaign.deleted',
    'custom_conversion.created',
    'custom_conversion.updated',
    'custom_conversion.deleted',
  ];

  const resourceTypes = ['pixel', 'campaign', 'custom_conversion', 'admin_assignment'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title-lg font-bold text-on-surface mb-2">Audit Logs</h1>
        <p className="text-body-md text-on-surface-variant">
          Track all system actions and changes for compliance
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-on-surface-variant" />
          <h2 className="text-title-sm font-bold text-on-surface">Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              Action Type
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="input-field"
            >
              <option value="">All Actions</option>
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              Resource Type
            </label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="input-field"
            >
              <option value="">All Resources</option>
              {resourceTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              User ID
            </label>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by user ID"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-label-sm font-medium text-on-surface mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={handleApplyFilters} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" />
            Apply Filters
          </button>
          <button onClick={handleClearFilters} className="btn-secondary">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="glass-card p-6 rounded-xl border border-outline-variant/20">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-on-surface-variant">Loading audit logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-on-surface-variant">
            <div className="text-center">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No audit logs found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Timestamp</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">User</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Action</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Resource Type</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Resource ID</th>
                  <th className="text-left py-3 px-4 text-label-sm font-medium text-on-surface-variant">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr 
                      className="border-b border-outline-variant/10 hover:bg-surface-high/50 cursor-pointer"
                      onClick={() => toggleLogExpansion(log.id)}
                    >
                      <td className="py-3 px-4 text-body-sm text-on-surface">
                        {format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss')}
                      </td>
                      <td className="py-3 px-4 text-body-sm text-on-surface">
                        {log.user_id ? log.user_id.substring(0, 8) : 'System'}
                      </td>
                      <td className="py-3 px-4 text-body-sm text-on-surface">
                        <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                          {log.action_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-body-sm text-on-surface">{log.resource_type}</td>
                      <td className="py-3 px-4 text-body-sm text-on-surface font-mono text-xs">
                        {log.resource_id.substring(0, 12)}...
                      </td>
                      <td className="py-3 px-4 text-body-sm text-on-surface">
                        <button className="text-primary hover:underline text-xs">
                          {expandedLog === log.id ? 'Hide' : 'Show'} Details
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-surface-high/30">
                        <td colSpan={6} className="py-4 px-4">
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-label-xs font-medium text-on-surface-variant">IP Address</p>
                                <p className="text-body-sm text-on-surface">{log.ip_address || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-label-xs font-medium text-on-surface-variant">User Agent</p>
                                <p className="text-body-sm text-on-surface truncate">{log.user_agent || 'N/A'}</p>
                              </div>
                            </div>
                            {renderValueDiff(log.old_value, log.new_value)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            <div className="mt-4 text-center text-label-sm text-on-surface-variant">
              Showing {logs.length} log entries (max 1000)
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperAdminAuditLogsPage;
