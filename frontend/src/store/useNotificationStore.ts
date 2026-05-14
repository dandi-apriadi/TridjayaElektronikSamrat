import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  duration?: number;
  createdAt: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

const MAX_STACK = 5;
const DEFAULT_DURATION = 5000;

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    const createdAt = Date.now();
    const duration = notification.duration ?? DEFAULT_DURATION;

    set((state) => {
      const next = [...state.notifications, { ...notification, id, createdAt }];
      // Enforce max stack: remove oldest if exceeding limit
      if (next.length > MAX_STACK) {
        return { notifications: next.slice(next.length - MAX_STACK) };
      }
      return { notifications: next };
    });

    if (duration !== Infinity && duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        }));
      }, duration);
    }
  },
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  clearAll: () => set({ notifications: [] }),
}));

// Helper for easy access
export const toast = {
  success: (message: string, description?: string) => 
    useNotificationStore.getState().addNotification({ type: 'success', message, description }),
  error: (message: string, description?: string) => 
    useNotificationStore.getState().addNotification({ type: 'error', message, description }),
  info: (message: string, description?: string) => 
    useNotificationStore.getState().addNotification({ type: 'info', message, description }),
  warning: (message: string, description?: string) => 
    useNotificationStore.getState().addNotification({ type: 'warning', message, description }),
};
