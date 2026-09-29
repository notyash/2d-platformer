import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GameEventBus, type GameStats } from '../services/GameEventBus';
import { Icon } from './kit/Icon';

export const KamiZukiHUD: React.FC = () => {
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return Boolean(document.fullscreenElement);
  });
  const timerRef = useRef<HTMLDivElement | null>(null);
  const coinChipRef = useRef<HTMLDivElement | null>(null);

  const isFullscreenSupported = typeof document !== 'undefined' && Boolean(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );

  const updateCoinTarget = useRef<() => void>(() => {});

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

    // 4. Coin bump animation on coin collection arrival
    const unsubCoinBump = bus.on('coin:bump', () => {
      if (coinChipRef.current) {
        coinChipRef.current.classList.remove('hud-chip--bump');
        // Force reflow so rapid coin bumps retrigger cleanly
        void coinChipRef.current.offsetWidth;
        coinChipRef.current.classList.add('hud-chip--bump');
      }
    });

    // 5. Calculate and share HUD Coin Chip coordinates in Phaser game coordinate space (854x480)
    const computeTarget = () => {
      if (!coinChipRef.current) return;
      const chipRect = coinChipRef.current.getBoundingClientRect();
      const stage = document.getElementById('game-stage');
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const gameX = ((chipRect.left + chipRect.width / 2 - stageRect.left) / stageRect.width) * 854;
      const gameY = ((chipRect.top + chipRect.height / 2 - stageRect.top) / stageRect.height) * 480;

      bus.emitCoinTarget({ x: gameX, y: gameY });
    };

    updateCoinTarget.current = computeTarget;
    computeTarget();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => computeTarget()) : null;
    if (ro) {
      if (coinChipRef.current) ro.observe(coinChipRef.current);
      const stage = document.getElementById('game-stage');
      if (stage) ro.observe(stage);
    }

    window.addEventListener('resize', computeTarget);

    // Sync fullscreen state & recompute coin-fly target on fullscreen change
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      computeTarget();
      setTimeout(computeTarget, 50);
      setTimeout(computeTarget, 150);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      unsubStats();
      unsubTime();
      unsubSound();
      unsubCoinBump();
      if (ro) ro.disconnect();
      window.removeEventListener('resize', computeTarget);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!isFullscreenSupported) return;
    try {
      if (!document.fullscreenElement) {
        const masterWrapper = document.getElementById('game-master-wrapper');
        if (masterWrapper?.requestFullscreen) {
          await masterWrapper.requestFullscreen();
        } else if ((masterWrapper as any)?.webkitRequestFullscreen) {
          await (masterWrapper as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
      updateCoinTarget.current();
      setTimeout(() => updateCoinTarget.current(), 50);
      setTimeout(() => updateCoinTarget.current(), 150);
    } catch (err) {
      console.warn('[Fullscreen] Error toggling fullscreen:', err);
    }
  }, [isFullscreenSupported]);

  // F Key toggles fullscreen (ignored while any modal is open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        // Check if modal or pause is active
        const isModalOpen = Boolean(
          document.querySelector('[role="dialog"]') ||
          document.querySelector('.kz-modal-backdrop') ||
          document.querySelector('.ui-kit-showcase-backdrop') ||
          GameEventBus.getInstance().getGameState() === 'PAUSED'
        );
        if (isModalOpen) return;

        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleFullscreen]);

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
        <div ref={coinChipRef} className="hud-chip chip-coins" title="Coins Collected">
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
          <div ref={timerRef} className="hud-timer-value">
            00:00.00
          </div>
        </div>
      </div>

      {/* Right: Small Icon-style Action Buttons */}
      <div className="hud-actions-group">
        {isFullscreenSupported && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Fullscreen"
            className="hud-btn hud-btn-outline"
            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
            onPointerDown={(e) => e.currentTarget.blur()}
            onClick={(e) => {
              e.currentTarget.blur();
              toggleFullscreen();
            }}
          >
            <Icon name={isFullscreen ? 'fullscreen-exit' : 'fullscreen'} size={14} />
          </button>
        )}

        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle Sound"
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
          aria-label="Restart Run"
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
          aria-label="Menu"
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
