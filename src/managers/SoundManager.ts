// src/managers/SoundManager.ts
import Phaser from 'phaser';
import { SettingsManager } from './SettingsManager';

export class SoundManager {
    private scene: Phaser.Scene;
    private ctx?: AudioContext;
    public isMuted: boolean = false;
    private settingsManager: SettingsManager;
    private musicInterval: any;
    
    // Background Music Track State
    private currentMusicKey?: 'game-bg-music' | 'boss-bg-music';
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

    public playVictory() {
        if (this.isMuted) return;
        this.ensureContext();
        this.stopMusic();

        // 8-bit celebratory victory fanfare (C5 -> E5 -> G5 -> C6 -> G5 -> Grand C Major Chord)
        // Uses window.setTimeout so the full fanfare plays out completely even when game scene is paused/completed
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
        this.ensureContext();
        this.playTone(440, 880, 'sine', 0.2, 0.25);
    }

    public playTeleport() {
        if (this.isMuted) return;
        this.ensureContext();
        this.playTone(200, 850, 'triangle', 0.25, 0.22);
    }

    public pauseAll() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
        if (this.scene.sound) {
            this.scene.sound.pauseAll();
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
        }
    }

    /**
     * Requirement 2: Play game bg music on loop with fade-in on start & restart, unless in boss arena
     */
    public playGameMusic() {
        if (this.currentMusicKey === 'game-bg-music' && this.currentMusicSound && this.currentMusicSound.isPlaying) {
            return;
        }
        this.playTrack('game-bg-music', 2000);
    }

    /**
     * Requirement 2 (Boss): Play boss bg music on loop until boss is defeated
     */
    public playBossMusic() {
        if (this.currentMusicKey === 'boss-bg-music' && this.currentMusicSound && this.currentMusicSound.isPlaying) {
            return;
        }
        this.playTrack('boss-bg-music', 1500);
    }

    private playTrack(key: 'game-bg-music' | 'boss-bg-music', fadeDurationMs: number = 2000) {
        if (this.musicInterval) {
            clearInterval(this.musicInterval);
            this.musicInterval = null;
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

        this.currentMusicKey = key;

        if (!this.scene.sound || !this.scene.cache.audio.exists(key)) {
            return;
        }

        if (!this.currentMusicSound || !this.currentMusicSound.isPlaying) {
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

            music.play();

            if (this.currentFadeTween) {
                this.currentFadeTween.stop();
            }

            if (!this.isMuted && targetVol > 0) {
                this.currentFadeTween = this.scene.tweens.add({
                    targets: music,
                    volume: targetVol,
                    duration: fadeDurationMs,
                    ease: 'Linear'
                });
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
