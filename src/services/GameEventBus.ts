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

export interface EquipmentState {
  hasGun: boolean;
  gunCount: number;
  reloadRemainingMs: number;
  hasTotem: boolean;
  totemCount: number;
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
  title?: string;
  message: string;
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'victory';
  durationMs?: number;
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
  private lastState: GameState = 'PLAYING';

  public static getInstance(): GameEventBus {
    if (!GameEventBus.instance) {
      GameEventBus.instance = new GameEventBus();
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
      } else if (event === 'game:state') {
        callback(this.lastState as EventMap[K]);
      } else if (event === 'time:tick') {
        callback(this.lastFormattedTime as EventMap[K]);
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

  public getGameState(): GameState {
    return this.lastState;
  }

  public getFormattedTime(): string {
    return this.lastFormattedTime;
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
   * Reset internal cache for clean run restart
   */
  public resetCache(): void {
    this.lastStats = { coins: 0, kills: 0, deaths: 0 };
    this.lastFormattedTime = '00:00.00';
    this.lastTimeEmitMs = 0;
    this.lastBossHp = { currentHp: 50, maxHp: 50, bossName: 'ELECKING', isVisible: false };
    this.lastBossPhase = { phase: 1, invulnerable: true };
    this.lastOrbs = { collected: 0, total: 0 };
    this.lastState = 'PLAYING';
  }
}
