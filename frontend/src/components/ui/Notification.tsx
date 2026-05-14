import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '../../store/useNotificationStore';
import type { NotificationItem } from '../../store/useNotificationStore';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DEFAULT_DURATION = 5000;
const SWIPE_THRESHOLD = 80;

const typeStyles: Record<string, { border: string; bar: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-emerald-500/20',
    bar: 'bg-emerald-400',
    icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
  },
  error: {
    border: 'border-red-500/20',
    bar: 'bg-red-400',
    icon: <AlertCircle className="w-5 h-5 text-red-400" />,
  },
  warning: {
    border: 'border-amber-500/20',
    bar: 'bg-amber-400',
    icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
  },
  info: {
    border: 'border-blue-500/20',
    bar: 'bg-blue-400',
    icon: <Info className="w-5 h-5 text-blue-400" />,
  },
};

const Toast: React.FC<{ notification: NotificationItem }> = ({ notification }) => {
  const { removeNotification } = useNotificationStore();
  const duration = notification.duration ?? DEFAULT_DURATION;
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [dragX, setDragX] = useState(0);
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const progressRef = useRef(100);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef(Date.now());
  const elapsedRef = useRef(0);

  const handleDismiss = useCallback(() => {
    removeNotification(notification.id);
  }, [notification.id, removeNotification]);

  // Progress bar animation
  useEffect(() => {
    if (duration === Infinity || duration <= 0) return;

    const tick = () => {
      if (!isPaused) {
        elapsedRef.current = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, duration - elapsedRef.current);
        const pct = (remaining / duration) * 100;
        progressRef.current = pct;
        setProgress(pct);

        if (remaining <= 0) {
          handleDismiss();
          return;
        }
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [duration, isPaused, handleDismiss]);

  // Touch / Mouse swipe handlers
  const onPointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const delta = e.clientX - startXRef.current;
    if (delta > 0) return; // only allow swipe left
    setDragX(delta);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      handleDismiss();
    } else {
      setDragX(0);
    }
  };

  const style = typeStyles[notification.type] || typeStyles.info;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 120, scale: 0.95 }}
      animate={{
        opacity: dragX < -10 ? Math.max(0, 1 - Math.abs(dragX) / 200) : 1,
        x: dragX,
        scale: 1,
      }}
      exit={{ opacity: 0, x: 120, scale: 0.9, transition: { duration: 0.25 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => {
        setIsPaused(false);
        startTimeRef.current = Date.now() - elapsedRef.current;
      }}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => {
        setIsPaused(false);
        startTimeRef.current = Date.now() - elapsedRef.current;
      }}
      className={`glass-dark border ${style.border} rounded-xl overflow-hidden shadow-2xl min-w-[320px] max-w-[420px] pointer-events-auto cursor-grab active:cursor-grabbing select-none relative`}
    >
      <div className="p-4 flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{style.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-white text-sm leading-snug">{notification.message}</div>
          {notification.description && (
            <div className="font-body text-white/60 text-xs mt-1 leading-relaxed">{notification.description}</div>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDismiss();
          }}
          className="text-white/40 hover:text-white transition-colors shrink-0 mt-0.5"
          aria-label="Tutup notifikasi"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      {duration !== Infinity && duration > 0 && (
        <div className="h-[3px] w-full bg-white/5">
          <motion.div
            className={`h-full ${style.bar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
};

export const NotificationContainer: React.FC = () => {
  const notifications = useNotificationStore((state) => state.notifications);

  return (
    <div className="fixed top-28 right-4 sm:right-6 z-[9999] flex flex-col gap-3 pointer-events-none items-end">
      <AnimatePresence mode="popLayout">
        {notifications.map((n) => (
          <Toast key={n.id} notification={n} />
        ))}
      </AnimatePresence>
    </div>
  );
};
