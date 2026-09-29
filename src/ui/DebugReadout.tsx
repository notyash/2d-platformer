// src/ui/DebugReadout.tsx
import React, { useEffect, useState, useRef } from 'react';
import { GameEventBus, type GameStats, type BossHpData, type GameState } from '../services/GameEventBus';

export interface DebugReadoutProps {
  onOpenUIKit?: () => void;
}

export const DebugReadout: React.FC<DebugReadoutProps> = ({ onOpenUIKit }) => {
  // Only enabled in dev builds
  const isDev = import.meta.env.DEV;

  // Hidden by default, toggled with backtick key (`)
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });
  const [time, setTime] = useState<string>('00:00.00');
  const [bossHp, setBossHp] = useState<BossHpData>({
    currentHp: 50,
    maxHp: 50,
    bossName: 'ELECKING',
    isVisible: false,
  });
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [tickCount, setTickCount] = useState<number>(0);

  const statsUpdateCount = useRef<number>(0);

  useEffect(() => {
    if (!isDev) return;

    // Toggle with backtick key (`)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Backquote' || e.key === '`') {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const bus = GameEventBus.getInstance();

    const unsubStats = bus.on('stats:changed', (newStats) => {
      statsUpdateCount.current += 1;
      setStats(newStats);
    });

    const unsubTime = bus.on('time:tick', (newTime) => {
      setTime(newTime);
      setTickCount((prev) => prev + 1);
    });

    const unsubBoss = bus.on('boss:hp', (newBossHp) => {
      setBossHp(newBossHp);
    });

    const unsubState = bus.on('game:state', (newState) => {
      setGameState(newState);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubStats();
      unsubTime();
      unsubBoss();
      unsubState();
    };
  }, [isDev]);

  if (!isDev || !isVisible) {
    return null;
  }

  return (
    <div className="debug-readout-card react-interactive">
      <div className="debug-title">
        <span className="debug-badge">DEV DEBUG [ ` ]</span>
        <span>EVENT BUS BRIDGE</span>
      </div>
      <div className="debug-row">
        <span>Time:</span>
        <span className="debug-val debug-gold">{time}</span>
      </div>
      <div className="debug-row">
        <span>Coins:</span>
        <span className="debug-val debug-gold">{stats.coins}</span>
      </div>
      <div className="debug-row">
        <span>Kills:</span>
        <span className="debug-val debug-crimson">{stats.kills}</span>
      </div>
      <div className="debug-row">
        <span>Deaths:</span>
        <span className="debug-val">{stats.deaths}</span>
      </div>
      <div className="debug-row">
        <span>Boss HP:</span>
        <span className="debug-val">
          {bossHp.isVisible ? `${bossHp.currentHp}/${bossHp.maxHp}` : 'Inactive'}
        </span>
      </div>
      <div className="debug-row">
        <span>Game State:</span>
        <span className="debug-val debug-crimson">{gameState}</span>
      </div>
      <div
        className="debug-row"
        style={{
          marginTop: '6px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: '4px',
          fontSize: '10px',
          color: 'var(--parchment-dim)',
        }}
      >
        <span>Stats Emits: {statsUpdateCount.current}</span>
        <span>Timer Ticks: {tickCount}</span>
      </div>

      {onOpenUIKit && (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            className="hud-btn hud-btn-outline"
            style={{ width: '100%', fontSize: '10px', padding: '4px 8px' }}
            onClick={onOpenUIKit}
          >
            Open UI Kit Showcase (/ui-kit)
          </button>
        </div>
      )}
    </div>
  );
};
