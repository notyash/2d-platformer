// src/ui/kit/ToastContext.tsx
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Toast, type ToastItemData } from './Toast';

export interface ToastOptions extends Omit<ToastItemData, 'id'> {
  id?: string;
}

export interface ToastContextValue {
  showToast: (options: ToastOptions | string) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (options: ToastOptions | string): string => {
      const id = typeof options === 'object' && options.id ? options.id : `toast-${Date.now()}-${Math.random()}`;
      const toastData: ToastItemData =
        typeof options === 'string'
          ? { id, message: options, durationMs: 3000 }
          : { id, durationMs: 3000, ...options };

      setToasts((prev) => [...prev.filter((t) => t.id !== id), toastData]);

      const duration = toastData.durationMs || 3000;
      if (duration > 0) {
        const timer = window.setTimeout(() => {
          dismissToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [dismissToast]
  );

  const clearAllToasts = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current.clear();
    setToasts([]);
  }, []);

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
