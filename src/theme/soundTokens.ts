// src/theme/soundTokens.ts

export const SOUND_TOKENS = {
  music: {
    gameBg: {
      key: 'game-bg-music',
      path: 'assets/sound effects/game bg music.mp3',
    },
    bossBg: {
      key: 'boss-bg-music',
      path: 'assets/sound effects/boss bg music.mp3',
    },
    bossPhase2Bg: {
      key: 'boss-phase-2-bg-music',
      path: 'assets/sound effects/boss phase 2 bg music.mp3',
    },
  },
  sfx: {
    victory: {
      key: 'victory-sound',
      path: 'assets/sound effects/victory.mp3',
    },
    bossRage: {
      key: 'boss-rage-sound',
      path: 'assets/sound effects/bossrage1.mp3',
    },
    phaseTransition: {
      key: 'phase-transition-sound',
      path: 'assets/sound effects/phase transition.mp3',
    },
    bossDeath: {
      key: 'boss-death-sound',
      path: 'assets/sound effects/BossDeath1.mp3',
    },
    bossFallingGround: {
      key: 'boss-falling-ground-sound',
      path: 'assets/sound effects/boss falling on ground sound.mp3',
    },
    bossTeleport: {
      key: 'boss-teleport-sound',
      path: 'assets/sound effects/boss teleport.mp3',
    },
    checkpoint: {
      key: 'checkpoint-sound',
      path: 'assets/sound effects/checkpoint.mp3',
    },
    jumpPad: {
      key: 'jump-pad-sound',
      path: 'assets/sound effects/jump-pad.mp3',
    },
    respawn: {
      key: 'respawn-sound',
      path: 'assets/sound effects/respawn.mp3',
    },
  },
} as const;

export type SoundTokens = typeof SOUND_TOKENS;

