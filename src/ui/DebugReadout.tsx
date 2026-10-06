import React, { useEffect, useState, useRef } from 'react';
import {
  GameEventBus,
  type GameStats,
  type BossHpData,
  type BossPhaseData,
  type OrbsData,
  type GameState,
} from '../services/GameEventBus';

export interface DebugReadoutProps {
  onOpenUIKit?: () => void;
}

export const DebugReadout: React.FC<DebugReadoutProps> = ({ onOpenUIKit }) => {
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
  const [bossPhase, setBossPhase] = useState<BossPhaseData>({
    phase: 1,
    invulnerable: true,
  });
  const [orbs, setOrbs] = useState<OrbsData>({
    collected: 0,
    total: 0,
  });
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [isCursorIdle, setIsCursorIdle] = useState<boolean>(false);
  const [tickCount, setTickCount] = useState<number>(0);

  const statsUpdateCount = useRef<number>(0);

  useEffect(() => {
    // 60% keyboards often map Fn+Esc to:
    // - key === '`' or '~'
    // - code === 'Backquote' or 'Escape' (with shift/fn)
    // - keyCode === 192 (Backquote/Tilde)
    // Also support F2, and Ctrl+Shift+D as universal alternatives
    const handleKeyDown = (e: KeyboardEvent) => {
      const isBacktick =
        e.key === '`' ||
        e.key === '~' ||
        e.code === 'Backquote' ||
        e.keyCode === 192 ||
        e.which === 192;

      const isDevShortcut =
        isBacktick ||
        e.code === 'F2' ||
        e.key === 'F2' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'KeyD' || e.key === 'D' || e.key === 'd'));

      if (isDevShortcut) {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });

    if (typeof window !== 'undefined') {
      (window as any).toggleDebug = () => setIsVisible((prev) => !prev);
      (window as any).openUIKit = () => onOpenUIKit?.();
    }

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

    const unsubPhase = bus.on('boss:phase', (newPhase) => {
      setBossPhase(newPhase);
    });

    const unsubOrbs = bus.on('orbs:updated', (newOrbs) => {
      setOrbs(newOrbs);
    });

    const unsubState = bus.on('game:state', (newState) => {
      setGameState(newState);
    });

    const unsubCursor = bus.on('cursor:idle', (idle) => {
      setIsCursorIdle(idle);
    });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      unsubStats();
      unsubTime();
      unsubBoss();
      unsubPhase();
      unsubOrbs();
      unsubState();
      unsubCursor();
    };
  }, [onOpenUIKit]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="debug-readout-card react-interactive">
      <div className="debug-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="debug-badge">DEV DEBUG [ ` / F2 ]</span>
          <span>EVENT BUS</span>
        </div>
        <button
          type="button"
          className="debug-close-btn"
          onClick={() => setIsVisible(false)}
          title="Close Debug"
        >
          ✕
        </button>
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
        <span>Boss Phase:</span>
        <span className="debug-val debug-gold">
          {bossHp.isVisible
            ? `Phase ${bossPhase.phase === 1 ? 'I' : 'II'} (${bossPhase.invulnerable ? 'Shielded' : 'Vulnerable'})`
            : 'Inactive'}
        </span>
      </div>
      {bossHp.isVisible && (
        <div className="debug-row">
          <span>Orbs:</span>
          <span className="debug-val" style={{ color: 'var(--orb-cyan)' }}>
            {orbs.collected}/{orbs.total}
          </span>
        </div>
      )}
      <div className="debug-row">
        <span>Game State:</span>
        <span className="debug-val debug-crimson">{gameState}</span>
      </div>
      <div className="debug-row">
        <span>Cursor:</span>
        <span
          className="debug-val"
          style={{ color: isCursorIdle ? 'var(--parchment-dim)' : 'var(--mint)' }}
        >
          {isCursorIdle ? 'Hidden (Idle)' : 'Visible'}
        </span>
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
