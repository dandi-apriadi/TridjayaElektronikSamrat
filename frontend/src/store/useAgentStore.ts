import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { API_BASE_URL } from '../utils/apiClient';

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
  rewardValue?: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  submittedAt: string;
}

export interface AgentStats {
  points: number;
  salesCount: number;
  currentTier: string;
}

export interface RewardTier {
  id: string;
  name: string;
  thresholdPoints: number;
  rewardValue: number;
  isActive: boolean;
}

export interface LeaderboardAgent {
  id: string;
  name: string;
  city: string;
  province?: string;
  points: number;
  totalSales: number;
  tierName?: string;
  isActive: boolean;
  joinedAt?: string;
}

export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  createdAt?: string;
}

interface AgentState {
  leads: Lead[];
  claims: RewardClaim[];
  stats: AgentStats | null;
  rewardTiers: RewardTier[];
  leaderboard: LeaderboardAgent[];
  supportTickets: SupportTicket[];
  isLoading: boolean;
  error: string | null;

  fetchLeads: () => Promise<void>;
  createLead: (data: Partial<Lead>) => Promise<boolean>;
  updateLeadStatus: (id: string, status: Lead['status']) => Promise<boolean>;
  
  fetchStats: () => Promise<void>;

  fetchRewardTiers: () => Promise<void>;

  fetchLeaderboard: () => Promise<void>;

  fetchSupportTickets: () => Promise<void>;
  createSupportTicket: (subject: string, message: string, priority?: SupportTicket['priority']) => Promise<boolean>;
  
  fetchClaims: () => Promise<void>;
  createClaim: (tierId: string, rewardName: string) => Promise<boolean>;
}

const API_ENDPOINT = `${API_BASE_URL}/api`;

export const useAgentStore = create<AgentState>((set) => ({
  leads: [],
  claims: [],
  stats: null,
  rewardTiers: [],
  leaderboard: [],
  supportTickets: [],
  isLoading: false,
  error: null,

  fetchLeads: async () => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/leads`, {
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
      const res = await fetch(`${API_ENDPOINT}/leads`, {
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
      const res = await fetch(`${API_ENDPOINT}/leads/${id}/status`, {
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
      const res = await fetch(`${API_ENDPOINT}/agent/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      set({ stats: data.data });
    } catch (error: any) {
      console.error(error);
    }
  },

  fetchRewardTiers: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/reward-tiers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch reward tiers');
      const data = await res.json();
      set({ rewardTiers: data.data.items || [] });
    } catch (error) {
      console.error(error);
    }
  },

  fetchLeaderboard: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const data = await res.json();
      set({ leaderboard: data.data.items || [] });
    } catch (error) {
      console.error(error);
    }
  },

  fetchSupportTickets: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/agent/support-tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch support tickets');
      const data = await res.json();
      set({ supportTickets: data.data.items || [] });
    } catch (error: any) {
      set({ error: error.message ?? 'Failed to fetch support tickets' });
    }
  },

  createSupportTicket: async (subject: string, message: string, priority: SupportTicket['priority'] = 'medium') => {
    set({ isLoading: true, error: null });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/agent/support-tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subject, message, priority })
      });
      if (!res.ok) throw new Error('Failed to create support ticket');
      await useAgentStore.getState().fetchSupportTickets();
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: error.message ?? 'Failed to create support ticket', isLoading: false });
      return false;
    }
  },

  fetchClaims: async () => {
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/agent/claims`, {
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

  createClaim: async (tierId: string, rewardName: string) => {
    set({ isLoading: true });
    try {
      const token = useAuthStore.getState().accessToken;
      const res = await fetch(`${API_ENDPOINT}/agent/claims`, {
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
