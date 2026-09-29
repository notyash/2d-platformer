// src/ui/kit/BossBar.tsx
import React, { useEffect, useState, useRef } from 'react';
import { Icon } from './Icon';
import './kit.css';

export interface BossBarProps {
  name: string;
  hp: number;
  maxHp: number;
  phase?: number;
  invulnerable?: boolean;
  phases?: number | number[]; // Number of equal phases or explicit threshold fractions
  showPhaseTicks?: boolean; // Phase ticks off by default
  visible: boolean;
  sealText?: string;
  hankoText?: string;
  className?: string;
  shieldHitPulse?: number;
}

const toRomanNumeral = (num?: number): string => {
  if (num === 1) return 'I';
  if (num === 2) return 'II';
  if (num === 3) return 'III';
  if (num === 4) return 'IV';
  return num ? String(num) : '';
};

export const BossBar: React.FC<BossBarProps> = ({
  name,
  hp,
  maxHp,
  phase,
  invulnerable = false,
  phases = 2,
  showPhaseTicks = false,
  visible,
  sealText = '神月',
  hankoText,
  className = '',
  shieldHitPulse,
}) => {
  const displaySeal = sealText ?? hankoText ?? '神月';
  const cleanName = name
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚡]/gu, '')
    .trim()
    .toUpperCase();
  const safeHp = Math.max(0, Math.min(maxHp, hp));
  const hpPercent = maxHp > 0 ? (safeHp / maxHp) * 100 : 0;

  // Delayed "ghost" damage segment (only active when not invulnerable)
  const [ghostPercent, setGhostPercent] = useState<number>(hpPercent);
  const ghostTimeoutRef = useRef<number | null>(null);

  // Shield break animation state
  const [isShieldBreaking, setIsShieldBreaking] = useState<boolean>(false);
  const prevInvulnerableRef = useRef<boolean>(invulnerable);

  // Refs for shield hit pulse animations
  const frameRef = useRef<HTMLDivElement | null>(null);
  const shieldBadgeRef = useRef<HTMLSpanElement | null>(null);
  const lastShieldHitTimeRef = useRef<number>(0);

  useEffect(() => {
    // Shield break transition: when invulnerable turns false from true
    if (prevInvulnerableRef.current && !invulnerable && visible) {
      setIsShieldBreaking(true);
      const timer = window.setTimeout(() => {
        setIsShieldBreaking(false);
      }, 450);
      return () => window.clearTimeout(timer);
    }
    prevInvulnerableRef.current = invulnerable;
  }, [invulnerable, visible]);

  useEffect(() => {
    if (shieldHitPulse === undefined || shieldHitPulse === 0) return;
    const now = performance.now();
    if (now - lastShieldHitTimeRef.current < 80) return; // Throttle to at most one pulse per 80ms
    lastShieldHitTimeRef.current = now;

    // Retrigger frame hit pulse via reflow
    if (frameRef.current) {
      frameRef.current.classList.remove('kz-boss-bar-frame--shield-hit');
      void frameRef.current.offsetWidth;
      frameRef.current.classList.add('kz-boss-bar-frame--shield-hit');
    }

    // Retrigger shield icon cyan flash via reflow
    if (shieldBadgeRef.current) {
      shieldBadgeRef.current.classList.remove('kz-boss-bar-shield-badge--hit');
      void shieldBadgeRef.current.offsetWidth;
      shieldBadgeRef.current.classList.add('kz-boss-bar-shield-badge--hit');
    }
  }, [shieldHitPulse]);

  useEffect(() => {
    if (invulnerable) {
      setGhostPercent(hpPercent);
      return;
    }

    if (ghostTimeoutRef.current) {
      window.clearTimeout(ghostTimeoutRef.current);
    }

    // Ghost damage bar lingers for 300ms then catches up smoothly
    ghostTimeoutRef.current = window.setTimeout(() => {
      setGhostPercent(hpPercent);
    }, 300);

    return () => {
      if (ghostTimeoutRef.current) {
        window.clearTimeout(ghostTimeoutRef.current);
      }
    };
  }, [hpPercent, invulnerable]);

  // Calculate phase divider tick positions (%) only when explicitly requested
  const getPhaseTicks = (): number[] => {
    if (!showPhaseTicks || !phases) return [];
    if (Array.isArray(phases)) {
      return phases.map((p) => p * 100);
    }
    if (typeof phases === 'number' && phases > 1) {
      const step = 100 / phases;
      return Array.from({ length: phases - 1 }, (_, i) => step * (i + 1));
    }
    return [];
  };

  if (!visible) {
    return null;
  }

  const ticks = getPhaseTicks();
  const visibilityClass = 'kz-boss-bar-wrapper--visible';
  const breakingClass = isShieldBreaking ? 'kz-boss-bar-frame--breaking' : '';

  return (
    <div className={`kz-boss-bar-wrapper ${visibilityClass} ${className}`.trim()}>
      {/* Header: Hanko Seal + Boss Title + Shield Badge + Phase Badge */}
      <div className="kz-boss-bar-header">
        <span className="kz-boss-bar-seal" title="KamiZuki Boss Seal">
          {displaySeal}
        </span>
        <h3 className="kz-boss-bar-name">{cleanName}</h3>

        {(invulnerable || isShieldBreaking) && (
          <span
            ref={shieldBadgeRef}
            className={`kz-boss-bar-shield-badge ${isShieldBreaking ? 'kz-boss-bar-shield-badge--breaking' : ''}`}
            title="Shielded / Invulnerable"
          >
            <Icon name="shield" size={12} />
          </span>
        )}

        {phase !== undefined && (
          <span className="kz-boss-bar-phase-badge" title={`Phase ${toRomanNumeral(phase)}`}>
            PHASE {toRomanNumeral(phase)}
          </span>
        )}
      </div>

      {/* Frame: Clear outline, containing dark clipped track */}
      <div
        ref={frameRef}
        className={`kz-boss-bar-frame ${breakingClass}`.trim()}
        role="progressbar"
        aria-valuenow={safeHp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label={`${name} Health`}
      >
        <div className="kz-boss-bar-track">
          {/* Ghost Damage Bar (disabled while shielded) */}
          {!invulnerable && ghostPercent > 0 && (
            <div className="kz-boss-bar-ghost" style={{ width: `${ghostPercent}%` }} />
          )}

          {/* Primary Health Fill: normal crimson fill, 100% width while shielded, hpPercent otherwise */}
          {(invulnerable || safeHp > 0) && (
            <div
              className="kz-boss-bar-fill"
              style={{ width: `${invulnerable ? 100 : hpPercent}%` }}
            />
          )}

          {/* Optional Phase Tick Dividers */}
          {showPhaseTicks && ticks.length > 0 && (
            <div className="kz-boss-bar-ticks" aria-hidden="true">
              {ticks.map((tickPercent, idx) => (
                <div key={idx} className="kz-boss-bar-tick" style={{ left: `${tickPercent}%` }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
