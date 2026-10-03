import Phaser from 'phaser';
import { Player } from './Player';
import { TemporaryPlatform } from './TemporaryPlatform';
import { UIManager } from '../managers/UIManager';
import { EnemyManager } from '../managers/EnemyManager';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { SoundManager } from '../managers/SoundManager';
import { InventoryManager } from '../managers/InventoryManager';
import { GameEventBus } from '../services/GameEventBus';
import { TOKENS } from '../theme/tokens';
import {
    BOSS_ANIM_KEYS,
    playBossAnimation,
    createBossAnimations,
    getBossBallAnimKey
} from './bossAnimationTokens';

export class EleckingBoss extends Phaser.Physics.Arcade.Sprite {
    private player: Player;
    private uiManager: UIManager;
    private enemyManager: EnemyManager;
    private soundManager?: SoundManager;
    private inventoryManager?: InventoryManager;

    public hasDiscoveredBoss: boolean = false;
    private hasStarted: boolean = false;
    private maxHp: number = 50;
    private hp: number = 50;
    public phase: number = 1;
    public isDead: boolean = false;
    public isInvulnerable: boolean = true;
    public hasReachedPhase2: boolean = false;
    private hasEnraged: boolean = false;

    private map: Phaser.Tilemaps.Tilemap;
    private arenaZone?: Phaser.Geom.Rectangle;
    private beamStartingZone?: Phaser.Geom.Rectangle;
    private arenaCover?: Phaser.GameObjects.TileSprite;
    public isEntranceRevealed: boolean = false;
    private pendingPhase2Transition: boolean = false;
    private bossEntranceZone?: Phaser.Geom.Rectangle;
    private envManager?: EnvironmentManager;
    public bossFightRespawn1?: { x: number, y: number };
    public bossFightRespawn2?: { x: number, y: number };
    public bossRespawnPoint?: { x: number, y: number };
    private victoryOrbZone?: Phaser.Geom.Rectangle;
    private initialSpawn: { x: number, y: number };
    private gravityOrbs: Phaser.GameObjects.Sprite[] = [];
    private rawGravityOrbData: { x: number, y: number, width?: number, height?: number, id?: number }[] = [];
    private orbRevealTimer?: Phaser.Time.TimerEvent;
    public tempPlatforms: TemporaryPlatform[] = [];
    private collectedOrbs: number = 0;
    private victoryOrb?: Phaser.Physics.Arcade.Sprite;
    private hasShownShieldedToast: boolean = false;
    private hasShownBossEncounterToast: boolean = false;
    private playerWasInArena: boolean = false;
    private isStompLocked: boolean = false;
    private stompLockTimer?: Phaser.Time.TimerEvent;
    
    // State Tracking
    private bossState: 
        | 'idle' 
        | 'idle-pre-encounter'
        | 'flying-to-pattern'
        | 'idle-pre-pattern'
        | 'flying-attack' 
        | 'ground-attack' 
        | 'ground-idle-pre-beam'
        | 'memory-telegraph' 
        | 'vanished' 
        | 'striking' 
        | 'reappearing' 
        | 'post-beam-idle'
        | 'player-dead-waiting'
        | 'transitioning' 
        | 'descending' 
        | 'patrolling' 
        | 'teleporting' 
        | 'summoning' 
        | 'raging' 
        | 'dead' = 'idle';
    
    // Phase 2 Movement Routine: Pace back & forth, maintain distance, anti-cornering
    private p2MoveDuration: number = 2500;
    private p2PaceDir: number = 1;
    private p2PaceFlipTimer: number = 0;
    private p2TurnCooldown: number = 0;
    private p2IsBackingAway: boolean = false;

    // Attack Properties
    private currentSequence: number[] = [];
    private thunderTiles: Map<number, Phaser.Tilemaps.Tile[]> = new Map();
    private summonThresholds = [35, 15];
    private orbsOfRageGroup: Phaser.Physics.Arcade.Group;
    private dotBlocks: Phaser.Physics.Arcade.StaticGroup;

    // Skeletons Minions Group
    private skeletonBombsGroup: Phaser.Physics.Arcade.Group;
    private skeletonBombs: Phaser.Physics.Arcade.Sprite[] = [];

    // Movement & Attack Timers
    private patrolSpeed: number = 60;
    private orbSpeed: number = 220;
    private orbInterval: number = 3000;
    private orbTimer: number = 3000;
    private flyingOrbTimer: number = 3500;
    private maintainDistance: number = 140;
    private basePhase2ThunderInterval: number = 12000;
    private phase2ThunderTimer: number = 7000;
    private teleportTimer: number = 5000;
    private baseTeleportInterval: number = 6800;
    private flyTarget?: { x: number, y: number };
    private flyTowardsPlayer: boolean = false;
    private nextAttackTimer: number = 3500;
    private activeTimers: Phaser.Time.TimerEvent[] = [];
    private activeAttackEffects: Phaser.GameObjects.GameObject[] = [];
    private activeTileGlowSprites: Phaser.GameObjects.Sprite[] = [];

    constructor(
        scene: Phaser.Scene, 
        x: number, 
        y: number, 
        player: Player, 
        uiManager: UIManager, 
        enemyManager: EnemyManager, 
        _envManager: EnvironmentManager,
        soundManager: SoundManager,
        rawMapObjects: any[],
        map: Phaser.Tilemaps.Tilemap,
        inventoryManager?: InventoryManager
    ) {
        const initialTex = scene.textures.exists('boss-fly-idle-1') 
            ? 'boss-fly-idle-1' 
            : (scene.textures.exists('elecking-power') ? 'elecking-power' : '__DEFAULT');
        super(scene, x, y, initialTex, 0);

        this.map = map;
        this.player = player;
        this.uiManager = uiManager;
        this.enemyManager = enemyManager;
        this.envManager = _envManager;
        this.soundManager = soundManager;
        this.inventoryManager = inventoryManager || (scene as any).inventoryManager;
        this.initialSpawn = { x, y };

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        // Character sprite is 112x112: set 64x96 centered hitbox
        body.setSize(64, 96);
        body.setOffset(24, 12);
        body.setImmovable(true);

        // Bullets hit boss
        scene.physics.add.overlap(this, this.player.bullets, (_bossObj, bulletObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (!bullet || !bullet.active || !bullet.scene) return;
            
            const bx = bullet.x;
            const by = bullet.y;
            if (bullet.body) {
                bullet.body.enable = false;
                bullet.body.checkCollision.none = true;
            }
            bullet.setActive(false);
            bullet.setVisible(false);
            if (bullet.scene) {
                bullet.scene.time.delayedCall(0, () => {
                    if (bullet && bullet.scene) bullet.destroy();
                });
            }
            this.uiManager.spawnParticles(bx, by, 0xF59E0B);

            // Phase 1: Zero damage, boss shielded
            // Phase 2: Vulnerable when patrolling or in ground orb attack
            const canTakeDamage = this.phase === 2 && 
                !this.isInvulnerable && 
                !this.isDead && 
                this.bossState !== 'vanished' && 
                this.bossState !== 'teleporting' && 
                this.bossState !== 'raging' && 
                this.bossState !== 'memory-telegraph' && 
                this.bossState !== 'striking';

            if (canTakeDamage) {
                this.takeDamage();
            } else if (this.isInvulnerable || this.phase === 1) {
                GameEventBus.getInstance().emit('boss:shield-hit', undefined);
                if (!this.hasShownShieldedToast) {
                    this.hasShownShieldedToast = true;
                    GameEventBus.getInstance().emit('toast:show', {
                        id: 'boss-shielded',
                        title: 'BOSS SHIELDED',
                        message: 'The boss is shielded. Collect the gravity orbs.',
                        variant: 'warning',
                        durationMs: 4000,
                    });
                }
            }
        });

        // Touching/jumping on the boss: Stomp mechanics (-5 damage, bounce, 4s lock) are ONLY for Phase 2
        scene.physics.add.overlap(this.player, this, () => {
            if (this.isDead || this.bossState === 'vanished' || this.bossState === 'teleporting' || !this.visible) return;

            // In Phase 1 (flying), player cannot stomp on the boss
            if (this.phase === 1) {
                GameEventBus.getInstance().emit('boss:shield-hit', undefined);
                if (!this.hasShownShieldedToast) {
                    this.hasShownShieldedToast = true;
                    GameEventBus.getInstance().emit('toast:show', {
                        id: 'boss-shielded',
                        title: 'BOSS SHIELDED',
                        message: 'The boss is shielded. Collect the gravity orbs.',
                        variant: 'warning',
                        durationMs: 4000,
                    });
                }
                return;
            }

            // Phase 2 Ground Encounter
            if (this.phase === 2) {
                const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                const bBody = this.body as Phaser.Physics.Arcade.Body;
                if (!pBody || !bBody) return;

                const isFalling = pBody.velocity.y > 0 || (pBody.prev && pBody.y > pBody.prev.y);
                const isAbove = pBody.bottom <= bBody.top + 28 || pBody.center.y < bBody.top + 16;
                const isStomp = isFalling && isAbove;

                if (isStomp) {
                    if (this.isStompLocked) {
                        // Lock is active: jumping on boss kills player
                        this.player.die();
                    } else {
                        // Successful stomp: -5 damage + bounce + 4s lock
                        this.isStompLocked = true;
                        if (this.stompLockTimer) {
                            this.stompLockTimer.remove(false);
                        }
                        this.stompLockTimer = this.scene.time.delayedCall(4000, () => {
                            this.isStompLocked = false;
                            this.stompLockTimer = undefined;
                        });

                        this.player.stompBounce(-380);
                        this.soundManager?.playStomp();
                        this.uiManager.spawnParticles(this.x, this.y - 20, 0xF59E0B);

                        if (!this.isInvulnerable) {
                            this.takeDamage(5);
                        }
                    }
                } else {
                    // Touching boss body from sides or below in Phase 2 kills the player
                    this.player.die();
                }
            }
        });

        this.setDepth(15);
        this.orbsOfRageGroup = scene.physics.add.group({ allowGravity: false });
        this.dotBlocks = scene.physics.add.staticGroup();
        scene.physics.add.collider(this.player, this.dotBlocks);
        scene.physics.add.collider(this.enemyManager.groundMobs, this.dotBlocks);

        // Skeleton Bombs Group setup
        this.skeletonBombsGroup = scene.physics.add.group({ allowGravity: true });
        if ((scene as any).groundLayer) {
            scene.physics.add.collider(this.skeletonBombsGroup, (scene as any).groundLayer);
        }
        scene.physics.add.collider(this.skeletonBombsGroup, this.dotBlocks);

        // Bullets hit skeleton minion (requires 3 shots to kill)
        scene.physics.add.overlap(this.player.bullets, this.skeletonBombsGroup, (bulletObj, skelObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            const skel = skelObj as Phaser.Physics.Arcade.Sprite;
            if (!bullet || !bullet.active || !skel || !skel.active) return;
            const state = skel.getData('state');
            if (state === 'dead' || state === 'exploding') return;

            bullet.destroy();

            const hp = (skel.getData('hp') as number) ?? 3;
            const newHp = hp - 1;
            skel.setData('hp', newHp);

            if (newHp <= 0) {
                this.killSkeleton(skel, false);
            } else {
                // Hit flash and particle effect on hit
                skel.setTint(0xF87171);
                this.soundManager?.playEnemyShoot();
                this.uiManager.spawnParticles(skel.x, skel.y - 14, 0xEF4444);
                this.scene.time.delayedCall(120, () => {
                    if (skel && skel.active && skel.getData('state') !== 'dead') {
                        skel.clearTint();
                    }
                });
            }
        });

        // Player vs skeleton: stomp detection (kill like other mobs) or prime/explode
        scene.physics.add.overlap(this.player, this.skeletonBombsGroup, (_p, skelObj) => {
            const skel = skelObj as Phaser.Physics.Arcade.Sprite;
            if (!skel || !skel.active) return;
            const skelState = skel.getData('state');
            if (skelState === 'dead' || skelState === 'exploding') return;

            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            const sBody = skel.body as Phaser.Physics.Arcade.Body;
            if (!pBody || !sBody) return;

            const isFalling = pBody.velocity.y > 0 || (pBody.prev && pBody.y > pBody.prev.y);
            const isAbove = pBody.bottom <= sBody.top + 16 || pBody.center.y < sBody.top + 8;

            if (isFalling && isAbove) {
                this.killSkeleton(skel);
            } else if (skelState === 'walking') {
                this.primeSkeletonForExplosion(skel);
            }
        });

        this.setupAnimations();
        this.parseMapObjects(rawMapObjects, map);

        scene.physics.add.collider(this.player, this.tempPlatforms, (_p, _plat) => {
            const playerSprite = _p as Player;
            const platform = _plat as TemporaryPlatform;
            platform.handlePlayerCollision(playerSprite);
        });
        
        // Initial setup for Phase 1 - starts frozen until player crosses BossFightEntrance
        this.startPhase1(false);

        this.scene.events.on('player-death', () => {
            this.isStompLocked = false;
            if (this.stompLockTimer) {
                this.stompLockTimer.remove(false);
                this.stompLockTimer = undefined;
            }
            this.uiManager.hideBossHealthBar();
            if (this.isPlayerInArena() || this.hasDiscoveredBoss || this.hasStarted) {
                const activeRespawn = this.getActiveRespawnPoint();
                if (activeRespawn) {
                    this.player.activeSpawnX = activeRespawn.x;
                    this.player.activeSpawnY = activeRespawn.y;
                }
            }
            this.onPlayerDeath();
        });

        this.scene.events.on('player-respawn', () => {
            this.isStompLocked = false;
            if (this.stompLockTimer) {
                this.stompLockTimer.remove(false);
                this.stompLockTimer = undefined;
            }
            this.uiManager.hideBossHealthBar();
            if (this.isEntranceRevealed) {
                if (this.arenaCover) this.arenaCover.setVisible(false);
                if (this.envManager) {
                    this.envManager.triggerRevealLayer('DungeonFill', true);
                    this.envManager.triggerRevealLayer('', true);
                }
            }
            const isBossRespawn = (
                (this.bossFightRespawn1 && this.player.activeSpawnX === this.bossFightRespawn1.x && this.player.activeSpawnY === this.bossFightRespawn1.y) ||
                (this.bossFightRespawn2 && this.player.activeSpawnX === this.bossFightRespawn2.x && this.player.activeSpawnY === this.bossFightRespawn2.y) ||
                (this.bossRespawnPoint && this.player.activeSpawnX === this.bossRespawnPoint.x && this.player.activeSpawnY === this.bossRespawnPoint.y)
            );
            if (isBossRespawn) {
                this.isEntranceRevealed = true;
                if (this.arenaCover) this.arenaCover.setVisible(false);
            }
            // Only grant gun if Phase 1 was genuinely completed!
            if (this.hasReachedPhase2 && !this.isDead) {
                this.player.hasGun = true;
                if (this.inventoryManager) {
                    this.inventoryManager.addGun();
                    this.inventoryManager.saveCheckpointSnapshot();
                } else if ((this.scene as any).inventoryManager) {
                    (this.scene as any).inventoryManager.addGun();
                    (this.scene as any).inventoryManager.saveCheckpointSnapshot();
                }
            }
            if ((this.hasDiscoveredBoss || this.hasStarted) && !this.isDead) {
                this.hasStarted = true;
                if (this.isPlayerInArena() || isBossRespawn) {
                    this.playerWasInArena = true;
                    this.uiManager.showBossHealthBar('ELECKING', this.maxHp, this.hp);
                }
                if (this.phase === 1) {
                    this.bossState = 'idle';
                    this.flyTarget = undefined;
                    playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                } else if (this.phase === 2) {
                    this.startGroundedPatrol();
                }
            }
        });
    }

    private setupAnimations() {
        createBossAnimations(this.scene);

        if (!this.scene.anims.exists('cloud-thunder-strike')) {
            this.scene.anims.create({
                key: 'cloud-thunder-strike',
                frames: this.scene.anims.generateFrameNumbers('cloud-thunder-attack', { start: 0, end: 4 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.scene.anims.exists('lightning-strike')) {
            this.scene.anims.create({
                key: 'lightning-strike',
                frames: this.scene.anims.generateFrameNumbers('cloud-thunder-attack', { start: 0, end: 4 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.scene.anims.exists('attack-orb-anim')) {
            this.scene.anims.create({
                key: 'attack-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('attack-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.scene.anims.exists('victory-orb-anim')) {
            this.scene.anims.create({
                key: 'victory-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('victory-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
        if (!this.scene.anims.exists('gravity-orb-anim')) {
            this.scene.anims.create({
                key: 'gravity-orb-anim',
                frames: this.scene.anims.generateFrameNumbers('gravity-orb', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: -1
            });
        }
    }

    private getProp(obj: any, keys: string[]): any {
        if (!obj) return undefined;
        const lookup = keys.map(k => k.toLowerCase());

        if (Array.isArray(obj.properties)) {
            const found = obj.properties.find((p: any) => p && p.name && lookup.includes(p.name.toLowerCase()));
            if (found && found.value !== undefined && found.value !== null && String(found.value).trim() !== '') {
                return found.value;
            }
        }

        if (obj.properties && typeof obj.properties === 'object') {
            for (const [k, v] of Object.entries(obj.properties)) {
                if (lookup.includes(k.toLowerCase()) && v !== undefined && v !== null && String(v).trim() !== '') {
                    return v;
                }
            }
        }

        for (const [k, v] of Object.entries(obj)) {
            if (lookup.includes(k.toLowerCase()) && v !== undefined && v !== null && String(v).trim() !== '') {
                return v;
            }
        }

        return undefined;
    }

    private parseMapObjects(rawMapObjects: any[], map: Phaser.Tilemaps.Tilemap) {
        // Find BossArenaZone
        const zoneObj = rawMapObjects.find(o => {
            const n = (o.name || '').toLowerCase();
            return n === 'bossarenazone' || n === 'bossarena' || n === 'bossfightzone';
        });
        if (zoneObj) {
            this.arenaZone = new Phaser.Geom.Rectangle(zoneObj.x, zoneObj.y, zoneObj.width || 800, zoneObj.height || 600);
        } else {
            this.arenaZone = new Phaser.Geom.Rectangle(this.x - 500, this.y - 400, 1000, 800);
        }

        if (this.arenaZone) {
            const groundTexKey = this.scene.textures.exists('plainGround') 
                ? 'plainGround' 
                : (this.scene.textures.exists('plain-ground') ? 'plain-ground' : 'blocks/plainGround');
            this.arenaCover = this.scene.add.tileSprite(
                this.arenaZone.x,
                this.arenaZone.y,
                this.arenaZone.width,
                this.arenaZone.height,
                groundTexKey
            );
            this.arenaCover.setOrigin(0, 0);
            this.arenaCover.setDepth(20);
            this.arenaCover.setVisible(true);
        }

        // Find BossFightEntrance
        const entranceObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightentrance' || nameLower === 'bossentrance';
        });
        if (entranceObj && entranceObj.x !== undefined && entranceObj.y !== undefined) {
            this.bossEntranceZone = new Phaser.Geom.Rectangle(
                entranceObj.x, 
                entranceObj.y, 
                entranceObj.width || 64, 
                Math.max(entranceObj.height || 0, 96)
            );
        }

        // Find BeamStartingZone
        const beamStartObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'beamstartingzone' || nameLower === 'beamstartzone' || nameLower === 'beamstart';
        });
        if (beamStartObj && beamStartObj.y !== undefined) {
            this.beamStartingZone = new Phaser.Geom.Rectangle(
                beamStartObj.x || 0,
                beamStartObj.y,
                beamStartObj.width || 1000,
                beamStartObj.height || 32
            );
        }

        // Find BossFightRespawn1 and BossFightRespawn2
        const respawn1Obj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn1' || nameLower === 'bossrespawn1';
        }) || rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn' || nameLower === 'bossrespawn';
        });

        const respawn2Obj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn2' || nameLower === 'bossrespawn2';
        });

        if (respawn1Obj && respawn1Obj.x !== undefined && respawn1Obj.y !== undefined) {
            this.bossFightRespawn1 = { x: respawn1Obj.x, y: respawn1Obj.y };
            this.bossRespawnPoint = { x: respawn1Obj.x, y: respawn1Obj.y };
        }

        if (respawn2Obj && respawn2Obj.x !== undefined && respawn2Obj.y !== undefined) {
            this.bossFightRespawn2 = { x: respawn2Obj.x, y: respawn2Obj.y };
        } else if (this.bossFightRespawn1 && this.arenaZone) {
            const arenaCenter = (this.arenaZone.left + this.arenaZone.right) / 2;
            const distFromCenter = this.bossFightRespawn1.x - arenaCenter;
            this.bossFightRespawn2 = {
                x: arenaCenter - distFromCenter,
                y: this.bossFightRespawn1.y
            };
        }

        // Find BossSpawn & parse custom configuration properties
        const bossSpawnObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossspawn' || nameLower === 'eleckingspawn';
        });
        if (bossSpawnObj) {
            const speedProp = this.getProp(bossSpawnObj, ['movespeed', 'speed', 'patrolspeed', 'speedx']);
            if (speedProp !== undefined && !isNaN(Number(speedProp))) {
                this.patrolSpeed = Number(speedProp);
            }

            const orbSpeedProp = this.getProp(bossSpawnObj, ['orbspeed', 'rageorbspeed', 'projectilespeed']);
            if (orbSpeedProp !== undefined && !isNaN(Number(orbSpeedProp))) {
                this.orbSpeed = Number(orbSpeedProp);
            }

            const orbIntervalProp = this.getProp(bossSpawnObj, ['orbinterval', 'rageorbinterval', 'shootinterval', 'interval']);
            if (orbIntervalProp !== undefined && !isNaN(Number(orbIntervalProp))) {
                this.orbInterval = Number(orbIntervalProp);
                this.orbTimer = this.orbInterval;
            }

            const thunderIntervalProp = this.getProp(bossSpawnObj, ['thunderinterval', 'p2thunderinterval', 'phase2thunderinterval']);
            if (thunderIntervalProp !== undefined && !isNaN(Number(thunderIntervalProp))) {
                this.phase2ThunderTimer = Number(thunderIntervalProp);
                this.basePhase2ThunderInterval = Number(thunderIntervalProp);
            }

            const maintainDistProp = this.getProp(bossSpawnObj, ['maintaindistance', 'combatdistance', 'distancetoplayer']);
            if (maintainDistProp !== undefined && !isNaN(Number(maintainDistProp))) {
                this.maintainDistance = Number(maintainDistProp);
            }

            const maxHpProp = this.getProp(bossSpawnObj, ['maxhp', 'hp', 'health']);
            if (maxHpProp !== undefined && !isNaN(Number(maxHpProp))) {
                this.maxHp = Number(maxHpProp);
                this.hp = this.maxHp;
            }
        }

        // Find VictoryOrb Spawn Zone
        const victoryOrbObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'victoryorb';
        });
        if (victoryOrbObj && victoryOrbObj.x !== undefined && victoryOrbObj.y !== undefined) {
            this.victoryOrbZone = new Phaser.Geom.Rectangle(
                victoryOrbObj.x,
                victoryOrbObj.y,
                victoryOrbObj.width || 64,
                victoryOrbObj.height || 64
            );
        }

        // Find TemporaryClouds / TempPlatforms
        const cloudObjs = rawMapObjects.filter(o => {
            const nameLower = (o.name || '').toLowerCase();
            const typeLower = (o.type || '').toLowerCase();
            const classLower = (o.class || '').toLowerCase();
            const isTempGid = o.gid && map.tilesets && map.tilesets.some((t: any) => {
                const tsName = (t.name || '').toLowerCase();
                return (tsName.includes('temp platform') || tsName.includes('temp-platform')) && o.gid >= t.firstgid && o.gid < t.firstgid + (t.total || 4);
            });
            return nameLower === 'temporarycloud' || nameLower === 'tempcloud' ||
                   nameLower === 'tempplatform' || nameLower === 'tempplatforms' ||
                   nameLower === 'temporaryplatform' || nameLower === 'temporaryplatforms' ||
                   nameLower === 'temp platforms' || nameLower === 'temp platform' ||
                   typeLower === 'tempplatform' || typeLower === 'temporarycloud' ||
                   classLower === 'tempplatform' || classLower === 'temporarycloud' ||
                   Boolean(isTempGid);
        });

        cloudObjs.forEach(c => {
            const platform = new TemporaryPlatform(this.scene, c);
            this.tempPlatforms.push(platform);
        });

        // Find Gravity Orbs
        const orbObjs = rawMapObjects.filter(o => {
            const nameLower = (o.name || '').toLowerCase();
            const typeLower = (o.type || '').toLowerCase();
            const classLower = (o.class || '').toLowerCase();
            return nameLower === 'gravityorb' || nameLower === 'gravity orb' || 
                   typeLower === 'gravityorb' || typeLower === 'gravity orb' ||
                   classLower === 'gravityorb' || classLower === 'gravity orb';
        });

        this.rawGravityOrbData = orbObjs.map(o => {
            const centerX = o.gid 
                ? o.x + (o.width || 32) / 2 
                : o.x + (o.width || 32) / 2;
            const centerY = o.gid 
                ? o.y - (o.height || 32) / 2 
                : o.y + (o.height || 32) / 2;
            const width = o.width || 32;
            const height = o.height || 32;

            const idProp = this.getProp(o, ['id', 'order', 'index', 'sequence', 'seq', 'orbindex', 'orborder', 'number']);
            const parsedId = (idProp !== undefined && !isNaN(Number(idProp))) ? Number(idProp) : undefined;

            return {
                x: centerX,
                y: centerY,
                width: width,
                height: height,
                id: parsedId
            };
        });
        this.spawnGravityOrbs();

        // Find Hazard tiles with dotNumber
        const dotObjects = rawMapObjects.filter((o: any) => {
            const val = this.getProp(o, ['dotNumber', 'dotnumber', 'dot']);
            return val !== undefined && val !== null;
        });

        dotObjects.forEach((o: any) => {
            const dot = Number(this.getProp(o, ['dotNumber', 'dotnumber', 'dot']));
            if (!this.thunderTiles.has(dot)) this.thunderTiles.set(dot, []);

            if (o.gid) {
                const cleanGid = o.gid & 0x1FFFFFFF;
                const tileset = map.tilesets.find((t: any) => cleanGid >= t.firstgid && cleanGid < t.firstgid + (t.total || 10));
                let localFrame = 0;
                if (cleanGid >= 2465 && cleanGid < 2475) {
                    localFrame = cleanGid - 2465;
                } else if (tileset && tileset.firstgid) {
                    localFrame = cleanGid - tileset.firstgid;
                }

                let texKey = 'attack-tiles';
                if (this.scene.textures.exists('attack-tiles')) {
                    texKey = 'attack-tiles';
                } else if (this.scene.textures.exists('attack tiles')) {
                    texKey = 'attack tiles';
                }

                const sprite = this.dotBlocks.create(o.x, o.y, texKey, localFrame) as Phaser.Physics.Arcade.Sprite;
                sprite.setOrigin(0, 1);
                sprite.setDisplaySize(o.width || 32, o.height || 32);
                sprite.refreshBody();
                sprite.setDepth(3.5);

                this.thunderTiles.get(dot)!.push({
                    pixelX: o.x,
                    pixelY: o.y - (o.height || 32),
                    width: o.width || 32,
                    height: o.height || 32
                } as any);
            } else {
                const block = this.scene.add.rectangle(o.x + (o.width || 32)/2, o.y + (o.height || 32)/2, o.width || 32, o.height || 32, 0x000000, 0);
                this.scene.physics.add.existing(block, true);
                this.dotBlocks.add(block);

                this.thunderTiles.get(dot)!.push({
                    pixelX: o.x,
                    pixelY: o.y,
                    width: o.width || 32,
                    height: o.height || 32
                } as any);
            }
        });

        // From Ground tilelayer
        const groundLayer = map.getLayer('Ground')?.tilemapLayer;
        if (groundLayer) {
            groundLayer.forEachTile(tile => {
                if (tile.properties && (tile.properties.dotNumber || tile.properties.dot)) {
                    const dot = Number(tile.properties.dotNumber || tile.properties.dot);
                    if (!this.thunderTiles.has(dot)) this.thunderTiles.set(dot, []);
                    this.thunderTiles.get(dot)!.push(tile);
                }
            });
        }

        // Setup bounds & collisions for Orbs of Rage against Ground layers
        if ((this.scene as any).groundLayer) {
            this.scene.physics.add.collider(this.orbsOfRageGroup, (this.scene as any).groundLayer, (orbObj) => {
                const orb = orbObj as Phaser.Physics.Arcade.Sprite;
                if (orb && orb.active) {
                    const ox = orb.x;
                    const oy = orb.y;
                    orb.destroy();
                    this.uiManager.spawnParticles(ox, oy, 0xA855F7);
                }
            });
        }
        map.layers.forEach(layerData => {
            const tLayer = layerData.tilemapLayer;
            if (tLayer) {
                const lName = (layerData.name || '').toLowerCase();
                if (lName.includes('ground') || lName.includes('dungeon') || lName.includes('fill') || lName.includes('boss') || lName.includes('well')) {
                    this.scene.physics.add.collider(this.orbsOfRageGroup, tLayer, (orbObj) => {
                        const orb = orbObj as Phaser.Physics.Arcade.Sprite;
                        if (orb && orb.active) {
                            const ox = orb.x;
                            const oy = orb.y;
                            orb.destroy();
                            this.uiManager.spawnParticles(ox, oy, 0xA855F7);
                        }
                    });
                }
            }
        });
    }

    private spawnGravityOrbs() {
        if (this.orbRevealTimer) {
            this.orbRevealTimer.remove(false);
            this.orbRevealTimer = undefined;
        }

        this.gravityOrbs.forEach(orb => {
            if (orb && orb.active) orb.destroy();
        });
        this.gravityOrbs = [];

        // Requirement: Orbs only appear inside the arena once the boss is discovered by the player
        if (!this.hasDiscoveredBoss) {
            return;
        }

        const definedIds = this.rawGravityOrbData
            .filter(d => d.id !== undefined && !isNaN(d.id))
            .map(d => d.id!);

        const sortedUniqueIds = Array.from(new Set(definedIds)).sort((a, b) => a - b);
        const hasSequentialIds = sortedUniqueIds.length > 0;
        const firstActiveId = hasSequentialIds ? sortedUniqueIds[0] : undefined;
        const totalOrbs = 7;
        GameEventBus.getInstance().emitOrbsIfChanged({ collected: this.collectedOrbs, total: totalOrbs });

        this.rawGravityOrbData.forEach(pos => {
            const orb = this.scene.physics.add.sprite(pos.x, pos.y, 'gravity-orb');
            orb.play('gravity-orb-anim');
            orb.setDepth(10);
            orb.setOrigin(0.5, 0.5);
            orb.setDisplaySize(pos.width || 32, pos.height || 32);

            const orbBody = orb.body as Phaser.Physics.Arcade.Body;
            if (orbBody) {
                orbBody.setAllowGravity(false);
                orbBody.setSize(24, 24);
                orbBody.setOffset(4, 4);
            }

            orb.setData('orbId', pos.id);

            if (hasSequentialIds && pos.id !== undefined) {
                if (pos.id === firstActiveId) {
                    orb.setVisible(true);
                    orb.setActive(true);
                    if (orbBody) orbBody.setEnable(true);
                } else {
                    orb.setVisible(false);
                    orb.setActive(false);
                    if (orbBody) orbBody.setEnable(false);
                }
            } else {
                orb.setVisible(true);
                orb.setActive(true);
                if (orbBody) orbBody.setEnable(true);
            }

            this.gravityOrbs.push(orb);

            // Overlap to collect
            this.scene.physics.add.overlap(this.player, orb, () => {
                if (!orb.visible || !orb.active) return;

                const currentOrbId = orb.getData('orbId');
                const pickupX = orb.x;
                const pickupY = orb.y;
                orb.destroy();

                if (hasSequentialIds && currentOrbId !== undefined) {
                    const currentIndex = sortedUniqueIds.indexOf(currentOrbId);
                    const nextId = (currentIndex !== -1 && currentIndex + 1 < sortedUniqueIds.length)
                        ? sortedUniqueIds[currentIndex + 1]
                        : currentOrbId + 1;

                    if (this.orbRevealTimer) {
                        this.orbRevealTimer.remove(false);
                        this.orbRevealTimer = undefined;
                    }

                    // Requirement 2: Collecting orb no.1 reveals orb no.2 (inactive orbs have active=false, so check o.scene)
                    const nextOrb = this.gravityOrbs.find(o => o && o.scene && o.getData('orbId') === nextId);
                    if (nextOrb) {
                        nextOrb.setVisible(true);
                        nextOrb.setActive(true);
                        const nBody = nextOrb.body as Phaser.Physics.Arcade.Body;
                        if (nBody) nBody.setEnable(true);
                        this.uiManager.spawnParticles(nextOrb.x, nextOrb.y, parseInt(TOKENS.colors.orbCyan.replace('#', '0x'), 16));
                        this.soundManager?.playPowerup();
                    }
                }

                const pipIndex = this.collectedOrbs; // 0-indexed for 1st pip, 1 for 2nd pip, etc.
                this.collectedOrbs++;
                const remaining = Math.max(0, 7 - this.collectedOrbs);

                this.soundManager?.playCoin();

                // Requirement 1 & 2: Show React UI Kit n/7 popup near the collected orb (offset from player to avoid overlap)
                const isPlayerToRight = this.player.x >= pickupX;
                const offsetDir = isPlayerToRight ? -1 : 1;
                const popupWorldX = pickupX + (offsetDir * 38);
                const popupWorldY = pickupY - 24;

                const cam = this.scene.cameras.main;
                const screenX = ((popupWorldX - cam.scrollX) * cam.zoom / 854) * 100;
                const screenY = ((popupWorldY - cam.scrollY) * cam.zoom / 480) * 100;

                GameEventBus.getInstance().emit('orb:collected-popup', {
                    id: `orb-popup-${Date.now()}-${this.collectedOrbs}`,
                    current: this.collectedOrbs,
                    total: 7,
                    x: Math.max(4, Math.min(96, screenX)),
                    y: Math.max(4, Math.min(96, screenY)),
                });

                // UI Kit Toast Notification for collecting gravity orb (React UI)
                GameEventBus.getInstance().emit('toast:show', {
                    id: `orb-collected-${currentOrbId || pipIndex + 1}`,
                    title: `GRAVITY ORB #${currentOrbId || pipIndex + 1}`,
                    message: remaining > 0 ? `${remaining} remaining to break Elecking's shield` : 'All 7 orbs collected! Shield shattered!',
                    icon: 'orb',
                    variant: 'info',
                    durationMs: 2500,
                });

                // Requirement 2: Collecting gravity orb makes it fly towards the gravity orb progress pip bar
                this.uiManager.playOrbPickupEffect(pickupX, pickupY, pipIndex, () => {
                    // Update React ProgressPips
                    GameEventBus.getInstance().emitOrbsIfChanged({ collected: this.collectedOrbs, total: 7 });

                    // Requirement 3: All 7 orbs collected -> Complete Phase 1 and Transition to Phase 2
                    if (this.collectedOrbs >= 7 || remaining === 0) {
                        GameEventBus.getInstance().emit('toast:show', {
                            id: 'phase1-complete',
                            title: 'PHASE 1 COMPLETE',
                            message: 'All 7 Gravity Orbs collected! Elecking\'s shield is shattered!',
                            icon: 'shield',
                            variant: 'success',
                            durationMs: 4000,
                        });
                        this.transitionToPhase2();
                    }
                });
            });
        });
    }

    // Requirement 1: If boss is on right half of bossarenazone -> BossFightRespawn2, else BossFightRespawn1
    public getActiveRespawnPoint(): { x: number, y: number } | undefined {
        if (!this.arenaZone) {
            return this.bossFightRespawn1 || this.bossFightRespawn2 || this.bossRespawnPoint;
        }
        const arenaCenter = (this.arenaZone.left + this.arenaZone.right) / 2;
        const isBossOnRightHalf = this.x >= arenaCenter;
        const chosen = isBossOnRightHalf
            ? (this.bossFightRespawn2 || this.bossFightRespawn1 || this.bossRespawnPoint)
            : (this.bossFightRespawn1 || this.bossFightRespawn2 || this.bossRespawnPoint);

        if (chosen) {
            this.bossRespawnPoint = chosen;
        }
        return chosen;
    }

    public isPlayerInArena(): boolean {
        if (!this.player || !this.player.active) return false;
        if (this.arenaZone) {
            const minX = this.arenaZone.left - 64;
            const maxX = this.arenaZone.right + 96;
            const minY = Math.min(this.arenaZone.top - 320, (this.bossEntranceZone?.top ?? 990) - 64);
            const maxY = this.arenaZone.bottom + 64;
            return this.player.x >= minX && this.player.x <= maxX && this.player.y >= minY && this.player.y <= maxY;
        }
        return false;
    }

    public isPlayerTouchingEntrance(): boolean {
        if (!this.player || !this.player.active || !this.bossEntranceZone) return false;
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        if (!pBody) return false;
        const playerRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
        return Phaser.Geom.Intersects.RectangleToRectangle(playerRect, this.bossEntranceZone);
    }

    public isBossVisibleInCamera(): boolean {
        const cam = this.scene.cameras.main;
        if (!cam) return false;
        const view = cam.worldView;
        const bossMargin = 64;
        if (view && view.width > 0 && view.height > 0) {
            return (
                this.x >= view.x - bossMargin &&
                this.x <= (view.x + view.width) + bossMargin &&
                this.y >= view.y - bossMargin &&
                this.y <= (view.y + view.height) + bossMargin
            );
        }
        const viewX = cam.scrollX;
        const viewY = cam.scrollY;
        const viewW = cam.width / (cam.zoom || 1);
        const viewH = cam.height / (cam.zoom || 1);
        return (
            this.x >= viewX - bossMargin &&
            this.x <= viewX + viewW + bossMargin &&
            this.y >= viewY - bossMargin &&
            this.y <= viewY + viewH + bossMargin
        );
    }

    private activateEncounter() {
        this.hasDiscoveredBoss = true;
        if (this.hasStarted) return;
        this.hasStarted = true;

        if (!this.hasShownBossEncounterToast) {
            this.hasShownBossEncounterToast = true;
            GameEventBus.getInstance().emit('toast:show', {
                id: 'boss-encounter',
                title: 'BOSS ENCOUNTER',
                message: 'Elecking has appeared! Collect all 7 gravity orbs to shatter its shield.',
                variant: 'info',
                durationMs: 4500,
            });
        }

        this.uiManager.showBossHealthBar('ELECKING', this.maxHp, this.hp);
        this.spawnGravityOrbs();

        if (this.phase === 2) {
            this.startGroundedPatrol();
        } else if (this.phase === 1) {
            // Give 2.4s pause so player can comprehend the boss before opening barrage
            this.bossState = 'idle-pre-encounter';
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body) body.setVelocity(0, 0);
            this.setFlipX(this.player.x < this.x);
            playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);

            this.nextAttackTimer = 16000;
            this.flyingOrbTimer = 4500;

            this.addBossTimer(2400, () => {
                if (this.hasStarted && !this.isDead && this.phase === 1 && this.bossState === 'idle-pre-encounter') {
                    this.shootOrbFlying(3);
                }
            });
        }
    }

    public resetAll(fullReset: boolean = true) {
        this.isStompLocked = false;
        if (this.stompLockTimer) {
            this.stompLockTimer.remove(false);
            this.stompLockTimer = undefined;
        }
        if (fullReset) {
            this.playerWasInArena = false;
            this.hasDiscoveredBoss = false;
            this.hasShownBossEncounterToast = false;
            this.hasShownShieldedToast = false;
            if (this.soundManager) this.soundManager.stopMusic();
        }
        this.uiManager.hideBossHealthBar();

        this.activeTimers.forEach(t => t.remove(false));
        this.activeTimers = [];

        this.activeAttackEffects.forEach(e => {
            if (e && e.active) e.destroy();
        });
        this.activeAttackEffects = [];
        this.activeTileGlowSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.activeTileGlowSprites = [];

        // Requirement 3: If player dies while minions are spawned, minions shouldn't disappear (only clear on full stage reset)
        if (fullReset) {
            this.skeletonBombs.forEach(s => {
                if (s && s.active) {
                    const timer = s.getData('primeTimer') as Phaser.Time.TimerEvent;
                    if (timer) timer.remove();
                    s.destroy();
                }
            });
            this.skeletonBombs = [];
            if (this.skeletonBombsGroup) {
                this.skeletonBombsGroup.clear(true, true);
            }
        }

        this.orbsOfRageGroup.getChildren().forEach(orb => {
            if (orb && orb.active) orb.destroy();
        });

        if (this.victoryOrb && this.victoryOrb.active) {
            this.victoryOrb.destroy();
            this.victoryOrb = undefined;
        }

        // Requirement 3: Only resume in Phase 2 if the player had genuinely completed Phase 1 (collected all 7 orbs)
        const shouldBePhase2 = this.hasReachedPhase2 && !fullReset;

        if (!shouldBePhase2) {
            // Phase 1 Reset: stays in Phase 1 until all 7 gravity orbs are collected
            this.hasStarted = this.hasDiscoveredBoss;
            this.hp = this.maxHp;
            this.collectedOrbs = 0;
            this.phase = 1;
            this.isDead = false;
            this.isInvulnerable = true;
            this.hasReachedPhase2 = false;
            this.hasEnraged = false;
            this.summonThresholds = [35, 15];
            this.currentSequence = [];
            this.flyTarget = undefined;
            this.flyTowardsPlayer = false;
            this.nextAttackTimer = 15000;
            this.flyingOrbTimer = 3500;
            this.orbTimer = this.orbInterval;
            this.phase2ThunderTimer = this.basePhase2ThunderInterval;
            this.teleportTimer = this.baseTeleportInterval;

            this.uiManager.hideBossHealthBar();
            this.startPhase1(false);
            this.spawnGravityOrbs();

            this.tempPlatforms.forEach(platform => {
                platform.reset(fullReset);
            });

            this.setVisible(true);
            this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setEnable(true);
                body.setVelocity(0, 0);
                body.setSize(64, 96);
                body.setOffset(24, 12);
            }

            this.pendingPhase2Transition = false;
            // Requirement 1: Once player has passed through BossFightEntrance, it stays permanently revealed!
            if (this.isEntranceRevealed) {
                if (this.arenaCover) {
                    this.arenaCover.setVisible(false);
                }
                if (this.envManager) {
                    this.envManager.triggerRevealLayer('DungeonFill', true);
                    this.envManager.triggerRevealLayer('', true);
                }
            } else {
                if (this.arenaCover) {
                    this.arenaCover.setVisible(true);
                }
            }
        } else {
            // Phase 2 Respawn Reset (only if Phase 1 was genuinely completed)
            this.isDead = false;
            this.phase = 2;
            this.isInvulnerable = false;
            this.summonThresholds = this.summonThresholds.filter(t => t < this.hp);
            this.pendingPhase2Transition = false;
            this.currentSequence = [];
            this.phase2ThunderTimer = 8500;
            this.teleportTimer = 5500;
            this.isEntranceRevealed = true;
            if (this.arenaCover) {
                this.arenaCover.setVisible(false);
            }

            this.tempPlatforms.forEach(platform => {
                platform.reset(false);
            });

            this.startPhase2Directly();
        }
    }

    public setBossFrame(frameIndex: number | string) {
        this.setFrame(frameIndex);
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setSize(64, 96);
            body.setOffset(24, 12);
        }
    }

    private startPhase1(retainPosition: boolean = false) {
        this.phase = 1;
        this.isInvulnerable = true;
        this.bossState = 'idle';
        this.nextAttackTimer = 15000;
        this.flyingOrbTimer = 3200;

        playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
        this.setVisible(true);
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 1, invulnerable: true });

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
            body.setSize(64, 96);
            body.setOffset(24, 12);
        }
        if (!retainPosition) {
            this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
        }
    }

    private startPhase2Directly() {
        this.phase = 2;
        this.hasReachedPhase2 = true;
        this.isInvulnerable = false;
        this.bossState = 'patrolling';
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });

        this.uiManager.showBossHealthBar('ELECKING', 50, this.hp);

        const groundY = this.findGroundYBelow(this.x, this.y);
        this.setY(groundY - 56);
        this.setVisible(true);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setAllowGravity(false);
            body.setSize(64, 96);
            body.setOffset(24, 12);
        }

        playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
        this.startGroundedPatrol();
    }

    private addBossTimer(delay: number, callback: () => void, loop: boolean = false): Phaser.Time.TimerEvent {
        const timer = this.scene.time.addEvent({
            delay,
            loop,
            callback: () => {
                if (this && this.active) callback();
            }
        });
        this.activeTimers.push(timer);
        return timer;
    }

    // Requirement 1: Flying Orb Attack - Fires single or rapid barrages (3 orbs initial, 4 orbs later)
    private shootOrbFlying(count?: number) {
        if (this.phase !== 1 || (this.bossState !== 'idle' && this.bossState !== 'idle-pre-encounter') || this.isDead) return;
        // Never shoot orbs if pattern is coming up soon (unless forced opening barrage)
        if (this.nextAttackTimer <= 2000 && count === undefined) return;

        const orbCount = count ?? (Phaser.Math.Between(1, 100) <= 35 ? 4 : 1);

        this.bossState = 'flying-attack';
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        this.setFlipX(this.player.x < this.x);
        playBossAnimation(this, BOSS_ANIM_KEYS.FLYING);

        if (orbCount > 1) {
            // Rapid-fire barrage of N orbs (4 initial, 5 later)
            const interval = 360;
            for (let i = 0; i < orbCount; i++) {
                this.addBossTimer(200 + i * interval, () => {
                    if (this.phase === 1 && this.bossState === 'flying-attack' && !this.isDead) {
                        this.setFlipX(this.player.x < this.x);
                        this.fireOrbOfRage();
                    }
                });
            }

            const totalDuration = 200 + orbCount * interval + 350;
            this.addBossTimer(totalDuration, () => {
                if (this.isDead) return;
                if (this.phase === 1 && this.bossState === 'flying-attack') {
                    this.bossState = 'idle';
                    this.flyTarget = undefined;
                    const baseInterval = 3200;
                    this.flyingOrbTimer = Phaser.Math.Between(Math.round(baseInterval * 0.8), Math.round(baseInterval * 1.2));
                }
            });
        } else {
            // Single orb shot
            this.addBossTimer(250, () => {
                if (this.phase === 1 && this.bossState === 'flying-attack' && !this.isDead) {
                    this.setFlipX(this.player.x < this.x);
                    this.fireOrbOfRage();
                }
            });
            this.addBossTimer(550, () => {
                if (this.isDead) return;
                if (this.phase === 1 && this.bossState === 'flying-attack') {
                    this.bossState = 'idle';
                    const baseInterval = 3000;
                    this.flyingOrbTimer = Phaser.Math.Between(Math.round(baseInterval * 0.75), Math.round(baseInterval * 1.25));
                }
            });
        }
    }

    // Requirement 4: Boss pauses wherever it currently is in the arena, becomes idle in air, then displays 3-ball pattern
    private prepareAndStartPattern() {
        if (!this.hasStarted || this.isDead) return;
        if (this.phase !== 1) {
            this.playBeamTelegraph();
            return;
        }

        // Stop moving, hover idle in mid-air wherever the boss currently is in the arena
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) body.setVelocity(0, 0);

        this.bossState = 'idle-pre-pattern';
        playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
        this.setFlipX(this.player.x < this.x);

        // Hover idle for 600ms, then start displaying pattern
        this.addBossTimer(600, () => {
            if (this.hasStarted && !this.isDead && this.bossState === 'idle-pre-pattern') {
                this.playBeamTelegraph();
            }
        });
    }

    private shootOrbGrounded() {
        if (this.phase !== 2 || this.bossState !== 'patrolling' || this.isDead || this.hasActiveMinions()) return;

        this.bossState = 'ground-attack';
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        // Face player during cast
        this.setFlipX(this.player.x < this.x);
        playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);

        const mouthX = this.x + (this.player.x > this.x ? 24 : -24);
        const mouthY = this.y - 12;
        this.uiManager.spawnParticles(mouthX, mouthY, 0xA855F7);

        this.addBossTimer(350, () => {
            if (this.phase === 2 && this.bossState === 'ground-attack' && !this.isDead) {
                this.fireOrbOfRage();
                this.addBossTimer(350, () => {
                    if (this.phase === 2 && this.bossState === 'ground-attack' && !this.isDead) {
                        this.orbTimer = this.getEffectiveOrbInterval();
                        this.startGroundedPatrol();
                    }
                });
            }
        });
    }

    // Phase 2 Ground Beam Attack: Stays idle first, then shows pattern -> disappears -> beams strike -> reappears
    private initiatePhase2BeamAttack() {
        if (this.phase !== 2 || this.isDead || this.bossState === 'dead') return;
        if (
            this.bossState === 'memory-telegraph' || 
            this.bossState === 'vanished' || 
            this.bossState === 'striking' ||
            this.bossState === 'ground-idle-pre-beam' ||
            this.bossState === 'summoning' ||
            this.bossState === 'raging'
        ) {
            return;
        }

        this.bossState = 'ground-idle-pre-beam';
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        // Stay idle facing the player before showing pattern
        this.setFlipX(this.player.x < this.x);
        playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);

        // Stay idle briefly before initiating pattern
        this.addBossTimer(850, () => {
            if (this.phase === 2 && this.bossState === 'ground-idle-pre-beam' && !this.isDead) {
                this.playBeamTelegraph();
            }
        });
    }

    // Requirements 3 & 4: Beam Pre-attack telegraph with ball lighting pattern and disappearance
    private playBeamTelegraph() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'memory-telegraph';
        this.isInvulnerable = true;
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: this.phase, invulnerable: true });
        this.anims.stop();
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        const available = [1, 2, 3, 4, 5];
        this.currentSequence = Phaser.Utils.Array.Shuffle(available).slice(0, 3);

        const isFlying = this.phase === 1;
        let step = 0;

        const playNextTelegraph = () => {
            if (!this.hasStarted || this.isDead || this.bossState !== 'memory-telegraph') return;

            if (step < this.currentSequence.length) {
                const dotNumber = this.currentSequence[step];

                // Play the specific ball animation on boss's body (2 frames per ball, wing flaps in sync)
                const ballAnimKey = getBossBallAnimKey(dotNumber, isFlying);
                playBossAnimation(this, ballAnimKey);

                this.soundManager?.playEnemyShoot();

                step++;
                // 1000ms = exactly 2 full wing-flap cycles (250ms * 4), keeping transitions completely smooth and in sync
                this.addBossTimer(1000, playNextTelegraph);
            } else {
                // Requirements 3 & 4: Boss disappears before beams strike
                if (isFlying) {
                    // Requirement 4: Boss Disappearing (Air Pre-attack)
                    playBossAnimation(this, BOSS_ANIM_KEYS.FLY_DISAPPEAR);
                    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                        if (anim.key === BOSS_ANIM_KEYS.FLY_DISAPPEAR) {
                            this.vanishAndStrike();
                        }
                    });
                } else {
                    // Requirement 3: Boss Disappearing (Ground Pre-attack)
                    playBossAnimation(this, BOSS_ANIM_KEYS.GROUND_ATTACK_TELEGRAPH);
                    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                        if (anim.key === BOSS_ANIM_KEYS.GROUND_ATTACK_TELEGRAPH) {
                            this.vanishAndStrike();
                        }
                    });
                }
            }
        };

        playNextTelegraph();
    }

    private vanishAndStrike() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'vanished';
        // Clear any previous glow sprites
        this.activeTileGlowSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.activeTileGlowSprites = [];

        // Requirement 1: The tiles pulse 2 times slowly after the boss has disappeared and before beams striking
        const uniqueDots = Array.from(new Set(this.currentSequence));
        uniqueDots.forEach(dotNumber => {
            const tiles = this.thunderTiles.get(dotNumber) || [];
            tiles.forEach(tile => {
                const tx = tile.pixelX !== undefined ? tile.pixelX : (tile as any).x;
                const ty = tile.pixelY !== undefined ? tile.pixelY : (tile as any).y;
                const tw = tile.width || 32;
                const th = tile.height || 32;
                const tileCenterX = tx + tw / 2;
                const tileCenterY = ty + th / 2;

                const animKey = `attack-tile-glow-${dotNumber}`;
                if (this.scene.anims.exists(animKey)) {
                    const glowSprite = this.scene.add.sprite(tileCenterX, tileCenterY, 'atk-tile-glow-1', `tile-${dotNumber}-glow-1`);
                    glowSprite.setDepth(11);
                    glowSprite.setAlpha(0);
                    glowSprite.play(animKey);
                    this.activeAttackEffects.push(glowSprite);
                    this.activeTileGlowSprites.push(glowSprite);

                    // Pulse 2 times (fade up -> fade down -> fade up -> hold/peak) over ~2600ms
                    this.scene.tweens.add({
                        targets: glowSprite,
                        alpha: { from: 0.15, to: 1 },
                        duration: 650,
                        yoyo: true,
                        repeat: 1, // 2 full pulses
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            if (glowSprite && glowSprite.active) {
                                this.scene.tweens.add({
                                    targets: glowSprite,
                                    alpha: 1,
                                    duration: 200,
                                    ease: 'Sine.easeIn'
                                });
                            }
                        }
                    });
                }
            });
        });

        // Disappear for 2.8 seconds while tiles pulse 2 times, then strike beams
        this.addBossTimer(2850, () => {
            if (this.hasStarted && !this.isDead && this.bossState === 'vanished') {
                this.executeBeamStrikes();
            }
        });
    }

    private isPlayerDeadOrDying(): boolean {
        if (!this.player) return false;
        return Boolean(this.player.isDying || this.player.isReviving || (this.player as any).activeDeathSprite);
    }

    public onPlayerDeath() {
        if (this.isDead) return;
        const bBody = this.body as Phaser.Physics.Arcade.Body;
        if (bBody) bBody.setVelocity(0, 0);

        const wasVanished = this.bossState === 'vanished';
        this.bossState = 'player-dead-waiting';

        // Toggle idle animation for wherever the boss is right now (flying / on ground) until player respawns
        if (this.visible && !wasVanished) {
            if (this.phase === 1) {
                playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
            } else {
                playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
            }
        }
    }

    private executeBeamStrikes() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'striking';

        let delay = 0;
        this.currentSequence.forEach(dotNumber => {
            this.addBossTimer(delay, () => {
                if (!this.hasStarted || this.isDead || this.bossState !== 'striking') return;
                const tiles = this.thunderTiles.get(dotNumber) || [];
                tiles.forEach(tile => {
                    const tileX = tile.pixelX !== undefined ? tile.pixelX : (tile as any).x;
                    const tileY = tile.pixelY !== undefined ? tile.pixelY : (tile as any).y;
                    const tileW = tile.width || 32;
                    const tileCenterX = tileX + tileW / 2;

                    // Determine beam starting top Y from BeamStartingZone or fallback to arena top / 10 tiles above
                    const startY = this.beamStartingZone 
                        ? this.beamStartingZone.y 
                        : (this.arenaZone ? this.arenaZone.top : tileY - 352);
                    const topCenterY = startY + 16;
                    const beamSprites: Phaser.GameObjects.Sprite[] = [];

                    // a. Start beam from the top row within BeamStartingZone using main attack new1.png to main attack new3.png
                    const topSprite = this.scene.add.sprite(tileCenterX, topCenterY, 'boss-main-atk-1', 'main-atk-1-row1');
                    topSprite.setDepth(13);
                    beamSprites.push(topSprite);
                    this.activeAttackEffects.push(topSprite);

                    this.addBossTimer(40, () => {
                        if (topSprite && topSprite.active) {
                            topSprite.setTexture('boss-main-atk-2', 'main-atk-2-row1');
                        }
                    });
                    this.addBossTimer(80, () => {
                        if (topSprite && topSprite.active) {
                            topSprite.setTexture('boss-main-atk-3', 'main-atk-3-row1');
                        }
                    });

                    // b. Use the 32x32 tile from the second row of main attack new4.png as filler beam down to ground
                    const fillerSprites: Phaser.GameObjects.Sprite[] = [];
                    this.addBossTimer(110, () => {
                        if (!this.hasStarted || this.isDead || this.bossState !== 'striking') return;

                        const fillerStart = startY + 32;
                        const fillerEnd = tileY - 32;
                        const fillerCount = Math.max(0, Math.round((fillerEnd - fillerStart) / 32));

                        for (let k = 0; k < fillerCount; k++) {
                            const fillerY = fillerStart + k * 32 + 16;
                            const filler = this.scene.add.sprite(tileCenterX, fillerY, 'boss-main-atk-4', 'main-atk-4-row2');
                            filler.setDepth(13);
                            fillerSprites.push(filler);
                            beamSprites.push(filler);
                            this.activeAttackEffects.push(filler);
                        }

                        // c. Then use the 32x32 tile from the third row of main attack new5.png for ground impact (sits directly on top of attack tile)
                        this.addBossTimer(35, () => {
                            if (!this.hasStarted || this.isDead || this.bossState !== 'striking') return;

                            const impactSprite = this.scene.add.sprite(tileCenterX, tileY - 16, 'boss-main-atk-5', 'main-atk-5-row3');
                            impactSprite.setDepth(14);
                            beamSprites.push(impactSprite);
                            this.activeAttackEffects.push(impactSprite);

                            this.soundManager?.playEnemyShoot();
                            this.scene.cameras.main.shake(140, 0.005);
                            this.uiManager.spawnParticles(tileCenterX, tileY, 0x38BDF8);

                            // d. Once beam hit ground, replace filler tiles with second row of main attack new5.png (loopback current)
                            fillerSprites.forEach(filler => {
                                if (filler && filler.active) {
                                    filler.setTexture('boss-main-atk-5', 'main-atk-5-row2');
                                }
                            });

                            // Lethal beam collision check on the vertical column directly above the attack tile
                            const beamColumnHeight = tileY - startY;
                            const damageCheckTimer = this.scene.time.addEvent({
                                delay: 20,
                                repeat: 20,
                                callback: () => {
                                    if (!this.player || this.player.isDying || !impactSprite.active) return;
                                    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                                    if (pBody) {
                                        const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
                                        const beamRect = new Phaser.Geom.Rectangle(tileX + 2, startY, tileW - 4, beamColumnHeight);
                                        if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, beamRect)) {
                                            this.player.die('beam');
                                        }
                                    }
                                }
                            });

                            // Cleanup beam after duration
                            this.addBossTimer(460, () => {
                                damageCheckTimer.remove();
                                beamSprites.forEach(s => {
                                    if (s && s.active) {
                                        this.scene.tweens.add({
                                            targets: s,
                                            alpha: 0,
                                            duration: 80,
                                            onComplete: () => { if (s.active) s.destroy(); }
                                        });
                                    }
                                });
                            });
                        });
                    });
                });
            });
            delay += 600;
        });

        // Stop attack tiles glowing once the beams have disappeared
        this.addBossTimer(delay + 480, () => {
            this.activeTileGlowSprites.forEach(glow => {
                if (glow && glow.active) {
                    this.scene.tweens.add({
                        targets: glow,
                        alpha: 0,
                        duration: 120,
                        onComplete: () => { if (glow.active) glow.destroy(); }
                    });
                }
            });
            this.activeTileGlowSprites = [];
        });

        // Reappearing sequence (Requirement 6)
        this.addBossTimer(delay + 900, () => {
            if (!this.hasStarted || this.isDead) return;

            this.bossState = 'reappearing';
            this.setVisible(true);
            (this.body as Phaser.Physics.Arcade.Body).setEnable(true);

            if (this.pendingPhase2Transition) {
                playBossAnimation(this, BOSS_ANIM_KEYS.FLY_SPAWN);
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                    if (anim.key === BOSS_ANIM_KEYS.FLY_SPAWN) {
                        this.descendAndStartPhase2();
                    }
                });
                return;
            }

            if (this.phase === 1) {
                // Requirement 6: Boss Re-appearing (Air Spawn)
                playBossAnimation(this, BOSS_ANIM_KEYS.FLY_SPAWN);
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                    if (anim.key === BOSS_ANIM_KEYS.FLY_SPAWN) {
                        this.flyTarget = undefined;
                        this.nextAttackTimer = Phaser.Math.Between(14000, 18000);
                        this.flyingOrbTimer = 3500;
                        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

                        if (this.isPlayerDeadOrDying()) {
                            this.bossState = 'player-dead-waiting';
                            playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                        } else {
                            // Player survived: resume movement immediately with no post-beam idle delay
                            this.bossState = 'idle';
                            this.flyTarget = undefined;
                        }
                    }
                });
            } else if (this.phase === 2) {
                // Ground reappear after beam strike
                const arenaLeft = this.arenaZone ? this.arenaZone.left + 64 : 3800;
                const arenaRight = this.arenaZone ? this.arenaZone.right - 64 : 4700;
                const reappearX = Phaser.Math.Clamp(this.x, arenaLeft, arenaRight);
                const floorTopY = this.findGroundYBelow(reappearX, this.y);
                this.setPosition(reappearX, floorTopY - 56);
                this.setFlipX(this.player.x < this.x);

                playBossAnimation(this, BOSS_ANIM_KEYS.GROUND_SPAWN);
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
                    if (anim.key === BOSS_ANIM_KEYS.GROUND_SPAWN && !this.isDead) {
                        this.isInvulnerable = false;
                        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });
                        this.phase2ThunderTimer = this.basePhase2ThunderInterval + Phaser.Math.Between(-1000, 2000);
                        this.teleportTimer = 5500;
                        this.orbTimer = 3000;
                        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

                        if (this.isPlayerDeadOrDying()) {
                            this.bossState = 'player-dead-waiting';
                            playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
                        } else {
                            // Player survived: resume patrol immediately
                            this.startGroundedPatrol();
                        }
                    }
                });
            }
        });
    }

    private transitionToPhase2() {
        this.hasReachedPhase2 = true;
        this.phase = 2;
        if (this.inventoryManager) {
            this.inventoryManager.addGun();
        } else if ((this.scene as any).inventoryManager) {
            (this.scene as any).inventoryManager.addGun();
        } else {
            this.player.hasGun = true;
        }

        this.uiManager.spawnParticles(this.player.x, this.player.y, parseInt(TOKENS.colors.orbCyan.replace('#', '0x'), 16));
        this.soundManager?.playPhaseTransition();
        this.soundManager?.playBossPhase2Music();

        if (this.bossState === 'memory-telegraph' || this.bossState === 'vanished' || this.bossState === 'striking') {
            this.pendingPhase2Transition = true;
            return;
        }

        this.descendAndStartPhase2();
    }

    private isSolidTileAt(x: number, y: number): boolean {
        for (const [_, tiles] of this.thunderTiles.entries()) {
            for (const t of tiles) {
                const tx = t.pixelX !== undefined ? t.pixelX : (t as any).x;
                const ty = t.pixelY !== undefined ? t.pixelY : (t as any).y;
                const tw = t.width || 32;
                const th = t.height || 32;
                if (x >= tx && x < tx + tw && y >= ty && y < ty + th) {
                    return true;
                }
            }
        }

        if (!this.map || !this.map.layers) return false;
        for (const layerData of this.map.layers) {
            const tLayer = layerData.tilemapLayer;
            if (tLayer) {
                const name = (layerData.name || '').toLowerCase();
                if (name.includes('ground') || name.includes('fill') || name.includes('dungeon') || name.includes('boss')) {
                    const tile = tLayer.getTileAtWorldXY(x, y);
                    if (tile && tile.index !== -1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private findGroundYBelow(startX: number, startY: number = this.y): number {
        let highestY: number | null = null;
        for (const [_, tiles] of this.thunderTiles.entries()) {
            for (const t of tiles) {
                const tx = t.pixelX !== undefined ? t.pixelX : (t as any).x;
                const ty = t.pixelY !== undefined ? t.pixelY : (t as any).y;
                const tw = t.width || 32;
                if (startX >= tx - 8 && startX <= tx + tw + 8) {
                    if (ty >= startY - 48) {
                        if (highestY === null || ty < highestY) {
                            highestY = ty;
                        }
                    }
                }
            }
        }

        const maxScanY = startY + 600;
        for (let checkY = startY; checkY < maxScanY; checkY += 8) {
            if (this.isSolidTileAt(startX, checkY)) {
                const tileTop = Math.floor(checkY / 32) * 32;
                if (highestY === null || tileTop < highestY) {
                    highestY = tileTop;
                }
                break;
            }
        }
        if (highestY !== null) return highestY;
        return this.arenaZone ? this.arenaZone.bottom - 48 : startY + 120;
    }

    // Requirement 16: Phase 1 ends -> Boss Losing Wings in air -> Falls down to ground
    private descendAndStartPhase2() {
        this.hasReachedPhase2 = true;
        this.phase = 2;
        this.isInvulnerable = true;
        this.phase2ThunderTimer = 8500;
        this.teleportTimer = 5500;
        this.pendingPhase2Transition = false;
        this.bossState = 'transitioning';
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: true });

        const floorTopY = this.findGroundYBelow(this.x, this.y);
        const targetGroundY = floorTopY - 56;
        const startAirY = Math.min(this.y, targetGroundY - 120);

        this.setVisible(true);
        this.setY(startAirY);
        this.soundManager?.playBossPhase2Music();

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
            body.setAllowGravity(false);
            body.setSize(64, 96);
            body.setOffset(24, 12);
        }

        // Requirement 16: Use "Boss Losing Wings" in the air
        playBossAnimation(this, BOSS_ANIM_KEYS.LOSING_WINGS);
        this.soundManager?.playPowerup();

        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
            if (anim.key !== BOSS_ANIM_KEYS.LOSING_WINGS || this.isDead) return;

            // Make the boss fall down on the ground
            this.scene.tweens.add({
                targets: this,
                y: targetGroundY,
                duration: 900,
                ease: 'Quad.easeIn',
                onComplete: () => {
                    if (this.isDead) return;

                    this.soundManager?.playBossFallingGround();
                    this.scene.cameras.main.shake(200, 0.006);
                    this.uiManager.spawnParticles(this.x, floorTopY, parseInt(TOKENS.colors.hazardRed.replace('#', '0x'), 16));
                    this.uiManager.spawnParticles(this.x - 24, floorTopY, 0xA855F7);
                    this.uiManager.spawnParticles(this.x + 24, floorTopY, 0xA855F7);

                    this.isInvulnerable = false;
                    GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });

                    // Requirement 2: Use components from our UI kit to display BOSS VULNERABLE when boss falls on ground
                    GameEventBus.getInstance().emitBossAlert({
                        title: 'BOSS VULNERABLE',
                        subtitle: 'SHIELD SHATTERED • STRIKE NOW!',
                        variant: 'danger',
                        durationMs: 3500,
                    });

                    GameEventBus.getInstance().emit('toast:show', {
                        id: 'boss-vulnerable-toast',
                        title: 'BOSS VULNERABLE',
                        message: 'Elecking has crashed to the ground! Attack now with your blaster!',
                        variant: 'danger',
                        icon: 'skull',
                        durationMs: 3800,
                    });

                    this.uiManager.showBossHealthBar('ELECKING', 50, this.hp);
                    this.startGroundedPatrol();
                }
            });
        });
    }

    private startGroundedPatrol() {
        this.bossState = 'patrolling';
        this.isInvulnerable = false;
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });
        this.p2MoveDuration = Phaser.Math.Between(2000, 3200);
        this.p2PaceFlipTimer = 0;
        this.p2PaceDir = this.player.x > this.x ? 1 : -1;

        const groundY = this.findGroundYBelow(this.x, this.y - 16);
        this.setY(groundY - 56);

        const dir = this.player.x > this.x ? 1 : -1;
        this.setFlipX(false);
        playBossAnimation(this, dir > 0 ? BOSS_ANIM_KEYS.WALK_RIGHT : BOSS_ANIM_KEYS.WALK_LEFT);
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.patrolSpeed * dir);
    }

    // Check if there is valid space behind the player inside the bossarena zone to fit the boss
    public getValidBehindPlayerPosition(): number | null {
        if (!this.player || !this.arenaZone) return null;

        const bossMargin = 48; // Margin from arena boundaries to keep boss inside
        const minBehindDist = 110;
        const maxBehindDist = 175;
        const arenaLeft = this.arenaZone.left + bossMargin;
        const arenaRight = this.arenaZone.right - bossMargin;

        // Player facing:
        // 'left' -> behind player is to the right (+X)
        // 'right' -> behind player is to the left (-X)
        const isFacingLeft = this.player.facing === 'left';

        if (isFacingLeft) {
            const minTargetX = this.player.x + minBehindDist;
            if (minTargetX > arenaRight) {
                return null; // Not enough space behind player within bossarena zone
            }
            const desiredX = this.player.x + Phaser.Math.Between(minBehindDist, maxBehindDist);
            return Phaser.Math.Clamp(desiredX, minTargetX, arenaRight);
        } else {
            const minTargetX = this.player.x - minBehindDist;
            if (minTargetX < arenaLeft) {
                return null; // Not enough space behind player within bossarena zone
            }
            const desiredX = this.player.x - Phaser.Math.Between(minBehindDist, maxBehindDist);
            return Phaser.Math.Clamp(desiredX, arenaLeft, minTargetX);
        }
    }

    // Teleport strictly behind player if space is available
    private teleportBossTo(targetX: number) {
        if (this.phase !== 2 || this.bossState !== 'patrolling' || this.isDead) return;

        this.bossState = 'teleporting';
        this.isInvulnerable = true;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        this.setFlipX(false);
        playBossAnimation(this, BOSS_ANIM_KEYS.GROUND_DISAPPEAR);
        this.soundManager?.playBossTeleport();
        this.uiManager.spawnParticles(this.x, this.y, 0x6366F1);

        let disappearHandled = false;
        const onDisappeared = () => {
            if (disappearHandled || this.isDead || this.phase !== 2) return;
            disappearHandled = true;

            this.setVisible(false);
            (this.body as Phaser.Physics.Arcade.Body).setEnable(false);

            const floorTopY = this.findGroundYBelow(targetX, this.y);
            const targetGroundY = floorTopY - 56;

            // Quick delay before appearing behind the player (20% faster: 140ms)
            this.addBossTimer(140, () => {
                if (this.isDead || this.phase !== 2) return;
                this.setPosition(targetX, targetGroundY);
                this.setVisible(true);
                // Face player from behind!
                this.setFlipX(this.player.x < this.x);
                (this.body as Phaser.Physics.Arcade.Body).setEnable(true);

                this.uiManager.spawnParticles(targetX, targetGroundY, 0x6366F1);
                this.soundManager?.playBossTeleport();

                playBossAnimation(this, BOSS_ANIM_KEYS.GROUND_SPAWN);

                let appearHandled = false;
                const onAppeared = () => {
                    if (appearHandled || this.isDead || this.phase !== 2) return;
                    appearHandled = true;
                    this.isInvulnerable = false;
                    GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });
                    this.teleportTimer = this.baseTeleportInterval + Phaser.Math.Between(-800, 800);

                    // If minions are not active, surprise shoot from behind shortly after appearing
                    if (!this.hasActiveMinions()) {
                        this.addBossTimer(300, () => {
                            if (this.phase === 2 && !this.isDead && (this.bossState === 'patrolling' || this.bossState === 'teleporting')) {
                                this.shootOrbGrounded();
                            }
                        });
                    }

                    this.startGroundedPatrol();
                };

                this.once('animationcomplete-' + BOSS_ANIM_KEYS.GROUND_SPAWN, onAppeared);
                this.addBossTimer(440, onAppeared); // Fast fallback (20% faster)
            });
        };

        this.once('animationcomplete-' + BOSS_ANIM_KEYS.GROUND_DISAPPEAR, onDisappeared);
        this.addBossTimer(440, onDisappeared); // Fast fallback (20% faster)
    }

    private fireOrbOfRage() {
        if (!this.active || this.isDead || !this.hasStarted) return;
        // Do not shoot orbs if minions are active or pattern is being prepared/executed
        if (
            this.hasActiveMinions() ||
            this.bossState === 'memory-telegraph' || 
            this.bossState === 'vanished' || 
            this.bossState === 'striking' || 
            this.bossState === 'reappearing' ||
            this.bossState === 'idle-pre-pattern' || 
            this.bossState === 'flying-to-pattern' ||
            this.bossState === 'ground-idle-pre-beam'
        ) {
            return;
        }

        const isFacingRight = this.player.x > this.x;
        const mouthX = this.x + (isFacingRight ? 24 : -24);
        const mouthY = this.y - 12;

        const angle = Phaser.Math.Angle.Between(mouthX, mouthY, this.player.x, this.player.y);
        const baseSpeed = this.orbSpeed || 200;
        let randomizedSpeed: number;

        if (this.phase === 1) {
            // Requirement 1: Increase speed by 50% while flying, with random variation within 25% range (±25%)
            const flyingBaseSpeed = baseSpeed * 1.5;
            const minSpeed = Math.round(flyingBaseSpeed * 0.75);
            const maxSpeed = Math.round(flyingBaseSpeed * 1.25);
            randomizedSpeed = Phaser.Math.Between(minSpeed, maxSpeed);
        } else {
            // Phase 2: Increase overall projectile speed by 40% with random variation within 20% range (±20%)
            const p2BaseSpeed = baseSpeed * 1.4;
            const minSpeed = Math.round(p2BaseSpeed * 0.8);
            const maxSpeed = Math.round(p2BaseSpeed * 1.2);
            randomizedSpeed = Phaser.Math.Between(minSpeed, maxSpeed);
        }

        const vx = Math.cos(angle) * randomizedSpeed;
        const vy = Math.sin(angle) * randomizedSpeed;

        const spriteRotation = isFacingRight ? angle : (angle >= 0 ? angle - Math.PI : angle + Math.PI);

        const orb = this.orbsOfRageGroup.create(mouthX, mouthY, 'attack-orb') as Phaser.Physics.Arcade.Sprite;
        orb.play('attack-orb-anim');
        orb.setDepth(14);
        orb.setOrigin(0.5, 0.5);
        orb.setRotation(spriteRotation);

        const orbBody = orb.body as Phaser.Physics.Arcade.Body;
        if (orbBody) {
            orbBody.setSize(16, 16);
            orbBody.setOffset(8, 8);
            orbBody.setAllowGravity(false);
            orb.setVelocity(vx, vy);
        }

        this.soundManager?.playEnemyShoot();
        this.uiManager.spawnParticles(mouthX, mouthY, 0xA855F7);
    }

    public takeDamage(amount: number = 1) {
        if (this.isInvulnerable || 
            this.isDead || 
            this.bossState === 'vanished' || 
            this.bossState === 'teleporting' || 
            this.bossState === 'raging' || 
            this.bossState === 'memory-telegraph' || 
            this.bossState === 'striking') return;

        this.hp = Math.max(0, this.hp - amount);
        this.setTint(parseInt(TOKENS.colors.hazardRed.replace('#', '0x'), 16));
        this.scene.time.delayedCall(120, () => {
            if (this && this.active) this.clearTint();
        });

        this.uiManager.updateBossHealthBar(this.hp, this.maxHp);

        // Requirement 15: Boss will rage when low HP and spawn twice minions
        if (this.hp <= 15 && !this.hasEnraged) {
            this.enrageBoss();
            return;
        }

        const triggeredSummons = this.summonThresholds.filter(t => this.hp <= t);
        if (triggeredSummons.length > 0) {
            this.summonThresholds = this.summonThresholds.filter(t => this.hp < t);
            this.summonMinions(false);
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    // Requirement 15: Boss Raging
    private enrageBoss() {
        if (this.hasEnraged || this.isDead) return;
        this.hasEnraged = true;
        this.bossState = 'raging';
        this.isInvulnerable = true;
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        this.scene.cameras.main.shake(300, 0.007);
        this.soundManager?.playBossRage();

        const rageEmitter = this.scene.time.addEvent({
            delay: 80,
            repeat: 12,
            callback: () => {
                if (this && this.active && this.bossState === 'raging') {
                    this.uiManager.spawnParticles(
                        this.x + Phaser.Math.Between(-32, 32),
                        this.y + Phaser.Math.Between(-32, 32),
                        0xEF4444
                    );
                }
            }
        });

        // Requirement 15: Play "Boss Raging" animation
        playBossAnimation(this, BOSS_ANIM_KEYS.RAGING);

        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
            rageEmitter.remove();
            if (anim.key !== BOSS_ANIM_KEYS.RAGING || this.isDead) return;

            this.patrolSpeed = Math.round(this.patrolSpeed * 1.3);
            this.orbInterval = Math.max(1600, Math.round(this.orbInterval * 0.75));
            this.baseTeleportInterval = Math.round(this.baseTeleportInterval * 0.75);

            // Requirement 15: Boss Raging -> then Boss Spawning Minions with double minions
            this.summonMinions(true);
        });
    }

    // Requirements 10, 11, 12, 13: Skeletons Spawning & Minions Sequence
    private summonMinions(isEnragedSpawn: boolean = false) {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'summoning';
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);

        // Boss Spawning Minions animation played first
        playBossAnimation(this, BOSS_ANIM_KEYS.SPAWN_MINIONS);
        this.soundManager?.playEnemyShoot();

        const floorY = this.findGroundYBelow(this.x, this.y);
        // Minion count: 2-3 normal, 5-6 enraged
        const count = isEnragedSpawn ? Phaser.Math.Between(5, 6) : Phaser.Math.Between(2, 3);

        // Once Boss Spawning Minions animation is done, spawn skeletons
        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
            if (anim.key !== BOSS_ANIM_KEYS.SPAWN_MINIONS || this.isDead) return;

            for (let i = 0; i < count; i++) {
                const spread = (i - (count - 1) / 2) * 40;
                const spawnX = Phaser.Math.Clamp(
                    this.x + spread + Phaser.Math.Between(-10, 10),
                    this.arenaZone ? this.arenaZone.left + 36 : this.x - 120,
                    this.arenaZone ? this.arenaZone.right - 36 : this.x + 120
                );

                const skeleton = this.skeletonBombsGroup.create(spawnX, floorY, 'skel-bomb-spwn-l-1') as Phaser.Physics.Arcade.Sprite;
                skeleton.setOrigin(0.5, 1);
                skeleton.setDepth(10);
                skeleton.setData('state', 'spawning');
                // Increased minion speed by 50% (was 80 / 95 -> now 120 / 145)
                skeleton.setData('speed', isEnragedSpawn ? 145 : 120);
                // Requires 3 bullet shots to defeat
                skeleton.setData('hp', 3);

                const sBody = skeleton.body as Phaser.Physics.Arcade.Body;
                if (sBody) {
                    sBody.setSize(20, 26);
                    sBody.setOffset(6, 6);
                    sBody.setAllowGravity(true);
                    sBody.setCollideWorldBounds(true);
                    sBody.setVelocity(0, 0);
                }

                this.skeletonBombs.push(skeleton);

                // Skeleton Spawn (Right) if player is on right side of boss, else Skeleton Spawn (Left)
                const isPlayerToRight = this.player.x >= this.x;
                if (isPlayerToRight) {
                    playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_SPAWN_RIGHT);
                } else {
                    playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_SPAWN_LEFT);
                }

                // Once skeleton spawn animations are done, make them walk towards the player
                skeleton.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    if (skeleton && skeleton.active && skeleton.getData('state') === 'spawning') {
                        skeleton.setData('state', 'walking');
                    }
                });
            }

            this.addBossTimer(400, () => {
                if (this.phase === 2 && !this.isDead && this.bossState === 'summoning') {
                    this.startGroundedPatrol();
                }
            });
        });
    }

    // Check if any minions are active on the battlefield
    public hasActiveMinions(): boolean {
        return this.skeletonBombs.some(s => {
            if (!s || !s.active) return false;
            const state = s.getData('state');
            return state === 'spawning' || state === 'walking' || state === 'priming' || state === 'exploding';
        });
    }

    private getEffectiveOrbInterval(baseAddRandom: boolean = true): number {
        let interval = this.orbInterval;
        if (baseAddRandom) {
            const range = Math.round(this.orbInterval * 0.2);
            interval += Phaser.Math.Between(-range, range);
        }
        return Math.max(1400, interval);
    }

    // Skeleton update and explosion in 2-tile radius
    private updateSkeletonBombs(_delta: number) {
        if (!this.player || this.player.isDying) return;

        for (let i = this.skeletonBombs.length - 1; i >= 0; i--) {
            const skeleton = this.skeletonBombs[i];
            if (!skeleton || !skeleton.active) {
                this.skeletonBombs.splice(i, 1);
                continue;
            }

            const state = skeleton.getData('state') as string;
            const sBody = skeleton.body as Phaser.Physics.Arcade.Body;
            if (!sBody) continue;

            if (state === 'walking') {
                const speed = (skeleton.getData('speed') as number) || 120;
                const isPlayerRight = this.player.x > skeleton.x + 4;
                const isPlayerLeft = this.player.x < skeleton.x - 4;
                const dir = isPlayerRight ? 1 : (isPlayerLeft ? -1 : 0);

                sBody.setVelocityX(dir * speed);

                // Skeleton Walking (Right) / Skeleton Walking (Left)
                if (dir >= 0) {
                    playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_WALK_RIGHT);
                } else {
                    playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_WALK_LEFT);
                }

                // Walk towards player -> when on the exact same tile as the player (within 16px horizontally and 48px vertically)
                const dx = Math.abs(skeleton.x - this.player.x);
                const dy = Math.abs((skeleton.y - 14) - this.player.y);
                if (dx <= 16 && dy <= 48) {
                    this.primeSkeletonForExplosion(skeleton);
                }
            } else if (state === 'priming' || state === 'exploding') {
                sBody.setVelocityX(0);
            }
        }
    }

    // Stay idle for 0.4s then play explosion
    private primeSkeletonForExplosion(skeleton: Phaser.Physics.Arcade.Sprite) {
        if (!skeleton || !skeleton.active) return;
        const currentState = skeleton.getData('state');
        if (currentState !== 'walking') return;

        skeleton.setData('state', 'priming');
        const sBody = skeleton.body as Phaser.Physics.Arcade.Body;
        if (sBody) {
            sBody.setVelocityX(0);
        }

        // Freeze walk animation facing player
        skeleton.anims.stop();
        const isPlayerRight = this.player.x >= skeleton.x;
        if (isPlayerRight) {
            playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_WALK_RIGHT);
        } else {
            playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_WALK_LEFT);
        }
        skeleton.anims.pause();

        // Visual warning cue during the 0.4s fuse
        skeleton.setTint(0xFCA5A5);

        // Stay idle for 0.4s (400ms) then play the explosion
        const primeTimer = this.scene.time.delayedCall(400, () => {
            if (skeleton && skeleton.active && skeleton.getData('state') === 'priming') {
                skeleton.clearTint();
                this.explodeSkeleton(skeleton);
            }
        });
        skeleton.setData('primeTimer', primeTimer);
    }

    // Skeleton Bomb Explode (Left) and Skeleton Bomb Explode (Right) with 2-tile radius (64px) lethal damage on animation completion
    private explodeSkeleton(skeleton: Phaser.Physics.Arcade.Sprite) {
        if (!skeleton || !skeleton.active || skeleton.getData('state') === 'dead' || skeleton.getData('state') === 'exploding') return;

        const primeTimer = skeleton.getData('primeTimer') as Phaser.Time.TimerEvent;
        if (primeTimer) {
            primeTimer.remove();
            skeleton.setData('primeTimer', null);
        }

        skeleton.setData('state', 'exploding');
        skeleton.clearTint();
        const sBody = skeleton.body as Phaser.Physics.Arcade.Body;
        if (sBody) {
            sBody.setVelocity(0, 0);
            sBody.setAllowGravity(false);
            sBody.checkCollision.none = true;
        }

        const isPlayerRight = this.player.x >= skeleton.x;
        // Skeleton Bomb Explode (Left) & Skeleton Bomb Explode (Right)
        if (isPlayerRight) {
            playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_BOMB_EXPLODE_RIGHT);
        } else {
            playBossAnimation(skeleton, BOSS_ANIM_KEYS.SKELETON_BOMB_EXPLODE_LEFT);
        }

        const explX = skeleton.x;
        const explY = skeleton.y - 14;

        let detonated = false;
        const completeExplosion = () => {
            if (detonated) return;
            detonated = true;

            this.soundManager?.playEnemyShoot();
            this.scene.cameras.main.shake(140, 0.005);
            this.uiManager.spawnParticles(explX, explY, 0xF97316);
            this.uiManager.spawnParticles(explX, explY, 0xEF4444);

            // Lethal damage inflicted in 2-tile radius (64px) only after explosion animation finishes
            if (this.player && !this.player.isDying) {
                const dist = Phaser.Math.Distance.Between(explX, explY, this.player.x, this.player.y);
                if (dist <= 64) {
                    this.player.die('explosion');
                }
            }

            const idx = this.skeletonBombs.indexOf(skeleton);
            if (idx !== -1) {
                this.skeletonBombs.splice(idx, 1);
            }

            if (skeleton && skeleton.active) {
                skeleton.destroy();
            }
        };

        skeleton.once(Phaser.Animations.Events.ANIMATION_COMPLETE, completeExplosion);
        this.addBossTimer(450, completeExplosion); // Safety fallback matching animation duration
    }

    // Jumping on top of minions or shooting them twice defeats them
    private killSkeleton(skeleton: Phaser.Physics.Arcade.Sprite, isStomp: boolean = true) {
        if (!skeleton || !skeleton.active || skeleton.getData('state') === 'dead' || skeleton.getData('state') === 'exploding') return;

        // Cancel prime timer if skeleton was idle/priming for explosion
        const primeTimer = skeleton.getData('primeTimer') as Phaser.Time.TimerEvent;
        if (primeTimer) {
            primeTimer.remove();
            skeleton.setData('primeTimer', null);
        }

        skeleton.setData('state', 'dead');
        skeleton.clearTint();
        if (isStomp) {
            this.player.stompBounce(-380);
            this.soundManager?.playStomp();
        } else {
            this.soundManager?.playEnemyShoot();
        }

        const sBody = skeleton.body as Phaser.Physics.Arcade.Body;
        if (sBody) {
            sBody.allowGravity = true;
            sBody.checkCollision.none = true;
            sBody.setCollideWorldBounds(false);
            skeleton.setVelocity(Phaser.Math.Between(-60, 60), -260);
            skeleton.setAngularVelocity(Phaser.Math.Between(400, 700) * (Math.random() > 0.5 ? 1 : -1));
        }

        skeleton.anims.stop();
        skeleton.setTint(0xFF4444);
        this.uiManager.spawnParticles(skeleton.x, skeleton.y - 14, 0xEF4444);

        const idx = this.skeletonBombs.indexOf(skeleton);
        if (idx !== -1) {
            this.skeletonBombs.splice(idx, 1);
        }

        this.scene.time.delayedCall(1200, () => {
            if (skeleton && skeleton.active) skeleton.destroy();
        });
    }

    // Requirement 5: Boss Death Animation
    private die() {
        this.isDead = true;
        this.bossState = 'dead';
        this.anims.stop();
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);

        this.activeTimers.forEach(t => t.remove(false));
        this.activeTimers = [];
        this.activeAttackEffects.forEach(e => {
            if (e && e.active) e.destroy();
        });
        this.activeAttackEffects = [];
        this.activeTileGlowSprites.forEach(s => { if (s && s.active) s.destroy(); });
        this.activeTileGlowSprites = [];

        this.skeletonBombs.forEach(s => {
            if (s && s.active) {
                const timer = s.getData('primeTimer') as Phaser.Time.TimerEvent;
                if (timer) timer.remove();
                s.destroy();
            }
        });
        this.skeletonBombs = [];
        if (this.skeletonBombsGroup) {
            this.skeletonBombsGroup.clear(true, true);
        }

        if (this.soundManager) {
            this.soundManager.stopMusic();
            this.soundManager.playBossDeath();
        }
        this.uiManager.hideBossHealthBar();

        this.scene.cameras.main.shake(400, 0.008);

        // Requirement 5: Play Boss Death Animation
        playBossAnimation(this, BOSS_ANIM_KEYS.DEATH);

        const goldParticleColor = parseInt(TOKENS.colors.gold.replace('#', '0x'), 16);

        this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, (anim: Phaser.Animations.Animation) => {
            if (anim.key !== BOSS_ANIM_KEYS.DEATH) return;

            this.setVisible(false);

            for (let i = 0; i < 20; i++) {
                this.scene.time.delayedCall(i * 80, () => {
                    this.uiManager.spawnParticles(
                        this.x + Phaser.Math.Between(-50, 50),
                        this.y + Phaser.Math.Between(-50, 50),
                        goldParticleColor
                    );
                });
            }

            this.scene.time.delayedCall(1600, () => {
                this.spawnVictoryOrb();
            });
        });
    }

    private spawnVictoryOrb() {
        if (this.victoryOrb && this.victoryOrb.active) this.victoryOrb.destroy();

        let spawnX = this.x;
        let spawnY = this.y - 30;
        if (this.victoryOrbZone) {
            spawnX = Phaser.Math.Between(this.victoryOrbZone.left + 12, this.victoryOrbZone.right - 12);
            spawnY = Phaser.Math.Between(this.victoryOrbZone.top + 12, this.victoryOrbZone.bottom - 12);
        }

        const goldParticleColor = parseInt(TOKENS.colors.gold.replace('#', '0x'), 16);
        this.victoryOrb = this.scene.physics.add.sprite(spawnX, spawnY, 'victory-orb');
        this.victoryOrb.play('victory-orb-anim');
        this.victoryOrb.setScale(2.5);
        this.victoryOrb.setDepth(15);
        const body = this.victoryOrb.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setAllowGravity(true);
            body.setGravityY(700);
            body.setBounce(0.35);
            body.setCollideWorldBounds(true);
            body.setSize(24, 24);
            body.setOffset(4, 4);
        }

        this.scene.tweens.add({
            targets: this.victoryOrb,
            scale: 2.8,
            duration: 650,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        if ((this.scene as any).groundLayer) {
            this.scene.physics.add.collider(this.victoryOrb, (this.scene as any).groundLayer);
        }
        if (this.dotBlocks) {
            this.scene.physics.add.collider(this.victoryOrb, this.dotBlocks);
        }
        
        this.scene.physics.add.overlap(this.player, this.victoryOrb, () => {
            if (this.victoryOrb && this.victoryOrb.active) {
                const orbX = this.victoryOrb.x;
                const orbY = this.victoryOrb.y;
                this.victoryOrb.destroy();
                this.victoryOrb = undefined;

                this.soundManager?.playVictory();
                this.uiManager.spawnParticles(orbX, orbY, goldParticleColor);

                // UI Kit React Victory Notification
                GameEventBus.getInstance().emit('toast:show', {
                    id: 'orb-of-victory-toast',
                    title: 'ORB OF VICTORY COLLECTED',
                    message: 'Stage Complete! You have claimed the ultimate relic.',
                    variant: 'victory',
                    icon: 'trophy',
                    durationMs: 4500,
                });

                if (typeof (this.scene as any).onStageComplete === 'function') {
                    (this.scene as any).onStageComplete();
                }
            }
        });
    }

    public update(time: number, delta: number) {
        // Update temporary platforms every frame regardless of arena state or boss state
        this.tempPlatforms.forEach(platform => {
            platform.update(time, delta);
        });

        if (this.isDead) return;

        // Entrance detection
        if (!this.isEntranceRevealed && (this.isPlayerTouchingEntrance() || this.isPlayerInArena())) {
            this.isEntranceRevealed = true;
            if (this.arenaCover) {
                this.arenaCover.setVisible(false);
            }
            if (this.envManager) {
                this.envManager.triggerRevealLayer('', true);
                this.envManager.triggerRevealLayer('DungeonFill', true);
                this.envManager.triggerRevealLayer('1', true);
            }
            if (this.isPlayerInArena()) {
                const activeRespawn = this.getActiveRespawnPoint();
                if (activeRespawn) {
                    this.player.activeSpawnX = activeRespawn.x;
                    this.player.activeSpawnY = activeRespawn.y;
                }
            }
        }

        if (this.arenaCover) {
            this.arenaCover.setVisible(!this.isEntranceRevealed);
        }

        const inArena = this.isPlayerInArena();
        const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, this.player.x, this.player.y);
        const isVisibleInCamera = this.isBossVisibleInCamera();

        // 1. Initial Boss Discovery Check:
        // Trigger immediately when the player sees the boss in camera or explores near the boss
        if (!this.hasDiscoveredBoss) {
            const bBody = this.body as Phaser.Physics.Arcade.Body;
            if (bBody) bBody.setVelocity(0, 0);
            if (this.visible && this.bossState !== 'vanished' && this.bossState !== 'reappearing') {
                if (this.phase === 1) {
                    playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                } else {
                    playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
                }
            }

            if (isVisibleInCamera || distToPlayer < 550 || (inArena && this.player.x < (this.arenaZone?.right ?? 4700) - 120)) {
                this.hasDiscoveredBoss = true;
                this.activateEncounter();
            } else {
                return;
            }
        }

        // 2. Boss Music & Arena Status
        if (inArena && !this.playerWasInArena && !this.isDead) {
            this.playerWasInArena = true;
            const activeRespawn = this.getActiveRespawnPoint();
            if (activeRespawn) {
                this.player.activeSpawnX = activeRespawn.x;
                this.player.activeSpawnY = activeRespawn.y;
            }
            if (this.phase === 2 || this.hasReachedPhase2) {
                this.soundManager?.playBossPhase2Music();
            } else {
                this.soundManager?.playBossMusic();
            }
            this.uiManager.showBossHealthBar('ELECKING', this.maxHp, this.hp);
        } else if (!inArena && this.playerWasInArena) {
            this.playerWasInArena = false;
            this.soundManager?.playGameMusic();
            this.uiManager.hideBossHealthBar();
        }

        if (!inArena) {
            const bBody = this.body as Phaser.Physics.Arcade.Body;
            if (bBody) bBody.setVelocity(0, 0);
            if (this.player.isDying && this.visible && this.bossState !== 'vanished' && this.bossState !== 'reappearing') {
                if (this.phase === 1) {
                    playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                } else {
                    playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
                }
            }
            return;
        }

        if (this.bossState === 'post-beam-idle' || this.bossState === 'player-dead-waiting' || this.isPlayerDeadOrDying()) {
            const bBody = this.body as Phaser.Physics.Arcade.Body;
            if (bBody) bBody.setVelocity(0, 0);
            if (this.visible && this.bossState !== 'vanished' && this.bossState !== 'reappearing') {
                if (this.phase === 1) {
                    playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                } else {
                    playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
                }
            }
            return;
        }

        // Update skeleton minions
        this.updateSkeletonBombs(delta);

        // Handle boss attack timers
        if (this.phase === 1 && this.bossState === 'idle') {
            // Requirement 1: Flying orb attack timer
            this.flyingOrbTimer -= delta;
            if (this.flyingOrbTimer <= 0) {
                this.flyingOrbTimer = Phaser.Math.Between(3200, 4400);
                this.shootOrbFlying();
                return;
            }

            // Beam strike timer
            this.nextAttackTimer -= delta;
            if (this.nextAttackTimer <= 0) {
                this.nextAttackTimer = Phaser.Math.Between(14000, 18000);
                this.prepareAndStartPattern();
            }
        } else if (this.phase === 2 && this.bossState === 'patrolling') {
            this.phase2ThunderTimer -= delta;
            this.teleportTimer -= delta;

            // 1. Ground beam attack timer: stays idle first, then shows pattern -> disappears -> beam strikes -> reappears
            if (this.phase2ThunderTimer <= 0) {
                this.phase2ThunderTimer = this.basePhase2ThunderInterval + Phaser.Math.Between(-1000, 2000);
                this.initiatePhase2BeamAttack();
                return;
            }

            // 2. Teleport timer: strictly teleports behind player if space is available inside bossarena zone
            if (this.teleportTimer <= 0) {
                const behindX = this.getValidBehindPlayerPosition();
                if (behindX !== null) {
                    this.teleportTimer = this.baseTeleportInterval + Phaser.Math.Between(-1000, 1000);
                    this.teleportBossTo(behindX);
                    return;
                } else {
                    // Not enough space behind player right now, check again shortly without jumping to awkward positions
                    this.teleportTimer = 1600;
                }
            }

            // 3. Boss stops shooting when minions are active
            if (!this.hasActiveMinions()) {
                this.orbTimer -= delta;
                // Ground orb attack timer
                if (this.orbTimer <= 0) {
                    this.orbTimer = this.getEffectiveOrbInterval();
                    this.shootOrbGrounded();
                    return;
                }
            }
        }

        // Projectile overlap
        this.scene.physics.overlap(this.player, this.orbsOfRageGroup, (_player, orbObj) => {
            const orb = orbObj as Phaser.GameObjects.GameObject;
            orb.destroy();
            this.player.die();
        });

        // Clean up orbs hitting walls/tiles or leaving arena bounds
        if (this.arenaZone) {
            this.orbsOfRageGroup.getChildren().forEach(orbObj => {
                const orb = orbObj as Phaser.Physics.Arcade.Sprite;
                if (orb && orb.active) {
                    if (this.isSolidTileAt(orb.x, orb.y)) {
                        const ox = orb.x;
                        const oy = orb.y;
                        orb.destroy();
                        this.uiManager.spawnParticles(ox, oy, 0xA855F7);
                        return;
                    }
                    if (orb.x < this.arenaZone!.left - 32 || orb.x > this.arenaZone!.right + 32 || orb.y < this.arenaZone!.top - 32 || orb.y > this.arenaZone!.bottom + 32) {
                        orb.destroy();
                    }
                }
            });
        }

        // Phase 1 Air flight (Requirements 4, 7, 8)
        if (this.phase === 1 && this.bossState === 'flying-to-pattern' && this.flyTarget) {
            this.scene.physics.moveTo(this, this.flyTarget.x, this.flyTarget.y, 110);
            playBossAnimation(this, BOSS_ANIM_KEYS.FLYING);
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body && Math.abs(body.velocity.x) > 5) {
                this.setFlipX(body.velocity.x < 0);
            }
            if (Phaser.Math.Distance.Between(this.x, this.y, this.flyTarget.x, this.flyTarget.y) < 20) {
                if ((this as any)._onArriveAtPerch) {
                    const fn = (this as any)._onArriveAtPerch;
                    (this as any)._onArriveAtPerch = null;
                    fn();
                }
            }
            return;
        }

        if (this.phase === 1 && (this.bossState === 'idle-pre-pattern' || this.bossState === 'idle-pre-encounter' || this.bossState === 'memory-telegraph' || this.bossState === 'flying-attack')) {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
            return;
        }

        if (this.phase === 1 && this.bossState === 'idle') {
            const zone = this.arenaZone;
            if (zone) {
                const arenaTop = zone.top;
                const arenaBottom = zone.bottom;
                const minY = arenaTop + 32;
                const maxY = Math.min(arenaTop + 240, arenaBottom - 140);
                const safeMaxY = maxY > minY ? maxY : minY + 80;

                const minX = zone.left + 48;
                const maxX = zone.right - 48;

                if (!this.flyTarget || Phaser.Math.Distance.Between(this.x, this.y, this.flyTarget.x, this.flyTarget.y) < 24) {
                    this.flyTowardsPlayer = !this.flyTowardsPlayer;
                    let targetX: number;
                    if (this.flyTowardsPlayer) {
                        // Wide swoop toward/around player
                        const sideOffset = (Phaser.Math.Between(0, 1) === 0 ? -1 : 1) * Phaser.Math.Between(80, 200);
                        targetX = Phaser.Math.Clamp(this.player.x + sideOffset, minX, maxX);
                    } else {
                        // Wide traverse across distant arena sections
                        const farSide = this.x < zone.centerX ? maxX - Phaser.Math.Between(40, 220) : minX + Phaser.Math.Between(40, 220);
                        targetX = Phaser.Math.Clamp(farSide, minX, maxX);
                    }
                    const targetY = Phaser.Math.Between(minY, safeMaxY);
                    this.flyTarget = { x: targetX, y: targetY };
                }

                this.scene.physics.moveTo(this, this.flyTarget.x, this.flyTarget.y, 115);

                const body = this.body as Phaser.Physics.Arcade.Body;
                // Move around using Boss Flying Animation
                if (Math.abs(body.velocity.x) > 5) {
                    playBossAnimation(this, BOSS_ANIM_KEYS.FLYING);
                    this.setFlipX(body.velocity.x < 0);
                } else {
                    playBossAnimation(this, BOSS_ANIM_KEYS.IDLE_FLYING);
                    this.setFlipX(this.player.x < this.x);
                }
            }
        } else if (this.phase === 1 && this.bossState !== 'idle' && this.bossState !== 'flying-to-pattern') {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Phase 2 Ground Patrol (Requirements 14 & 17)
        if (this.phase === 2 && this.bossState === 'patrolling') {
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body) {
                const groundY = this.findGroundYBelow(this.x, this.y - 16);
                this.setY(groundY - 56);

                const zone = this.arenaZone;
                const arenaLeft = zone ? zone.left + 48 : 3760;
                const arenaRight = zone ? zone.right - 48 : 4780;

                const distToPlayer = Math.abs(this.player.x - this.x);
                const isPlayerToLeft = this.player.x < this.x;
                const playerNearLeftCorner = this.player.x < arenaLeft + 160;
                const playerNearRightCorner = this.player.x > arenaRight - 160;

                this.p2TurnCooldown -= delta;

                this.p2PaceFlipTimer += delta;
                if (this.p2PaceFlipTimer >= this.p2MoveDuration) {
                    this.p2PaceFlipTimer = 0;
                    this.p2MoveDuration = Phaser.Math.Between(2200, 3200);
                    this.p2PaceDir = -this.p2PaceDir;
                }

                let desiredDir = this.p2PaceDir;

                // Hysteresis deadband: Start backing away if < maintainDistance - 30, keep backing away until > maintainDistance + 30 to eliminate rapid in-place jitter
                const minBackDist = Math.max(70, this.maintainDistance - 30);
                const maxBackDist = Math.max(120, this.maintainDistance + 30);
                if (distToPlayer < minBackDist) {
                    this.p2IsBackingAway = true;
                } else if (distToPlayer > maxBackDist) {
                    this.p2IsBackingAway = false;
                }

                if (this.p2IsBackingAway) {
                    desiredDir = isPlayerToLeft ? 1 : -1;
                    this.p2PaceDir = desiredDir;
                } else if (playerNearLeftCorner && isPlayerToLeft && this.x < arenaLeft + 280) {
                    desiredDir = 1;
                    this.p2PaceDir = 1;
                } else if (playerNearRightCorner && !isPlayerToLeft && this.x > arenaRight - 280) {
                    desiredDir = -1;
                    this.p2PaceDir = -1;
                } else if (distToPlayer > 340) {
                    desiredDir = isPlayerToLeft ? -1 : 1;
                }

                if (desiredDir !== 0) {
                    const checkX = desiredDir > 0 ? this.x + 36 : this.x - 36;
                    const wallAhead = this.isSolidTileAt(checkX, this.y);
                    const floorAhead = this.isSolidTileAt(checkX, groundY + 8);

                    if (wallAhead || !floorAhead) {
                        desiredDir = -desiredDir;
                        this.p2PaceDir = desiredDir;
                        this.p2TurnCooldown = 600;
                    }
                }

                if (this.x <= arenaLeft && desiredDir < 0) {
                    desiredDir = 1;
                    this.p2PaceDir = 1;
                    this.p2TurnCooldown = 600;
                } else if (this.x >= arenaRight && desiredDir > 0) {
                    desiredDir = -1;
                    this.p2PaceDir = -1;
                    this.p2TurnCooldown = 600;
                }

                // Smooth direction commitment: prevent flipping back-and-forth rapidly in place
                const currentMovingDir = body.velocity.x > 2 ? 1 : (body.velocity.x < -2 ? -1 : 0);
                if (currentMovingDir !== 0 && desiredDir !== currentMovingDir && this.p2TurnCooldown > 0) {
                    desiredDir = currentMovingDir;
                } else if (currentMovingDir !== 0 && desiredDir !== currentMovingDir) {
                    this.p2TurnCooldown = 500;
                }

                body.setVelocityX(desiredDir * this.patrolSpeed);

                // Requirements 1 & 14 & 17: Walking left, right, and standing idle with proper direction
                if (body.velocity.x < -2) {
                    this.setFlipX(false);
                    playBossAnimation(this, BOSS_ANIM_KEYS.WALK_LEFT);
                } else if (body.velocity.x > 2) {
                    this.setFlipX(false);
                    playBossAnimation(this, BOSS_ANIM_KEYS.WALK_RIGHT);
                } else {
                    playBossAnimation(this, BOSS_ANIM_KEYS.STANDING_IDLE);
                    this.setFlipX(this.player.x < this.x);
                }
            }
        }


    }
}
