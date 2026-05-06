import { create } from 'zustand';
import { apiFetch } from '../utils/apiClient';

export interface DashboardNotification {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  message?: string;
  actionPath?: string;
  entityId?: string;
  isRead: boolean;
  createdAt?: string;
  readAt?: string;
}

interface NotificationsApiPayload {
  success?: boolean;
  message?: string;
  data?: {
    items?: DashboardNotification[];
    unreadCount?: number;
    updated?: number;
  };
}

interface DashboardNotificationsState {
  items: DashboardNotification[];
  unreadCount: number;
  isLoading: boolean;
  isUpdating: boolean;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<number>;
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  clear: () => void;
}

export const useDashboardNotificationsStore = create<DashboardNotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  isLoading: false,
  isUpdating: false,

  fetchNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await apiFetch('/api/notifications');
      if (!response.ok) {
        throw new Error('Gagal memuat notifikasi');
      }

      const payload = (await response.json()) as NotificationsApiPayload;
      const items = payload.data?.items ?? [];
      const unreadCount = payload.data?.unreadCount ?? items.filter((item) => !item.isRead).length;

      set({ items, unreadCount, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const response = await apiFetch('/api/notifications/unread-count');
      // Silently ignore 401 — token expired or not logged in yet, not worth logging
      if (!response.ok) {
        return get().unreadCount;
      }

      const payload = (await response.json()) as NotificationsApiPayload;
      const unreadCount = payload.data?.unreadCount ?? 0;
      set({ unreadCount });
      return unreadCount;
    } catch {
      return get().unreadCount;
    }
  },

  markAsRead: async (id: string) => {
    set({ isUpdating: true });
    try {
      const response = await apiFetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Gagal menandai notifikasi');
      }

      const updatedItems = get().items.map((item) =>
        item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item,
      );
      const unreadCount = Math.max(0, updatedItems.filter((item) => !item.isRead).length);
      set({ items: updatedItems, unreadCount, isUpdating: false });
      return true;
    } catch {
      set({ isUpdating: false });
      return false;
    }
  },

  markAllAsRead: async () => {
    set({ isUpdating: true });
    try {
      const response = await apiFetch('/api/notifications/read-all', {
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Gagal menandai semua notifikasi');
      }

      const now = new Date().toISOString();
      const updatedItems = get().items.map((item) => ({ ...item, isRead: true, readAt: item.readAt ?? now }));
      set({ items: updatedItems, unreadCount: 0, isUpdating: false });
      return true;
    } catch {
      set({ isUpdating: false });
      return false;
    }
  },

  clear: () => set({ items: [], unreadCount: 0, isLoading: false, isUpdating: false }),
}));
