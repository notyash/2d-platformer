// src/ui/ReactOverlay.tsx
import React, { useEffect, useState } from 'react';
import {
  GameEventBus,
  type GameState,
  type GameStats,
  type BossHpData,
  type BossPhaseData,
  type OrbsData,
} from '../services/GameEventBus';
import { KamiZukiHUD } from './KamiZukiHUD';
import { PauseModal } from './PauseModal';
import { DebugReadout } from './DebugReadout';
import { UIKitShowcase } from './UIKitShowcase';
import { BossBar } from './kit/BossBar';
import { ProgressPips } from './kit/ProgressPips';
import { ToastProvider, useToast } from './kit/ToastContext';

const ReactOverlayContent: React.FC = () => {
  const isDev = import.meta.env.DEV;
  const { showToast } = useToast();
  const [gameState, setGameState] = useState<GameState>('PLAYING');
  const [stats, setStats] = useState<GameStats>({ coins: 0, kills: 0, deaths: 0 });
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

  // Check if URL specifies /ui-kit showcase
  const [showUIKit, setShowUIKit] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && isDev) {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      return path.includes('ui-kit') || search.includes('ui-kit') || hash.includes('ui-kit');
    }
    return false;
  });

  useEffect(() => {
    const bus = GameEventBus.getInstance();

    const unsubState = bus.on('game:state', (newState) => {
      setGameState(newState);
    });

    const unsubStats = bus.on('stats:changed', (newStats) => {
      setStats(newStats);
    });

    const unsubBossHp = bus.on('boss:hp', (data) => {
      setBossHp(data);
    });

    const unsubBossPhase = bus.on('boss:phase', (data) => {
      setBossPhase(data);
    });

    const unsubOrbs = bus.on('orbs:updated', (data) => {
      setOrbs(data);
    });

    const unsubToast = bus.on('toast:show', (toastData) => {
      showToast({
        title: toastData.title,
        message: toastData.message,
        variant: toastData.variant,
        durationMs: toastData.durationMs,
      });
    });

    return () => {
      unsubState();
      unsubStats();
      unsubBossHp();
      unsubBossPhase();
      unsubOrbs();
      unsubToast();
    };
  }, [showToast]);

  return (
    <div className="react-ui-overlay">
      {/* Top KamiZuki HUD & Boss Arena Status */}
      <div className="hud-top-wrapper">
        <KamiZukiHUD />

        {/* Boss Health Bar & Gravity Orbs Pips Container */}
        <div className="hud-boss-section">
          <BossBar
            name={bossHp.bossName || 'ELECKING'}
            hp={bossHp.currentHp}
            maxHp={bossHp.maxHp}
            phase={bossPhase.phase}
            invulnerable={bossPhase.invulnerable}
            visible={bossHp.isVisible}
            sealText="神月"
          />

          {bossHp.isVisible && orbs.total > 0 && (
            <div className="hud-boss-orbs">
              <ProgressPips
                total={orbs.total}
                filled={orbs.collected}
                variant="cyan"
                size="md"
                aria-label={`Gravity Orbs: ${orbs.collected} of ${orbs.total}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Pause Modal */}
      <PauseModal gameState={gameState} stats={stats} />

      {/* Dev-Only Event Bus Overlay (toggled with backtick `) */}
      {isDev && <DebugReadout onOpenUIKit={() => setShowUIKit(true)} />}

      {/* Dev-Only /ui-kit Showcase Gallery */}
      {isDev && showUIKit && <UIKitShowcase onClose={() => setShowUIKit(false)} />}
    </div>
  );
};

export const ReactOverlay: React.FC = () => {
  return (
    <ToastProvider>
      <ReactOverlayContent />
    </ToastProvider>
  );
};
