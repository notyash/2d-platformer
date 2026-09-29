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

  const ticks = getPhaseTicks();
  const visibilityClass = visible ? 'kz-boss-bar-wrapper--visible' : 'kz-boss-bar-wrapper--hidden';
  const shieldedClass = invulnerable ? 'kz-boss-bar-wrapper--shielded' : '';
  const breakingClass = isShieldBreaking ? 'kz-boss-bar-frame--breaking' : '';

  return (
    <div className={`kz-boss-bar-wrapper ${visibilityClass} ${shieldedClass} ${className}`.trim()}>
      {/* Header: Hanko Seal + Boss Title + Phase Badge + Shield Icon */}
      <div className="kz-boss-bar-header">
        <span className="kz-boss-bar-seal" title="KamiZuki Boss Seal">
          {displaySeal}
        </span>
        <h3 className="kz-boss-bar-name">{cleanName}</h3>

        {phase !== undefined && (
          <span className="kz-boss-bar-phase-badge" title={`Phase ${toRomanNumeral(phase)}`}>
            PHASE {toRomanNumeral(phase)}
          </span>
        )}

        {invulnerable && (
          <span className="kz-boss-bar-shield-badge" title="Shielded / Invulnerable">
            <Icon name="shield" size={13} />
          </span>
        )}
      </div>

      {/* Frame: Ghost Bar + Segmented Fill + Optional Phase Ticks */}
      <div
        className={`kz-boss-bar-frame ${invulnerable ? 'kz-boss-bar-frame--shielded' : ''} ${breakingClass}`.trim()}
        role="progressbar"
        aria-valuenow={safeHp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label={`${name} Health`}
      >
        {/* Ghost Damage Bar (disabled while shielded) */}
        {!invulnerable && (
          <div className="kz-boss-bar-ghost" style={{ width: `${ghostPercent}%` }} />
        )}

        {/* Primary Health Fill */}
        <div
          className={`kz-boss-bar-fill ${invulnerable ? 'kz-boss-bar-fill--shielded' : ''}`}
          style={{ width: `${hpPercent}%` }}
        />

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
  );
};
