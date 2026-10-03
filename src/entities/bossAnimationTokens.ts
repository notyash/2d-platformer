/**
 * Boss Animation & Sprite Tokens
 * 
 * Asset Directory: /assets/sprites/boss/new boss/
 * Provides strongly-typed tokens, frame definitions, animation configuration,
 * preloader helper, and Phaser animation registration for the New Boss encounter.
 */

import Phaser from 'phaser';

export const BOSS_ASSET_BASE_PATH = 'assets/sprites/boss/new boss';

export interface BossAnimationFrameDef {
    key: string;
    file: string;
    path: string;
}

export interface BossAnimationTokenConfig {
    token: string;
    animKey: string;
    name: string;
    description: string;
    useCase: string;
    frameCount: number;
    frameRate: number;
    repeat: number; // -1 for infinite, 0 for play once
    flipX?: boolean;
    frames: BossAnimationFrameDef[];
    mirroredToken?: string;
}

/**
 * Helper to generate individual frame paths
 */
function buildFrames(prefix: string, count: number, extension: string = '.png', customKeyPrefix?: string): BossAnimationFrameDef[] {
    const frames: BossAnimationFrameDef[] = [];
    const baseKey = customKeyPrefix || prefix.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    for (let i = 1; i <= count; i++) {
        const file = `${prefix}${i}${extension}`;
        frames.push({
            key: `${baseKey}-${i}`,
            file,
            path: `${BOSS_ASSET_BASE_PATH}/${file}`
        });
    }
    return frames;
}

/**
 * Boss Animation Identifiers
 */
export const BOSS_ANIM_KEYS = {
    // 1. Boss flying attack pattern (1-12)
    FLYING_ATTACK: 'boss-anim-flying-attack',
    
    // 2. Boss ground attack pattern (1-12)
    GROUND_ATTACK: 'boss-anim-ground-attack',
    
    // 3. Boss disappearing before ground attack (1-7)
    GROUND_ATTACK_TELEGRAPH: 'boss-anim-ground-attack-telegraph',
    
    // 4. Boss disappearing before air attack (1-6)
    FLY_DISAPPEAR: 'boss-anim-fly-disappear',
    
    // 5. Boss death animation (1-8)
    DEATH: 'boss-anim-death',
    
    // 6. Boss re-appearing after air attack (1-6)
    FLY_SPAWN: 'boss-anim-fly-spawn',
    
    // 7. Boss flying animation (1-2)
    FLYING: 'boss-anim-flying',
    
    // 8. Boss ground teleport disappear (1-6)
    GROUND_DISAPPEAR: 'boss-anim-ground-disappear',
    
    // 9. Boss ground teleport appear (1-6)
    GROUND_SPAWN: 'boss-anim-ground-spawn',
    
    // 10. Boss idle flying (1-2)
    IDLE_FLYING: 'boss-anim-idle-flying',
    
    // 11. Skeleton bomb explode (LEFT & RIGHT) (1-6)
    SKELETON_BOMB_EXPLODE_LEFT: 'skeleton-bomb-anim-explode-left',
    SKELETON_BOMB_EXPLODE_RIGHT: 'skeleton-bomb-anim-explode-right',
    
    // 12. Skeleton spawn (LEFT & RIGHT) (1-4)
    SKELETON_SPAWN_LEFT: 'skeleton-bomb-anim-spawn-left',
    SKELETON_SPAWN_RIGHT: 'skeleton-bomb-anim-spawn-right',
    
    // 13. Skeleton walking (LEFT & RIGHT) (1-4)
    SKELETON_WALK_LEFT: 'skeleton-bomb-anim-walk-left',
    SKELETON_WALK_RIGHT: 'skeleton-bomb-anim-walk-right',
    
    // 14. Boss spawning minions (1-6)
    SPAWN_MINIONS: 'boss-anim-spawn-minions',
    
    // 15. Boss standing idle (1-2)
    STANDING_IDLE: 'boss-anim-standing-idle',
    
    // 16. Boss raging (1-9)
    RAGING: 'boss-anim-raging',
    
    // 17. Boss losing wings (1-8)
    LOSING_WINGS: 'boss-anim-losing-wings',
    
    // 18. Boss walking left (1-5)
    WALK_LEFT: 'boss-anim-walk-left',
    
    // 19. Boss walking right (1-5)
    WALK_RIGHT: 'boss-anim-walk-right',

    // Pattern Telegraph Ball Identifiers (2 frames each for smooth wing-flap sync)
    // Ball 1 = frames 3-4, Ball 2 = frames 5-6, Ball 3 = frames 7-8, Ball 4 = frames 9-10, Ball 5 = frames 11-12
    FLYING_BALL_1: 'boss-anim-flying-ball-1',
    FLYING_BALL_2: 'boss-anim-flying-ball-2',
    FLYING_BALL_3: 'boss-anim-flying-ball-3',
    FLYING_BALL_4: 'boss-anim-flying-ball-4',
    FLYING_BALL_5: 'boss-anim-flying-ball-5',

    GROUND_BALL_1: 'boss-anim-ground-ball-1',
    GROUND_BALL_2: 'boss-anim-ground-ball-2',
    GROUND_BALL_3: 'boss-anim-ground-ball-3',
    GROUND_BALL_4: 'boss-anim-ground-ball-4',
    GROUND_BALL_5: 'boss-anim-ground-ball-5',

    // Bonus / Specialized sequences found in assets
    DEATH_BY_BEAM: 'boss-anim-death-beam',
    MAIN_ATTACK: 'boss-anim-main-attack',
    ATTACK_TILES_GLOW: 'boss-anim-attack-tiles-glow'
} as const;


export type BossAnimKey = typeof BOSS_ANIM_KEYS[keyof typeof BOSS_ANIM_KEYS];

/**
 * Complete Token Registry with Metadata and Frame Definitions
 */
export const BOSS_ANIMATION_TOKENS: Record<string, BossAnimationTokenConfig> = {
    // 1. Boss Flying Attack Pattern
    BOSS_FLYING_ATTACK: {
        token: 'BOSS_FLYING_ATTACK',
        animKey: BOSS_ANIM_KEYS.FLYING_ATTACK,
        name: 'Boss Flying Attack Pattern',
        description: 'Light attack pattern executed during aerial phase',
        useCase: 'Air phase lightning/light barrage attack routine',
        frameCount: 12,
        frameRate: 10,
        repeat: 0,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk')
    },

    // 2. Boss Ground Attack Pattern
    BOSS_GROUND_ATTACK: {
        token: 'BOSS_GROUND_ATTACK',
        animKey: BOSS_ANIM_KEYS.GROUND_ATTACK,
        name: 'Boss Ground Attack Pattern',
        description: 'Light attack pattern executed while grounded',
        useCase: 'Ground phase projectile or slam telegraph & execution',
        frameCount: 12,
        frameRate: 10,
        repeat: 0,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk')
    },

    // 3. Boss Disappearing Before Ground Attack
    BOSS_GROUND_ATTACK_TELEGRAPH: {
        token: 'BOSS_GROUND_ATTACK_TELEGRAPH',
        animKey: BOSS_ANIM_KEYS.GROUND_ATTACK_TELEGRAPH,
        name: 'Boss Disappearing Before Ground Attack',
        description: 'Charging/teleporting pre-attack telegraph before number attacks',
        useCase: 'Telegraph window before unleashing targeted ground number assault',
        frameCount: 7,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('charging before number attack ani', 7, '.png', 'boss-num-chg')
    },

    // 4. Boss Disappearing Before Air Attack
    BOSS_FLY_DISAPPEAR: {
        token: 'BOSS_FLY_DISAPPEAR',
        animKey: BOSS_ANIM_KEYS.FLY_DISAPPEAR,
        name: 'Boss Disappearing Before Air Attack',
        description: 'Airborne phase vanish into concealment',
        useCase: 'Boss fades out before an aerial ambush or reposition',
        frameCount: 6,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('fly disappear', 6, '.png', 'boss-fly-disp')
    },

    // 5. Boss Death Animation
    BOSS_DEATH: {
        token: 'BOSS_DEATH',
        animKey: BOSS_ANIM_KEYS.DEATH,
        name: 'Boss Death Animation',
        description: 'Standard boss defeat/shatter sequence',
        useCase: 'Played upon boss reaching 0 HP to trigger victory sequence',
        frameCount: 8,
        frameRate: 6,
        repeat: 0,
        frames: buildFrames('death ani', 8, '.png', 'boss-death')
    },

    // 6. Boss Re-appearing After Air Attack
    BOSS_FLY_SPAWN: {
        token: 'BOSS_FLY_SPAWN',
        animKey: BOSS_ANIM_KEYS.FLY_SPAWN,
        name: 'Boss Re-appearing After Air Attack',
        description: 'Airborne arrival / materialization in flight',
        useCase: 'Boss re-emerges in the sky after aerial vanish attack',
        frameCount: 6,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('fly spawn', 6, '.png', 'boss-fly-spwn')
    },

    // 7. Boss Flying Animation
    BOSS_FLYING: {
        token: 'BOSS_FLYING',
        animKey: BOSS_ANIM_KEYS.FLYING,
        name: 'Boss Flying Animation',
        description: 'Active flight / hovering animation loop',
        useCase: 'Standard movement animation during airborne boss phase',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('flying animation', 2, '.png', 'boss-fly-active')
    },

    // 8. Boss Ground Teleport Disappear
    BOSS_GROUND_DISAPPEAR: {
        token: 'BOSS_GROUND_DISAPPEAR',
        animKey: BOSS_ANIM_KEYS.GROUND_DISAPPEAR,
        name: 'Boss Ground Teleport Disappear',
        description: 'Ground teleportation exit / shadow dissolve',
        useCase: 'Ground phase teleport initiation to dodge or reposition',
        frameCount: 6,
        frameRate: 17,
        repeat: 0,
        frames: buildFrames('ground disappear', 6, '.png', 'boss-grnd-disp')
    },

    // 9. Boss Ground Teleport Appear
    BOSS_GROUND_SPAWN: {
        token: 'BOSS_GROUND_SPAWN',
        animKey: BOSS_ANIM_KEYS.GROUND_SPAWN,
        name: 'Boss Ground Teleport Appear',
        description: 'Ground teleportation entry / rising from shadow',
        useCase: 'Ground phase teleport conclusion at destination position',
        frameCount: 6,
        frameRate: 17,
        repeat: 0,
        frames: buildFrames('ground spawn', 6, '.png', 'boss-grnd-spwn')
    },

    // 10. Boss Idle Flying
    BOSS_IDLE_FLYING: {
        token: 'BOSS_IDLE_FLYING',
        animKey: BOSS_ANIM_KEYS.IDLE_FLYING,
        name: 'Boss Idle Flying',
        description: 'Resting airborne hover pose',
        useCase: 'Stationary flying state during dialogue or waiting windows',
        frameCount: 2,
        frameRate: 3,
        repeat: -1,
        frames: buildFrames('idle position flying ani', 2, '.png', 'boss-fly-idle')
    },

    // 11. Skeleton Bomb Explode LEFT & RIGHT
    SKELETON_BOMB_EXPLODE_LEFT: {
        token: 'SKELETON_BOMB_EXPLODE_LEFT',
        animKey: BOSS_ANIM_KEYS.SKELETON_BOMB_EXPLODE_LEFT,
        name: 'Skeleton Bomb Explode (Left)',
        description: 'Skeleton minion detonation sequence facing left',
        useCase: 'Detonation upon reaching player proximity or timer expiration',
        frameCount: 6,
        frameRate: 15,
        repeat: 0,
        flipX: false,
        mirroredToken: 'SKELETON_BOMB_EXPLODE_RIGHT',
        frames: buildFrames('skeleton bomb attack new', 6, '.png', 'skel-bomb-atk-l')
    },
    SKELETON_BOMB_EXPLODE_RIGHT: {
        token: 'SKELETON_BOMB_EXPLODE_RIGHT',
        animKey: BOSS_ANIM_KEYS.SKELETON_BOMB_EXPLODE_RIGHT,
        name: 'Skeleton Bomb Explode (Right)',
        description: 'Skeleton minion detonation sequence facing right',
        useCase: 'Detonation upon reaching player proximity or timer expiration (flipped)',
        frameCount: 6,
        frameRate: 15,
        repeat: 0,
        flipX: true,
        mirroredToken: 'SKELETON_BOMB_EXPLODE_LEFT',
        frames: buildFrames('skeleton bomb attack new', 6, '.png', 'skel-bomb-atk-l')
    },

    // 12. Skeleton Spawn LEFT & RIGHT
    SKELETON_SPAWN_LEFT: {
        token: 'SKELETON_SPAWN_LEFT',
        animKey: BOSS_ANIM_KEYS.SKELETON_SPAWN_LEFT,
        name: 'Skeleton Spawn (Left)',
        description: 'Skeleton minion summon / rise animation facing left',
        useCase: 'Summoned into combat by boss minion skill facing leftward',
        frameCount: 4,
        frameRate: 8,
        repeat: 0,
        flipX: false,
        mirroredToken: 'SKELETON_SPAWN_RIGHT',
        frames: buildFrames('skeleton bomb spawn new', 4, '.png', 'skel-bomb-spwn-l')
    },
    SKELETON_SPAWN_RIGHT: {
        token: 'SKELETON_SPAWN_RIGHT',
        animKey: BOSS_ANIM_KEYS.SKELETON_SPAWN_RIGHT,
        name: 'Skeleton Spawn (Right)',
        description: 'Skeleton minion summon / rise animation facing right',
        useCase: 'Summoned into combat by boss minion skill facing rightward',
        frameCount: 4,
        frameRate: 8,
        repeat: 0,
        flipX: true,
        mirroredToken: 'SKELETON_SPAWN_LEFT',
        frames: buildFrames('skeleton bomb spawn new', 4, '.png', 'skel-bomb-spwn-l')
    },

    // 13. Skeleton Walking LEFT & RIGHT
    SKELETON_WALK_LEFT: {
        token: 'SKELETON_WALK_LEFT',
        animKey: BOSS_ANIM_KEYS.SKELETON_WALK_LEFT,
        name: 'Skeleton Walking (Left)',
        description: 'Skeleton bomb minion movement patrol facing left',
        useCase: 'Skeleton minion moving left towards the player',
        frameCount: 4,
        frameRate: 6,
        repeat: -1,
        flipX: false,
        mirroredToken: 'SKELETON_WALK_RIGHT',
        frames: buildFrames('skeleton bomb walking new ani', 4, '.png', 'skel-bomb-walk-l')
    },
    SKELETON_WALK_RIGHT: {
        token: 'SKELETON_WALK_RIGHT',
        animKey: BOSS_ANIM_KEYS.SKELETON_WALK_RIGHT,
        name: 'Skeleton Walking (Right)',
        description: 'Skeleton bomb minion movement patrol facing right',
        useCase: 'Skeleton minion moving right towards the player',
        frameCount: 4,
        frameRate: 6,
        repeat: -1,
        flipX: true,
        mirroredToken: 'SKELETON_WALK_LEFT',
        frames: buildFrames('skeleton bomb walking new ani', 4, '.png', 'skel-bomb-walk-l')
    },

    // 14. Boss Spawning Minions
    BOSS_SPAWN_MINIONS: {
        token: 'BOSS_SPAWN_MINIONS',
        animKey: BOSS_ANIM_KEYS.SPAWN_MINIONS,
        name: 'Boss Spawning Minions',
        description: 'Summoning ritual animation invoking skeleton minions',
        useCase: 'Casting animation when spawning skeleton bomb mobs or reinforcements',
        frameCount: 6,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('spawn other mobs animation', 6, '.png', 'boss-spwn-mobs')
    },

    // 15. Boss Standing Idle
    BOSS_STANDING_IDLE: {
        token: 'BOSS_STANDING_IDLE',
        animKey: BOSS_ANIM_KEYS.STANDING_IDLE,
        name: 'Boss Standing Idle',
        description: 'Grounded idle breathing loop',
        useCase: 'Default ground phase state when stationary',
        frameCount: 2,
        frameRate: 3,
        repeat: -1,
        frames: buildFrames('standing idle', 2, '.png', 'boss-grnd-idle')
    },

    // 16. Boss Raging
    BOSS_RAGING: {
        token: 'BOSS_RAGING',
        animKey: BOSS_ANIM_KEYS.RAGING,
        name: 'Boss Raging',
        description: 'Phase transition / enraged state roar and aura flare',
        useCase: 'Triggered when boss health drops below thresholds (e.g. 50% HP or Phase 2)',
        frameCount: 9,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('raging final boss', 9, '.png', 'boss-rage')
    },

    // 17. Boss Losing Wings
    BOSS_LOSING_WINGS: {
        token: 'BOSS_LOSING_WINGS',
        animKey: BOSS_ANIM_KEYS.LOSING_WINGS,
        name: 'Boss Losing Wings',
        description: 'Wings shatter/detach animation transitioning from flight to ground',
        useCase: 'Mid-battle phase change forcing the boss onto the ground',
        frameCount: 8,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('losing the wings animation new', 8, '.png', 'boss-lose-wings')
    },

    // 18. Boss Walking Left
    BOSS_WALK_LEFT: {
        token: 'BOSS_WALK_LEFT',
        animKey: BOSS_ANIM_KEYS.WALK_LEFT,
        name: 'Boss Walking Left',
        description: 'Grounded walk cycle facing left',
        useCase: 'Boss moving leftward during ground combat phase',
        frameCount: 5,
        frameRate: 6,
        repeat: -1,
        frames: buildFrames('going left', 5, '.png', 'boss-walk-left')
    },

    // 19. Boss Walking Right
    BOSS_WALK_RIGHT: {
        token: 'BOSS_WALK_RIGHT',
        animKey: BOSS_ANIM_KEYS.WALK_RIGHT,
        name: 'Boss Walking Right',
        description: 'Grounded walk cycle facing right',
        useCase: 'Boss moving rightward during ground combat phase',
        frameCount: 5,
        frameRate: 6,
        repeat: -1,
        frames: buildFrames('going right', 5, '.png', 'boss-walk-right')
    },

    // Additional Auxiliary Sequences in Asset Folder
    BOSS_DEATH_BY_BEAM: {
        token: 'BOSS_DEATH_BY_BEAM',
        animKey: BOSS_ANIM_KEYS.DEATH_BY_BEAM,
        name: 'Boss Death By Beam',
        description: 'Vaporization death sequence when defeated by special energy beam',
        useCase: 'Alternate defeat animation triggered by beam attack',
        frameCount: 8,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('death by beam', 8, '.png', 'boss-death-beam')
    },
    BOSS_MAIN_ATTACK: {
        token: 'BOSS_MAIN_ATTACK',
        animKey: BOSS_ANIM_KEYS.MAIN_ATTACK,
        name: 'Boss Main Attack',
        description: 'Direct main projectile / melee discharge',
        useCase: 'Primary direct offensive strike',
        frameCount: 5,
        frameRate: 8,
        repeat: 0,
        frames: buildFrames('main attack new', 5, '.png', 'boss-main-atk')
    },
    BOSS_ATTACK_TILES_GLOW: {
        token: 'BOSS_ATTACK_TILES_GLOW',
        animKey: BOSS_ANIM_KEYS.ATTACK_TILES_GLOW,
        name: 'Attack Tiles Glow Warning',
        description: 'Ground hazardous floor tiles charge glow effect',
        useCase: 'Environmental floor telegraph for arena lightning strikes',
        frameCount: 4,
        frameRate: 6,
        repeat: -1,
        frames: buildFrames('attack tiles glow new', 4, '.png', 'atk-tile-glow')
    },

    // Flying Pattern Balls (1-5): 2 frames per ball synced with wing flaps
    BOSS_FLYING_BALL_1: {
        token: 'BOSS_FLYING_BALL_1',
        animKey: BOSS_ANIM_KEYS.FLYING_BALL_1,
        name: 'Flying Telegraph Ball 1',
        description: 'Wing flapping loop with Ball 1 illuminated (frames 3-4)',
        useCase: 'Pattern telegraph ball 1 in air',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk').slice(2, 4)
    },
    BOSS_FLYING_BALL_2: {
        token: 'BOSS_FLYING_BALL_2',
        animKey: BOSS_ANIM_KEYS.FLYING_BALL_2,
        name: 'Flying Telegraph Ball 2',
        description: 'Wing flapping loop with Ball 2 illuminated (frames 5-6)',
        useCase: 'Pattern telegraph ball 2 in air',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk').slice(4, 6)
    },
    BOSS_FLYING_BALL_3: {
        token: 'BOSS_FLYING_BALL_3',
        animKey: BOSS_ANIM_KEYS.FLYING_BALL_3,
        name: 'Flying Telegraph Ball 3',
        description: 'Wing flapping loop with Ball 3 illuminated (frames 7-8)',
        useCase: 'Pattern telegraph ball 3 in air',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk').slice(6, 8)
    },
    BOSS_FLYING_BALL_4: {
        token: 'BOSS_FLYING_BALL_4',
        animKey: BOSS_ANIM_KEYS.FLYING_BALL_4,
        name: 'Flying Telegraph Ball 4',
        description: 'Wing flapping loop with Ball 4 illuminated (frames 9-10)',
        useCase: 'Pattern telegraph ball 4 in air',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk').slice(8, 10)
    },
    BOSS_FLYING_BALL_5: {
        token: 'BOSS_FLYING_BALL_5',
        animKey: BOSS_ANIM_KEYS.FLYING_BALL_5,
        name: 'Flying Telegraph Ball 5',
        description: 'Wing flapping loop with Ball 5 illuminated (frames 11-12)',
        useCase: 'Pattern telegraph ball 5 in air',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light animation', 12, '.png', 'boss-fly-atk').slice(10, 12)
    },

    // Ground Pattern Balls (1-5): 2 frames per ball synced with wing flaps
    BOSS_GROUND_BALL_1: {
        token: 'BOSS_GROUND_BALL_1',
        animKey: BOSS_ANIM_KEYS.GROUND_BALL_1,
        name: 'Ground Telegraph Ball 1',
        description: 'Ground wing flapping loop with Ball 1 illuminated (frames 3-4)',
        useCase: 'Pattern telegraph ball 1 on ground',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk').slice(2, 4)
    },
    BOSS_GROUND_BALL_2: {
        token: 'BOSS_GROUND_BALL_2',
        animKey: BOSS_ANIM_KEYS.GROUND_BALL_2,
        name: 'Ground Telegraph Ball 2',
        description: 'Ground wing flapping loop with Ball 2 illuminated (frames 5-6)',
        useCase: 'Pattern telegraph ball 2 on ground',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk').slice(4, 6)
    },
    BOSS_GROUND_BALL_3: {
        token: 'BOSS_GROUND_BALL_3',
        animKey: BOSS_ANIM_KEYS.GROUND_BALL_3,
        name: 'Ground Telegraph Ball 3',
        description: 'Ground wing flapping loop with Ball 3 illuminated (frames 7-8)',
        useCase: 'Pattern telegraph ball 3 on ground',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk').slice(6, 8)
    },
    BOSS_GROUND_BALL_4: {
        token: 'BOSS_GROUND_BALL_4',
        animKey: BOSS_ANIM_KEYS.GROUND_BALL_4,
        name: 'Ground Telegraph Ball 4',
        description: 'Ground wing flapping loop with Ball 4 illuminated (frames 9-10)',
        useCase: 'Pattern telegraph ball 4 on ground',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk').slice(8, 10)
    },
    BOSS_GROUND_BALL_5: {
        token: 'BOSS_GROUND_BALL_5',
        animKey: BOSS_ANIM_KEYS.GROUND_BALL_5,
        name: 'Ground Telegraph Ball 5',
        description: 'Ground wing flapping loop with Ball 5 illuminated (frames 11-12)',
        useCase: 'Pattern telegraph ball 5 on ground',
        frameCount: 2,
        frameRate: 4,
        repeat: -1,
        frames: buildFrames('attack light ground ani', 12, '.png', 'boss-grnd-atk').slice(10, 12)
    }
};

/**
 * Helper to retrieve the animation key for a specific pattern ball (1-5)
 * depending on whether the boss is flying or grounded.
 */
export function getBossBallAnimKey(ballNumber: number, isFlying: boolean): string {
    const clamped = Phaser.Math.Clamp(Math.round(ballNumber), 1, 5);
    const flyingKeys = [
        BOSS_ANIM_KEYS.FLYING_BALL_1,
        BOSS_ANIM_KEYS.FLYING_BALL_2,
        BOSS_ANIM_KEYS.FLYING_BALL_3,
        BOSS_ANIM_KEYS.FLYING_BALL_4,
        BOSS_ANIM_KEYS.FLYING_BALL_5
    ];
    const groundKeys = [
        BOSS_ANIM_KEYS.GROUND_BALL_1,
        BOSS_ANIM_KEYS.GROUND_BALL_2,
        BOSS_ANIM_KEYS.GROUND_BALL_3,
        BOSS_ANIM_KEYS.GROUND_BALL_4,
        BOSS_ANIM_KEYS.GROUND_BALL_5
    ];
    return isFlying ? flyingKeys[clamped - 1] : groundKeys[clamped - 1];
}


/**
 * Preload all Boss Sprite Frames in a Phaser Scene
 * 
 * Usage in Scene.preload():
 * ```typescript
 * import { preloadBossSprites } from '../entities/bossAnimationTokens';
 * preloadBossSprites(this);
 * ```
 */
export function preloadBossSprites(scene: Phaser.Scene): void {
    const loadedKeys = new Set<string>();

    Object.values(BOSS_ANIMATION_TOKENS).forEach(config => {
        config.frames.forEach(frame => {
            if (!loadedKeys.has(frame.key) && !scene.textures.exists(frame.key)) {
                scene.load.image(frame.key, frame.path);
                loadedKeys.add(frame.key);
            }
        });
    });
}

/**
 * Sets up 32x32 sub-frame slices on the 160x64 'attack tiles glow new1..4' textures
 * and registers animated glow loops for individual tiles 1 to 5.
 * 
 * First row (y=0..32): Tile 1 (col 0), Tile 3 (col 2), Tile 5 (col 4) with 32x32 gap in between
 * Second row (y=32..64): Tile 2 (col 1), Tile 4 (col 3)
 */
export function setupAttackTileGlowAnimations(scene: Phaser.Scene): void {
    for (let f = 1; f <= 4; f++) {
        const texKey = `atk-tile-glow-${f}`;
        if (scene.textures.exists(texKey)) {
            const texture = scene.textures.get(texKey);
            for (let dot = 1; dot <= 5; dot++) {
                const col = dot - 1;
                const row = dot % 2 === 1 ? 0 : 1;
                const frameX = col * 32;
                const frameY = row * 32;
                const frameName = `tile-${dot}-glow-${f}`;
                if (!texture.has(frameName)) {
                    texture.add(frameName, 0, frameX, frameY, 32, 32);
                }
            }
        }
    }

    // Register animations for each individual tile (1 to 5)
    for (let dot = 1; dot <= 5; dot++) {
        const animKey = `attack-tile-glow-${dot}`;
        if (!scene.anims.exists(animKey)) {
            scene.anims.create({
                key: animKey,
                frames: [
                    { key: 'atk-tile-glow-1', frame: `tile-${dot}-glow-1` },
                    { key: 'atk-tile-glow-2', frame: `tile-${dot}-glow-2` },
                    { key: 'atk-tile-glow-3', frame: `tile-${dot}-glow-3` },
                    { key: 'atk-tile-glow-4', frame: `tile-${dot}-glow-4` },
                ],
                frameRate: 8,
                repeat: -1
            });
        }
    }
}

/**
 * Register all Boss Animations in Phaser's Animation Manager
 * 
 * Usage in Scene.create() or Boss.setupAnimations():
 * ```typescript
 * import { createBossAnimations } from '../entities/bossAnimationTokens';
 * createBossAnimations(this);
 * ```
 */
export function createBossAnimations(scene: Phaser.Scene): void {
    Object.values(BOSS_ANIMATION_TOKENS).forEach(config => {
        if (!scene.anims.exists(config.animKey)) {
            const animFrames = config.frames.map(f => ({ key: f.key }));
            scene.anims.create({
                key: config.animKey,
                frames: animFrames,
                frameRate: config.frameRate,
                repeat: config.repeat
            });
        }
    });

    // Set up subframes and animated loops for attack tiles glow 1..5
    setupAttackTileGlowAnimations(scene);

    // Set up 32x32 sub-frame slices for main attack new 1..5 beam mechanics
    setupMainAttackBeamFrames(scene);
}

/**
 * Sets up 32x32 sub-frame slices on the 32x96 'main attack new1..5' textures
 * for the multi-stage lightning beam column attack.
 * 
 * Row 1 (y=0..32): Top beam origin charge
 * Row 2 (y=32..64): Filler beam (new4) & energized current loopback (new5)
 * Row 3 (y=64..96): Ground impact discharge (new5)
 */
export function setupMainAttackBeamFrames(scene: Phaser.Scene): void {
    for (let f = 1; f <= 5; f++) {
        const texKey = `boss-main-atk-${f}`;
        if (scene.textures.exists(texKey)) {
            const texture = scene.textures.get(texKey);
            for (let row = 0; row < 3; row++) {
                const frameName = `main-atk-${f}-row${row + 1}`;
                if (!texture.has(frameName)) {
                    texture.add(frameName, 0, 0, row * 32, 32, 32);
                }
            }
        }
    }
}

const TOKEN_CONFIG_LOOKUP = new Map<string, BossAnimationTokenConfig>();
Object.values(BOSS_ANIMATION_TOKENS).forEach(cfg => {
    TOKEN_CONFIG_LOOKUP.set(cfg.animKey, cfg);
    TOKEN_CONFIG_LOOKUP.set(cfg.token, cfg);
});

/**
 * Play helper for boss or minion sprites with directional flipping
 */
export function playBossAnimation(
    sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
    tokenConfig: BossAnimationTokenConfig | keyof typeof BOSS_ANIMATION_TOKENS | string
): Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite {
    const config = typeof tokenConfig === 'string' 
        ? (BOSS_ANIMATION_TOKENS[tokenConfig] || TOKEN_CONFIG_LOOKUP.get(tokenConfig))
        : tokenConfig;
        
    if (!config) {
        if (typeof tokenConfig === 'string' && sprite.scene.anims.exists(tokenConfig)) {
            sprite.play(tokenConfig, true);
        }
        return sprite;
    }

    if (config.flipX !== undefined) {
        sprite.setFlipX(config.flipX);
    }

    sprite.play(config.animKey, true);
    return sprite;
}

