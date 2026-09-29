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
import { Panel } from './kit/Panel';
import { PromptChip } from './kit/PromptChip';
import { ToastProvider, useToast } from './kit/ToastContext';
import type { RestartPromptData, CheckpointState } from '../services/GameEventBus';

interface ReactOverlayContentProps {
  gameState: GameState;
}

const ReactOverlayContent: React.FC<ReactOverlayContentProps> = ({ gameState }) => {
  const isDev = import.meta.env.DEV;
  const { showToast } = useToast();
  const [windowWidth, setWindowWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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
  const [shieldHitPulse, setShieldHitPulse] = useState<number>(0);
  const [restartPrompt, setRestartPrompt] = useState<RestartPromptData>({ active: false, progress: 0 });
  const [activeCheckpoint, setActiveCheckpoint] = useState<CheckpointState | null>(null);
  const [checkpointPulse, setCheckpointPulse] = useState<number>(0);

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

  const orbsContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Measure and emit Orb Pips target positions (each individual pip + center) in Phaser game coordinates (854x480)
  useEffect(() => {
    const bus = GameEventBus.getInstance();
    const updateOrbTarget = () => {
      if (!orbsContainerRef.current) return;
      const stage = document.getElementById('game-stage');
      if (!stage) return;
      const stageRect = stage.getBoundingClientRect();
      if (stageRect.width <= 0 || stageRect.height <= 0) return;

      const orbsRect = orbsContainerRef.current.getBoundingClientRect();
      const centerX = ((orbsRect.left + orbsRect.width / 2 - stageRect.left) / stageRect.width) * 854;
      const centerY = ((orbsRect.top + orbsRect.height / 2 - stageRect.top) / stageRect.height) * 480;

      const pipEls = orbsContainerRef.current.querySelectorAll('.kz-pip');
      const pips: { x: number; y: number }[] = [];
      pipEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        pips.push({
          x: ((rect.left + rect.width / 2 - stageRect.left) / stageRect.width) * 854,
          y: ((rect.top + rect.height / 2 - stageRect.top) / stageRect.height) * 480,
        });
      });

      bus.emitOrbTarget({
        pips,
        center: { x: centerX, y: centerY },
      });
    };

    updateOrbTarget();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateOrbTarget()) : null;
    if (ro) {
      if (orbsContainerRef.current) ro.observe(orbsContainerRef.current);
      const stage = document.getElementById('game-stage');
      if (stage) ro.observe(stage);
    }

    const handleFullscreenChange = () => {
      updateOrbTarget();
      setTimeout(updateOrbTarget, 50);
      setTimeout(updateOrbTarget, 150);
    };

    window.addEventListener('resize', updateOrbTarget);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateOrbTarget);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [bossHp.isVisible, isPipsRendered, orbs.total]);

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

    const unsubShieldHit = bus.on('boss:shield-hit', () => {
      setShieldHitPulse(Date.now());
    });

    const unsubRestartPrompt = bus.on('prompt:restart', (data) => {
      setRestartPrompt(data);
    });

    const unsubCheckpoint = bus.on('checkpoint:changed', (data) => {
      setActiveCheckpoint(data);
      if (data) {
        setCheckpointPulse(Date.now());
      }
    });

    const unsubToast = bus.on('toast:show', (toastData) => {
      showToast({
        id: toastData.id,
        title: toastData.title,
        iconSrc: toastData.iconSrc,
        icon: toastData.icon as any,
        keys: toastData.keys,
        hint: toastData.hint,
        message: toastData.message,
        variant: toastData.variant,
        durationMs: toastData.durationMs,
      });
    });

    return () => {
      unsubStats();
      unsubBossHp();
      unsubBossPhase();
      unsubOrbs();
      unsubEquipment();
      unsubShieldHit();
      unsubRestartPrompt();
      unsubCheckpoint();
      unsubToast();
    };
  }, [showToast]);

  if (windowWidth < 480) {
    return (
      <div className="react-ui-overlay react-ui-overlay--screen-too-small">
        <Panel variant="crimson-border" className="screen-too-small-panel">
          <div className="screen-too-small-icon">⛩️</div>
          <h2 className="screen-too-small-title">PLEASE USE A LARGER SCREEN</h2>
          <p className="screen-too-small-text">
            KamiZuki requires a display width of at least 480px.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div
      className="react-ui-overlay"
      data-paused={gameState === 'PAUSED' ? 'true' : 'false'}
    >
      {/* Top KamiZuki HUD & Boss Arena Status */}
      <div className="hud-top-wrapper">
        <KamiZukiHUD />

        {/* Boss Health Bar & Gravity Orbs Pips Container (Mounted only when active) */}
        {bossHp.isVisible && (
          <div className="hud-boss-section">
            <BossBar
              name={bossHp.bossName || 'ELECKING'}
              hp={bossHp.currentHp}
              maxHp={bossHp.maxHp}
              phase={bossPhase.phase}
              invulnerable={bossPhase.invulnerable}
              visible={bossHp.isVisible}
              sealText="神月"
              shieldHitPulse={shieldHitPulse}
            />

            {isPipsRendered && orbs.total > 0 && (
              <div
                ref={orbsContainerRef}
                className={`hud-boss-orbs ${isPipsFadingOut ? 'hud-boss-orbs--fading' : ''}`}
              >
                <ProgressPips
                  total={orbs.total}
                  filled={orbs.collected}
                  variant="mint"
                  size="md"
                  aria-label={`Gravity Orbs: ${orbs.collected} of ${orbs.total}`}
                />
              </div>
            )}
          </div>
        )}

        {/* Restart Confirmation Prompt Chip */}
        {restartPrompt.active && (
          <div className="hud-prompt-container">
            <PromptChip
              keyName="R"
              label="again to restart"
              variant="warning"
            />
          </div>
        )}
      </div>

      {/* Bottom-Left Equipment & Checkpoint Dock */}
      {(equipment.gun.acquired || equipment.totem.acquired || activeCheckpoint !== null) && (
        <div className="hud-equipment-dock" role="region" aria-label="Equipment & Checkpoint Dock">
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

          {activeCheckpoint !== null && (
            <SlotCard
              key={`checkpoint-slot-${activeCheckpoint.id}-${checkpointPulse}`}
              state="ready"
              icon="checkpoint"
              keyHint="C"
              badgeCount={typeof activeCheckpoint.id === 'number' ? activeCheckpoint.id : parseInt(String(activeCheckpoint.id), 10) || undefined}
              className={`hud-checkpoint-slot ${checkpointPulse > 0 ? 'hud-checkpoint-slot--pulse' : ''}`}
              aria-label={`Checkpoint ${activeCheckpoint.id} Active`}
            />
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
  const [gameState, setGameState] = useState<GameState>('PLAYING');

  useEffect(() => {
    const bus = GameEventBus.getInstance();
    const unsubState = bus.on('game:state', (newState) => {
      setGameState(newState);
    });
    return () => {
      unsubState();
    };
  }, []);

  return (
    <ToastProvider paused={gameState === 'PAUSED'}>
      <ReactOverlayContent gameState={gameState} />
    </ToastProvider>
  );
};
