// src/ui/ReactOverlay.tsx
import React, { useEffect, useState } from 'react';
import {
  GameEventBus,
  type GameState,
  type GameStats,
  type BossHpData,
  type BossPhaseData,
  type OrbsData,
  type EquipmentState,
} from '../services/GameEventBus';
import { KamiZukiHUD } from './KamiZukiHUD';
import { PauseModal } from './PauseModal';
import { DebugReadout } from './DebugReadout';
import { UIKitShowcase } from './UIKitShowcase';
import { BossBar } from './kit/BossBar';
import { ProgressPips } from './kit/ProgressPips';
import { SlotCard } from './kit/SlotCard';
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
  const [equipment, setEquipment] = useState<EquipmentState>({
    gun: { acquired: false, count: 0, state: 'disabled' },
    totem: { acquired: false, count: 0, state: 'disabled' },
  });

  // Orb Pips lifecycle: visible only in Phase 1; on transition to Phase 2, fade out over 600ms then remove from DOM
  const [isPipsFadingOut, setIsPipsFadingOut] = useState<boolean>(false);
  const [isPipsRendered, setIsPipsRendered] = useState<boolean>(() => bossPhase.phase === 1);
  const prevPhaseRef = React.useRef<number>(bossPhase.phase);

  useEffect(() => {
    if (bossPhase.phase === 1) {
      setIsPipsRendered(true);
      setIsPipsFadingOut(false);
    } else if (prevPhaseRef.current === 1 && bossPhase.phase === 2) {
      setIsPipsFadingOut(true);
      const timer = window.setTimeout(() => {
        setIsPipsRendered(false);
        setIsPipsFadingOut(false);
      }, 600);
      return () => window.clearTimeout(timer);
    } else {
      setIsPipsRendered(false);
      setIsPipsFadingOut(false);
    }
    prevPhaseRef.current = bossPhase.phase;
  }, [bossPhase.phase]);

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

    const unsubEquipment = bus.on('equipment:changed', (data) => {
      setEquipment(data);
    });

    const unsubToast = bus.on('toast:show', (toastData) => {
      showToast({
        title: toastData.title,
        iconSrc: toastData.iconSrc,
        keys: toastData.keys,
        hint: toastData.hint,
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
      unsubEquipment();
      unsubToast();
    };
  }, [showToast]);

  return (
    <div
      className="react-ui-overlay"
      data-paused={gameState === 'PAUSED' ? 'true' : 'false'}
    >
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

          {bossHp.isVisible && isPipsRendered && orbs.total > 0 && (
            <div className={`hud-boss-orbs ${isPipsFadingOut ? 'hud-boss-orbs--fading' : ''}`}>
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

      {/* Bottom-Left Equipment Dock */}
      {(equipment.gun.acquired || equipment.totem.acquired) && (
        <div className="hud-equipment-dock" role="region" aria-label="Equipment Dock">
          {equipment.gun.acquired && (
            <SlotCard
              state={equipment.gun.state}
              cooldownStartTime={equipment.gun.cooldownStartTime}
              cooldownDurationMs={equipment.gun.cooldownDurationMs}
              aria-label="Blaster Slot"
            >
              <img
                src="/assets/sprites/collectibles/gun_sprite.png"
                alt="Blaster"
                width={28}
                height={28}
              />
            </SlotCard>
          )}

          {equipment.totem.acquired && (
            <SlotCard
              state={equipment.totem.state}
              keyHint="E"
              badgeCount={equipment.totem.count && equipment.totem.count > 1 ? equipment.totem.count : undefined}
              cooldownStartTime={equipment.totem.cooldownStartTime}
              cooldownDurationMs={equipment.totem.cooldownDurationMs}
              aria-label="Totem Shield Slot"
            >
              <img
                src="/assets/sprites/collectibles/frog_doll_totem.png"
                alt="Totem Shield"
                width={28}
                height={28}
              />
            </SlotCard>
          )}
        </div>
      )}

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
