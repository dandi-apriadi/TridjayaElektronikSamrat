import React from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { NotificationItem } from '../../store/useNotificationStore';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const Toast: React.FC<{ notification: NotificationItem }> = ({ notification }) => {
  const { removeNotification } = useNotificationStore();

  const icon = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
    error: <AlertCircle className="w-5 h-5 text-red-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
  }[notification.type as string] || <Info className="w-5 h-5 text-blue-400" />;

  return (
    <div className="glass-dark border border-white/10 rounded-xl p-4 flex items-start gap-3 backdrop-blur-xl shadow-2xl min-w-[300px] pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="font-display font-bold text-white text-sm">{notification.message}</div>
        {notification.description && (
          <div className="font-body text-white/60 text-xs mt-1">{notification.description}</div>
        )}
      </div>
      <button 
        onClick={() => removeNotification(notification.id)}
        className="text-white/40 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const NotificationContainer: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);

  return (
    <div className="fixed top-28 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {notifications.map((n) => (
        <Toast key={n.id} notification={n} />
      ))}
    </div>
  );
};
