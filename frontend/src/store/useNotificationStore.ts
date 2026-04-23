import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  description?: string;
  duration?: number;
}

interface NotificationState {
  notifications: NotificationItem[];
  addNotification: (notification: Omit<NotificationItem, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (notification) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      notifications: [...state.notifications, { ...notification, id }],
    }));

    // Auto remove
    const duration = notification.duration || 5000;
    if (duration !== Infinity) {
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
