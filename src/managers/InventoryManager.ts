// src/managers/InventoryManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { SoundManager } from './SoundManager';
import { GameEventBus, type EquipmentSlotState } from '../services/GameEventBus';

import { TOKENS } from '../theme/tokens';

export class InventoryManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private soundManager?: SoundManager;

    public gunCount: number = 0;
    public totemCount: number = 0;

    // Checkpoint Snapshots
    private savedCheckpointGunCount: number = 0;
    private savedCheckpointTotemCount: number = 0;
    private savedCheckpointHasGun: boolean = false;
    private savedCheckpointHasTotem: boolean = false;

    // Phaser-governed timers for pause-aware equipment state transitions
    private gunShotTimer?: Phaser.Time.TimerEvent;
    private gunCooldownTimer?: Phaser.Time.TimerEvent;

    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        uiManager: UIManager, 
        soundManager?: SoundManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.soundManager = soundManager;

        this.saveCheckpointSnapshot();
        this.syncEquipment();
    }

    public saveCheckpointSnapshot() {
        this.savedCheckpointGunCount = this.gunCount;
        this.savedCheckpointTotemCount = this.totemCount;
        this.savedCheckpointHasGun = this.player.hasGun;
        this.savedCheckpointHasTotem = this.player.hasTotem;
    }

    public rollbackToCheckpoint() {
        this.gunCount = this.savedCheckpointGunCount;
        this.totemCount = this.savedCheckpointTotemCount;
        this.player.hasGun = this.savedCheckpointHasGun;
        this.player.hasTotem = this.savedCheckpointHasTotem;
        this.syncEquipment();
    }

    public syncEquipment(gunCooldown?: { startTime: number; durationMs: number }) {
        const hasGun = Boolean(this.player.hasGun || this.gunCount > 0);
        const hasTotem = Boolean(this.player.hasTotem && this.totemCount > 0);

        const gunState: EquipmentSlotState = !hasGun
            ? 'disabled'
            : gunCooldown
            ? 'cooldown'
            : 'ready';

        const totemState: EquipmentSlotState = !hasTotem
            ? 'disabled'
            : this.player.hasTotem
            ? 'active'
            : 'ready';

        GameEventBus.getInstance().emitEquipmentIfChanged({
            gun: {
                acquired: hasGun,
                count: this.gunCount,
                state: gunState,
                cooldownStartTime: gunCooldown?.startTime,
                cooldownDurationMs: gunCooldown?.durationMs,
            },
            totem: {
                acquired: hasTotem,
                count: this.totemCount,
                state: totemState,
            },
        });
    }

    public onGunFired(_startTime?: number, _durationMs?: number) {
        const hasGun = Boolean(this.player.hasGun || this.gunCount > 0);
        if (!hasGun) return;

        const hasTotem = Boolean(this.player.hasTotem && this.totemCount > 0);
        const totemState: EquipmentSlotState = !hasTotem
            ? 'disabled'
            : this.player.hasTotem
            ? 'active'
            : 'ready';

        // Plain gun shot: brief pulse on the slot instead of rapid sweep ring
        GameEventBus.getInstance().emitEquipmentIfChanged({
            gun: {
                acquired: true,
                count: this.gunCount,
                state: 'active',
            },
            totem: {
                acquired: hasTotem,
                count: this.totemCount,
                state: totemState,
            },
        });

        // Cooldown end is governed by Phaser scene timer so it pauses with game pause
        this.gunShotTimer?.remove();
        this.gunShotTimer = this.scene.time.delayedCall(120, () => {
            this.syncEquipment();
        });
    }

    public triggerGunCooldown(startTime: number, durationMs: number) {
        this.syncEquipment({ startTime, durationMs });
        this.gunCooldownTimer?.remove();
        this.gunCooldownTimer = this.scene.time.delayedCall(durationMs, () => {
            this.syncEquipment();
        });
    }

    public addGun() {
        this.gunCount = 1;
        this.player.hasGun = true;
        this.updatePlayerTint();
        this.soundManager?.playPowerup();
        this.syncEquipment();

        // Structured control hint toast on pickup (ephemeral, not cached/replayed)
        GameEventBus.getInstance().emit('toast:show', {
            id: 'gun-acquired',
            title: 'GUN ACQUIRED',
            iconSrc: '/assets/sprites/collectibles/gun_sprite.png',
            keys: ['CTRL', 'L-CLICK'],
            hint: 'to shoot',
            variant: 'info',
            durationMs: 3500,
        });
    }

    public addTotem() {
        this.totemCount++;
        this.player.hasTotem = true;
        this.updatePlayerTint();
        const goldColor = parseInt(TOKENS.colors.gold.replace('#', '0x'), 16);
        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'TOTEM SHIELD ACTIVATED!', TOKENS.colors.gold, 1200);
        this.uiManager.spawnParticles(this.player.x, this.player.y, goldColor);
        this.scene.cameras.main.shake(150, 0.006);
        this.soundManager?.playPowerup();
        this.syncEquipment();

        // Structured control hint toast on pickup (ephemeral, not cached/replayed)
        GameEventBus.getInstance().emit('toast:show', {
            id: 'totem-acquired',
            title: 'TOTEM ACQUIRED',
            iconSrc: '/assets/sprites/collectibles/frog_doll_totem.png',
            keys: ['E'],
            hint: 'to activate the shield',
            variant: 'success',
            durationMs: 3500,
        });
    }

    public consumeTotem() {
        this.totemCount = 0;
        this.player.hasTotem = false;
        this.savedCheckpointTotemCount = 0;
        this.savedCheckpointHasTotem = false;
        if ((this.scene as any).collectiblesManager) {
            (this.scene as any).collectiblesManager.onTotemConsumed();
        }
        this.updatePlayerTint();
        this.syncEquipment();
    }

    public disarmGun() {
        this.gunCount = 0;
        this.player.hasGun = false;
        this.updatePlayerTint();
        this.syncEquipment();
    }

    public activateShield() {
        if (this.player.isDying || this.player.isTeleporting) return;

        if (!this.player.hasTotem && this.totemCount > 0) {
            this.player.hasTotem = true;
            this.updatePlayerTint();
            this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'TOTEM SHIELD ACTIVATED!', '#FFD700', 1200);
            this.uiManager.spawnParticles(this.player.x, this.player.y, 0xFFD700);
            this.scene.cameras.main.shake(150, 0.006);
            this.soundManager?.playPowerup();
        }

        this.syncEquipment();
    }

    private updatePlayerTint() {
        if (this.player.isInvincible) return;
        this.player.clearTint();
    }

    public update() {
        // Pure CSS & GameEventBus drive equipment state and cooldown rings
    }

    public updateUI() {
        this.syncEquipment();
    }

    public resetAll() {
        this.gunCount = 0;
        this.totemCount = 0;
        this.savedCheckpointGunCount = 0;
        this.savedCheckpointTotemCount = 0;
        this.savedCheckpointHasGun = false;
        this.savedCheckpointHasTotem = false;
        this.player.hasGun = false;
        this.player.hasTotem = false;
        this.player.clearTint();
        this.syncEquipment();
    }
}
