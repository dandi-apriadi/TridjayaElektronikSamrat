import { create } from 'zustand';
import { useAuthStore } from './authStore';

export interface Lead {
  id: string;
  agentId: string;
  customerName: string;
  phoneNumber: string;
  interestedProduct: string;
  status: 'Follow Up' | 'Negosiasi' | 'Closed Won' | 'Closed Lost';
  notes?: string;
  createdAt: string;
}

export interface RewardClaim {
  id: string;
  agentId: string;
  tierId: string;
  rewardName: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  submittedAt: string;
}

export interface AgentStats {
  points: number;
  salesCount: number;
  currentTier: string;
}

interface AgentState {
  leads: Lead[];
  claims: RewardClaim[];
  stats: AgentStats | null;
  isLoading: boolean;
  error: string | null;

  fetchLeads: () => Promise<void>;
  createLead: (data: Partial<Lead>) => Promise<boolean>;
  updateLeadStatus: (id: string, status: Lead['status']) => Promise<boolean>;
  
  fetchStats: () => Promise<void>;
  
  fetchClaims: () => Promise<void>;
  createClaim: (tierId: string, rewardName: string) => Promise<boolean>;
}

const API_ROOT = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:8081';
const API_BASE_URL = `${API_ROOT}/api`;

export const useAgentStore = create<AgentState>((set) => ({
  leads: [],
  claims: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/leads`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch leads');
      const data = await res.json();
      set({ leads: data.data.items, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createLead: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create lead');
      await useAgentStore.getState().fetchLeads();
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  },

  updateLeadStatus: async (id, status) => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/leads/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error('Failed to update lead');
      await useAgentStore.getState().fetchLeads();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  fetchStats: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/agent/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      set({ stats: data.data });
    } catch (error: any) {
      console.error(error);
    }
  },

  fetchClaims: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/agent/claims`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        set({ claims: data.data.items });
      }
    } catch (error) {
      console.error(error);
    }
  },

  createClaim: async (tierId, rewardName) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_BASE_URL}/agent/claims`, {
        method: 'POST',
        headers: {
           'Content-Type': 'application/json',
           Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tierId, rewardName })
      });
      if (!res.ok) throw new Error('Failed to claim reward');
      await useAgentStore.getState().fetchClaims();
      return true;
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      return false;
    }
  }
}));
