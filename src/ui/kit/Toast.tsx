// src/ui/kit/Toast.tsx
import React from 'react';
import { Icon, type IconName } from './Icon';
import { KeyCap } from './KeyCap';
import './kit.css';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger' | 'victory';

export interface ToastItemData {
  id: string;
  title?: string;
  message: string;
  keys?: string[];
  variant?: ToastVariant;
  icon?: IconName;
  durationMs?: number;
}

export interface ToastProps {
  toasts: ToastItemData[];
  onDismiss: (id: string) => void;
}

const getDefaultIcon = (variant: ToastVariant = 'info'): IconName => {
  switch (variant) {
    case 'success':
      return 'check';
    case 'warning':
      return 'totem';
    case 'danger':
      return 'skull';
    case 'victory':
      return 'trophy';
    default:
      return 'orb';
  }
};

const renderMessageWithKeyCaps = (message: string, _keys?: string[]): React.ReactNode => {
  const parts = message.split(/(\[[^\]]+\])/g);
  if (parts.length === 1) {
    return message;
  }

  return parts.map((part, index) => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const keyText = part.slice(1, -1);
      return (
        <span key={index} style={{ margin: '0 3px', display: 'inline-flex', verticalAlign: 'middle' }}>
          <KeyCap size="sm">{keyText}</KeyCap>
        </span>
      );
    }
    return part;
  });
};

export const Toast: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="kz-toast-container" aria-live="polite" role="region">
      {toasts.map((t) => {
        const variant = t.variant || 'info';
        const iconName = t.icon || getDefaultIcon(variant);

        return (
          <div key={t.id} className={`kz-toast-item kz-toast-item--${variant}`}>
            <div className="kz-toast-item__icon">
              <Icon name={iconName} size={18} />
            </div>

            <div className="kz-toast-item__content">
              {t.title && <div className="kz-toast-item__title">{t.title}</div>}
              <div className="kz-toast-item__message">{renderMessageWithKeyCaps(t.message, t.keys)}</div>
            </div>

            <button
              type="button"
              className="kz-toast-item__close"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
