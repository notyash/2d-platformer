// src/managers/InventoryManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { SoundManager } from './SoundManager';

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

    // Dynamic Equipment Badges Container
    private hudContainer!: Phaser.GameObjects.Container;
    private gunBadgeContainer!: Phaser.GameObjects.Container;
    private totemBadgeContainer!: Phaser.GameObjects.Container;
    
    private gunText!: Phaser.GameObjects.Text;
    private totemText!: Phaser.GameObjects.Text;

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

        this.createEquipmentUI();
        this.saveCheckpointSnapshot();
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
        this.updateUI();
    }

    private createEquipmentUI() {
        this.hudContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(20);

        const badgeWidth = 158;
        const badgeHeight = 34;

        // Gun Badge Container
        this.gunBadgeContainer = this.scene.add.container(0, 0);
        const gunBg = this.scene.add.rectangle(0, 0, badgeWidth, badgeHeight, 0x0f172a, 0.85)
            .setStrokeStyle(1.5, 0x00FFFF, 0.9)
            .setOrigin(0.5);
        const gunIcon = this.scene.add.image(-badgeWidth / 2 + 18, 0, 'gun-powerup')
            .setDisplaySize(20, 20);
        this.gunText = this.scene.add.text(-badgeWidth / 2 + 34, 0, '[L-Click / Ctrl] Shoot', {
            fontSize: '11px', fontFamily: 'Arial', color: '#00FFFF', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.gunBadgeContainer.add([gunBg, gunIcon, this.gunText]);
        this.hudContainer.add(this.gunBadgeContainer);

        // Totem Badge Container
        this.totemBadgeContainer = this.scene.add.container(0, 0);
        const totemBg = this.scene.add.rectangle(0, 0, badgeWidth, badgeHeight, 0x0f172a, 0.85)
            .setStrokeStyle(1.5, 0xFFD700, 0.9)
            .setOrigin(0.5);
        const totemIcon = this.scene.add.image(-badgeWidth / 2 + 18, 0, 'totem')
            .setDisplaySize(20, 20);
        this.totemText = this.scene.add.text(-badgeWidth / 2 + 34, 0, 'Totem: ACTIVE', {
            fontSize: '11px', fontFamily: 'Arial', color: '#FFD700', fontStyle: 'bold'
        }).setOrigin(0, 0.5);

        this.totemBadgeContainer.add([totemBg, totemIcon, this.totemText]);
        this.hudContainer.add(this.totemBadgeContainer);

        this.updateUI();
    }

    public addGun() {
        this.gunCount = 1;
        this.player.hasGun = true;
        this.updatePlayerTint();
        this.soundManager?.playPowerup();
        this.updateUI();
    }

    public addTotem() {
        this.totemCount++;
        this.player.hasTotem = true;
        this.updatePlayerTint();
        this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'TOTEM SHIELD ACTIVATED!', '#FFD700', 1200);
        this.uiManager.spawnParticles(this.player.x, this.player.y, 0xFFD700);
        this.scene.cameras.main.shake(150, 0.006);
        this.soundManager?.playPowerup();
        this.updateUI();
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
        this.updateUI();
    }

    public disarmGun() {
        this.gunCount = 0;
        this.player.hasGun = false;
        this.updatePlayerTint();
        this.updateUI();
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

        this.updateUI();
    }

    private updatePlayerTint() {
        if (this.player.isInvincible) return;
        this.player.clearTint();
    }

    public update() {
        if (this.gunBadgeContainer && this.gunBadgeContainer.visible && this.player.hasGun) {
            const now = this.scene.time.now;
            const remaining = (this.player.lastShootTime + this.player.shootCooldownMs) - now;
            if (remaining > 0) {
                const secs = (remaining / 1000).toFixed(1);
                this.gunText.setText(`[Reloading ${secs}s]`);
                this.gunText.setColor('#94a3b8');
            } else {
                this.gunText.setText('[L-Click / Ctrl] Shoot');
                this.gunText.setColor('#00FFFF');
            }
        }
    }

    public updateUI() {
        const hasGun = Boolean(this.player.hasGun || this.gunCount > 0);
        const hasTotem = Boolean(this.player.hasTotem && this.totemCount > 0);

        const centerX = this.scene.scale.width / 2;
        const posY = this.scene.scale.height - 38;
        const badgeWidth = 148;
        const spacing = 12;

        if (hasGun && hasTotem) {
            this.gunBadgeContainer.setVisible(true).setPosition(centerX - (badgeWidth / 2) - (spacing / 2), posY);
            this.totemBadgeContainer.setVisible(true).setPosition(centerX + (badgeWidth / 2) + (spacing / 2), posY);
        } else if (hasGun) {
            this.gunBadgeContainer.setVisible(true).setPosition(centerX, posY);
            this.totemBadgeContainer.setVisible(false);
        } else if (hasTotem) {
            this.gunBadgeContainer.setVisible(false);
            this.totemBadgeContainer.setVisible(true).setPosition(centerX, posY);
        } else {
            this.gunBadgeContainer.setVisible(false);
            this.totemBadgeContainer.setVisible(false);
        }

        this.gunText.setText('[L-Click / Ctrl] Shoot');
        this.totemText.setText('Totem: ACTIVE');

        this.updatePlayerTint();
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
        this.updateUI();
    }
}
