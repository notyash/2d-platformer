// src/services/GameEventBus.ts

export interface GameStats {
  coins: number;
  kills: number;
  deaths: number;
}

export interface BossHpData {
  currentHp: number;
  maxHp: number;
  bossName: string;
  isVisible: boolean;
}

export interface BossPhaseData {
  phase: number;
  invulnerable: boolean;
}

export interface OrbsData {
  collected: number;
  total: number;
}

export type EquipmentSlotState = 'ready' | 'active' | 'cooldown' | 'disabled';

export interface EquipmentItem {
  acquired: boolean;
  count?: number;
  state: EquipmentSlotState;
  cooldownStartTime?: number;
  cooldownDurationMs?: number;
}

export interface EquipmentState {
  gun: EquipmentItem;
  totem: EquipmentItem;
}

export function normalizeEquipmentState(equip: EquipmentState): EquipmentState {
  const now = Date.now();
  const normalizeItem = (item: EquipmentItem): EquipmentItem => {
    if (
      item.state === 'cooldown' &&
      item.cooldownStartTime !== undefined &&
      item.cooldownDurationMs !== undefined &&
      item.cooldownStartTime + item.cooldownDurationMs <= now
    ) {
      return {
        ...item,
        state: 'ready',
        cooldownStartTime: undefined,
        cooldownDurationMs: undefined,
      };
    }
    return { ...item };
  };

  return {
    gun: normalizeItem(equip.gun),
    totem: normalizeItem(equip.totem),
  };
}

export type GameState = 'PLAYING' | 'PAUSED' | 'DEAD' | 'VICTORY';

export type GameAction = 
  | { type: 'RESUME_GAME' }
  | { type: 'PAUSE_GAME' }
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'RESPAWN_CHECKPOINT' }
  | { type: 'RESTART_RUN' }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'OPEN_LEADERBOARD' }
  | { type: 'CLOSE_MODAL' };

export interface ToastData {
  id?: string;
  title?: string;
  iconSrc?: string;
  icon?: string;
  keys?: string[];
  hint?: string;
  message?: string;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'victory';
  durationMs?: number;
}

export interface RestartPromptData {
  active: boolean;
  progress: number;
}

export interface CoinTargetData {
  x: number;
  y: number;
}

export interface OrbTargetData {
  pips: { x: number; y: number }[];
  center: { x: number; y: number };
}

export interface EventMap {
  'stats:changed': GameStats;
  'time:tick': string; // Formatted time string, throttled to ~10Hz
  'boss:hp': BossHpData;
  'boss:phase': BossPhaseData;
  'orbs:updated': OrbsData;
  'toast:show': ToastData;
  'equipment:changed': EquipmentState;
  'game:state': GameState;
  'action:trigger': GameAction;
  'checkpoint:status': boolean;
  'sound:status': boolean;
  'checkpoint:saved': { checkpointName: string; timestamp: number };
  'hud:coin-target': CoinTargetData;
  'hud:orb-target': OrbTargetData;
  'coin:bump': void;
  'boss:shield-hit': void;
  'prompt:restart': RestartPromptData;
}

type EventCallback<T> = (data: T) => void;

export class GameEventBus {
  private static instance: GameEventBus;
  private listeners: Map<keyof EventMap, Set<EventCallback<any>>> = new Map();

  // Cached state to ensure emit-on-change semantics
  private lastStats: GameStats = { coins: 0, kills: 0, deaths: 0 };
  private lastFormattedTime: string = '00:00.00';
  private lastTimeEmitMs: number = 0;
  private lastBossHp: BossHpData = { currentHp: 50, maxHp: 50, bossName: 'ELECKING', isVisible: false };
  private lastBossPhase: BossPhaseData = { phase: 1, invulnerable: true };
  private lastOrbs: OrbsData = { collected: 0, total: 0 };
  private lastEquipment: EquipmentState = {
    gun: { acquired: false, count: 0, state: 'disabled' },
    totem: { acquired: false, count: 0, state: 'disabled' },
  };
  private lastState: GameState = 'PLAYING';
  private lastCoinTarget: CoinTargetData = { x: 80, y: 30 };
  private lastOrbTarget: OrbTargetData = { pips: [], center: { x: 427, y: 55 } };
  private lastRestartPrompt: RestartPromptData = { active: false, progress: 0 };

  public static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
    }
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__GameEventBus = GameEventBus.instance;
    }
    return GameEventBus.instance;
  }

  public on<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Immediately deliver cached state upon subscription so late-mounting components receive latest values
    try {
      if (event === 'stats:changed') {
        callback(this.lastStats as EventMap[K]);
      } else if (event === 'boss:hp') {
        callback(this.lastBossHp as EventMap[K]);
      } else if (event === 'boss:phase') {
        callback(this.lastBossPhase as EventMap[K]);
      } else if (event === 'orbs:updated') {
        callback(this.lastOrbs as EventMap[K]);
      } else if (event === 'equipment:changed') {
        callback(this.getEquipment() as EventMap[K]);
      } else if (event === 'game:state') {
        callback(this.lastState as EventMap[K]);
      } else if (event === 'time:tick') {
        callback(this.lastFormattedTime as EventMap[K]);
      } else if (event === 'hud:coin-target') {
        callback(this.lastCoinTarget as EventMap[K]);
      } else if (event === 'hud:orb-target') {
        callback(this.lastOrbTarget as EventMap[K]);
      } else if (event === 'prompt:restart') {
        callback(this.lastRestartPrompt as EventMap[K]);
      }
    } catch (err) {
      console.error(`[GameEventBus] Error in initial cached callback for "${String(event)}":`, err);
    }

    // Return cleanup unsubscribe function
    return () => {
      this.off(event, callback);
    };
  }

  public off<K extends keyof EventMap>(event: K, callback: EventCallback<EventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const cb of Array.from(set)) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[GameEventBus] Error in handler for event "${String(event)}":`, err);
        }
      }
    }
  }

  public getStats(): GameStats {
    return { ...this.lastStats };
  }

  public getBossHp(): BossHpData {
    return { ...this.lastBossHp };
  }

  public getBossPhase(): BossPhaseData {
    return { ...this.lastBossPhase };
  }

  public getOrbs(): OrbsData {
    return { ...this.lastOrbs };
  }

  public getEquipment(): EquipmentState {
    return normalizeEquipmentState(this.lastEquipment);
  }

  public getGameState(): GameState {
    return this.lastState;
  }

  public getFormattedTime(): string {
    return this.lastFormattedTime;
  }

  /**
   * Emit equipment state only when slot presence, state, count, or cooldown changes
   */
  public emitEquipmentIfChanged(equipment: EquipmentState): void {
    const prev = this.lastEquipment;
    const changed =
      prev.gun.acquired !== equipment.gun.acquired ||
      prev.gun.state !== equipment.gun.state ||
      prev.gun.count !== equipment.gun.count ||
      prev.gun.cooldownStartTime !== equipment.gun.cooldownStartTime ||
      prev.gun.cooldownDurationMs !== equipment.gun.cooldownDurationMs ||
      prev.totem.acquired !== equipment.totem.acquired ||
      prev.totem.state !== equipment.totem.state ||
      prev.totem.count !== equipment.totem.count ||
      prev.totem.cooldownStartTime !== equipment.totem.cooldownStartTime ||
      prev.totem.cooldownDurationMs !== equipment.totem.cooldownDurationMs;

    if (changed) {
      this.lastEquipment = {
        gun: { ...equipment.gun },
        totem: { ...equipment.totem },
      };
      this.emit('equipment:changed', this.getEquipment());
    }
  }

  /**
   * Emit stats only when coin, kill, or death values change
   */
  public emitStatsIfChanged(stats: GameStats): void {
    if (
      stats.coins !== this.lastStats.coins ||
      stats.kills !== this.lastStats.kills ||
      stats.deaths !== this.lastStats.deaths
    ) {
      this.lastStats = { ...stats };
      this.emit('stats:changed', this.lastStats);
    }
  }

  /**
   * Emit time throttled to ~10Hz (100ms) or when value changed after interval
   */
  public emitTimeThrottled(formattedTime: string, nowMs: number = performance.now()): void {
    if (formattedTime !== this.lastFormattedTime && nowMs - this.lastTimeEmitMs >= 95) {
      this.lastFormattedTime = formattedTime;
      this.lastTimeEmitMs = nowMs;
      this.emit('time:tick', formattedTime);
    }
  }

  /**
   * Emit boss HP only on change
   */
  public emitBossHpIfChanged(bossData: BossHpData): void {
    if (
      bossData.currentHp !== this.lastBossHp.currentHp ||
      bossData.maxHp !== this.lastBossHp.maxHp ||
      bossData.isVisible !== this.lastBossHp.isVisible ||
      bossData.bossName !== this.lastBossHp.bossName
    ) {
      this.lastBossHp = { ...bossData };
      this.emit('boss:hp', this.lastBossHp);
    }
  }

  /**
   * Emit boss phase and invulnerability state only on change
   */
  public emitBossPhaseIfChanged(phaseData: BossPhaseData): void {
    if (
      phaseData.phase !== this.lastBossPhase.phase ||
      phaseData.invulnerable !== this.lastBossPhase.invulnerable
    ) {
      this.lastBossPhase = { ...phaseData };
      this.emit('boss:phase', this.lastBossPhase);
    }
  }

  /**
   * Emit orbs count only on change
   */
  public emitOrbsIfChanged(orbsData: OrbsData): void {
    if (
      orbsData.collected !== this.lastOrbs.collected ||
      orbsData.total !== this.lastOrbs.total
    ) {
      this.lastOrbs = { ...orbsData };
      this.emit('orbs:updated', this.lastOrbs);
    }
  }

  /**
   * Emit game state changed
   */
  public emitGameState(state: GameState): void {
    if (state !== this.lastState) {
      this.lastState = state;
      this.emit('game:state', state);
    }
  }

  /**
   * Emit HUD coin target position in game coordinates
   */
  public emitCoinTarget(target: CoinTargetData): void {
    this.lastCoinTarget = { ...target };
    this.emit('hud:coin-target', this.lastCoinTarget);
  }

  public getCoinTarget(): CoinTargetData {
    return { ...this.lastCoinTarget };
  }

  /**
   * Emit HUD orb pips target positions in game coordinates
   */
  public emitOrbTarget(target: OrbTargetData): void {
    this.lastOrbTarget = {
      pips: target.pips.map((p) => ({ ...p })),
      center: { ...target.center },
    };
    this.emit('hud:orb-target', this.lastOrbTarget);
  }

  public getOrbTarget(pipIndex?: number): { x: number; y: number } {
    if (pipIndex !== undefined && this.lastOrbTarget.pips && this.lastOrbTarget.pips[pipIndex]) {
      return { ...this.lastOrbTarget.pips[pipIndex] };
    }
    return { ...this.lastOrbTarget.center };
  }

  /**
   * Reset internal cache for clean run restart
   */
  public resetCache(): void {
    this.lastStats = { coins: 0, kills: 0, deaths: 0 };
    this.lastFormattedTime = '00:00.00';
    this.lastTimeEmitMs = 0;
    this.lastBossHp = { currentHp: 50, maxHp: 50, bossName: 'ELECKING', isVisible: false };
    this.lastBossPhase = { phase: 1, invulnerable: true };
    this.lastOrbs = { collected: 0, total: 0 };
    this.lastEquipment = {
      gun: { acquired: false, count: 0, state: 'disabled' },
      totem: { acquired: false, count: 0, state: 'disabled' },
    };
    this.lastState = 'PLAYING';
    this.lastCoinTarget = { x: 80, y: 30 };
    this.lastOrbTarget = { pips: [], center: { x: 427, y: 55 } };
    this.lastRestartPrompt = { active: false, progress: 0 };
    this.emit('prompt:restart', { active: false, progress: 0 });
  }
}
