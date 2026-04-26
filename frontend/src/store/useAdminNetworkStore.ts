import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { API_BASE_URL, apiFetch } from '../utils/apiClient';

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

export interface AdminSupportTicket {
  id: string;
  agentId: string;
  agentName?: string;
  agentEmail?: string;
  subject: string;
  message?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt?: string;
  updatedAt?: string;
}

interface AdminNetworkState {
  registrations: AgentRegistration[];
  claims: AdminClaim[];
  agents: Agent[];
  supportTickets: AdminSupportTicket[];
  leads: any[];
  isLoading: boolean;
  error: string | null;

  fetchRegistrations: () => Promise<void>;
  updateRegistrationStatus: (id: string, status: AgentRegistration['status']) => Promise<boolean>;

  fetchClaims: () => Promise<void>;
  updateClaimStatus: (id: string, status: AdminClaim['status']) => Promise<boolean>;

  fetchAgents: () => Promise<void>;

  fetchLeads: () => Promise<void>;
  updateLeadStatus: (id: string, status: string) => Promise<boolean>;

  fetchSupportTickets: () => Promise<void>;
  updateSupportTicketStatus: (id: string, status: AdminSupportTicket['status']) => Promise<boolean>;

  telemetryStats: TelemetryStats | null;
  fetchTelemetryStats: () => Promise<void>;
}

const API_ROOT = API_BASE_URL.replace(/\/$/, '');
const API_ADMIN_URL = `${API_ROOT}/api/admin`;

export const useAdminNetworkStore = create<AdminNetworkState>((set) => ({
  registrations: [],
  claims: [],
  agents: [],
  supportTickets: [],
  leads: [],
  telemetryStats: null,
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch admin leads');
      const data = await res.json();
      set({ leads: data.data.items || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateLeadStatus: async (id, status) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      set({ registrations: [], isLoading: false, error: 'Sesi login tidak valid. Silakan login ulang.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/agent-registrations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch agent registrations');
      const data = await res.json();
      set({ registrations: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateRegistrationStatus: async (id, status) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/agent-registrations/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      set({ claims: [], isLoading: false, error: 'Sesi login tidak valid. Silakan login ulang.' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/admin/claims', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Failed to fetch claims');
      const data = await res.json();
      set({ claims: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateClaimStatus: async (id, status) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/claims/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
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
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ROOT}/api/admin/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      set({ agents: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchSupportTickets: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/support-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch support tickets');
      const payload = await res.json();
      set({ supportTickets: payload.data.items ?? [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateSupportTicketStatus: async (id, status) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/support-tickets/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update support ticket status');
      await useAdminNetworkStore.getState().fetchSupportTickets();
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  fetchTelemetryStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ADMIN_URL}/telemetry-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch telemetry stats');
      const payload = await res.json();
      set({ telemetryStats: payload.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
