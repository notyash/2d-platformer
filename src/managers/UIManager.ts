import Phaser from 'phaser';
import { SoundManager } from './SoundManager';
import { LeaderboardManager } from './LeaderboardManager';
import { GameEventBus } from '../services/GameEventBus';
import { TOKENS } from '../theme/tokens';

export interface MenuOption {
    id: string;
    label: string;
    action: () => void;
}

export class UIManager {
    private scene: Phaser.Scene;
    private soundManager?: SoundManager;
    private hudText?: Phaser.GameObjects.Text;
    private activeFlyingCoins: Phaser.GameObjects.Sprite[] = [];
    
    // Pause Menu Container & State
    private pauseContainer?: Phaser.GameObjects.Container;
    public soundEnabled: boolean = true;
    public isPauseMenuOpen: boolean = false;
    
    // Death Screen Container & State
    private deathContainer?: Phaser.GameObjects.Container;
    public isDeathScreenOpen: boolean = false;
    private selectedDeathIndex: number = 0;
    private deathOptions: MenuOption[] = [];
    private deathButtonBoxes: Phaser.GameObjects.Rectangle[] = [];
    private deathButtonLabels: Phaser.GameObjects.Text[] = [];
    private deathHighlight?: Phaser.GameObjects.Graphics;

    // Victory Menu Container & State
    private victoryContainer?: Phaser.GameObjects.Container;
    public isVictoryMenuOpen: boolean = false;
    private selectedVictoryIndex: number = 0;
    private victoryOptions: MenuOption[] = [];
    private victoryButtonBoxes: Phaser.GameObjects.Rectangle[] = [];
    private victoryButtonLabels: Phaser.GameObjects.Text[] = [];
    private victoryHighlight?: Phaser.GameObjects.Graphics;
    private victorySoundLabelRef?: Phaser.GameObjects.Text;
    private victoryStartBtnY = 210;
    private readonly victoryBtnGap = 44;
    private readonly victoryBtnWidth = 300;
    private readonly victoryBtnHeight = 36;
    private get victoryModalX(): number { return this.scene.scale.width / 2; }
    private get victoryModalY(): number { return this.scene.scale.height / 2; }

    private get deathModalX(): number { return this.scene.scale.width / 2; }
    private get deathModalY(): number { return this.scene.scale.height / 2; }
    private readonly deathBtnY = 292;
    private readonly deathBtnWidth = 320;
    private readonly deathBtnHeight = 44;

    constructor(scene: Phaser.Scene, soundManager?: SoundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
        
        // Global Keyboard Event Listener
        window.addEventListener('keydown', this.handleGlobalKeyDown, { capture: true });
        
        // Global Pointer Move & Down Listeners (Screen coordinates immune to camera scrolling)
        this.scene.input.on('pointermove', this.handlePointerMove);
        this.scene.input.on('pointerdown', this.handlePointerDown);

        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
            window.removeEventListener('keydown', this.handleGlobalKeyDown, { capture: true });
            this.scene.input.off('pointermove', this.handlePointerMove);
            this.scene.input.off('pointerdown', this.handlePointerDown);
        });
    }

    private handlePointerMove = (pointer: Phaser.Input.Pointer) => {
        if (this.isVictoryMenuOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.victoryBtnWidth / 2;
            const halfH = this.victoryBtnHeight / 2;

            for (let i = 0; i < this.victoryOptions.length; i++) {
                const btnY = this.victoryStartBtnY + (i * this.victoryBtnGap);
                if (
                    px >= this.victoryModalX - halfW && px <= this.victoryModalX + halfW &&
                    py >= btnY - halfH && py <= btnY + halfH
                ) {
                    if (this.selectedVictoryIndex !== i) {
                        this.selectedVictoryIndex = i;
                        this.soundManager?.playMenuSelect();
                        this.updateVictoryVisuals();
                    }
                    break;
                }
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.deathBtnWidth / 2;
            const halfH = this.deathBtnHeight / 2;

            if (
                px >= this.deathModalX - halfW && px <= this.deathModalX + halfW &&
                py >= this.deathBtnY - halfH && py <= this.deathBtnY + halfH
            ) {
                if (this.selectedDeathIndex !== 0) {
                    this.selectedDeathIndex = 0;
                    this.soundManager?.playMenuSelect();
                    this.updateDeathVisuals();
                }
            }
        }
    };

    private handlePointerDown = (pointer: Phaser.Input.Pointer) => {
        if (this.isVictoryMenuOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.victoryBtnWidth / 2;
            const halfH = this.victoryBtnHeight / 2;

            for (let i = 0; i < this.victoryOptions.length; i++) {
                const btnY = this.victoryStartBtnY + (i * this.victoryBtnGap);
                if (
                    px >= this.victoryModalX - halfW && px <= this.victoryModalX + halfW &&
                    py >= btnY - halfH && py <= btnY + halfH
                ) {
                    this.selectedVictoryIndex = i;
                    this.triggerCurrentVictoryOption();
                    break;
                }
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const px = pointer.x;
            const py = pointer.y;
            const halfW = this.deathBtnWidth / 2;
            const halfH = this.deathBtnHeight / 2;

            if (
                px >= this.deathModalX - halfW && px <= this.deathModalX + halfW &&
                py >= this.deathBtnY - halfH && py <= this.deathBtnY + halfH
            ) {
                this.selectedDeathIndex = 0;
                this.triggerCurrentDeathOption();
            }
        }
    };

    private handleGlobalKeyDown = (event: KeyboardEvent) => {
        if (this.isVictoryMenuOpen) {
            const key = event.code;
            if (key === 'ArrowUp' || key === 'KeyW') {
                event.preventDefault();
                event.stopPropagation();
                this.selectedVictoryIndex = (this.selectedVictoryIndex - 1 + this.victoryOptions.length) % this.victoryOptions.length;
                this.soundManager?.playMenuSelect();
                this.updateVictoryVisuals();
            } else if (key === 'ArrowDown' || key === 'KeyS') {
                event.preventDefault();
                event.stopPropagation();
                this.selectedVictoryIndex = (this.selectedVictoryIndex + 1) % this.victoryOptions.length;
                this.soundManager?.playMenuSelect();
                this.updateVictoryVisuals();
            } else if (key === 'Enter' || key === 'Space') {
                event.preventDefault();
                event.stopPropagation();
                this.triggerCurrentVictoryOption();
            }
            return;
        }

        if (this.isDeathScreenOpen) {
            const key = event.code;
            if (key === 'Enter' || key === 'Space') {
                event.preventDefault();
                event.stopPropagation();
                this.triggerCurrentDeathOption();
            }
        }
    };

    createHUD(_onPauseToggle?: () => void, _onRestartRun?: () => void) {
        // Visual HUD and Boss Bar now handled exclusively by KamiZuki React HUD / BossBar
    }

    public showBossHealthBar(bossName: string = 'ELECKING', maxHp: number = 50, currentHp: number = 50) {
        const cleanName = bossName.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}⚡]/gu, '').trim().toUpperCase() || 'ELECKING';
        GameEventBus.getInstance().emitBossHpIfChanged({ currentHp, maxHp, bossName: cleanName, isVisible: true });
    }

    public updateBossHealthBar(currentHp: number, maxHp: number = 50) {
        const safeHp = Math.max(0, currentHp);
        GameEventBus.getInstance().emitBossHpIfChanged({ currentHp: safeHp, maxHp, bossName: 'ELECKING', isVisible: true });
    }

    public hideBossHealthBar() {
        GameEventBus.getInstance().emitBossHpIfChanged({ currentHp: 0, maxHp: 50, bossName: 'ELECKING', isVisible: false });
    }

    updateHUD(formattedTime: string, coins: number, kills: number, deaths: number) {
        if (this.hudText) {
            this.hudText.setText(`TIME: ${formattedTime}   |   DEATHS: ${deaths}   |   COINS: ${coins}   |   KILLS: ${kills}`);
        }
        GameEventBus.getInstance().emitTimeThrottled(formattedTime);
        GameEventBus.getInstance().emitStatsIfChanged({ coins, kills, deaths });
    }

    showFloatingText(x: number, y: number, message: string, color: string, duration: number = 800, distance: number = 40) {
        const floatText = this.scene.add.text(x, y, message, { 
            fontSize: '18px', fontFamily: 'Arial', color: color, stroke: '#000000', strokeThickness: 4, fontStyle: 'bold' 
        }).setOrigin(0.5).setDepth(30);

        if (duration > 1200) {
            floatText.setScale(0.85);
            this.scene.tweens.add({
                targets: floatText,
                scale: 1.1,
                duration: 200,
                yoyo: true,
                repeat: 0,
                ease: 'Back.easeOut'
            });

            this.scene.tweens.add({
                targets: floatText,
                y: y - distance,
                duration: duration * 0.4,
                ease: 'Cubic.easeOut',
                onComplete: () => {
                    this.scene.tweens.add({
                        targets: floatText,
                        alpha: 0,
                        duration: duration * 0.6,
                        ease: 'Linear',
                        onComplete: () => floatText.destroy()
                    });
                }
            });
        } else {
            this.scene.tweens.add({ 
                targets: floatText, y: y - distance, alpha: 0, duration: duration, ease: 'Cubic.easeOut', 
                onComplete: () => floatText.destroy() 
            });
        }
    }

    spawnParticles(x: number, y: number, color: number) {
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;
        const particles = this.scene.add.particles(x, y, 'particle', { 
            speed: { min: 50, max: 150 }, scale: { start: 1, end: 0 }, tint: color, lifespan: 600, blendMode: 'ADD', emitting: false 
        });
        particles.setDepth(25); 
        particles.explode(15);
        this.scene.time.delayedCall(700, () => {
            if (particles && particles.active) particles.destroy();
        });
    }

    public spawnCoinSparkles(x: number, y: number) {
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;
        const goldColor = parseInt(TOKENS.colors.gold.replace('#', '0x'), 16);
        const count = Phaser.Math.Between(3, 5);
        const particles = this.scene.add.particles(x, y, 'particle', {
            speed: { min: 30, max: 80 },
            scale: { start: 0.8, end: 0 },
            tint: goldColor,
            lifespan: 350,
            blendMode: 'ADD',
            emitting: false
        });
        particles.setDepth(25);
        particles.explode(count);
        this.scene.time.delayedCall(400, () => {
            if (particles && particles.active) particles.destroy();
        });
    }

    public playCoinPickupEffect(worldX: number, worldY: number, _amount: number = 1) {
        if (worldX === undefined || worldY === undefined || isNaN(worldX) || isNaN(worldY)) return;

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            GameEventBus.getInstance().emit('coin:bump', undefined);
            return;
        }

        // 1. Burst 3-5 gold sparkle pixels at pickup point
        this.spawnCoinSparkles(worldX, worldY);

        // 2. Cap at 8 active flying coins simultaneously (extra coins skip flight and directly trigger bump)
        const currentFlyingCount = this.activeFlyingCoins.filter(s => s && s.active).length;
        if (currentFlyingCount >= 8) {
            GameEventBus.getInstance().emit('coin:bump', undefined);
            return;
        }

        // 3. Screen space sprite (scrollFactor 0) so flight pauses with the game on the Phaser clock
        const camera = this.scene.cameras.main;
        const screenStartX = worldX - camera.scrollX;
        const screenStartY = worldY - camera.scrollY;

        const coinSprite = this.scene.add.sprite(screenStartX, screenStartY, 'coin');
        coinSprite.setScrollFactor(0);
        coinSprite.setDepth(100);
        if (this.scene.anims.exists('coin-spin')) {
            coinSprite.play({ key: 'coin-spin', frameRate: 6 });
        }
        coinSprite.setScale(0.8);

        const target = GameEventBus.getInstance().getCoinTarget();
        this.activeFlyingCoins.push(coinSprite);

        // Step 1: 150ms pop at pickup point (scale 0.8 -> 1.35, slight rise)
        const popTargetY = screenStartY - 14;
        this.scene.tweens.add({
            targets: coinSprite,
            y: popTargetY,
            scale: 1.35,
            duration: 150,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (!coinSprite || !coinSprite.active) return;

                const startX = coinSprite.x;
                const startY = coinSprite.y;
                const targetX = target.x;
                const targetY = target.y;

                // Quadratic Bezier arc control point: smooth upward curve towards target
                const midX = (startX + targetX) / 2 + (startX < targetX ? -20 : 20);
                const midY = Math.min(startY, targetY) - 50;

                const tweenData = { t: 0 };

                // Step 2: 650ms Bezier flight to HUD coin chip, shrinking to ~0.6
                this.scene.tweens.add({
                    targets: tweenData,
                    t: 1,
                    duration: 650,
                    ease: 'Cubic.easeInOut',
                    onUpdate: () => {
                        if (!coinSprite || !coinSprite.active) return;
                        const t = tweenData.t;
                        const curX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * targetX;
                        const curY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * targetY;
                        coinSprite.setPosition(curX, curY);
                        coinSprite.setScale(1.35 - 0.75 * t); // Shrinks smoothly from 1.35 to 0.60
                    },
                    onComplete: () => {
                        const idx = this.activeFlyingCoins.indexOf(coinSprite);
                        if (idx !== -1) {
                            this.activeFlyingCoins.splice(idx, 1);
                        }
                        if (coinSprite && coinSprite.active) {
                            coinSprite.destroy();
                        }
                        GameEventBus.getInstance().emit('coin:bump', undefined);
                    }
                });
            }
        });
    }

    showPauseMenu(
        _onResume: () => void, 
        _onRespawnCheckpoint: () => void,
        _onRestart: () => void, 
        stats: { time: string; deaths: number; coins: number; kills: number; hasCheckpoint?: boolean }
    ) {
        this.hidePauseMenu();
        this.isPauseMenuOpen = true;
        GameEventBus.getInstance().emitGameState('PAUSED');
        GameEventBus.getInstance().emit('checkpoint:status', Boolean(stats.hasCheckpoint));
        GameEventBus.getInstance().emit('sound:status', this.soundEnabled);
    }

    public updatePauseMenu() {
        // Handled via React useMenuNavigation and global keyboard event bus
    }

    hideDeathScreen() {
        this.isDeathScreenOpen = false;
        if (this.deathContainer) {
            this.deathContainer.destroy();
            this.deathContainer = undefined;
        }
    }

    hidePauseMenu() {
        this.isPauseMenuOpen = false;
        if (this.pauseContainer) {
            this.pauseContainer.destroy();
            this.pauseContainer = undefined;
        }
        GameEventBus.getInstance().emitGameState('PLAYING');
    }

    showDeathScreen(
        onRestart: () => void,
        stats: { time: string; deaths: number; coins: number; kills: number }
    ) {
        this.hideDeathScreen();
        this.hidePauseMenu();
        this.isDeathScreenOpen = true;
        this.selectedDeathIndex = 0;
        GameEventBus.getInstance().emitGameState('DEAD');

        if (this.scene.game.canvas) {
            this.scene.game.canvas.focus();
        }

        this.deathContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(150);

        const backdrop = this.scene.add.rectangle(this.deathModalX, this.deathModalY, this.scene.scale.width, this.scene.scale.height, 0x0a0000, 0.85);
        this.deathContainer.add(backdrop);

        const modalWidth = 420;
        const modalHeight = 300;
        const modalBg = this.scene.add.rectangle(this.deathModalX, this.deathModalY, modalWidth, modalHeight, 0x180808, 0.96)
            .setStrokeStyle(2.5, 0xef4444, 0.95);
        this.deathContainer.add(modalBg);

        const title = this.scene.add.text(this.deathModalX, this.deathModalY - 105, 'YOU DIED', {
            fontSize: '32px', fontFamily: 'Arial', color: '#ef4444', stroke: '#450a0a', strokeThickness: 5, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add(title);

        this.scene.tweens.add({
            targets: title,
            scale: 1.06,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitle = this.scene.add.text(this.deathModalX, this.deathModalY - 65, 'Press ENTER or SPACE to Try Again', {
            fontSize: '13px', fontFamily: 'Arial', color: '#fca5a5', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add(subtitle);

        const statsBox = this.scene.add.rectangle(this.deathModalX, this.deathModalY - 18, 360, 50, 0x0f0404, 0.9)
            .setStrokeStyle(1.5, 0x7f1d1d);
        const statsText = this.scene.add.text(this.deathModalX, this.deathModalY - 18, `TIME: ${stats.time}   |   DEATHS: ${stats.deaths}\nCOINS: ${stats.coins}   |   KILLS: ${stats.kills}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#e2e8f0', align: 'center', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.deathContainer.add([statsBox, statsText]);

        this.deathOptions = [
            { id: 'restart', label: 'Try Again (Restart Stage)', action: onRestart }
        ];

        this.deathButtonBoxes = [];
        this.deathButtonLabels = [];

        const box = this.scene.add.rectangle(this.deathModalX, this.deathBtnY, this.deathBtnWidth, this.deathBtnHeight, 0xb91c1c, 0.95)
            .setStrokeStyle(2, 0xf87171);

        const label = this.scene.add.text(this.deathModalX, this.deathBtnY, this.deathOptions[0].label, {
            fontSize: '15px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2.5
        }).setOrigin(0.5);

        this.deathButtonBoxes.push(box);
        this.deathButtonLabels.push(label);
        this.deathContainer.add([box, label]);

        this.deathHighlight = this.scene.add.graphics();
        this.deathContainer.add(this.deathHighlight);

        this.updateDeathVisuals();
    }

    public updateDeathMenu() {
        // Handled via window & screen pointer listeners
    }

    private triggerCurrentDeathOption() {
        const opt = this.deathOptions[this.selectedDeathIndex];
        if (opt && opt.action) {
            this.soundManager?.playMenuSelect();
            opt.action();
        }
    }

    private updateDeathVisuals() {
        if (!this.isDeathScreenOpen || !this.deathHighlight) return;

        const activeBox = this.deathButtonBoxes[0];
        if (activeBox) {
            activeBox.setFillStyle(0xb91c1c, 0.95);
            activeBox.setStrokeStyle(2, 0xf87171);
            activeBox.setScale(1.02);
            if (this.deathButtonLabels[0]) {
                this.deathButtonLabels[0].setScale(1.02);
                this.deathButtonLabels[0].setColor('#ffffff');
            }

            this.deathHighlight.clear();
            this.deathHighlight.lineStyle(3, 0xfca5a5, 1);
            this.deathHighlight.strokeRoundedRect(
                activeBox.x - (activeBox.width * activeBox.scaleX / 2) - 3,
                activeBox.y - (activeBox.height * activeBox.scaleY / 2) - 3,
                (activeBox.width * activeBox.scaleX) + 6,
                (activeBox.height * activeBox.scaleY) + 6,
                6
            );
        }
    }

    public showVictoryMenu(
        onRestart: () => void,
        stats: { time: string; deaths: number; coins: number; kills: number }
    ) {
        this.hideVictoryMenu();
        this.hidePauseMenu();
        this.hideDeathScreen();
        this.isVictoryMenuOpen = true;
        this.selectedVictoryIndex = 0;
        GameEventBus.getInstance().emitGameState('VICTORY');

        if (this.scene.game.canvas) {
            this.scene.game.canvas.focus();
        }

        this.victoryContainer = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(250);

        // Dark dimming backdrop
        const backdrop = this.scene.add.rectangle(this.victoryModalX, this.victoryModalY, this.scene.scale.width, this.scene.scale.height, 0x030712, 0.88);
        this.victoryContainer.add(backdrop);

        // Victory Options: Restart Run, View Leaderboard, Audio Mute/Unmute
        this.victoryOptions = [
            {
                id: 'restart',
                label: '🔄 Restart Run',
                action: onRestart
            },
            {
                id: 'leaderboard',
                label: '🏆 View Leaderboard',
                action: () => {
                    LeaderboardManager.getInstance().showLeaderboardModal(this.scene, this.soundManager);
                }
            },
            {
                id: 'sound',
                label: `🔊 Audio: ${this.soundEnabled ? 'ON' : 'OFF'}`,
                action: () => {
                    this.soundEnabled = !this.soundEnabled;
                    this.soundManager?.setMuted(!this.soundEnabled);
                    if (this.victorySoundLabelRef) {
                        this.victorySoundLabelRef.setText(`🔊 Audio: ${this.soundEnabled ? 'ON' : 'OFF'}`);
                    }
                    if (this.soundEnabled) {
                        this.soundManager?.playMenuSelect();
                    }
                }
            }
        ];

        const modalWidth = 420;
        const modalHeight = 350;
        const modalBg = this.scene.add.rectangle(this.victoryModalX, this.victoryModalY, modalWidth, modalHeight, 0x0f172a, 0.96)
            .setStrokeStyle(2.5, 0xf59e0b, 0.95);
        this.victoryContainer.add(modalBg);

        // Title
        const title = this.scene.add.text(this.victoryModalX, this.victoryModalY - 125, '🏆 STAGE COMPLETE! 🏆', {
            fontSize: '24px', fontFamily: 'Arial', color: '#facc15', stroke: '#000000', strokeThickness: 4, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.victoryContainer.add(title);

        this.scene.tweens.add({
            targets: title,
            scale: 1.05,
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        const subtitle = this.scene.add.text(this.victoryModalX, this.victoryModalY - 92, 'Orb of Victory Secured • Run Submitted!', {
            fontSize: '12px', fontFamily: 'Arial', color: '#38bdf8', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.victoryContainer.add(subtitle);

        // Stats Box
        const statsBox = this.scene.add.rectangle(this.victoryModalX, this.victoryModalY - 48, 360, 46, 0x1e293b, 0.9)
            .setStrokeStyle(1.5, 0x475569);
        const statsText = this.scene.add.text(this.victoryModalX, this.victoryModalY - 48, `TIME: ${stats.time}   |   DEATHS: ${stats.deaths}\nCOINS: ${stats.coins}   |   KILLS: ${stats.kills}`, {
            fontSize: '12px', fontFamily: 'Arial', color: '#e2e8f0', align: 'center', stroke: '#000000', strokeThickness: 2, fontStyle: 'bold'
        }).setOrigin(0.5);
        this.victoryContainer.add([statsBox, statsText]);

        this.victoryStartBtnY = this.victoryModalY + 16;

        this.victoryButtonBoxes = [];
        this.victoryButtonLabels = [];

        for (let i = 0; i < this.victoryOptions.length; i++) {
            const opt = this.victoryOptions[i];
            const btnY = this.victoryStartBtnY + (i * this.victoryBtnGap);

            const box = this.scene.add.rectangle(this.victoryModalX, btnY, this.victoryBtnWidth, this.victoryBtnHeight, 0x1e293b, 0.9)
                .setStrokeStyle(1.5, 0x475569);

            const label = this.scene.add.text(this.victoryModalX, btnY, opt.label, {
                fontSize: '13px', fontFamily: 'Arial', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2.5
            }).setOrigin(0.5);

            if (opt.id === 'sound') {
                this.victorySoundLabelRef = label;
            }

            this.victoryButtonBoxes.push(box);
            this.victoryButtonLabels.push(label);
            this.victoryContainer.add([box, label]);
        }

        this.victoryHighlight = this.scene.add.graphics();
        this.victoryContainer.add(this.victoryHighlight);

        this.updateVictoryVisuals();
    }

    public hideVictoryMenu() {
        this.isVictoryMenuOpen = false;
        if (this.victoryContainer) {
            this.victoryContainer.destroy();
            this.victoryContainer = undefined;
        }
    }

    private triggerCurrentVictoryOption() {
        const opt = this.victoryOptions[this.selectedVictoryIndex];
        if (opt && opt.action) {
            this.soundManager?.playMenuSelect();
            opt.action();
        }
    }

    private updateVictoryVisuals() {
        if (!this.isVictoryMenuOpen || !this.victoryHighlight) return;

        for (let i = 0; i < this.victoryButtonBoxes.length; i++) {
            const box = this.victoryButtonBoxes[i];
            const label = this.victoryButtonLabels[i];
            const isSelected = (i === this.selectedVictoryIndex);
            const opt = this.victoryOptions[i];

            if (isSelected) {
                if (opt.id === 'restart') {
                    box.setFillStyle(0xb91c1c, 0.95);
                    box.setStrokeStyle(2, 0xf87171);
                } else if (opt.id === 'leaderboard') {
                    box.setFillStyle(0x0284c7, 0.95);
                    box.setStrokeStyle(2, 0x38bdf8);
                } else {
                    box.setFillStyle(0x059669, 0.95);
                    box.setStrokeStyle(2, 0x34d399);
                }
                box.setScale(1.02);
                label.setScale(1.02);
                label.setColor('#ffffff');
            } else {
                box.setFillStyle(0x1e293b, 0.85);
                box.setStrokeStyle(1.5, 0x475569);
                box.setScale(1);
                label.setScale(1);
                label.setColor('#94a3b8');
            }
        }

        this.victoryHighlight.clear();
        const activeBox = this.victoryButtonBoxes[this.selectedVictoryIndex];
        const activeOpt = this.victoryOptions[this.selectedVictoryIndex];
        if (activeBox && activeOpt) {
            let borderColor = 0x38bdf8;
            if (activeOpt.id === 'restart') borderColor = 0xfca5a5;
            else if (activeOpt.id === 'sound') borderColor = 0x6ee7b7;

            this.victoryHighlight.lineStyle(3, borderColor, 1);
            this.victoryHighlight.strokeRoundedRect(
                activeBox.x - (activeBox.width * activeBox.scaleX / 2) - 3,
                activeBox.y - (activeBox.height * activeBox.scaleY / 2) - 3,
                (activeBox.width * activeBox.scaleX) + 6,
                (activeBox.height * activeBox.scaleY) + 6,
                6
            );
        }
    }
}
