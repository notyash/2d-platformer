// src/managers/SoundManager.ts
import Phaser from 'phaser';
import { SettingsManager } from './SettingsManager';
import { SOUND_TOKENS } from '../theme/soundTokens';

export class SoundManager {
    private scene: Phaser.Scene;
    private ctx?: AudioContext;
    public isMuted: boolean = false;
    private settingsManager: SettingsManager;
    private musicInterval: any;
    
    // Background Music Track State
    private currentMusicKey?: 'game-bg-music' | 'boss-bg-music' | 'boss-phase-2-bg-music';
    private currentMusicSound?: Phaser.Sound.BaseSound;
    private currentFadeTween?: Phaser.Tweens.Tween;
    private unsubscribeSettings?: () => void;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.settingsManager = SettingsManager.getInstance();
        this.initAudioContext();
        this.initSettingsListener();
        this.scene.events.on(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
        this.scene.events.on(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
    }

    private initSettingsListener() {
        this.unsubscribeSettings = this.settingsManager.subscribe(() => {
            if (this.currentMusicSound && this.currentMusicSound.isPlaying && !this.isMuted) {
                if (!this.currentFadeTween || !this.currentFadeTween.isPlaying()) {
                    const targetVol = this.getTargetMusicVolume();
                    (this.currentMusicSound as any).setVolume(targetVol);
                }
            }
        });
    }

    private initAudioContext() {
        const resumeAudio = () => {
            if (this.isMuted) return;
            if (!this.ctx) {
                try {
                    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                    if (AudioContextClass) {
                        this.ctx = new AudioContextClass();
                    }
                } catch {
                    // Ignore audio context errors
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.scene.sound && this.scene.sound.locked) {
                this.scene.sound.unlock();
            }
            if (this.currentMusicKey && (!this.currentMusicSound || !this.currentMusicSound.isPlaying)) {
                this.playTrack(this.currentMusicKey, 2000);
            }
        };

        window.addEventListener('pointerdown', resumeAudio, { passive: true });
        window.addEventListener('keydown', resumeAudio, { passive: true });
        window.addEventListener('touchstart', resumeAudio, { passive: true });
    }

    private ensureContext() {
        if (this.isMuted) return;
        if (!this.ctx) {
            try {
                const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContextClass) {
                    this.ctx = new AudioContextClass();
                }
            } catch {
                return;
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    public getTargetMusicVolume(): number {
        if (this.isMuted) return 0;
        // Requirement 3: Set the volume of both background music to 30% of game sound effects
        const effectiveSfx = this.settingsManager.getEffectiveSfxVolume();
        return Math.max(0, Math.min(1, 0.30 * effectiveSfx));
    }

    public setMuted(muted: boolean) {
        this.isMuted = muted;
        if (this.scene.sound) {
            this.scene.sound.mute = muted;
        }
        if (muted) {
            if (this.currentMusicSound) {
                (this.currentMusicSound as any).setVolume(0);
            }
            if (this.ctx && this.ctx.state === 'running') {
                this.ctx.suspend();
            }
        } else {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.currentMusicSound && this.currentMusicSound.isPlaying) {
                (this.currentMusicSound as any).setVolume(this.getTargetMusicVolume());
            } else if (this.currentMusicKey) {
                this.playTrack(this.currentMusicKey, 1500);
            }
        }
    }

    public playJump() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(150, 420, 'sine', 0.12, 0.18);
    }

    public playShoot() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(620, 180, 'sawtooth', 0.08, 0.2);
    }

    public playEnemyShoot() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(220, 110, 'sawtooth', 0.14, 0.22);
    }

    public playCoin() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(987.77, 1318.51, 'triangle', 0.15, 0.25);
    }

    public playPowerup() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(523.25, 523.25, 'triangle', 0.06, 0.22);
        this.scene.time.delayedCall(65, () => this.playTone(659.25, 659.25, 'triangle', 0.06, 0.22));
        this.scene.time.delayedCall(130, () => this.playTone(783.99, 783.99, 'triangle', 0.06, 0.25));
        this.scene.time.delayedCall(195, () => this.playTone(1046.50, 1046.50, 'sine', 0.18, 0.3));
    }

    public playAudioFile(key: string, volumeScale: number = 1.0) {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(key)) {
            const effectiveVol = this.settingsManager.getEffectiveSfxVolume() * volumeScale;
            if (effectiveVol > 0.001) {
                this.scene.sound.play(key, { volume: effectiveVol });
            }
        }
    }

    public playVictory() {
        if (this.isMuted) return;
        this.stopMusic();
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.victory.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.victory.key, 0.7);
        } else {
            this.ensureContext();
            // Fallback synthetic fanfare
            this.playTone(523.25, 523.25, 'triangle', 0.12, 0.28, true);
            window.setTimeout(() => this.playTone(659.25, 659.25, 'triangle', 0.12, 0.28, true), 130);
            window.setTimeout(() => this.playTone(783.99, 783.99, 'triangle', 0.12, 0.3, true), 260);
            window.setTimeout(() => this.playTone(1046.50, 1046.50, 'sine', 0.22, 0.35, true), 390);
            window.setTimeout(() => this.playTone(783.99, 783.99, 'triangle', 0.14, 0.3, true), 560);
            window.setTimeout(() => {
                this.playTone(1046.50, 1046.50, 'triangle', 0.85, 0.35, true);
                this.playTone(1318.51, 1318.51, 'sine', 0.85, 0.3, true);
                this.playTone(1567.98, 1567.98, 'sine', 0.85, 0.25, true);
            }, 700);
        }
    }

    public playBossRage() {
        this.playAudioFile(SOUND_TOKENS.sfx.bossRage.key, 0.7);
    }

    public playPhaseTransition() {
        this.playAudioFile(SOUND_TOKENS.sfx.phaseTransition.key, 0.75);
    }

    public playBossDeath() {
        this.stopMusic();
        this.playAudioFile(SOUND_TOKENS.sfx.bossDeath.key, 0.8);
    }

    public playBossFallingGround() {
        this.playAudioFile(SOUND_TOKENS.sfx.bossFallingGround.key, 0.75);
    }

    public playStomp() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(280, 80, 'square', 0.1, 0.25);
    }

    public playDeath() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(400, 90, 'sawtooth', 0.4, 0.35);
    }

    public playBridgeBreak() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(160, 45, 'sawtooth', 0.25, 0.35);
        this.scene.time.delayedCall(40, () => this.playTone(280, 70, 'square', 0.2, 0.28));
        this.scene.time.delayedCall(90, () => this.playTone(120, 30, 'sawtooth', 0.3, 0.35));
    }

    public playMenuSelect() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(520, 680, 'sine', 0.05, 0.18, true);
    }

    public playCheckpoint() {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.checkpoint.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.checkpoint.key, 0.7);
        } else {
            this.ensureContext();
            this.playTone(440, 880, 'sine', 0.2, 0.25);
        }
    }

    public playTeleport() {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.bossTeleport.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.bossTeleport.key, 0.7);
        } else {
            this.ensureContext();
            this.playTone(200, 850, 'triangle', 0.25, 0.22);
        }
    }

    public playBossTeleport() {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.bossTeleport.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.bossTeleport.key, 0.75);
        } else {
            this.playTeleport();
        }
    }

    public playJumpPad() {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.jumpPad.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.jumpPad.key, 0.75);
        } else {
            this.playJump();
        }
    }

    public playRespawn() {
        if (this.isMuted) return;
        if (this.scene.sound && this.scene.cache.audio.exists(SOUND_TOKENS.sfx.respawn.key)) {
            this.playAudioFile(SOUND_TOKENS.sfx.respawn.key, 0.75);
        } else {
            this.ensureContext();
            this.playTone(330, 660, 'sine', 0.2, 0.25);
        }
    }

    public pauseAll() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
        if (this.scene.sound) {
            this.scene.sound.pauseAll();
        }
        if (this.currentMusicSound && this.currentMusicSound.isPlaying) {
            this.currentMusicSound.pause();
        }
    }

    public resumeAll() {
        if (!this.isMuted) {
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
            if (this.scene.sound) {
                this.scene.sound.resumeAll();
            }
            if (this.currentMusicSound && (this.currentMusicSound as any).isPaused) {
                this.currentMusicSound.resume();
            }
        }
    }

    /**
     * Requirement 2: Play game bg music on loop with fade-in on start & restart, unless in boss arena
     */
    public playGameMusic() {
        if (this.currentMusicKey === 'game-bg-music' && this.currentMusicSound) {
            if (this.currentMusicSound.isPlaying) {
                return;
            }
            if ((this.currentMusicSound as any).isPaused) {
                if (!(this.scene as any).isGamePaused) {
                    this.currentMusicSound.resume();
                }
                return;
            }
        }
        this.playTrack('game-bg-music', 2000);
    }

    /**
     * Requirement 2 (Boss): Play boss bg music on loop until boss is defeated (or Phase 2 starts)
     */
    public playBossMusic(phase: number = 1) {
        if (phase === 2) {
            this.playBossPhase2Music();
            return;
        }
        if (this.currentMusicKey === 'boss-bg-music' && this.currentMusicSound) {
            if (this.currentMusicSound.isPlaying) {
                return;
            }
            if ((this.currentMusicSound as any).isPaused) {
                if (!(this.scene as any).isGamePaused) {
                    this.currentMusicSound.resume();
                }
                return;
            }
        }
        this.playTrack('boss-bg-music', 1500);
    }

    /**
     * Boss Phase 2: Play boss phase 2 bg music on loop
     */
    public playBossPhase2Music() {
        if (this.currentMusicKey === 'boss-phase-2-bg-music' && this.currentMusicSound) {
            if (this.currentMusicSound.isPlaying) {
                return;
            }
            if ((this.currentMusicSound as any).isPaused) {
                if (!(this.scene as any).isGamePaused) {
                    this.currentMusicSound.resume();
                }
                return;
            }
        }
        this.playTrack('boss-phase-2-bg-music', 1500);
    }

    private playTrack(key: 'game-bg-music' | 'boss-bg-music' | 'boss-phase-2-bg-music', fadeDurationMs: number = 2000) {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }

        // Check if the current track is already initialized and just paused
        if (this.currentMusicKey === key && this.currentMusicSound) {
            if (this.currentMusicSound.isPlaying) {
                return;
            }
            if ((this.currentMusicSound as any).isPaused) {
                if (!(this.scene as any).isGamePaused) {
                    this.currentMusicSound.resume();
                }
                return;
            }
        }

        // Stop prior track if switching
        if (this.currentMusicSound && this.currentMusicKey !== key) {
            if (this.currentFadeTween) {
                this.currentFadeTween.stop();
                this.currentFadeTween = undefined;
            }
            this.currentMusicSound.stop();
            this.currentMusicSound.destroy();
            this.currentMusicSound = undefined;
        }

        // Strictly stop any lingering background music instances in Phaser audio cache
        if (this.scene.sound) {
            const allMusicKeys = [
                SOUND_TOKENS.music.gameBg.key,
                SOUND_TOKENS.music.bossBg.key,
                SOUND_TOKENS.music.bossPhase2Bg.key,
            ];
            for (const mKey of allMusicKeys) {
                if (mKey !== key) {
                    this.scene.sound.stopByKey(mKey);
                }
            }
        }

        this.currentMusicKey = key;

        if (!this.scene.sound || !this.scene.cache.audio.exists(key)) {
            return;
        }

        if (!this.currentMusicSound || (!this.currentMusicSound.isPlaying && !(this.currentMusicSound as any).isPaused)) {
            if (this.currentMusicSound) {
                this.currentMusicSound.stop();
                this.currentMusicSound.destroy();
                this.currentMusicSound = undefined;
            }

            const targetVol = this.getTargetMusicVolume();
            const music = this.scene.sound.add(key, {
                loop: true,
                volume: 0
            });
            this.currentMusicSound = music;

            // Fade-in on each loop restart (as the track is already faded out at the end)
            const handleLoopFade = () => {
                if (this.currentMusicSound === music && music.isPlaying && !this.isMuted) {
                    const target = this.getTargetMusicVolume();
                    (music as any).setVolume(0);
                    if (this.currentFadeTween) {
                        this.currentFadeTween.stop();
                    }
                    this.currentFadeTween = this.scene.tweens.add({
                        targets: music,
                        volume: target,
                        duration: fadeDurationMs,
                        ease: 'Linear'
                    });
                }
            };

            music.on('looped', handleLoopFade);
            music.on('loop', handleLoopFade);

            if ((this.scene as any).isGamePaused) {
                music.play();
                music.pause();
            } else {
                music.play();
            }

            if (this.currentFadeTween) {
                this.currentFadeTween.stop();
            }

            if (!this.isMuted && targetVol > 0 && !(this.scene as any).isGamePaused) {
                this.currentFadeTween = this.scene.tweens.add({
                    targets: music,
                    volume: targetVol,
                    duration: fadeDurationMs,
                    ease: 'Linear'
                });
            } else if (!this.isMuted && targetVol > 0) {
                (music as any).setVolume(targetVol);
            }
        }
    }

    public stopMusic() {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
        }
        if (this.currentFadeTween) {
            this.currentFadeTween.stop();
            this.currentFadeTween = undefined;
        }
        if (this.currentMusicSound) {
            this.currentMusicSound.stop();
            this.currentMusicSound.destroy();
            this.currentMusicSound = undefined;
        }
        if (this.scene.sound) {
            this.scene.sound.stopByKey(SOUND_TOKENS.music.gameBg.key);
            this.scene.sound.stopByKey(SOUND_TOKENS.music.bossBg.key);
            this.scene.sound.stopByKey(SOUND_TOKENS.music.bossPhase2Bg.key);
        }
        this.currentMusicKey = undefined;
    }

    private cleanup() {
        this.stopMusic();
        if (this.unsubscribeSettings) {
            this.unsubscribeSettings();
            this.unsubscribeSettings = undefined;
        }
    }

    private playTone(startFreq: number, endFreq: number, type: OscillatorType, duration: number, volume: number, isMenu: boolean = false) {
        if (this.isMuted) return;
        try {
            if (!this.ctx) return;
            if (!isMenu && (this.scene as any).isGamePaused) return;
            const effectiveVol = volume * this.settingsManager.getEffectiveSfxVolume();
            if (effectiveVol <= 0.001) return;

            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }

            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), this.ctx.currentTime + duration);

            gain.gain.setValueAtTime(effectiveVol, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch {
            // Ignore audio output errors
        }
    }
}
