// src/ui/kit/SlotCard.tsx
import React from 'react';
import { Icon, type IconName } from './Icon';
import { KeyCap } from './KeyCap';
import './kit.css';

export type SlotCardState = 'empty' | 'ready' | 'active' | 'cooldown' | 'disabled';

export interface SlotCardProps extends React.HTMLAttributes<HTMLDivElement> {
  state?: SlotCardState;
  icon?: IconName;
  keyHint?: string;
  badgeCount?: number;
  cooldownStartTime?: number;
  cooldownDurationMs?: number;
  children?: React.ReactNode;
}

export const SlotCard: React.FC<SlotCardProps> = ({
  state = 'ready',
  icon,
  keyHint,
  badgeCount,
  cooldownStartTime,
  cooldownDurationMs = 1000,
  className = '',
  children,
  ...props
}) => {
  const stateClass = `kz-slot-card--${state}`;

  // Calculate CSS animation delay if cooldown started in the past
  const getCooldownStyle = (): React.CSSProperties | undefined => {
    if (state !== 'cooldown') return undefined;

    const elapsed = cooldownStartTime ? Math.max(0, Date.now() - cooldownStartTime) : 0;
    return {
      animationDuration: `${cooldownDurationMs}ms`,
      animationDelay: elapsed > 0 ? `-${elapsed}ms` : '0ms',
    };
  };

  return (
    <div className={`kz-slot-card ${stateClass} ${className}`.trim()} {...props}>
      {/* Icon / Content */}
      <div className="kz-slot-card__icon-wrapper">
        {children ? children : icon ? <Icon name={icon} size={24} /> : null}
      </div>

      {/* Badge Count (e.g. quantity / ammo) */}
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="kz-slot-card__badge-count">{badgeCount}</span>
      )}

      {/* KeyCap Hint */}
      {keyHint && (
        <div className="kz-slot-card__keycap-wrapper">
          <KeyCap size="sm">{keyHint}</KeyCap>
        </div>
      )}

      {/* Cooldown SVG Ring Sweep (Pure CSS animation, zero JS per-frame updates) */}
      {state === 'cooldown' && (
        <div className="kz-slot-card__cooldown-overlay" aria-hidden="true">
          <svg className="kz-slot-card__cooldown-svg" viewBox="0 0 70 70">
            <circle
              className="kz-slot-card__cooldown-circle"
              cx="35"
              cy="35"
              r="30"
              style={getCooldownStyle()}
            />
          </svg>
        </div>
      )}
    </div>
  );
};
