// src/ui/kit/ToastContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Toast, type ToastItemData } from './Toast';

export interface ToastOptions extends Omit<ToastItemData, 'id'> {
  id?: string;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions | string) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

export interface ToastProviderProps {
  paused?: boolean;
  children: React.ReactNode;
}

interface ToastRecord {
  data: ToastItemData;
  remainingMs: number;
  startedAt: number;
  timerId: number | null;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<ToastProviderProps> = ({ paused = false, children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const recordsRef = useRef<Map<string, ToastRecord>>(new Map());
  const prevPausedRef = useRef<boolean>(paused);

  const dismissToast = useCallback((id: string) => {
    const record = recordsRef.current.get(id);
    if (record?.timerId) {
      window.clearTimeout(record.timerId);
    }
    recordsRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (options: ToastOptions | string): string => {
      const id = typeof options === 'object' && options.id ? options.id : `toast-${Date.now()}-${Math.random()}`;
      const toastData: ToastItemData =
        typeof options === 'string'
          ? { id, message: options, durationMs: 3000 }
          : { id, durationMs: 3000, ...options };

      const duration = toastData.durationMs ?? 3000;
      let timerId: number | null = null;
      const startedAt = performance.now();

      if (duration > 0 && !paused) {
        timerId = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
      }

      recordsRef.current.set(id, {
        data: toastData,
        remainingMs: duration,
        startedAt,
        timerId,
      });

      setToasts((prev) => {
        const filtered = prev.filter((t) => t.id !== id);
        const next = [...filtered, toastData];
        if (next.length > 3) {
          const overflow = next.slice(0, next.length - 3);
          overflow.forEach((item) => {
            const rec = recordsRef.current.get(item.id);
            if (rec?.timerId) {
              window.clearTimeout(rec.timerId);
            }
            recordsRef.current.delete(item.id);
          });
          return next.slice(-3);
        }
        return next;
      });
      return id;
    },
    [dismissToast, paused]
  );

  const clearAllToasts = useCallback(() => {
    recordsRef.current.forEach((record) => {
      if (record.timerId) window.clearTimeout(record.timerId);
    });
    recordsRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    if (paused && !prevPausedRef.current) {
      // Freezing timers on pause transition
      const now = performance.now();
      recordsRef.current.forEach((record) => {
        if (record.timerId !== null) {
          window.clearTimeout(record.timerId);
          record.timerId = null;
          const elapsed = now - record.startedAt;
          record.remainingMs = Math.max(0, record.remainingMs - elapsed);
        }
      });
    } else if (!paused && prevPausedRef.current) {
      // Resuming timers with remaining duration on unpause transition
      const now = performance.now();
      recordsRef.current.forEach((record, id) => {
        if (record.remainingMs > 0 && record.timerId === null) {
          record.startedAt = now;
          record.timerId = window.setTimeout(() => {
            dismissToast(id);
          }, record.remainingMs);
        }
      });
    }
    prevPausedRef.current = paused;
  }, [paused, dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, clearAllToasts }}>
      {children}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
