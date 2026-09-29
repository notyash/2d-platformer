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

function deriveToastId(options: ToastOptions | string): string {
  if (typeof options === 'object' && options.id && options.id.trim().length > 0) {
    return options.id.trim();
  }
  if (typeof options === 'string') {
    const slug = options.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return slug.length > 0 ? `toast-${slug}` : 'toast-info';
  }
  const variant = options.variant || 'info';
  const titlePart = options.title
    ? options.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    : '';
  const messagePart =
    !options.title && options.message
      ? options.message.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : '';
  const parts = [variant, titlePart, messagePart].filter(Boolean);
  const slug = parts.join('-');
  return slug.length > 0 ? `toast-${slug}` : `toast-${variant}`;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ paused = false, children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const recordsRef = useRef<Map<string, ToastRecord>>(new Map());
  const pausedRef = useRef<boolean>(paused);
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
      const id = deriveToastId(options);

      if (import.meta.env.DEV) {
        if (typeof options === 'string' || !options.id || options.id.trim().length === 0) {
          console.warn(`[Toast] Emitted toast without explicit id; derived fallback id '${id}':`, options);
        }
      }

      let duration = 3000;
      if (typeof options === 'object' && typeof options.durationMs === 'number' && options.durationMs > 0) {
        duration = options.durationMs;
      }

      const toastData: ToastItemData =
        typeof options === 'string'
          ? { id, message: options, durationMs: duration }
          : { ...options, id, durationMs: duration };

      // Clear any prior timer for this toast id
      const existingRecord = recordsRef.current.get(id);
      if (existingRecord?.timerId !== null && existingRecord?.timerId !== undefined) {
        window.clearTimeout(existingRecord.timerId);
      }

      let timerId: number | null = null;
      const startedAt = performance.now();

      if (duration > 0 && !pausedRef.current) {
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
        const existingIdx = prev.findIndex((t) => t.id === id);
        if (existingIdx !== -1) {
          // Update existing toast in place to avoid re-mounting and duplicate stacking
          const updated = [...prev];
          updated[existingIdx] = toastData;
          return updated;
        }

        const next = [...prev, toastData];
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
    [dismissToast]
  );

  const clearAllToasts = useCallback(() => {
    recordsRef.current.forEach((record) => {
      if (record.timerId) window.clearTimeout(record.timerId);
    });
    recordsRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const isPaused = paused;
    const wasPaused = prevPausedRef.current;
    pausedRef.current = isPaused;
    prevPausedRef.current = isPaused;

    if (isPaused && !wasPaused) {
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
    } else if (!isPaused && wasPaused) {
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
