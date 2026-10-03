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
import { VictoryModal } from './VictoryModal';
import { DebugReadout } from './DebugReadout';
import { UIKitShowcase } from './UIKitShowcase';
import { BossBar } from './kit/BossBar';
import { ProgressPips } from './kit/ProgressPips';
import { SlotCard } from './kit/SlotCard';
import { Panel } from './kit/Panel';
import { PromptChip } from './kit/PromptChip';
import { Icon } from './kit/Icon';
import { OrbCollectPopup } from './kit/OrbCollectPopup';
import { ToastProvider, useToast } from './kit/ToastContext';
import type { RestartPromptData, CheckpointState, DoorPromptData, BossAlertData, OrbCollectPopupData } from '../services/GameEventBus';

interface ReactOverlayContentProps {
  gameState: GameState;
}

const ReactOverlayContent: React.FC<ReactOverlayContentProps> = ({ gameState }) => {
  const { showToast, dismissToast } = useToast();
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
  const [doorPrompt, setDoorPrompt] = useState<DoorPromptData | null>(null);
  const [timeString, setTimeString] = useState<string>('00:00.00');
  const [activeCheckpoint, setActiveCheckpoint] = useState<CheckpointState | null>(null);
  const [checkpointPulse, setCheckpointPulse] = useState<number>(0);
  const [bossAlert, setBossAlert] = useState<BossAlertData | null>(null);
  const [orbPopups, setOrbPopups] = useState<OrbCollectPopupData[]>([]);
  const bossAlertTimerRef = React.useRef<number | null>(null);

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
    if (typeof window !== 'undefined') {
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

    const unsubDoor = bus.on('prompt:door', (data) => {
      setDoorPrompt(data);
    });

    const unsubTime = bus.on('time:tick', (t) => {
      setTimeString(t);
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

    const unsubDismissToast = bus.on('toast:dismiss', (id) => {
      dismissToast(id);
    });

    const unsubBossAlert = bus.on('boss:alert', (data) => {
      setBossAlert(data);
      if (bossAlertTimerRef.current) {
        window.clearTimeout(bossAlertTimerRef.current);
        bossAlertTimerRef.current = null;
      }
      if (data && data.durationMs) {
        bossAlertTimerRef.current = window.setTimeout(() => {
          setBossAlert(null);
          bossAlertTimerRef.current = null;
        }, data.durationMs);
      }
    });

    const unsubOrbPopup = bus.on('orb:collected-popup', (popupData) => {
      setOrbPopups((prev) => [...prev, popupData]);
      window.setTimeout(() => {
        setOrbPopups((prev) => prev.filter((p) => p.id !== popupData.id));
      }, 1800);
    });

    return () => {
      unsubStats();
      unsubBossHp();
      unsubBossPhase();
      unsubOrbs();
      unsubEquipment();
      unsubShieldHit();
      unsubRestartPrompt();
      unsubDoor();
      unsubTime();
      unsubCheckpoint();
      unsubToast();
      unsubDismissToast();
      unsubBossAlert();
      unsubOrbPopup();
      if (bossAlertTimerRef.current) {
        window.clearTimeout(bossAlertTimerRef.current);
        bossAlertTimerRef.current = null;
      }
    };
  }, [showToast, dismissToast]);

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

  const isMenuPaused = gameState === 'PAUSED' || gameState === 'VICTORY';

  return (
    <div
      className="react-ui-overlay"
      data-paused={isMenuPaused ? 'true' : 'false'}
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

            {bossAlert && (
              <div className="hud-boss-alert-container" role="status" aria-live="assertive">
                <Panel variant="crimson-border" className="hud-boss-alert-panel">
                  <Icon name="skull" size={20} className="hud-boss-alert-icon" />
                  <div className="hud-boss-alert-content">
                    <span className="hud-boss-alert-title">{bossAlert.title}</span>
                    {bossAlert.subtitle && (
                      <span className="hud-boss-alert-subtitle">{bossAlert.subtitle}</span>
                    )}
                  </div>
                </Panel>
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

      {/* Floating Door Interact Prompt Chip positioned directly above DoorZone */}
      {doorPrompt && doorPrompt.active && (
        <div
          className="door-prompt-world-wrapper"
          style={{
            left: `${doorPrompt.x}%`,
            top: `${doorPrompt.y}%`,
          }}
        >
          <PromptChip
            keyName="E"
            label="to enter"
            variant="crimson"
          />
        </div>
      )}

      {/* In-World UI Kit Orb Collection n/7 Popups */}
      {orbPopups.map((popup) => (
        <OrbCollectPopup
          key={popup.id}
          id={popup.id}
          current={popup.current}
          total={popup.total}
          x={popup.x}
          y={popup.y}
        />
      ))}

      {/* Pause Modal */}
      <PauseModal gameState={gameState} stats={stats} />

      {/* Victory Modal */}
      <VictoryModal gameState={gameState} stats={stats} timeString={timeString} />

      {/* Event Bus Debug Overlay (toggled with backtick `) */}
      <DebugReadout onOpenUIKit={() => setShowUIKit(true)} />

      {/* UI Kit Showcase Gallery (/ui-kit or toggled from debug readout) */}
      {showUIKit && <UIKitShowcase onClose={() => setShowUIKit(false)} />}
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
    <ToastProvider paused={gameState === 'PAUSED' || gameState === 'VICTORY'}>
      <ReactOverlayContent gameState={gameState} />
    </ToastProvider>
  );
};
