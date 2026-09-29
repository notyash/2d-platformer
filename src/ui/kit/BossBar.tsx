// src/ui/kit/BossBar.tsx
import React, { useEffect, useState, useRef } from 'react';
import './kit.css';

export interface BossBarProps {
  name: string;
  hp: number;
  maxHp: number;
  phases?: number | number[]; // Number of equal phases (e.g. 2) or explicit threshold fractions [0.5]
  visible: boolean;
  hankoText?: string;
  className?: string;
}

export const BossBar: React.FC<BossBarProps> = ({
  name,
  hp,
  maxHp,
  phases = 2,
  visible,
  hankoText = '鬼',
  className = '',
}) => {
  const safeHp = Math.max(0, Math.min(maxHp, hp));
  const hpPercent = maxHp > 0 ? (safeHp / maxHp) * 100 : 0;

  // Delayed "ghost" damage segment
  const [ghostPercent, setGhostPercent] = useState<number>(hpPercent);
  const ghostTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
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
  }, [hpPercent]);

  // Calculate phase divider tick positions (%)
  const getPhaseTicks = (): number[] => {
    if (!phases) return [];
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

  return (
    <div className={`kz-boss-bar-wrapper ${visibilityClass} ${className}`.trim()}>
      {/* Header: Hanko Seal + Boss Title */}
      <div className="kz-boss-bar-header">
        <span className="kz-boss-bar-seal" title="KamiZuki Boss Seal">
          {hankoText}
        </span>
        <h3 className="kz-boss-bar-name">{name}</h3>
      </div>

      {/* Frame: Ghost Bar + Segmented Crimson Fill + Phase Ticks */}
      <div
        className="kz-boss-bar-frame"
        role="progressbar"
        aria-valuenow={safeHp}
        aria-valuemin={0}
        aria-valuemax={maxHp}
        aria-label={`${name} Health`}
      >
        {/* Ghost Damage Bar */}
        <div className="kz-boss-bar-ghost" style={{ width: `${ghostPercent}%` }} />

        {/* Primary Health Fill */}
        <div className="kz-boss-bar-fill" style={{ width: `${hpPercent}%` }} />

        {/* Phase Tick Dividers */}
        {ticks.length > 0 && (
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
