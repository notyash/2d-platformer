// src/ui/KamiZukiHUD.tsx
import React, { useEffect, useState, useRef } from 'react';
import { GameEventBus, type GameStats } from '../services/GameEventBus';
import { Icon } from './kit/Icon';

export const KamiZukiHUD: React.FC = () => {
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const timerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bus = GameEventBus.getInstance();

    // 1. Stats changed (only re-renders when numbers change)
    const unsubStats = bus.on('stats:changed', (newStats) => {
      setStats(newStats);
    });

    // 2. High-frequency timer tick: updates DOM directly via ref for zero React re-render overhead
    const unsubTime = bus.on('time:tick', (formattedTime) => {
      if (timerRef.current) {
        timerRef.current.textContent = formattedTime;
      }
    });

    // 3. Sound toggle status
    const unsubSound = bus.on('sound:status', (enabled) => {
      setSoundEnabled(enabled);
    });

    return () => {
      unsubStats();
      unsubTime();
      unsubSound();
    };
  }, []);

  const handleAction = (type: 'RESTART_RUN' | 'TOGGLE_PAUSE' | 'TOGGLE_SOUND') => {
    // Ensure all buttons blur immediately so Space key will never re-trigger them
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    GameEventBus.getInstance().emit('action:trigger', { type });
  };

  return (
    <header className="kamizuki-hud react-interactive">
      {/* Left: Compact Dark Navy Stat Chips */}
      <div className="hud-chips-group">
        <div className="hud-chip chip-coins" title="Coins Collected">
          <Icon name="coin" size={14} className="chip-icon-svg" />
          <span className="chip-value">{stats.coins}</span>
        </div>

        <div className="hud-chip chip-kills" title="Enemies Banished">
          <Icon name="sword" size={14} className="chip-icon-svg" />
          <span className="chip-value">{stats.kills}</span>
        </div>

        <div className="hud-chip chip-deaths" title="Deaths">
          <Icon name="skull" size={14} className="chip-icon-svg" />
          <span className="chip-value">{stats.deaths}</span>
        </div>
      </div>

      {/* Center: Large Space Grotesk Tabular Timer */}
      <div className="hud-timer-container">
        <div className="hud-timer-frame">
          <span className="hud-timer-label">TIME</span>
          <div ref={timerRef} className="hud-timer-value">
            00:00.00
          </div>
        </div>
      </div>

      {/* Right: Small Icon-style Action Buttons */}
      <div className="hud-actions-group">
        <button
          type="button"
          tabIndex={-1}
          className="hud-btn hud-btn-outline"
          title="Toggle Sound"
          onPointerDown={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            e.currentTarget.blur();
            handleAction('TOGGLE_SOUND');
          }}
        >
          <Icon name={soundEnabled ? 'volume' : 'volume-mute'} size={14} />
        </button>

        <button
          type="button"
          tabIndex={-1}
          className="hud-btn hud-btn-outline hud-btn-restart"
          title="Restart Run (Double R)"
          onPointerDown={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            e.currentTarget.blur();
            handleAction('RESTART_RUN');
          }}
        >
          <Icon name="restart" size={14} />
          <span className="btn-label">RESTART</span>
        </button>

        <button
          type="button"
          tabIndex={-1}
          className="hud-btn hud-btn-crimson"
          title="Pause / Menu (ESC)"
          onPointerDown={(e) => e.currentTarget.blur()}
          onClick={(e) => {
            e.currentTarget.blur();
            handleAction('TOGGLE_PAUSE');
          }}
        >
          <Icon name="menu" size={14} />
          <span className="btn-label">MENU</span>
        </button>
      </div>
    </header>
  );
};
