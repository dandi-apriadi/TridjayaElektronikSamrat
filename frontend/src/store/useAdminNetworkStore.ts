import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface AgentRegistration {
  id: string;
  fullName: string;
  email: string;
  whatsapp: string;
  province: string;
  city: string;
  address?: string;
  preferredProducts: string[];
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  submittedAt: string;
}

export interface AdminClaim {
  id: string;
  agentId: string;
  agentName?: string;
  tierId: string;
  rewardName: string;
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

interface AdminNetworkState {
  registrations: AgentRegistration[];
  claims: AdminClaim[];
  isLoading: boolean;
  error: string | null;

  fetchRegistrations: () => Promise<void>;
  updateRegistrationStatus: (id: string, status: AgentRegistration['status']) => Promise<boolean>;

  fetchClaims: () => Promise<void>;
  updateClaimStatus: (id: string, status: AdminClaim['status']) => Promise<boolean>;

  telemetryStats: TelemetryStats | null;
  fetchTelemetryStats: () => Promise<void>;
}

const API_BASE_URL = 'http://localhost:8081/api/admin';

export const useAdminNetworkStore = create<AdminNetworkState>((set) => ({
  registrations: [],
  claims: [],
  telemetryStats: null,
  isLoading: false,
  error: null,

  fetchRegistrations: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/agent-registrations`, {
        headers: { Authorization: `Bearer ${token}` }
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
      const res = await fetch(`${API_BASE_URL}/agent-registrations/${id}/status`, {
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
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/claims`, {
        headers: { Authorization: `Bearer ${token}` }
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
      const res = await fetch(`${API_BASE_URL}/claims/${id}/status`, {
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
      set({ error: error.message });
      return false;
    }
  },

  fetchTelemetryStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/telemetry-stats`, {
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
