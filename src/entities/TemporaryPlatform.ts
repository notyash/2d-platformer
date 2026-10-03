// src/entities/TemporaryPlatform.ts
import Phaser from 'phaser';
import { Player } from './Player';

export type TemporaryPlatformState = 'idle' | 'fading' | 'vanished';

export interface TemporaryPlatformConfig {
    scene: Phaser.Scene;
    mapObject?: any;
    x?: number;
    y?: number;
    direction?: number;
    distance?: number;
    speed?: number;
    canMove?: boolean;
    noFade?: boolean;
    fadeDurationMs?: number;
    respawnDelayMs?: number;
    axis?: 'x' | 'y';
}

export class TemporaryPlatform extends Phaser.Physics.Arcade.Sprite {
    public readonly startX: number;
    public readonly startY: number;
    public readonly minX: number;
    public readonly maxX: number;
    public readonly minY: number;
    public readonly maxY: number;
    public readonly speed: number;
    public readonly distance: number;
    public readonly initialDirection: 1 | -1;
    public readonly axis: 'x' | 'y';
    public readonly noFade: boolean;
    public readonly fadeDurationMs: number;
    public readonly respawnDelayMs: number;

    private currentDirection: 1 | -1;
    private platformState: TemporaryPlatformState = 'idle';
    private fadeTimers: Phaser.Time.TimerEvent[] = [];

    constructor(scene: Phaser.Scene, configOrMapObj: TemporaryPlatformConfig | any) {
        let config: TemporaryPlatformConfig;
        let mapObj: any = undefined;

        if (configOrMapObj && ('scene' in configOrMapObj || configOrMapObj.physics)) {
            config = configOrMapObj as TemporaryPlatformConfig;
            mapObj = config.mapObject;
        } else {
            config = { scene };
            mapObj = configOrMapObj;
        }

        const getProp = (keys: string[]): any => {
            if (!mapObj) return undefined;
            if (mapObj.properties && Array.isArray(mapObj.properties)) {
                for (const k of keys) {
                    const found = mapObj.properties.find((p: any) => p.name && p.name.toLowerCase() === k.toLowerCase());
                    if (found !== undefined) return found.value;
                }
            }
            for (const k of keys) {
                if (mapObj[k] !== undefined) return mapObj[k];
            }
            return undefined;
        };

        const parseBool = (keys: string[], defaultVal: boolean): boolean => {
            const raw = getProp(keys);
            if (raw === undefined || raw === null) return defaultVal;
            if (typeof raw === 'boolean') return raw;
            const str = String(raw).toLowerCase().trim();
            if (str === 'true' || str === '1') return true;
            if (str === 'false' || str === '0') return false;
            return defaultVal;
        };

        // Determine coordinates from mapObject (Tiled GID offset convention) or direct config
        const width = (mapObj && mapObj.width) || 64;
        const height = (mapObj && mapObj.height) || 32;
        let posX = config.x ?? (mapObj ? mapObj.x + width / 2 : 0);
        let posY = config.y ?? (mapObj ? (mapObj.gid ? mapObj.y - height / 2 : mapObj.y + height / 2) : 0);

        // Parse noFade
        const noFadeExplicit = parseBool(['nofade', 'permanent', 'solid', 'disablefade'], false);
        let noFade = noFadeExplicit;
        if (!noFadeExplicit) {
            const canFade = parseBool(['canfade', 'fading', 'disappear', 'istemporary', 'temporary'], true);
            noFade = !canFade;
        }
        if (config.noFade !== undefined) {
            noFade = config.noFade;
        }

        // Parse canMove
        let canMove = true;
        const staticProp = getProp(['isstatic', 'is_static', 'static']);
        if (staticProp !== undefined && staticProp !== null) {
            const val = String(staticProp).toLowerCase().trim();
            if (val === 'true' || val === '1') canMove = false;
        }
        const canMoveProp = getProp(['canmove', 'can_move', 'ismoving', 'is_moving', 'moving']);
        if (canMoveProp !== undefined && canMoveProp !== null) {
            const val = String(canMoveProp).toLowerCase().trim();
            if (val === 'false' || val === '0') canMove = false;
            else if (val === 'true' || val === '1') canMove = true;
        }
        if (config.canMove !== undefined) {
            canMove = config.canMove;
        }

        // Parse speed
        let speed = Number(config.speed ?? getProp(['speed', 'movespeed', 'velocity'])) || 0;
        if (!canMove) {
            speed = 0;
        }

        // Parse distance: values 1..15 are multiplied by 32 (tile width), values >= 16 are pixel distances
        const rawDist = Number(config.distance ?? getProp(['distance', 'movedistance', 'traveldistance', 'dist'])) || 0;
        const distance = (rawDist > 0 && rawDist <= 15) ? Math.round(rawDist * 32) : Math.abs(rawDist);

        // Parse direction: -1 = left / up, 1 = right / down
        const dirProp = config.direction ?? getProp(['direction', 'dir', 'initialdirection']);
        let platformDir: 1 | -1 = 1;
        if (dirProp !== undefined && dirProp !== null) {
            const val = String(dirProp).toLowerCase().trim();
            if (val === 'left' || val === '-1' || val === 'up') {
                platformDir = -1;
            } else if (val === 'right' || val === '1' || val === 'down') {
                platformDir = 1;
            } else {
                const num = Number(dirProp);
                if (!isNaN(num) && num < 0) {
                    platformDir = -1;
                } else if (!isNaN(num) && num > 0) {
                    platformDir = 1;
                }
            }
        }

        // Parse axis
        const axisRaw = String(config.axis ?? getProp(['axis', 'moveaxis']) ?? 'x').toLowerCase().trim();
        const axis: 'x' | 'y' = (axisRaw === 'y' || axisRaw === 'vertical' || axisRaw === 'up' || axisRaw === 'down') ? 'y' : 'x';

        // Parse durations
        const fadeDurationMs = Number(config.fadeDurationMs ?? getProp(['fadedurationms', 'fadeduration', 'standdurationms', 'standduration', 'duration', 'fadedelay'])) || 1000;
        const respawnDelayMs = Number(config.respawnDelayMs ?? getProp(['respawndelayms', 'respawndelay', 'cooldown', 'respawntime'])) || 2500;

        super(scene, posX, posY, 'temp-platforms', 3);
        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.startX = posX;
        this.startY = posY;
        this.speed = speed;
        this.distance = distance;
        this.initialDirection = platformDir;
        this.currentDirection = platformDir;
        this.axis = axis;
        this.noFade = noFade;
        this.fadeDurationMs = fadeDurationMs;
        this.respawnDelayMs = respawnDelayMs;

        // Calculate patrol bounds based on initial direction and distance
        if (axis === 'x') {
            if (platformDir === -1) {
                this.minX = this.startX - this.distance;
                this.maxX = this.startX;
            } else {
                this.minX = this.startX;
                this.maxX = this.startX + this.distance;
            }
            this.minY = this.startY;
            this.maxY = this.startY;
        } else {
            this.minX = this.startX;
            this.maxX = this.startX;
            if (platformDir === -1) {
                this.minY = this.startY - this.distance;
                this.maxY = this.startY;
            } else {
                this.minY = this.startY;
                this.maxY = this.startY + this.distance;
            }
        }

        this.setDepth(6);
        this.setOrigin(0.5, 0.5);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setAllowGravity(false);
            body.setImmovable(true);
            body.setFriction(1, 0);
            // Solid platform: collides on all 4 sides (player cannot jump through from below)
            body.checkCollision.none = false;
            body.checkCollision.up = true;
            body.checkCollision.down = true;
            body.checkCollision.left = true;
            body.checkCollision.right = true;
            body.setSize(46, 12);
            body.setOffset(9, 10);

            if (this.speed > 0 && this.distance > 0) {
                if (this.axis === 'y') {
                    body.setVelocityY(this.currentDirection * this.speed);
                } else {
                    body.setVelocityX(this.currentDirection * this.speed);
                }
            }
        }
    }

    /**
     * Updates movement patrol smoothly without coordinate snapping or teleporting.
     * Continues patrolling even while invisible/fading to preserve trajectory cycle.
     */
    public update(_time?: number, _delta?: number): void {
        if (!this.active) return;
        if (this.speed <= 0 || this.distance <= 0) return;

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        if (this.axis === 'x') {
            if (this.currentDirection > 0) {
                if (this.x >= this.maxX) {
                    this.currentDirection = -1;
                    body.setVelocityX(-this.speed);
                } else if (body.velocity.x <= 0) {
                    body.setVelocityX(this.speed);
                }
            } else {
                if (this.x <= this.minX) {
                    this.currentDirection = 1;
                    body.setVelocityX(this.speed);
                } else if (body.velocity.x >= 0) {
                    body.setVelocityX(-this.speed);
                }
            }
        } else {
            if (this.currentDirection > 0) {
                if (this.y >= this.maxY) {
                    this.currentDirection = -1;
                    body.setVelocityY(-this.speed);
                } else if (body.velocity.y <= 0) {
                    body.setVelocityY(this.speed);
                }
            } else {
                if (this.y <= this.minY) {
                    this.currentDirection = 1;
                    body.setVelocityY(this.speed);
                } else if (body.velocity.y >= 0) {
                    body.setVelocityY(-this.speed);
                }
            }
        }
    }

    /**
     * Handles collision with player.
     * If player lands on top of the platform, enables jump and begins fade sequence.
     */
    public handlePlayerCollision(player: Player): void {
        if (!this.active || this.platformState === 'vanished' || !this.visible) return;

        const pBody = player.body as Phaser.Physics.Arcade.Body;
        const platBody = this.body as Phaser.Physics.Arcade.Body;
        if (!pBody || !platBody) return;

        const isPlayerOnTop = pBody.bottom <= platBody.top + 8 &&
                              (pBody.velocity.y >= 0 || pBody.blocked.down || pBody.touching.down) &&
                              pBody.right > platBody.left + 2 &&
                              pBody.left < platBody.right - 2;

        if (isPlayerOnTop) {
            player.isOnPlatform = true;
            this.triggerFade();
        }
    }

    /**
     * Initiates progressive fade 3 -> 2 -> 1 -> 0 -> vanished -> respawn.
     */
    public triggerFade(): void {
        if (this.noFade || this.platformState !== 'idle' || !this.active) return;

        this.platformState = 'fading';
        this.clearTimers();

        const stepTime = Math.floor(this.fadeDurationMs / 4);

        this.fadeTimers.push(
            this.scene.time.delayedCall(stepTime, () => {
                if (!this.active || this.platformState !== 'fading') return;
                this.setFrame(2);
            })
        );

        this.fadeTimers.push(
            this.scene.time.delayedCall(stepTime * 2, () => {
                if (!this.active || this.platformState !== 'fading') return;
                this.setFrame(1);
            })
        );

        this.fadeTimers.push(
            this.scene.time.delayedCall(stepTime * 3, () => {
                if (!this.active || this.platformState !== 'fading') return;
                this.setFrame(0);
            })
        );

        this.fadeTimers.push(
            this.scene.time.delayedCall(this.fadeDurationMs, () => {
                if (!this.active || this.platformState !== 'fading') return;
                this.platformState = 'vanished';
                this.setVisible(false);

                const body = this.body as Phaser.Physics.Arcade.Body;
                if (body) {
                    body.checkCollision.none = true;
                }

                this.fadeTimers.push(
                    this.scene.time.delayedCall(this.respawnDelayMs, () => {
                        if (!this.active) return;
                        this.respawnPlatform();
                    })
                );
            })
        );
    }

    private respawnPlatform(): void {
        this.setFrame(3);
        this.setVisible(true);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.checkCollision.none = false;
            body.checkCollision.up = true;
            body.checkCollision.down = true;
            body.checkCollision.left = true;
            body.checkCollision.right = true;
        }
        this.platformState = 'idle';
    }

    private clearTimers(): void {
        for (const t of this.fadeTimers) {
            t.remove(false);
        }
        this.fadeTimers = [];
    }

    /**
     * Resets platform.
     * @param fullReset If true, snaps position back to startX, startY and restores initial direction.
     *                  If false (e.g. player died in arena), restores visible/solid state without snapping moving platforms.
     */
    public reset(fullReset: boolean = false): void {
        this.clearTimers();
        this.respawnPlatform();

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (!body) return;

        if (fullReset) {
            this.setPosition(this.startX, this.startY);
            this.currentDirection = this.initialDirection;
        }

        if (this.speed > 0 && this.distance > 0) {
            if (this.axis === 'y') {
                body.setVelocityY(this.currentDirection * this.speed);
            } else {
                body.setVelocityX(this.currentDirection * this.speed);
            }
        } else {
            body.setVelocity(0, 0);
        }
    }

    public getState(): TemporaryPlatformState {
        return this.platformState;
    }

    public isVanished(): boolean {
        return this.platformState === 'vanished';
    }

    public override destroy(fromScene?: boolean): void {
        this.clearTimers();
        super.destroy(fromScene);
    }
}
