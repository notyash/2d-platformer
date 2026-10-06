// src/managers/CursorManager.ts
import { GameEventBus } from '../services/GameEventBus';

export interface CursorManagerOptions {
  idleTimeoutMs?: number;
  idleClassName?: string;
}

export class CursorManager {
  private static instance: CursorManager;
  private isIdleState = false;
  private isEnabledState = true;
  private isMouseDown = false;
  private idleTimeoutMs = 2000;
  private idleClassName = 'cursor-idle';
  private timer: number | null = null;
  private lastPos = { x: -1, y: -1 };
  private boundEvents: Array<[EventTarget, string, EventListener]> = [];

  private constructor() {}

  public static getInstance(): CursorManager {
    return (this.instance ??= new CursorManager());
  }

  public init(options?: CursorManagerOptions): void {
    if (typeof window === 'undefined' || this.boundEvents.length) return;
    if (options?.idleTimeoutMs !== undefined) this.idleTimeoutMs = options.idleTimeoutMs;
    if (options?.idleClassName !== undefined) this.idleClassName = options.idleClassName;

    const onActivity = (e: Event) => {
      if (!this.isEnabledState) return;

      if (e instanceof MouseEvent || e instanceof PointerEvent) {
        const isMove = e.type.includes('move');
        if (isMove && e.clientX === this.lastPos.x && e.clientY === this.lastPos.y && !e.movementX && !e.movementY) return;
        this.lastPos = { x: e.clientX, y: e.clientY };

        if (e.type.includes('down') || (typeof e.buttons === 'number' && e.buttons > 0)) {
          this.isMouseDown = true;
          this.showCursor(false);
          return;
        }
        if (e.type.includes('up')) {
          this.isMouseDown = false;
        }
      }

      this.isMouseDown = false;
      this.showCursor(true);
    };

    const add = (target: EventTarget, type: string, fn: EventListener) => {
      target.addEventListener(type, fn, { capture: true, passive: true });
      this.boundEvents.push([target, type, fn]);
    };

    ['mousemove', 'pointermove', 'mousedown', 'pointerdown', 'mouseup', 'pointerup', 'wheel'].forEach((t) => add(window, t, onActivity));
    add(document, 'mouseenter', onActivity);

    this.showCursor(true);
    (window as any).__CursorManager = this;
  }

  public destroy(): void {
    this.boundEvents.forEach(([target, type, fn]) => target.removeEventListener(type, fn, { capture: true } as any));
    this.boundEvents = [];
    this.showCursor(false);
  }

  public showCursor(scheduleCountdown = true): void {
    if (this.isIdleState) {
      this.isIdleState = false;
      document.documentElement.classList.remove(this.idleClassName);
      document.body.classList.remove(this.idleClassName);
      try {
        GameEventBus.getInstance().emit('cursor:idle', false);
      } catch {}
    }

    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }

    if (scheduleCountdown && this.isEnabledState && !this.isMouseDown) {
      this.timer = window.setTimeout(() => this.hideCursor(), this.idleTimeoutMs);
    }
  }

  public hideCursor(): void {
    if (!this.isEnabledState || this.isMouseDown || this.isIdleState) return;
    this.isIdleState = true;
    document.documentElement.classList.add(this.idleClassName);
    document.body.classList.add(this.idleClassName);
    try {
      GameEventBus.getInstance().emit('cursor:idle', true);
    } catch {}
  }

  public resetTimer(): void {
    this.showCursor(true);
  }

  public isIdle(): boolean {
    return this.isIdleState;
  }

  public isEnabled(): boolean {
    return this.isEnabledState;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabledState = enabled;
    this.showCursor(enabled);
  }

  public setIdleTimeout(timeoutMs: number): void {
    this.idleTimeoutMs = Math.max(200, timeoutMs);
    if (!this.isIdleState && this.isEnabledState) this.showCursor(true);
  }

  public getIdleTimeout(): number {
    return this.idleTimeoutMs;
  }
}
