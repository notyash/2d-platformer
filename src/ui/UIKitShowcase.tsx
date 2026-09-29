// src/ui/UIKitShowcase.tsx
import React, { useState } from 'react';
import {
  Panel,
  KeyCap,
  Icon,
  type IconName,
  SlotCard,
  type SlotCardState,
  ProgressPips,
  BossBar,
  useToast,
  ToastProvider,
} from './kit';
import './kit/kit.css';

const ALL_ICONS: IconName[] = [
  'coin',
  'sword',
  'skull',
  'volume',
  'volume-mute',
  'restart',
  'menu',
  'gun',
  'totem',
  'orb',
  'close',
  'check',
  'arrow-up',
  'arrow-down',
  'trophy',
];

const ShowcaseContent: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { showToast } = useToast();

  // State for SlotCard interactive testing
  const [slotState, setSlotState] = useState<SlotCardState>('ready');

  // State for ProgressPips
  const [pipFilled, setPipFilled] = useState<number>(3);
  const totalPips = 5;

  // State for BossBar
  const [bossHp, setBossHp] = useState<number>(38);
  const [bossVisible, setBossVisible] = useState<boolean>(true);
  const [bossPhase, setBossPhase] = useState<number>(1);
  const [bossInvulnerable, setBossInvulnerable] = useState<boolean>(true);
  const [bossShowTicks, setBossShowTicks] = useState<boolean>(false);

  // State for KeyCap pressed
  const [isKeyPressed, setIsKeyPressed] = useState<boolean>(false);

  const triggerCooldown = () => {
    setSlotState('cooldown');
    setTimeout(() => {
      setSlotState('ready');
    }, 2000);
  };

  return (
    <div className="ui-kit-showcase-backdrop react-interactive">
      <div className="ui-kit-showcase-container">
        {/* Header */}
        <div className="ui-kit-header">
          <div>
            <span className="modal-kanji-tag">神月 UI KIT</span>
            <h1 className="ui-kit-title">KamiZuki Shared Component Kit</h1>
            <p className="ui-kit-subtitle">Dev-Only Interactive Component Showcase & Token Verification</p>
          </div>
          {onClose && (
            <button type="button" className="ui-kit-close-btn" onClick={onClose} aria-label="Close Showcase">
              <Icon name="close" size={20} />
            </button>
          )}
        </div>

        <div className="ui-kit-grid">
          {/* Section 1: Icons */}
          <Panel variant="crimson-border" className="ui-kit-section">
            <h2 className="ui-kit-section-title">
              <Icon name="sword" size={16} /> 1. Thin-Line SVG Icons
            </h2>
            <div className="ui-kit-icons-grid">
              {ALL_ICONS.map((name) => (
                <div key={name} className="ui-kit-icon-cell" title={name}>
                  <Icon name={name} size={22} />
                  <span className="ui-kit-icon-label">{name}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Section 2: KeyCaps */}
          <Panel variant="default" className="ui-kit-section">
            <h2 className="ui-kit-section-title">
              <Icon name="check" size={16} /> 2. KeyCap Badges
            </h2>
            <div className="ui-kit-row">
              <div className="ui-kit-item-group">
                <span className="ui-kit-label">Small:</span>
                <KeyCap size="sm">E</KeyCap>
                <KeyCap size="sm">SPACE</KeyCap>
                <KeyCap size="sm">ESC</KeyCap>
              </div>
              <div className="ui-kit-item-group">
                <span className="ui-kit-label">Medium:</span>
                <KeyCap size="md">WASD</KeyCap>
                <KeyCap size="md">ENTER</KeyCap>
                <KeyCap size="md" isPressed={isKeyPressed}>
                  {isKeyPressed ? 'PRESSED' : 'CLICK ME'}
                </KeyCap>
              </div>
              <button
                type="button"
                className="hud-btn hud-btn-outline"
                onClick={() => setIsKeyPressed((p) => !p)}
              >
                Toggle Pressed State
              </button>
            </div>
          </Panel>

          {/* Section 3: Panels */}
          <div className="ui-kit-section-full">
            <h2 className="ui-kit-section-title">3. Panel Variants</h2>
            <div className="ui-kit-panels-row">
              <Panel variant="default" className="ui-kit-panel-demo">
                <strong>Variant: Default</strong>
                <p>Dark navy surface with subtle border.</p>
              </Panel>
              <Panel variant="crimson-border" className="ui-kit-panel-demo">
                <strong>Variant: Crimson Border</strong>
                <p>Crimson accent border with crimson glow shadow.</p>
              </Panel>
              <Panel variant="parchment" className="ui-kit-panel-demo">
                <strong>Variant: Parchment</strong>
                <p>Gold parchment card aesthetic with inset glow.</p>
              </Panel>
            </div>
          </div>

          {/* Section 4: SlotCard */}
          <Panel variant="crimson-border" className="ui-kit-section">
            <h2 className="ui-kit-section-title">
              <Icon name="gun" size={16} /> 4. SlotCard Equipment Slots (With & Without KeyHint)
            </h2>
            <div className="ui-kit-row" style={{ alignItems: 'flex-start' }}>
              <div className="ui-kit-slot-demo">
                <span className="ui-kit-label">With KeyHint (Totem):</span>
                <SlotCard
                  state={slotState}
                  keyHint="E"
                  badgeCount={1}
                  cooldownDurationMs={2000}
                >
                  <img
                    src="/assets/sprites/collectibles/frog_doll_totem.png"
                    alt="Totem"
                    width={26}
                    height={26}
                    style={{ imageRendering: 'pixelated' }}
                  />
                </SlotCard>
              </div>
              <div className="ui-kit-slot-demo">
                <span className="ui-kit-label">No KeyHint (Gun):</span>
                <SlotCard state="ready">
                  <img
                    src="/assets/sprites/collectibles/gun_sprite.png"
                    alt="Gun"
                    width={26}
                    height={26}
                    style={{ imageRendering: 'pixelated' }}
                  />
                </SlotCard>
              </div>
              <div className="ui-kit-slot-demo">
                <span className="ui-kit-label">Active (Glow):</span>
                <SlotCard state="active" icon="orb" keyHint="C" />
              </div>
              <div className="ui-kit-slot-demo">
                <span className="ui-kit-label">Empty:</span>
                <SlotCard state="empty" />
              </div>
              <div className="ui-kit-slot-demo">
                <span className="ui-kit-label">Disabled:</span>
                <SlotCard state="disabled" icon="gun" keyHint="E" />
              </div>
            </div>
            <div className="ui-kit-controls-row">
              <button type="button" className="hud-btn hud-btn-crimson" onClick={triggerCooldown}>
                Trigger 2s Cooldown
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-outline"
                onClick={() =>
                  setSlotState((s) => (s === 'ready' ? 'active' : s === 'active' ? 'disabled' : 'ready'))
                }
              >
                Cycle State ({slotState})
              </button>
            </div>
          </Panel>

          {/* Section 5: ProgressPips */}
          <Panel variant="default" className="ui-kit-section">
            <h2 className="ui-kit-section-title">
              <Icon name="orb" size={16} /> 5. ProgressPips (Completion Flash)
            </h2>
            <div className="ui-kit-row">
              <div className="ui-kit-pip-group">
                <span className="ui-kit-label">Crimson:</span>
                <ProgressPips total={totalPips} filled={pipFilled} variant="crimson" size="md" />
              </div>
              <div className="ui-kit-pip-group">
                <span className="ui-kit-label">Gold:</span>
                <ProgressPips total={totalPips} filled={pipFilled} variant="gold" size="md" />
              </div>
              <div className="ui-kit-pip-group">
                <span className="ui-kit-label">Cyan:</span>
                <ProgressPips total={totalPips} filled={pipFilled} variant="cyan" size="lg" />
              </div>
            </div>
            <div className="ui-kit-controls-row">
              <button
                type="button"
                className="hud-btn hud-btn-outline"
                onClick={() => setPipFilled((p) => Math.max(0, p - 1))}
              >
                - Pip ({pipFilled}/{totalPips})
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-crimson"
                onClick={() => setPipFilled((p) => Math.min(totalPips, p + 1))}
              >
                + Pip ({pipFilled}/{totalPips})
              </button>
              <button
                type="button"
                className="hud-btn hud-btn-outline"
                onClick={() => setPipFilled(totalPips)}
              >
                Fill 100% (Flash)
              </button>
            </div>
          </Panel>

          {/* Section 6: BossBar */}
          <div className="ui-kit-section-full">
            <Panel variant="crimson-border" style={{ padding: '20px' }}>
              <h2 className="ui-kit-section-title">
                <Icon name="skull" size={16} /> 6. BossBar (Shielded, Phase Badge & Shield Break)
              </h2>
              <div style={{ margin: '20px 0' }}>
                <BossBar
                  name="AKUMA • ELECKING"
                  hp={bossHp}
                  maxHp={50}
                  phase={bossPhase}
                  invulnerable={bossInvulnerable}
                  showPhaseTicks={bossShowTicks}
                  visible={bossVisible}
                  sealText="神月"
                />
              </div>
              <div className="ui-kit-controls-row" style={{ alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                  HP: {bossHp}/50
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={bossHp}
                    onChange={(e) => setBossHp(Number(e.target.value))}
                    style={{ cursor: 'pointer' }}
                  />
                </label>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() => {
                    setBossInvulnerable((inv) => !inv);
                    if (bossInvulnerable) {
                      setBossPhase(2);
                    } else {
                      setBossPhase(1);
                    }
                  }}
                >
                  {bossInvulnerable ? 'Break Shield (Phase II)' : 'Shield Boss (Phase I)'}
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() => setBossPhase((p) => (p === 1 ? 2 : 1))}
                >
                  Phase: {bossPhase === 1 ? 'I' : 'II'}
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() => setBossShowTicks((t) => !t)}
                >
                  Ticks: {bossShowTicks ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() => setBossVisible((v) => !v)}
                >
                  {bossVisible ? 'Hide BossBar' : 'Show BossBar'}
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-crimson"
                  onClick={() => setBossHp((h) => Math.max(0, h - 10))}
                >
                  -10 HP (Ghost Bar)
                </button>
              </div>
            </Panel>
          </div>

          {/* Section 7: Toast Notifications */}
          <div className="ui-kit-section-full">
            <Panel variant="parchment" style={{ padding: '20px' }}>
              <h2 className="ui-kit-section-title">
                <Icon name="trophy" size={16} /> 7. Toast Notifications (Structured Sprite & KeyCaps)
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--parchment-dim)', marginBottom: '12px' }}>
                Trigger accessible, structured notifications with item pixel sprites, multiple KeyCaps, and hint text.
              </p>
              <div className="ui-kit-controls-row">
                <button
                  type="button"
                  className="hud-btn hud-btn-crimson"
                  onClick={() =>
                    showToast({
                      title: 'GUN ACQUIRED',
                      iconSrc: '/assets/sprites/collectibles/gun_sprite.png',
                      keys: ['CTRL', 'L-CLICK'],
                      hint: 'to shoot',
                      variant: 'info',
                    })
                  }
                >
                  Gun Pickup Toast
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() =>
                    showToast({
                      title: 'TOTEM ACQUIRED',
                      iconSrc: '/assets/sprites/collectibles/frog_doll_totem.png',
                      keys: ['E'],
                      hint: 'to activate the shield',
                      variant: 'success',
                    })
                  }
                >
                  Totem Pickup Toast
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-outline"
                  onClick={() =>
                    showToast({
                      title: 'CHECKPOINT',
                      message: 'Checkpoint registered at Shrine Gate.',
                      variant: 'info',
                    })
                  }
                >
                  Info Toast
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-restart"
                  onClick={() =>
                    showToast({
                      title: 'BOSS INVULNERABLE',
                      message: 'Collect all 7 Gravity Orbs to break the barrier!',
                      variant: 'danger',
                    })
                  }
                >
                  Boss Shield Toast
                </button>
                <button
                  type="button"
                  className="hud-btn hud-btn-crimson"
                  onClick={() =>
                    showToast({
                      title: 'STAGE COMPLETE',
                      message: 'New best time: 01:24.80!',
                      variant: 'victory',
                    })
                  }
                >
                  Victory Toast
                </button>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
};

export const UIKitShowcase: React.FC<{ onClose?: () => void }> = (props) => {
  return (
    <ToastProvider>
      <ShowcaseContent {...props} />
    </ToastProvider>
  );
};
