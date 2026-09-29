import Phaser from 'phaser';
import { Player } from './Player';
import { UIManager } from '../managers/UIManager';
import { EnemyManager } from '../managers/EnemyManager';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { SoundManager } from '../managers/SoundManager';
import { InventoryManager } from '../managers/InventoryManager';
import { GameEventBus } from '../services/GameEventBus';
import { TOKENS } from '../theme/tokens';

export class EleckingBoss extends Phaser.Physics.Arcade.Sprite {
    private player: Player;
    private uiManager: UIManager;
    private enemyManager: EnemyManager;
    private soundManager?: SoundManager;
    private inventoryManager?: InventoryManager;

    private hasStarted: boolean = false;
    private maxHp: number = 50;
    private hp: number = 50;
    public phase: number = 1;
    public isDead: boolean = false;
    public isInvulnerable: boolean = true;
    public hasReachedPhase2: boolean = false;

    private map: Phaser.Tilemaps.Tilemap;
    private arenaZone?: Phaser.Geom.Rectangle;
    private arenaCover?: Phaser.GameObjects.TileSprite;
    public isEntranceRevealed: boolean = false;
    private pendingPhase2Transition: boolean = false;
    private bossEntranceZone?: Phaser.Geom.Rectangle;
    private envManager?: EnvironmentManager;
    private bossRespawnPoint?: { x: number, y: number };
    private victoryOrbZone?: Phaser.Geom.Rectangle;
    private initialSpawn: { x: number, y: number };
    private gravityOrbs: Phaser.GameObjects.Sprite[] = [];
    private rawGravityOrbData: { x: number, y: number, width?: number, height?: number, id?: number }[] = [];
    private orbRevealTimer?: Phaser.Time.TimerEvent;
    private tempClouds: Phaser.Physics.Arcade.Sprite[] = [];
    private collectedOrbs: number = 0;
    private victoryOrb?: Phaser.Physics.Arcade.Sprite;
    private hasShownShieldedToast: boolean = false;
    private hasShownBossEncounterToast: boolean = false;
    
    // State Tracking
    private bossState: 'idle' | 'memory-telegraph' | 'vanished' | 'striking' | 'descending' | 'patrolling' | 'summoning' = 'idle';
    
    // Phase 2 Movement Routine: Pace back & forth, maintain distance, anti-cornering
    private p2MoveDuration: number = 2500;
    private p2PaceDir: number = 1;
    private p2PaceFlipTimer: number = 0;

    // Attack Properties
    private currentSequence: number[] = [];
    private thunderTiles: Map<number, Phaser.Tilemaps.Tile[]> = new Map();
    private summonThresholds = [35, 15];
    private orbsOfRageGroup: Phaser.Physics.Arcade.Group;
    private dotBlocks: Phaser.Physics.Arcade.StaticGroup;

    // Movement & Attack Timers (configurable via BossSpawn properties)
    private patrolSpeed: number = 60;
    private orbSpeed: number = 220;
    private orbInterval: number = 2200;
    private maintainDistance: number = 140;
    private basePhase2ThunderInterval: number = 15000;
    private flyTarget?: { x: number, y: number };
    private flyTowardsPlayer: boolean = false;
    private nextAttackTimer: number = 2000;
    private phase2ThunderTimer: number = 15000;
    private activeTimers: Phaser.Time.TimerEvent[] = [];
    private activeAttackEffects: Phaser.GameObjects.GameObject[] = [];

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
        super(scene, x, y, 'elecking-power', 0);
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
        body.setSize(81, 91); // Exact non-transparent pixel hitbox (96x96 sprite: 81x91 at offset 12,0)
        body.setOffset(12, 0);
        body.setImmovable(true);

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

            // Phase 1: Zero damage, no state changes, no game freeze
            // Phase 2: Deal damage only if boss is vulnerable and not vanished/dead
            if (this.phase === 2 && !this.isInvulnerable && !this.isDead && this.bossState !== 'vanished') {
                this.takeDamage();
            } else if (this.isInvulnerable || this.phase === 1) {
                if (!this.hasShownShieldedToast) {
                    this.hasShownShieldedToast = true;
                    GameEventBus.getInstance().emit('toast:show', {
                        title: 'BOSS SHIELDED',
                        message: 'The boss is shielded. Collect the gravity orbs.',
                        variant: 'warning',
                        durationMs: 4000,
                    });
                }
            }
        });

        // Touching the boss in Phase 2 kills the player
        scene.physics.add.overlap(this.player, this, () => {
            if (this.phase === 2 && !this.isDead && this.bossState !== 'vanished' && this.visible) {
                this.player.die();
            }
        });

        this.setDepth(15);
        this.orbsOfRageGroup = scene.physics.add.group({ allowGravity: false });
        this.dotBlocks = scene.physics.add.staticGroup();
        scene.physics.add.collider(this.player, this.dotBlocks);
        scene.physics.add.collider(this.enemyManager.groundMobs, this.dotBlocks);

        this.setupAnimations();
        this.parseMapObjects(rawMapObjects, map);

        scene.physics.add.collider(this.player, this.tempClouds, (_p, _c) => {
            const playerSprite = _p as Player;
            const cloudSprite = _c as Phaser.Physics.Arcade.Sprite;
            if (cloudSprite.getData('state') === 'vanished' || !cloudSprite.visible) return;
            const pBody = playerSprite.body as Phaser.Physics.Arcade.Body;
            const cBody = cloudSprite.body as Phaser.Physics.Arcade.Body;

            if (pBody.bottom <= cBody.top + 8 && (pBody.velocity.y >= 0 || pBody.blocked.down || pBody.touching.down)) {
                playerSprite.isOnPlatform = true;
                this.triggerCloudFade(cloudSprite);
            }
        });
        
        // Initial setup for Phase 1 - starts frozen until player crosses BossFightEntrance
        this.startPhase1(false);

        this.scene.events.on('player-respawn', () => {
            if (this.player.activeSpawnX && this.player.activeSpawnY && this.bossRespawnPoint) {
                if (this.player.activeSpawnX === this.bossRespawnPoint.x && this.player.activeSpawnY === this.bossRespawnPoint.y) {
                    this.isEntranceRevealed = true;
                    if (this.arenaCover) this.arenaCover.setVisible(false);
                }
            }
            if ((this.phase === 2 || this.hasReachedPhase2) && !this.isDead) {
                // Ensure player retains the Blaster Gun in Phase 2
                this.player.hasGun = true;
                if (this.inventoryManager) {
                    this.inventoryManager.addGun();
                    this.inventoryManager.saveCheckpointSnapshot();
                } else if ((this.scene as any).inventoryManager) {
                    (this.scene as any).inventoryManager.addGun();
                    (this.scene as any).inventoryManager.saveCheckpointSnapshot();
                }
            }
            if (this.hasStarted && !this.isDead) {
                // When player respawns inside boss arena, boss and arena objects retain their position and state
                if (this.phase === 1 && this.bossState === 'idle') {
                    this.flyTarget = undefined;
                } else if (this.phase === 2 && this.bossState === 'patrolling') {
                    const bBody = this.body as Phaser.Physics.Arcade.Body;
                    if (bBody) {
                        const dir = this.player.x > this.x ? 1 : -1;
                        bBody.setVelocityX(this.patrolSpeed * dir);
                    }
                }
            }
        });
    }

    private setupAnimations() {
        if (!this.scene.anims.exists('elecking-drum')) {
            this.scene.anims.create({
                key: 'elecking-drum',
                frames: this.scene.anims.generateFrameNumbers('elecking-power', { start: 1, end: 5 }),
                frameRate: 1, // 1 second delay per user spec
                repeat: 0
            });
        }

        if (!this.scene.anims.exists('elecking-powerup-anim')) {
            this.scene.anims.create({
                key: 'elecking-powerup-anim',
                frames: this.scene.anims.generateFrameNumbers('elecking-powerup', { start: 0, end: 3 }),
                frameRate: 8,
                repeat: 0
            });
        }

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

        if (obj.properties && typeof obj.properties === 'object' && !Array.isArray(obj.properties)) {
            for (const k of Object.keys(obj.properties)) {
                if (lookup.includes(k.toLowerCase()) && obj.properties[k] !== undefined && obj.properties[k] !== null && String(obj.properties[k]).trim() !== '') {
                    return obj.properties[k];
                }
            }
        }

        for (const k of Object.keys(obj)) {
            if (lookup.includes(k.toLowerCase()) && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') {
                return obj[k];
            }
        }

        return undefined;
    }

    private parseBoolProp(obj: any, keys: string[], defaultVal: boolean = true): boolean {
        const val = this.getProp(obj, keys);
        if (val === undefined || val === null) return defaultVal;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val !== 0;
        const s = String(val).toLowerCase().trim();
        if (s === 'false' || s === '0' || s === 'off' || s === 'no' || s === 'disable' || s === 'disabled') return false;
        if (s === 'true' || s === '1' || s === 'on' || s === 'yes' || s === 'enable' || s === 'enabled') return true;
        return defaultVal;
    }

    private parseMapObjects(rawMapObjects: any[], map: Phaser.Tilemaps.Tilemap) {
        // Find BossArenaZone (sole arena boundary and detection limit)
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
                entranceObj.height || 96
            );
        }

        // Find BossFightRespawn
        const respawnObj = rawMapObjects.find(o => {
            const nameLower = (o.name || '').toLowerCase();
            return nameLower === 'bossfightrespawn' || nameLower === 'bossrespawn';
        });
        if (respawnObj && respawnObj.x !== undefined && respawnObj.y !== undefined) {
            this.bossRespawnPoint = { x: respawnObj.x, y: respawnObj.y };
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

        // Find VictoryOrb Spawn Zone (square object)
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
            const posX = c.gid 
                ? c.x + (c.width || 64) / 2 
                : c.x + (c.width || 64) / 2;
            const posY = c.gid 
                ? c.y - (c.height || 32) / 2 
                : c.y + (c.height || 32) / 2;

            const cloud = this.scene.physics.add.sprite(posX, posY, 'temp-platforms', 3);
            cloud.setDepth(6);
            cloud.setOrigin(0.5, 0.5);

            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (cBody) {
                cBody.setAllowGravity(false);
                cBody.setImmovable(true);
                cBody.checkCollision.none = false;
                cBody.checkCollision.down = true;
                cBody.checkCollision.left = true;
                cBody.checkCollision.right = true;
                cBody.checkCollision.up = true;
                cBody.setSize(46, 12);
                cBody.setOffset(9, 10);
            }

            // Custom Properties for Fading & Movement
            let canFade = true;
            const noFadeVal = this.parseBoolProp(c, [
                'noFade', 'nofade', 'no_fade', 'stopFade', 'stopfade', 'stop_fade',
                'disableFade', 'disablefade', 'disable_fade', 'neverFade', 'neverfade', 'never_fade',
                'dontFade', 'dontfade', 'dont_fade', 'permanent', 'isPermanent', 'ispermanent', 'is_permanent',
                'solid', 'isSolid', 'issolid'
            ], false);

            if (noFadeVal) {
                canFade = false;
            } else {
                canFade = this.parseBoolProp(c, [
                    'fade', 'canFade', 'canfade', 'can_fade',
                    'isTemporary', 'istemporary', 'is_temporary',
                    'temporary', 'temp', 'fades', 'fadeable'
                ], true);
            }

            let isMoving = true;
            const isStatic = this.parseBoolProp(c, ['isStatic', 'isstatic', 'is_static', 'static', 'stationary'], false);
            if (isStatic) {
                isMoving = false;
            } else {
                const hasMoveProp = this.getProp(c, ['isMoving', 'ismoving', 'is_moving', 'moving', 'canMove', 'canmove', 'can_move', 'move', 'moves']);
                if (hasMoveProp !== undefined) {
                    isMoving = this.parseBoolProp(c, ['isMoving', 'ismoving', 'is_moving', 'moving', 'canMove', 'canmove', 'can_move', 'move', 'moves'], true);
                }
            }

            let standDuration = Number(this.getProp(c, ['fadeDurationMs', 'standDurationMs', 'standduration', 'fadeduration', 'duration', 'fadetime'])) || 1600;
            if (standDuration > 0 && standDuration <= 20) standDuration = Math.round(standDuration * 1000); // allow seconds (e.g. 1.8 -> 1800ms)

            let respawnDelay = Number(this.getProp(c, ['respawnDelayMs', 'respawndelay', 'respawntime', 'respawn'])) || 2500;
            if (respawnDelay > 0 && respawnDelay <= 20) respawnDelay = Math.round(respawnDelay * 1000); // allow seconds (e.g. 2.5 -> 2500ms)

            let distance = Number(this.getProp(c, ['distance', 'platDistance', 'travelDistance', 'range'])) || 0;
            let speed = Number(this.getProp(c, ['speed', 'platSpeed', 'moveSpeed'])) || 0;

            if (!isMoving) {
                speed = 0;
                distance = 0;
            } else {
                if (distance > 0 && speed === 0) speed = 50; // default medium-slow speed if distance is set
                if (speed > 0 && distance === 0) distance = 96; // default 3 tiles travel distance if speed is set
            }

            const axis = String(this.getProp(c, ['axis', 'directionAxis', 'moveAxis']) || 'x').toLowerCase();
            const direction = Number(this.getProp(c, ['direction', 'dir'])) || 1;

            cloud.setData('state', 'idle');
            cloud.setData('canFade', canFade);
            cloud.setData('isMoving', isMoving);
            cloud.setData('standDurationMs', standDuration);
            cloud.setData('respawnDelayMs', respawnDelay);
            cloud.setData('speed', speed);
            cloud.setData('distance', distance);
            cloud.setData('axis', axis);
            cloud.setData('direction', direction);
            cloud.setData('startX', posX);
            cloud.setData('startY', posY);

            if (isMoving && speed > 0 && distance > 0) {
                if (axis === 'y') {
                    cloud.setData('minY', direction === -1 ? posY - distance : posY);
                    cloud.setData('maxY', direction === -1 ? posY : posY + distance);
                } else {
                    cloud.setData('minX', direction === -1 ? posX - distance : posX);
                    cloud.setData('maxX', direction === -1 ? posX : posX + distance);
                }
                cBody.setVelocity(0, 0); // Initially frozen until encounter is activated
            }

            this.tempClouds.push(cloud);
        });

        // Find GravityOrbs
        const orbObjs = rawMapObjects.filter(o => {
            const nameLower = (o.name || '').toLowerCase();
            const typeLower = (o.type || '').toLowerCase();
            const classLower = (o.class || '').toLowerCase();
            const isOrbGid = o.gid && map.tilesets && map.tilesets.some((t: any) => {
                const tsName = (t.name || '').toLowerCase();
                return (tsName.includes('gravity orb') || tsName.includes('gravity-orb')) && o.gid >= t.firstgid && o.gid < t.firstgid + (t.total || 4);
            });
            return nameLower === 'gravityorb' || nameLower === 'gravity-orb' || nameLower === 'gravity_orb' ||
                   typeLower === 'gravityorb' || typeLower === 'gravity-orb' ||
                   classLower === 'gravityorb' || classLower === 'gravity-orb' ||
                   Boolean(isOrbGid);
        });

        this.rawGravityOrbData = orbObjs.map(o => {
            const idVal = this.getProp(o, ['id', 'orbId', 'orbid', 'order', 'index', 'sequence', 'step']);
            const parsedId = (idVal !== undefined && idVal !== null && !isNaN(Number(idVal)))
                ? Number(idVal)
                : undefined;

            const hasGid = o.gid !== undefined;
            const width = o.width || 32;
            const height = o.height || 32;
            const centerX = o.x + (width / 2);
            const centerY = hasGid ? (o.y - (height / 2)) : (o.y + (height / 2));

            return {
                x: centerX,
                y: centerY,
                width: width,
                height: height,
                id: parsedId
            };
        });
        this.spawnGravityOrbs();

        // Find Hazard tiles with dotNumber from Object Layer & Tile Layers
        // 1. From rawMapObjects (Tiled tile objects placed in Object Layer)
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

                // Render solid block sprite (origin bottom-left in Tiled) at depth 3.5
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

        // 2. From Ground tilelayer
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

        // Setup bounds & collisions for Orbs of Rage against Ground, DungeonFill, and other solid dungeon layers
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

        this.scene.physics.add.collider(this.orbsOfRageGroup, this.dotBlocks, (orbObj) => {
            const orb = orbObj as Phaser.Physics.Arcade.Sprite;
            if (orb && orb.active) {
                const ox = orb.x;
                const oy = orb.y;
                orb.destroy();
                this.uiManager.spawnParticles(ox, oy, 0xA855F7);
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

        const definedIds = this.rawGravityOrbData
            .filter(d => d.id !== undefined && !isNaN(d.id))
            .map(d => d.id!);

        const sortedUniqueIds = Array.from(new Set(definedIds)).sort((a, b) => a - b);
        const hasSequentialIds = sortedUniqueIds.length > 0;
        const firstActiveId = hasSequentialIds ? sortedUniqueIds[0] : undefined;
        const totalOrbs = this.rawGravityOrbData.length > 0 ? this.rawGravityOrbData.length : 7;
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

            // If sequential IDs are configured, only the lowest ID starts visible/active
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
                orb.destroy();
                this.collectedOrbs++;

                // Sound & Floating '+1' token pop notification
                this.soundManager?.playPowerup();
                this.uiManager.showFloatingText(orb.x, orb.y - 10, '+1', TOKENS.colors.orbCyan, 600, 20);
                GameEventBus.getInstance().emitOrbsIfChanged({ collected: this.collectedOrbs, total: totalOrbs });

                if (this.collectedOrbs >= totalOrbs && this.phase === 1) {
                    if (this.orbRevealTimer) {
                        this.orbRevealTimer.remove(false);
                        this.orbRevealTimer = undefined;
                    }
                    this.transitionToPhase2();
                    return;
                }

                // If sequential IDs: reveal the next orb in sequence instantly
                if (hasSequentialIds && currentOrbId !== undefined) {
                    const currentIndex = sortedUniqueIds.indexOf(currentOrbId);
                    const nextId = (currentIndex !== -1 && currentIndex + 1 < sortedUniqueIds.length)
                        ? sortedUniqueIds[currentIndex + 1]
                        : currentOrbId + 1;

                    if (this.orbRevealTimer) {
                        this.orbRevealTimer.remove(false);
                        this.orbRevealTimer = undefined;
                    }

                    this.revealNextGravityOrb(nextId);
                }
            });
        });
    }

    private revealNextGravityOrb(nextId: number) {
        let revealedAny = false;

        this.gravityOrbs.forEach(orb => {
            if (!orb || !orb.scene) return;
            const orbId = orb.getData('orbId');
            if (orbId === nextId && !orb.visible) {
                orb.setVisible(true);
                orb.setActive(true);
                const orbBody = orb.body as Phaser.Physics.Arcade.Body;
                if (orbBody) orbBody.setEnable(true);
                orb.play('gravity-orb-anim');

                // Appearance pop animation & sound
                orb.setScale(0);
                this.scene.tweens.add({
                    targets: orb,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 400,
                    ease: 'Back.easeOut'
                });

                this.soundManager?.playCheckpoint();

                revealedAny = true;
            }
        });

        // Fallback: If no orb with exact nextId was found, reveal the next hidden orb in list
        if (!revealedAny) {
            const nextHidden = this.gravityOrbs.find(o => o && o.scene && !o.visible);
            if (nextHidden) {
                nextHidden.setVisible(true);
                nextHidden.setActive(true);
                const b = nextHidden.body as Phaser.Physics.Arcade.Body;
                if (b) b.setEnable(true);
                nextHidden.play('gravity-orb-anim');
                nextHidden.setScale(0);
                this.scene.tweens.add({
                    targets: nextHidden,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 400,
                    ease: 'Back.easeOut'
                });
                this.soundManager?.playCheckpoint();
            }
        }
    }

    public isPlayerInArena(): boolean {
        if (!this.player || !this.arenaZone) return false;
        const px = this.player.x;
        const py = this.player.y;

        // Check if player is anywhere within BossArenaZone
        if (Phaser.Geom.Rectangle.Contains(this.arenaZone, px, py)) {
            return true;
        }

        // Check if player has respawned at the boss checkpoint inside the arena
        if (this.player.activeSpawnX && this.player.activeSpawnY && this.bossRespawnPoint) {
            if (this.player.activeSpawnX === this.bossRespawnPoint.x && this.player.activeSpawnY === this.bossRespawnPoint.y) {
                return true;
            }
        }

        return false;
    }

    private addBossTimer(delay: number, callback: () => void, loop: boolean = false, repeat: number = 0): Phaser.Time.TimerEvent {
        const timer = this.scene.time.addEvent({
            delay,
            callback,
            loop,
            repeat
        });
        this.activeTimers.push(timer);
        return timer;
    }

    private clearAllActiveTimers() {
        if (this.orbRevealTimer) {
            this.orbRevealTimer.remove(false);
            this.orbRevealTimer = undefined;
        }
        this.activeTimers.forEach(t => {
            if (t) t.remove(false);
        });
        this.activeTimers = [];
    }

    private clearAllAttackEffects() {
        this.activeAttackEffects.forEach(obj => {
            if (obj && (obj as any).active) {
                obj.destroy();
            }
        });
        this.activeAttackEffects = [];
    }

    public isPlayerTouchingEntrance(): boolean {
        if (!this.bossEntranceZone || !this.player || !this.player.body) return false;
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;
        const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
        return Phaser.Geom.Intersects.RectangleToRectangle(pRect, this.bossEntranceZone);
    }

    public activateEncounter() {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.isEntranceRevealed = true;
        this.clearAllActiveTimers();
        this.clearAllAttackEffects();
        this.currentSequence = [];
        this.nextAttackTimer = 2000;
        if (this.arenaCover) {
            this.arenaCover.setVisible(false);
        }
        if (this.envManager) {
            this.envManager.triggerRevealLayer('', true);
            this.envManager.triggerRevealLayer('DungeonFill', true);
            this.envManager.triggerRevealLayer('1', true);
        }

        // Unfreeze and start moving all TemporaryCloud platforms
        this.tempClouds.forEach(cloud => {
            const speed = cloud.getData('speed') as number;
            const distance = cloud.getData('distance') as number;
            if (speed > 0 && distance > 0) {
                const axis = cloud.getData('axis') || 'x';
                const direction = (cloud.getData('direction') as number) || 1;
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) {
                    if (axis === 'y') {
                        cBody.setVelocityY(speed * direction);
                    } else {
                        cBody.setVelocityX(speed * direction);
                    }
                }
            }
        });

        // Show top-screen boss health bar immediately on encounter start
        this.uiManager.showBossHealthBar('ELECKING', this.maxHp, this.hp);

        // Boss encounter toast only when entering BossArenaZone for the first time
        if (!this.hasShownBossEncounterToast) {
            this.hasShownBossEncounterToast = true;
            GameEventBus.getInstance().emit('toast:show', {
                title: 'BOSS ENCOUNTER',
                message: 'The boss is shielded. Collect the gravity orbs.',
                variant: 'warning',
                durationMs: 4000,
            });
        }

        if (this.hasReachedPhase2) {
            this.startPhase2Directly();
        } else {
            this.startPhase1(false);
        }
    }

    private startPhase2Directly() {
        this.hasReachedPhase2 = true;
        this.phase = 2;
        this.isInvulnerable = false;
        this.phase2ThunderTimer = 15000;
        this.pendingPhase2Transition = false;
        this.bossState = 'patrolling';
        this.collectedOrbs = 4;
        this.gravityOrbs.forEach(orb => orb.destroy());
        this.gravityOrbs = [];

        // Ensure player has gun
        this.player.hasGun = true;
        if (this.inventoryManager) {
            this.inventoryManager.addGun();
            this.inventoryManager.saveCheckpointSnapshot();
        }

        // Find ground position directly beneath spawn/boss
        const floorTopY = this.findGroundYBelow(this.initialSpawn.x);
        this.setTexture('elecking-power');
        this.setVisible(true);
        this.setBossFrame(0);
        this.setPosition(this.initialSpawn.x, floorTopY - 48);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
            body.setAllowGravity(false);
        }

        this.uiManager.showBossHealthBar('ELECKING', 50, this.hp);
        this.uiManager.updateBossHealthBar(this.hp, 50);
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });
        this.startGroundedPatrol();

        // Start periodic Orbs of Rage using configured interval
        this.addBossTimer(this.orbInterval, () => {
            if (this.phase === 2 && this.bossState === 'patrolling' && !this.isDead) {
                this.tryShootOrbOfRage();
            }
        }, true);
    }

    public resetAll(forceFullReset: boolean = false) {
        this.clearAllActiveTimers();
        this.clearAllAttackEffects();

        // Clear all boss projectiles
        this.orbsOfRageGroup.clear(true, true);

        // Clear victory items
        if (this.victoryOrb && this.victoryOrb.active) {
            this.victoryOrb.destroy();
            this.victoryOrb = undefined;
        }

        // Clean up boss minion mobs in enemyManager
        const minionMobs = this.enemyManager.groundMobs.getChildren().filter((m: any) => m.getData('isBossMinion'));
        minionMobs.forEach((m: any) => m.destroy());

        if (forceFullReset || !this.hasReachedPhase2) {
            this.hasReachedPhase2 = false;
            this.hasStarted = false;
            this.isDead = false;
            this.phase = 1;
            this.hp = 50;
            this.isInvulnerable = true;
            this.bossState = 'idle';
            this.summonThresholds = [35, 15];
            this.flyTarget = undefined;
            this.flyTowardsPlayer = false;
            this.collectedOrbs = 0;
            this.nextAttackTimer = 2000;
            this.phase2ThunderTimer = 15000;
            this.currentSequence = [];

            // Hide Boss Health Bar
            this.uiManager.hideBossHealthBar();
            this.hasShownShieldedToast = false;
            if (forceFullReset) {
                this.hasShownBossEncounterToast = false;
            }
            GameEventBus.getInstance().emitOrbsIfChanged({ collected: 0, total: 7 });
            GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 1, invulnerable: true });

            // Reset gravity orbs to full
            this.spawnGravityOrbs();

            // Reset moving platforms to start positions and freeze them
            this.tempClouds.forEach(cloud => {
                if (!cloud.active) return;
                cloud.setVisible(true);
                cloud.setFrame(3);
                cloud.setData('state', 'idle');
                cloud.setPosition(cloud.getData('startX'), cloud.getData('startY'));
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) {
                    cBody.setEnable(true);
                    cBody.setVelocity(0, 0);
                }
            });

            // Reset boss sprite and body to initial spawn
            this.setTexture('elecking-power');
            this.setBossFrame(0);
            this.setVisible(true);
            this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setEnable(true);
                body.setVelocity(0, 0);
            }

            // Reset arena cover
            this.isEntranceRevealed = false;
            this.pendingPhase2Transition = false;
            if (this.arenaCover) {
                this.arenaCover.setVisible(true);
            }
        } else {
            // Phase 2 Respawn Reset - Preserve damaged HP and remaining summon thresholds
            this.isDead = false;
            this.phase = 2;
            this.isInvulnerable = false;
            this.summonThresholds = this.summonThresholds.filter(t => t < this.hp);
            this.pendingPhase2Transition = false;
            this.currentSequence = [];
            this.phase2ThunderTimer = 15000;
            this.isEntranceRevealed = true;
            if (this.arenaCover) {
                this.arenaCover.setVisible(false);
            }

            // Unfreeze/reset moving platforms
            this.tempClouds.forEach(cloud => {
                if (!cloud.active) return;
                cloud.setVisible(true);
                cloud.setFrame(3);
                cloud.setData('state', 'idle');
                cloud.setPosition(cloud.getData('startX'), cloud.getData('startY'));
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) {
                    cBody.setEnable(true);
                    const speed = cloud.getData('speed') as number;
                    const distance = cloud.getData('distance') as number;
                    if (speed > 0 && distance > 0) {
                        const axis = cloud.getData('axis') || 'x';
                        const direction = (cloud.getData('direction') as number) || 1;
                        if (axis === 'y') {
                            cBody.setVelocityY(speed * direction);
                        } else {
                            cBody.setVelocityX(speed * direction);
                        }
                    } else {
                        cBody.setVelocity(0, 0);
                    }
                }
            });

            // Start Phase 2 directly
            this.startPhase2Directly();
        }
    }

    private static readonly FRAME_HITBOXES: Record<number, { width: number, height: number, offsetX: number, offsetY: number }> = {
        0: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        1: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        2: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        3: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        4: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
        5: { width: 81, height: 91, offsetX: 12, offsetY: 0 },
    };

    public setBossFrame(frameIndex: number | string) {
        this.setFrame(frameIndex);
        const idx = typeof frameIndex === 'number' ? frameIndex : parseInt(frameIndex, 10) || 0;
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            const box = EleckingBoss.FRAME_HITBOXES[idx] || EleckingBoss.FRAME_HITBOXES[0];
            body.setSize(box.width, box.height);
            body.setOffset(box.offsetX, box.offsetY);
        }
    }

    private startPhase1(retainPosition: boolean = false) {
        this.phase = 1;
        this.isInvulnerable = true;
        this.bossState = 'idle';
        this.nextAttackTimer = 2000;
        this.setTexture('elecking-power');
        this.setBossFrame(0);
        this.setVisible(true);
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 1, invulnerable: true });
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
        }
        if (!retainPosition) {
            this.setPosition(this.initialSpawn.x, this.initialSpawn.y);
        }
    }

    private playThunderTelegraph() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'memory-telegraph';
        this.isInvulnerable = true; // Boss is invulnerable when initiating thunder attacks in Phase 2
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: true });
        this.anims.stop();
        (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        
        // Pick exactly 3 random distinct drums in a randomized sequence
        const available = [1, 2, 3, 4, 5];
        this.currentSequence = Phaser.Utils.Array.Shuffle(available).slice(0, 3);

        // Step 1: Step through each drum in the sequence displaying its specific frame sequentially for 1 second each
        let step = 0;
        const playNextDrum = () => {
            if (!this.hasStarted || this.isDead || this.bossState !== 'memory-telegraph') return;

            if (step < this.currentSequence.length) {
                const drumNumber = this.currentSequence[step];
                // Frame 1 corresponds to Drum 1, Frame 5 to Drum 5
                this.setTexture('elecking-power');
                this.setBossFrame(drumNumber);
                this.soundManager?.playEnemyShoot();
                step++;
                this.addBossTimer(1000, playNextDrum);
            } else {
                // Step 2: Play "Elecking Powerup 96.png" animation right before disappearing for thunder attack
                this.setTexture('elecking-powerup');
                const pBody = this.body as Phaser.Physics.Arcade.Body;
                if (pBody) {
                    pBody.setSize(81, 91);
                    pBody.setOffset(12, 0);
                }
                this.play('elecking-powerup-anim');
                this.soundManager?.playEnemyShoot();
                this.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + 'elecking-powerup-anim', () => {
                    this.vanishAndStrike();
                });
            }
        };

        playNextDrum();
    }

    private vanishAndStrike() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'vanished';
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);

        // Disappear for 3-4 seconds, then strike
        this.addBossTimer(Phaser.Math.Between(3000, 4000), () => {
            if (this.hasStarted && !this.isDead && this.bossState === 'vanished') {
                this.executeThunderStrikes();
            }
        });
    }

    private executeThunderStrikes() {
        if (!this.hasStarted || this.isDead) return;
        this.bossState = 'striking';

        // Strike the tiles matching the boss's telegraphed pattern in sequence
        let delay = 0;
        this.currentSequence.forEach(dotNumber => {
            this.addBossTimer(delay, () => {
                if (!this.hasStarted || this.isDead || this.bossState !== 'striking') return;
                const tiles = this.thunderTiles.get(dotNumber) || [];
                tiles.forEach(tile => {
                    const tileX = tile.pixelX !== undefined ? tile.pixelX : (tile as any).x;
                    const tileY = tile.pixelY !== undefined ? tile.pixelY : (tile as any).y;
                    const tileW = tile.width || 32;
                    const tileH = tile.height || 32;
                    const tileCenterX = tileX + tileW / 2;

                    const arenaTopY = this.arenaZone ? this.arenaZone.top + 24 : tileY - 240;
                    const attackHeight = Math.max(160, tileY - arenaTopY);
                    const cloudTopY = tileY - attackHeight;

                    // 1. Telegraph: Storm Cloud appears directly above the targeted tile column
                    const telegraphCloud = this.scene.add.sprite(tileCenterX, cloudTopY + 16, 'cloud-thunder-attack', 0);
                    telegraphCloud.setOrigin(0.5, 0.5);
                    telegraphCloud.setDisplaySize(tileW + 16, 32);
                    telegraphCloud.setDepth(12);
                    telegraphCloud.setAlpha(0.2);
                    this.activeAttackEffects.push(telegraphCloud);

                    this.scene.tweens.add({
                        targets: telegraphCloud,
                        alpha: 0.95,
                        duration: 350,
                        ease: 'Sine.easeInOut'
                    });

                    // 2. Thunder Strike: After cloud gathering telegraph (~400ms), lightning strikes down onto the tile
                    this.addBossTimer(400, () => {
                        if (telegraphCloud && telegraphCloud.active) telegraphCloud.destroy();
                        if (!this.hasStarted || this.isDead || this.bossState !== 'striking') return;

                        // Play cloud & lightning animation striking down onto the 32x32 ground tile from above
                        const cloudEffect = this.scene.add.sprite(tileCenterX, tileY, 'cloud-thunder-attack', 0);
                        cloudEffect.setOrigin(0.5, 1);
                        cloudEffect.setDisplaySize(tileW, attackHeight);
                        cloudEffect.setDepth(12);
                        cloudEffect.play('cloud-thunder-strike');
                        this.activeAttackEffects.push(cloudEffect);

                        // Sound and camera shake
                        this.soundManager?.playEnemyShoot();
                        this.scene.cameras.main.shake(120, 0.003);

                        // Active damage window during lightning contact (checked every 25ms for 380ms)
                        const damageCheckTimer = this.scene.time.addEvent({
                            delay: 25,
                            repeat: 15,
                            callback: () => {
                                if (!this.player || this.player.isDying || !cloudEffect.active) return;
                                const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                                if (pBody) {
                                    const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
                                    // Bounding column covering the lightning bolt beam down into the tile surface
                                    const beamRect = new Phaser.Geom.Rectangle(tileX + 2, cloudTopY, tileW - 4, attackHeight + tileH);
                                    if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, beamRect)) {
                                        this.player.die('electric');
                                    }
                                }
                            }
                        });

                        this.addBossTimer(450, () => {
                            damageCheckTimer.remove();
                            if (cloudEffect && cloudEffect.active) cloudEffect.destroy();
                        });
                    });
                });
            });
            delay += 600; // Stagger each strike so the player can see them clearly
        });

        // Return to normal or execute Phase 2 descent if last orb was collected mid-attack
        this.addBossTimer(delay + 900, () => {
            if (!this.hasStarted || this.isDead) return;

            // Reveal boss in the air first
            this.setTexture('elecking-power');
            this.setVisible(true);
            this.setBossFrame(0);
            (this.body as Phaser.Physics.Arcade.Body).setEnable(true);

            if (this.pendingPhase2Transition) {
                this.descendAndStartPhase2();
                return;
            }

            if (this.phase === 1) {
                this.bossState = 'idle';
                this.flyTarget = undefined;
                this.nextAttackTimer = 3000;
            } else if (this.phase === 2) {
                this.startGroundedPatrol();
            }
        });
    }

    private transitionToPhase2() {
        this.hasReachedPhase2 = true;
        this.phase = 2;
        // Directly equip player with the Blaster Gun and enable all gun sprites/animations immediately
        if (this.inventoryManager) {
            this.inventoryManager.addGun();
        } else if ((this.scene as any).inventoryManager) {
            (this.scene as any).inventoryManager.addGun();
        } else {
            this.player.hasGun = true;
        }

        this.uiManager.showFloatingText(this.player.x, this.player.y - 30, 'BLASTER GUN EQUIPPED!', TOKENS.colors.orbCyan, 2000);
        this.uiManager.spawnParticles(this.player.x, this.player.y, parseInt(TOKENS.colors.orbCyan.replace('#', '0x'), 16));
        this.soundManager?.playPowerup();

        // If boss is currently mid thunder attack (telegraphing, vanished, or striking):
        // Allow the thunder attack to finish executing first, then reveal in the air and descend
        if (this.bossState === 'memory-telegraph' || this.bossState === 'vanished' || this.bossState === 'striking') {
            this.pendingPhase2Transition = true;
            return;
        }

        // Otherwise (boss is idle in air), reveal in air and descend immediately
        this.descendAndStartPhase2();
    }

    private isSolidTileAt(x: number, y: number): boolean {
        // 1. Check dotBlocks / attack tiles
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

        // 2. Check tilemap layers
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
        // Find highest surface beneath startX among thunderTiles / attack tiles
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

        // Scan downwards in 8px increments from startY to locate highest solid floor tile
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

    private descendAndStartPhase2() {
        this.hasReachedPhase2 = true;
        this.phase = 2;
        this.isInvulnerable = false;
        this.phase2ThunderTimer = 15000;
        this.pendingPhase2Transition = false;
        this.bossState = 'descending';
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });

        // Show phase transition banner & Top-Screen Boss Health Bar
        this.uiManager.showFloatingText(this.x, this.y - 40, 'PHASE 2 - VULNERABLE', TOKENS.colors.danger);
        this.uiManager.showBossHealthBar('ELECKING', 50, this.hp);

        // Find ground position directly beneath boss.
        // Boss sprite is 96px high with origin (0.5, 0.5), so sprite bottom is y + 48.
        // For feet to rest on ground surface at groundY, y = groundY - 48.
        const floorTopY = this.findGroundYBelow(this.x, this.y);
        const targetGroundY = floorTopY - 48;
        const startAirY = Math.min(this.y, targetGroundY - 120);

        // Reveal boss in the air first
        this.setTexture('elecking-power');
        this.setVisible(true);
        this.setBossFrame(0);
        this.setY(startAirY);

        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setEnable(true);
            body.setVelocity(0, 0);
            body.setAllowGravity(false);
        }

        // Floating descent aura particles
        const auraEmitter = this.scene.time.addEvent({
            delay: 100,
            repeat: 14,
            callback: () => {
                if (this && this.active && this.bossState === 'descending') {
                    this.uiManager.spawnParticles(
                        this.x + Phaser.Math.Between(-24, 24), 
                        this.y + Phaser.Math.Between(-20, 20), 
                        0xA855F7
                    );
                }
            }
        });

        // Descend smoothly from the air to the ground
        this.scene.tweens.add({
            targets: this,
            y: targetGroundY,
            duration: 1500,
            ease: 'Sine.easeInOut',
            onComplete: () => {
                auraEmitter.remove();
                if (this.isDead) return;

                // Impact landing dust & audio
                this.uiManager.spawnParticles(this.x, floorTopY, parseInt(TOKENS.colors.hazardRed.replace('#', '0x'), 16));
                this.uiManager.spawnParticles(this.x - 24, floorTopY, 0xA855F7);
                this.uiManager.spawnParticles(this.x + 24, floorTopY, 0xA855F7);
                this.soundManager?.playStomp();

                this.startGroundedPatrol();

                // Start periodic Orbs of Rage using configured interval
                this.addBossTimer(this.orbInterval, () => {
                    if (this.phase === 2 && this.bossState === 'patrolling' && !this.isDead) {
                        this.tryShootOrbOfRage();
                    }
                }, true);
            }
        });
    }

    private startGroundedPatrol() {
        this.bossState = 'patrolling';
        this.isInvulnerable = false; // Vulnerable during grounded combat
        GameEventBus.getInstance().emitBossPhaseIfChanged({ phase: 2, invulnerable: false });
        this.p2MoveDuration = Phaser.Math.Between(2000, 3200);
        this.p2PaceFlipTimer = 0;
        this.p2PaceDir = this.player.x > this.x ? 1 : -1;

        const groundY = this.findGroundYBelow(this.x, this.y - 16);
        this.setY(groundY - 48);

        const dir = this.player.x > this.x ? 1 : -1;
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(this.patrolSpeed * dir);
    }

    private tryShootOrbOfRage() {
        if (this.phase !== 2 || this.bossState !== 'patrolling' || this.isDead) return;

        // Telegraph flash before firing
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 80,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                if (this.active && this.phase === 2 && !this.isDead) {
                    this.fireOrbOfRage();
                }
            }
        });
    }

    private fireOrbOfRage() {
        if (!this.active || this.isDead) return;

        const isFacingRight = this.player.x > this.x;
        const mouthX = this.x + (isFacingRight ? 18 : -18);
        const mouthY = this.y - 10;

        const angle = Phaser.Math.Angle.Between(mouthX, mouthY, this.player.x, this.player.y);
        const vx = Math.cos(angle) * this.orbSpeed;
        const vy = Math.sin(angle) * this.orbSpeed;

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

    public takeDamage() {
        if (this.isInvulnerable || this.isDead || this.bossState === 'vanished' || this.bossState === 'memory-telegraph' || this.bossState === 'striking') return;

        this.hp -= 1;
        this.setTint(parseInt(TOKENS.colors.hazardRed.replace('#', '0x'), 16));
        this.scene.time.delayedCall(100, () => {
            if (this && this.active) this.clearTint();
        });

        // Update Boss Health Bar
        this.uiManager.updateBossHealthBar(this.hp, 50);

        // Check summoning thresholds
        if (this.summonThresholds.includes(this.hp)) {
            this.summonThresholds = this.summonThresholds.filter(t => t !== this.hp);
            this.summonMinions();
        }

        if (this.hp <= 0) {
            this.die();
        }
    }

    private summonMinions() {
        this.bossState = 'summoning';
        (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0); // Pause patrol
        
        // Summon 2-3 Sandal Mobs at boss location grounded on the floor
        const floorY = this.y + 48;
        const count = Phaser.Math.Between(2, 3);
        for (let i = 0; i < count; i++) {
            const offsetX = Phaser.Math.Between(-30, 30);
            const initialDir = offsetX > 0 ? 1 : -1;
            const texKey = initialDir === 1 ? 'mob-sandal-r' : 'mob-sandal-l';
            const validTex = this.scene.textures.exists(texKey) ? texKey : (this.scene.textures.exists('mob-sandal-r') ? 'mob-sandal-r' : 'mob-sandal');
            
            const minion = this.enemyManager.groundMobs.create(this.x + offsetX, floorY, validTex, 0) as Phaser.Physics.Arcade.Sprite;
            minion.setDepth(4).setOrigin(0.5, 1);
            
            const body = minion.body as Phaser.Physics.Arcade.Body;
            if (body) {
                body.setSize(22, 22);
                body.setOffset(5, 10);
                body.setCollideWorldBounds(true);
                body.setAllowGravity(true);
            }
            
            const animKey = initialDir === 1 ? 'mob-sandal-walk-r' : 'mob-sandal-walk-l';
            if (this.scene.anims.exists(animKey)) {
                minion.play(animKey, true);
            }
            
            minion.setData('uniqueKey', `boss_minion_${this.scene.time.now}_${i}`);
            minion.setData('spawnX', this.x + offsetX);
            minion.setData('spawnY', floorY);
            minion.setData('direction', initialDir);
            minion.setData('speed', 80);
            minion.setData('stationary', false);
            minion.setData('type', 'sandal');
            minion.setData('canShoot', false);
            minion.setData('allowOneWay', true);
            minion.setData('scale', 1.0);
            minion.setData('isBossMinion', true);
        }

        this.uiManager.showFloatingText(this.x, this.y - 40, 'SUMMONING!', TOKENS.colors.orbPurple);
        
        this.addBossTimer(2000, () => {
            if (this.phase === 2 && !this.isDead) this.startGroundedPatrol();
        });
    }

    private die() {
        this.isDead = true;
        this.setVisible(false);
        (this.body as Phaser.Physics.Arcade.Body).setEnable(false);
        if (this.soundManager) this.soundManager.stopMusic();

        // Hide Boss Health Bar
        this.uiManager.hideBossHealthBar();

        const goldParticleColor = parseInt(TOKENS.colors.gold.replace('#', '0x'), 16);

        // Boss explosion
        for (let i = 0; i < 20; i++) {
            this.scene.time.delayedCall(i * 100, () => {
                this.uiManager.spawnParticles(
                    this.x + Phaser.Math.Between(-50, 50),
                    this.y + Phaser.Math.Between(-50, 50),
                    goldParticleColor
                );
            });
        }

        // Spawn Big Orb of Victory inside the VictoryOrb square object zone
        this.scene.time.delayedCall(2000, () => {
            if (this.victoryOrb && this.victoryOrb.active) this.victoryOrb.destroy();

            // Spawn at random location within the "VictoryOrb" square object zone if present
            let spawnX = this.x;
            let spawnY = this.y - 30;
            if (this.victoryOrbZone) {
                spawnX = Phaser.Math.Between(this.victoryOrbZone.left + 12, this.victoryOrbZone.right - 12);
                spawnY = Phaser.Math.Between(this.victoryOrbZone.top + 12, this.victoryOrbZone.bottom - 12);
            }

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

            // Pulsing golden glow effect
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
                    this.uiManager.showFloatingText(orbX, orbY - 25, 'ORB OF VICTORY COLLECTED!', TOKENS.colors.gold, 1600);
                    this.uiManager.spawnParticles(orbX, orbY, goldParticleColor);

                    // Complete the stage & submit run to SurrealDB
                    if (typeof (this.scene as any).onStageComplete === 'function') {
                        (this.scene as any).onStageComplete();
                    }
                }
            });
        });
    }

    private triggerCloudFade(cloud: Phaser.Physics.Arcade.Sprite) {
        if (!cloud.active || cloud.getData('state') !== 'idle') return;
        if (cloud.getData('canFade') === false) return;

        cloud.setData('state', 'fading');
        const standDuration = cloud.getData('standDurationMs') || 1600;
        const stepTime = Math.floor(standDuration / 4);

        // Transition: Frame 3 (solid) -> Frame 2 -> Frame 1 -> Frame 0 -> vanish
        this.scene.time.delayedCall(stepTime, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(2);
        });

        this.scene.time.delayedCall(stepTime * 2, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(1);
        });

        this.scene.time.delayedCall(stepTime * 3, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setFrame(0);
        });

        this.scene.time.delayedCall(standDuration, () => {
            if (!cloud.active || cloud.getData('state') !== 'fading') return;
            cloud.setData('state', 'vanished');
            cloud.setVisible(false);
            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (cBody) cBody.checkCollision.none = true;

            const respawnDelay = cloud.getData('respawnDelayMs') || 2500;
            this.scene.time.delayedCall(respawnDelay, () => {
                if (!cloud.active) return;
                cloud.setFrame(3);
                cloud.setVisible(true);
                if (cBody) cBody.checkCollision.none = false;
                cloud.setData('state', 'idle');
            });
        });
    }

    public update(_time: number, delta: number) {
        if (this.isDead) return;

        if (!this.isEntranceRevealed && this.isPlayerTouchingEntrance()) {
            this.isEntranceRevealed = true;
            if (this.arenaCover) {
                this.arenaCover.setVisible(false);
            }
            if (this.envManager) {
                this.envManager.triggerRevealLayer('', true);
                this.envManager.triggerRevealLayer('DungeonFill', true);
                this.envManager.triggerRevealLayer('1', true);
            }
        }

        // Keep plainGround cover visible unless player has touched BossFightEntrance
        if (this.arenaCover) {
            this.arenaCover.setVisible(!this.isEntranceRevealed);
        }

        const inArena = this.isPlayerInArena();

        // Frozen until player enters the arena
        if (!this.hasStarted) {
            if (inArena) {
                this.activateEncounter();
            } else {
                // Keep boss & all moving platforms completely frozen outside
                const bBody = this.body as Phaser.Physics.Arcade.Body;
                if (bBody) bBody.setVelocity(0, 0);

                this.tempClouds.forEach(cloud => {
                    const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                    if (cBody) cBody.setVelocity(0, 0);
                });
                return;
            }
        }

        if (!inArena) {
            // Freeze boss and moving platforms completely when outside arena
            const bBody = this.body as Phaser.Physics.Arcade.Body;
            if (bBody) bBody.setVelocity(0, 0);

            this.tempClouds.forEach(cloud => {
                const cBody = cloud.body as Phaser.Physics.Arcade.Body;
                if (cBody) cBody.setVelocity(0, 0);
            });
            return;
        }

        // Handle boss attack timers
        if (this.phase === 1 && this.bossState === 'idle') {
            this.nextAttackTimer -= delta;
            if (this.nextAttackTimer <= 0) {
                this.nextAttackTimer = 3000;
                this.playThunderTelegraph();
            }
        } else if (this.phase === 2 && this.bossState === 'patrolling') {
            this.phase2ThunderTimer -= delta;
            if (this.phase2ThunderTimer <= 0) {
                this.phase2ThunderTimer = this.basePhase2ThunderInterval;
                this.playThunderTelegraph();
            }
        }

        // When inside arena:
        if (this.bossRespawnPoint) {
            this.player.activeSpawnX = this.bossRespawnPoint.x;
            this.player.activeSpawnY = this.bossRespawnPoint.y;
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

        // Hover & Air Flight logic for Phase 1 (fly towards player direction and back, not very close to the ground)
        if (this.phase === 1 && this.bossState === 'idle') {
            const zone = this.arenaZone;
            if (zone) {
                const arenaTop = zone.top;
                const arenaBottom = zone.bottom;
                const minY = arenaTop + 32;
                const maxY = Math.min(arenaTop + 140, arenaBottom - 180);
                const safeMaxY = maxY > minY ? maxY : minY + 40;

                const minX = zone.left + 48;
                const maxX = zone.right - 48;

                if (!this.flyTarget || Phaser.Math.Distance.Between(this.x, this.y, this.flyTarget.x, this.flyTarget.y) < 16) {
                    this.flyTowardsPlayer = !this.flyTowardsPlayer;
                    let targetX: number;
                    if (this.flyTowardsPlayer) {
                        // Fly towards player direction with gentle variance
                        targetX = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-60, 60), minX, maxX);
                    } else {
                        // Fly back / away in the opposite direction
                        const dirAway = this.player.x > this.x ? -1 : 1;
                        targetX = Phaser.Math.Clamp(this.x + dirAway * Phaser.Math.Between(120, 240), minX, maxX);
                    }
                    const targetY = Phaser.Math.Between(minY, safeMaxY);
                    this.flyTarget = { x: targetX, y: targetY };
                }

                this.scene.physics.moveTo(this, this.flyTarget.x, this.flyTarget.y, 65);
            }
        } else if (this.phase === 1 && this.bossState !== 'idle') {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
        }

        // Ground Patrol & Dynamic Spacing/Anti-Cornering for Phase 2
        if (this.phase === 2 && this.bossState === 'patrolling') {
            const body = this.body as Phaser.Physics.Arcade.Body;
            if (body) {
                // Keep boss firmly grounded on the floor surface (sprite bottom at groundY, origin 0.5)
                const groundY = this.findGroundYBelow(this.x, this.y - 16);
                this.setY(groundY - 48);

                const zone = this.arenaZone;
                const arenaLeft = zone ? zone.left + 48 : 3760;
                const arenaRight = zone ? zone.right - 48 : 4780;

                const distToPlayer = Math.abs(this.player.x - this.x);
                const isPlayerToLeft = this.player.x < this.x;
                const playerNearLeftCorner = this.player.x < arenaLeft + 160;
                const playerNearRightCorner = this.player.x > arenaRight - 160;

                // Flip pacing direction periodically every 1.8 - 2.8s
                this.p2PaceFlipTimer += delta;
                if (this.p2PaceFlipTimer >= this.p2MoveDuration) {
                    this.p2PaceFlipTimer = 0;
                    this.p2MoveDuration = Phaser.Math.Between(1800, 2800);
                    this.p2PaceDir = -this.p2PaceDir;
                }

                let desiredDir = this.p2PaceDir;

                // Maintain Distance: If player is too close (< maintainDistance px), back away from the player
                if (distToPlayer < this.maintainDistance) {
                    desiredDir = isPlayerToLeft ? 1 : -1;
                    this.p2PaceDir = desiredDir;
                } 
                // Anti-Cornering: If player is near an arena corner, do NOT trap them in the corner
                else if (playerNearLeftCorner && isPlayerToLeft && this.x < arenaLeft + 280) {
                    desiredDir = 1; // Pull right away from the left corner
                    this.p2PaceDir = 1;
                } else if (playerNearRightCorner && !isPlayerToLeft && this.x > arenaRight - 280) {
                    desiredDir = -1; // Pull left away from the right corner
                    this.p2PaceDir = -1;
                } else if (distToPlayer > 320) {
                    // Close in towards player if too far
                    desiredDir = isPlayerToLeft ? -1 : 1;
                }

                // Check for solid wall tiles or cliff edges
                if (desiredDir !== 0) {
                    const checkX = desiredDir > 0 ? this.x + 36 : this.x - 36;
                    const wallAhead = this.isSolidTileAt(checkX, this.y);
                    const floorAhead = this.isSolidTileAt(checkX, groundY + 8);

                    if (wallAhead || !floorAhead) {
                        desiredDir = -desiredDir;
                        this.p2PaceDir = desiredDir;
                    }
                }

                // Arena boundary clamp
                if (this.x <= arenaLeft && desiredDir < 0) {
                    desiredDir = 1;
                    this.p2PaceDir = 1;
                } else if (this.x >= arenaRight && desiredDir > 0) {
                    desiredDir = -1;
                    this.p2PaceDir = -1;
                }

                // Apply smooth velocity
                body.setVelocityX(desiredDir * this.patrolSpeed);

                // Boss always faces towards the player
                this.setFlipX(this.player.x < this.x);
            }
        }

        // Moving Cloud Platforms Patrol - continues pathing even when vanished
        this.tempClouds.forEach(cloud => {
            if (!cloud.active) return;
            const speed = cloud.getData('speed') as number;
            const distance = cloud.getData('distance') as number;
            if (!speed || !distance) return;

            const axis = cloud.getData('axis') || 'x';
            const cBody = cloud.body as Phaser.Physics.Arcade.Body;
            if (!cBody) return;

            if (axis === 'y') {
                const minY = cloud.getData('minY') as number;
                const maxY = cloud.getData('maxY') as number;
                if (cloud.y >= maxY) {
                    cBody.setVelocityY(-speed);
                } else if (cloud.y <= minY) {
                    cBody.setVelocityY(speed);
                }
            } else {
                const minX = cloud.getData('minX') as number;
                const maxX = cloud.getData('maxX') as number;
                if (cloud.x >= maxX) {
                    cBody.setVelocityX(-speed);
                } else if (cloud.x <= minX) {
                    cBody.setVelocityX(speed);
                }
            }
        });
    }
}
