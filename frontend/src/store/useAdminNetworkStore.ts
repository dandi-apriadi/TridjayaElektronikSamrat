import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

export interface AgentRegistration {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  province: string;
  city: string;
  address?: string;
  preferredProducts: string[];
  profilePhoto?: string;
  ktpPhoto?: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface AdminClaim {
  id: string;
  agentId: string;
  agentName?: string;
  tierId: string;
  rewardName: string;
  rewardValue?: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  submittedAt: string;
}

export interface TelemetryStats {
  trafficData: any[];
  monthlyPageViews: any[];
  sourceRows: any[];
  topContentRows: any[];
  systemMetrics: any[];
  errorLogs: any[];
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  city?: string;
  province?: string;
  totalSales: number;
  points: number;
  tierName?: string;
  isActive: boolean;
  joinedAt: string;
}

export interface DailyPerformance {
  day: string;
  date: string;
  activity: number;
  leads: number;
}

interface AdminNetworkState {
  registrations: AgentRegistration[];
  claims: AdminClaim[];
  agents: Agent[];
  leads: any[];
  agentPerformance: DailyPerformance[];
  isLoading: boolean;
  error: string | null;

  fetchRegistrations: () => Promise<void>;
  updateRegistrationStatus: (id: string, status: AgentRegistration['status']) => Promise<boolean>;

  fetchClaims: () => Promise<void>;
  updateClaimStatus: (id: string, status: AdminClaim['status']) => Promise<boolean>;

  fetchAgents: () => Promise<void>;
  fetchAgentPerformance: (id: string) => Promise<void>;

  fetchLeads: () => Promise<void>;
  updateLeadStatus: (id: string, status: string) => Promise<boolean>;

  telemetryStats: TelemetryStats | null;
  fetchTelemetryStats: () => Promise<void>;
}

export const useAdminNetworkStore = create<AdminNetworkState>((set) => ({
  registrations: [],
  claims: [],
  agents: [],
  leads: [],
  agentPerformance: [],
  telemetryStats: null,
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/leads');
      if (!res.ok) throw new Error('Failed to fetch admin leads');
      const data = await res.json();
      set({ leads: data.data.items || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateLeadStatus: async (id, status) => {
    try {
      const res = await apiFetch(`/api/admin/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update lead status');
      await useAdminNetworkStore.getState().fetchLeads();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  fetchRegistrations: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/agent-registrations');

      if (!res.ok) throw new Error('Failed to fetch agent registrations');
      const data = await res.json();
      set({ registrations: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateRegistrationStatus: async (id, status) => {
    try {
      const res = await apiFetch(`/api/admin/agent-registrations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update status');
      await useAdminNetworkStore.getState().fetchRegistrations();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  fetchClaims: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/claims');

      if (!res.ok) throw new Error('Failed to fetch claims');
      const data = await res.json();
      set({ claims: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateClaimStatus: async (id, status) => {
    try {
      const res = await apiFetch(`/api/admin/claims/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update claim');
      await useAdminNetworkStore.getState().fetchClaims();
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      set({ agents: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
  
  fetchAgentPerformance: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch(`/api/admin/agents/${id}/performance`);
      if (!res.ok) throw new Error('Failed to fetch agent performance');
      const data = await res.json();
      set({ agentPerformance: data.data.items || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchTelemetryStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/telemetry-stats');
      if (!res.ok) throw new Error('Failed to fetch telemetry stats');
      const payload = await res.json();
      set({ telemetryStats: payload.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
