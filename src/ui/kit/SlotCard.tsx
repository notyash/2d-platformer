// src/ui/kit/SlotCard.tsx
import React, { useMemo } from 'react';
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
  cooldownStartTime: _cooldownStartTime,
  cooldownDurationMs = 1000,
  className = '',
  children,
  ...props
}) => {
  const stateClass = `kz-slot-card--${state}`;

  // Cooldown sweep ring style (game-driven duration, zero wall-clock drift on pause)
  const cooldownStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (state !== 'cooldown') return undefined;

    return {
      animationDuration: `${cooldownDurationMs}ms`,
      animationDelay: '0ms',
    };
  }, [state, cooldownDurationMs]);

  return (
    <div className={`kz-slot-wrapper ${className}`.trim()} {...props}>
      <div className={`kz-slot-card ${stateClass}`}>
        {/* Icon / Content */}
        <div className="kz-slot-card__icon-wrapper">
          {children ? children : icon ? <Icon name={icon} size={24} /> : null}
        </div>

        {/* Badge Count (e.g. quantity / ammo) */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <span className="kz-slot-card__badge-count">{badgeCount}</span>
        )}

        {/* Cooldown SVG Ring Sweep (Pure CSS animation, paused automatically during game pause) */}
        {state === 'cooldown' && (
          <div className="kz-slot-card__cooldown-overlay" aria-hidden="true">
            <svg className="kz-slot-card__cooldown-svg" viewBox="0 0 70 70">
              <circle
                className="kz-slot-card__cooldown-circle"
                cx="35"
                cy="35"
                r="30"
                pathLength="100"
                style={cooldownStyle}
              />
            </svg>
          </div>
        )}
      </div>

      {/* KeyCap Hint Centered Below the Card */}
      {keyHint && (
        <div className="kz-slot-card__keyhint-below">
          <KeyCap
            size="sm"
            isPressed={state === 'active'}
            className={state === 'disabled' ? 'kz-keycap--dimmed' : ''}
          >
            {keyHint}
          </KeyCap>
        </div>
      )}
    </div>
  );
};
