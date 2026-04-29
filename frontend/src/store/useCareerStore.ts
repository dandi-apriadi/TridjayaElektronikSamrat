import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

export interface JobApplication {
  id: string;
  jobId: string;
  jobTitle: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  education: string;
  major: string;
  experience: string;
  coverLetter: string;
  linkedIn?: string;
  portfolioUrl?: string;
  status: 'pending' | 'reviewed' | 'interview' | 'accepted' | 'rejected';
  appliedAt: string;
}

export interface JobListing {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'fulltime' | 'parttime' | 'contract' | 'internship';
  level: 'Junior' | 'Mid' | 'Senior' | 'Manager';
  description: string;
  requirements: string[];
  benefits: string[];
  isActive: boolean;
  deadline?: string;
  createdAt?: string;
  applicantsCount?: number;
}

interface CareerStore {
  jobs: JobListing[];
  applications: JobApplication[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  // Public
  fetchJobs: () => Promise<void>;
  submitApplication: (data: Omit<JobApplication, 'id' | 'status' | 'appliedAt'>) => Promise<boolean>;
  // Admin
  fetchApplications: () => Promise<void>;
  createJob: (data: Omit<JobListing, 'id' | 'createdAt' | 'applicantsCount'>) => Promise<boolean>;
  updateJob: (id: string, data: Partial<JobListing>) => Promise<boolean>;
  deleteJob: (id: string) => Promise<boolean>;
  updateApplicationStatus: (id: string, status: JobApplication['status']) => Promise<boolean>;
}

export const useCareerStore = create<CareerStore>((set) => ({
  jobs: [],
  applications: [],
  isLoading: false,
  isSubmitting: false,
  error: null,

  fetchJobs: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/jobs');
      if (!res.ok) throw new Error('Gagal mengambil lowongan');
      const data = await res.json();
      set({ jobs: data.data.items || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  submitApplication: async (data) => {
    set({ isSubmitting: true, error: null });
    try {
      const res = await apiFetch('/api/job-applications', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Gagal mengirim lamaran');
      set({ isSubmitting: false });
      return true;
    } catch (error: any) {
      set({ error: error.message, isSubmitting: false });
      return false;
    }
  },

  fetchApplications: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiFetch('/api/job-applications');
      if (!res.ok) throw new Error('Gagal mengambil data pelamar');
      const data = await res.json();
      set({ applications: data.data.items || [], isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  createJob: async (data) => {
    try {
      const res = await apiFetch('/api/jobs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Gagal membuat lowongan');
      await useCareerStore.getState().fetchJobs();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  updateJob: async (id, data) => {
    try {
      const res = await apiFetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Gagal memperbarui lowongan');
      await useCareerStore.getState().fetchJobs();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  deleteJob: async (id) => {
    try {
      const res = await apiFetch(`/api/jobs/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Gagal menghapus lowongan');
      await useCareerStore.getState().fetchJobs();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },

  updateApplicationStatus: async (id, status) => {
    try {
      const res = await apiFetch(`/api/job-applications/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Gagal memperbarui status pelamar');
      await useCareerStore.getState().fetchApplications();
      return true;
    } catch (error: any) {
      set({ error: error.message });
      return false;
    }
  },
}));
