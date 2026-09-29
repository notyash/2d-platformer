import Phaser from 'phaser';
import { SoundManager } from './SoundManager';
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
    private activeFlyingOrbs: { sprite: Phaser.GameObjects.Sprite; tweens: Phaser.Tweens.Tween[]; sessionId: number }[] = [];
    private orbFlightSessionId: number = 0;
    
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

    // Victory State
    public isVictoryMenuOpen: boolean = false;

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

    public spawnOrbSparkles(x: number, y: number) {
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) return;
        const mintColor = parseInt(TOKENS.colors.orbMint.replace('#', '0x'), 16);
        const count = Phaser.Math.Between(4, 6);
        const particles = this.scene.add.particles(x, y, 'particle', {
            speed: { min: 30, max: 90 },
            scale: { start: 0.9, end: 0 },
            tint: mintColor,
            lifespan: 400,
            blendMode: 'ADD',
            emitting: false
        });
        particles.setDepth(25);
        particles.explode(count);
        this.scene.time.delayedCall(450, () => {
            if (particles && particles.active) particles.destroy();
        });
    }

    public getInFlightOrbsCount(): number {
        return this.activeFlyingOrbs.filter(o => o.sprite && o.sprite.active).length;
    }

    public cancelFlyingOrbs(): void {
        this.orbFlightSessionId++;
        for (const item of this.activeFlyingOrbs) {
            for (const tw of item.tweens) {
                if (tw && tw.isPlaying()) tw.stop();
            }
            if (item.sprite && item.sprite.active) {
                item.sprite.destroy();
            }
        }
        this.activeFlyingOrbs = [];
    }

    public playOrbPickupEffect(worldX: number, worldY: number, pipIndex: number, onArrival?: () => void) {
        if (worldX === undefined || worldY === undefined || isNaN(worldX) || isNaN(worldY)) {
            onArrival?.();
            return;
        }

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            onArrival?.();
            return;
        }

        // 1. Burst 4-6 mint sparkle pixels at pickup point
        this.spawnOrbSparkles(worldX, worldY);

        // 2. Screen space sprite (scrollFactor 0) so flight pauses with the game on the Phaser clock
        const camera = this.scene.cameras.main;
        const screenStartX = worldX - camera.scrollX;
        const screenStartY = worldY - camera.scrollY;

        const orbSprite = this.scene.add.sprite(screenStartX, screenStartY, 'gravity-orb');
        orbSprite.setScrollFactor(0);
        orbSprite.setDepth(100);
        if (this.scene.anims.exists('gravity-orb-anim')) {
            orbSprite.play('gravity-orb-anim');
        }
        orbSprite.setScale(0.85);

        const target = GameEventBus.getInstance().getOrbTarget(pipIndex);
        const flightSession = this.orbFlightSessionId;
        const orbRecord = { sprite: orbSprite, tweens: [] as Phaser.Tweens.Tween[], sessionId: flightSession };
        this.activeFlyingOrbs.push(orbRecord);

        // Step 1: 150ms pop at pickup point (scale 0.85 -> 1.35, slight rise)
        const popTargetY = screenStartY - 16;
        const popTween = this.scene.tweens.add({
            targets: orbSprite,
            y: popTargetY,
            scale: 1.35,
            duration: 150,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (flightSession !== this.orbFlightSessionId || !orbSprite || !orbSprite.active) {
                    return;
                }

                const startX = orbSprite.x;
                const startY = orbSprite.y;
                const targetX = target.x;
                const targetY = target.y;

                // Smooth upward curve towards the exact reserved pip slot
                const midX = (startX + targetX) / 2 + (startX < targetX ? -30 : 30);
                const midY = Math.min(startY, targetY) - 60;

                const tweenData = { t: 0 };

                // Step 2: 650ms smooth Bezier flight to exact pip slot, shrinking to pip size (~0.28)
                const flightTween = this.scene.tweens.add({
                    targets: tweenData,
                    t: 1,
                    duration: 650,
                    ease: 'Cubic.easeInOut',
                    onUpdate: () => {
                        if (flightSession !== this.orbFlightSessionId || !orbSprite || !orbSprite.active) return;
                        const t = tweenData.t;
                        const curX = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * midX + t * t * targetX;
                        const curY = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * midY + t * t * targetY;
                        orbSprite.setPosition(curX, curY);
                        // Shrinks from 1.35 down to 0.28 (pip slot size) so it drops directly into the pip
                        orbSprite.setScale(1.35 - 1.07 * t);
                    },
                    onComplete: () => {
                        const idx = this.activeFlyingOrbs.indexOf(orbRecord);
                        if (idx !== -1) {
                            this.activeFlyingOrbs.splice(idx, 1);
                        }
                        if (orbSprite && orbSprite.active) {
                            orbSprite.destroy();
                        }
                        if (flightSession === this.orbFlightSessionId) {
                            onArrival?.();
                        }
                    }
                });
                orbRecord.tweens.push(flightTween);
            }
        });
        orbRecord.tweens.push(popTween);
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
        _onRestart: () => void,
        _stats: { time: string; deaths: number; coins: number; kills: number }
    ) {
        this.hideVictoryMenu();
        this.hidePauseMenu();
        this.hideDeathScreen();
        this.isVictoryMenuOpen = true;
        GameEventBus.getInstance().emitGameState('VICTORY');
        GameEventBus.getInstance().emit('sound:status', this.soundEnabled);
    }

    public hideVictoryMenu() {
        this.isVictoryMenuOpen = false;
    }
}
