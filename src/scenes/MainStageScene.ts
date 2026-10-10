// src/scenes/MainStageScene.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EnvironmentManager } from '../managers/EnvironmentManager';
import { EnemyManager } from '../managers/EnemyManager';
import { CollectiblesManager } from '../managers/CollectiblesManager';
import { UIManager } from '../managers/UIManager';
import { InventoryManager } from '../managers/InventoryManager';
import { SoundManager } from '../managers/SoundManager';
import { SecurityManager } from '../managers/SecurityManager';
import { LeaderboardManager } from '../managers/LeaderboardManager';
import { InputRecorder } from '../managers/InputRecorder';
import { SurrealService } from '../services/SurrealService';
import { EleckingBoss } from '../entities/EleckingBoss';
import { preloadBossSprites, createBossAnimations } from '../entities/bossAnimationTokens';
import { GameEventBus } from '../services/GameEventBus';
import { SOUND_TOKENS } from '../theme/soundTokens';

export class MainStageScene extends Phaser.Scene {
    private player!: Player;
    private envManager!: EnvironmentManager;
    private enemyManager!: EnemyManager;
    private collectiblesManager!: CollectiblesManager;
    private uiManager!: UIManager;
    private inventoryManager!: InventoryManager;
    private soundManager!: SoundManager;
    private eleckingBoss?: EleckingBoss;

    private groundLayer!: Phaser.Tilemaps.TilemapLayer;
    private oneWayLayer!: Phaser.Tilemaps.TilemapLayer;
    public wellLayer?: Phaser.Tilemaps.TilemapLayer;
    public wellZones: Phaser.Geom.Rectangle[] = [];
    public wellForegroundLayers: Phaser.Tilemaps.TilemapLayer[] = [];
    private hazardsLayer?: Phaser.Tilemaps.TilemapLayer;
    private allTilesets: Phaser.Tilemaps.Tileset[] = [];

    // Hardcore Speedrun & Death State
    private initialSpawnX: number = 100;
    private initialSpawnY: number = 100;
    private activeRunTimeMs: number = 0;
    public isGamePaused: boolean = false;
    public isGameComplete: boolean = false;
    public totalDeaths: number = 0;
    private restartPromptActive: boolean = false;
    private restartPromptElapsedMs: number = 0;
    private readonly RESTART_WINDOW_MS: number = 650;
    private checkpointPromptActive: boolean = false;
    private checkpointPromptElapsedMs: number = 0;
    private readonly CHECKPOINT_WINDOW_MS: number = 650;
    private lastFullscreenExitTime: number = 0;
    private escKey!: Phaser.Input.Keyboard.Key;
    private rKey!: Phaser.Input.Keyboard.Key;
    private cKey!: Phaser.Input.Keyboard.Key;
    private mKey!: Phaser.Input.Keyboard.Key;
    private lastSoundToggleTime: number = 0;

    private onFullscreenChange = () => {
        if (typeof document !== 'undefined' && !document.fullscreenElement) {
            this.lastFullscreenExitTime = performance.now();
        }
    };

    private onWindowBlur = () => {
        if (!this.isGameComplete && !this.isGamePaused) {
            this.pauseGame();
        }
    };

    private onVisibilityChange = () => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            if (!this.isGameComplete && !this.isGamePaused) {
                this.pauseGame();
            }
        }
    };

    constructor() {
        super('MainStageScene');
    }

    preload() {
        this.load.image('levelobjects', 'assets/tilesets/LevelObjectTiles.png');
        this.load.image('landtiles', 'assets/tilesets/LandTiles_32_32.png');
        this.load.image('sky', 'assets/sprites/background/sky.png');
        this.load.image('clouds1', 'assets/sprites/background/clouds1.png');
        this.load.image('smallTree', 'assets/sprites/background/smallTree.png');
        this.load.image('largeTree', 'assets/sprites/background/largeTree.png');
        this.load.image('grass', 'assets/sprites/background/grass.png');
        this.load.image('cloud2', 'assets/sprites/background/cloud2.png');
        this.load.tilemapTiledJSON('stage1', 'assets/tilemaps/harder-main-stage.json');

        // Tileset overlays
        this.load.image('plain-ground', 'assets/sprites/blocks/plainGround.png');
        this.load.image('plainGround', 'assets/sprites/blocks/plainGround.png');
        this.load.image('plain-well', 'assets/sprites/blocks/plainWell.png');
        this.load.image('plainWell', 'assets/sprites/blocks/plainWell.png');
        this.load.image('plain-dungeon', 'assets/sprites/background/plainDungeon.png');
        this.load.image('plainDungeon', 'assets/sprites/background/plainDungeon.png');

        this.load.image('cherry blossom 2', 'assets/sprites/background/cherry blossom 2.png');
        this.load.image('cherry blossom 3', 'assets/sprites/background/cherry blossom 3.png');
        this.load.image('cherry blossom tree', 'assets/sprites/background/cherry blossom tree.png');
        this.load.image('cherry blossom blocks', 'assets/sprites/blocks/cherry blossom blocks.png');
        this.load.image('tree 1', 'assets/sprites/background/tree 1.png');
        this.load.image('tree 2', 'assets/sprites/background/tree 2.png');
        this.load.image('tree 3', 'assets/sprites/background/tree 3.png');
        this.load.image('tree 4', 'assets/sprites/background/tree 4.png');
        this.load.image('japanese building', 'assets/sprites/background/japanese building.png');
        this.load.image('japanese_building_3', 'assets/sprites/background/japanese_building_3.png');
        this.load.image('flower bush', 'assets/sprites/background/flower bush.png');
        this.load.image('grass 1', 'assets/sprites/background/grass 1.png');
        this.load.image('grass 2', 'assets/sprites/background/grass 2.png');
        this.load.image('big ahh well', 'assets/sprites/misc/big ahh well.png');
        this.load.image('obstacles sprite', 'assets/sprites/misc/obstacles sprite.png');
        this.load.image('grass template', 'assets/sprites/blocks/grass template.png');
        this.load.image('cb template', 'assets/sprites/blocks/cb template.png');
        this.load.image('DIRT AND GRASS REMADE', 'assets/sprites/blocks/DIRT AND GRASS REMADE.png');
        this.load.image('bridge extra', 'assets/sprites/misc/bridge extra.png');
        this.load.image('temp platforms', 'assets/sprites/boss/temp platforms.png');
        this.load.image('gravity orb', 'assets/sprites/boss/gravity orb.png');
        this.load.spritesheet('dandelion', 'assets/sprites/background/dandelion flower sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('well', 'assets/sprites/blocks/well2.png');
        this.load.image('Well', 'assets/sprites/blocks/well2.png');
        this.load.image('well2', 'assets/sprites/blocks/well2.png');
        this.load.image('Well2', 'assets/sprites/blocks/well2.png');
        this.load.image('water', 'assets/sprites/blocks/water.png');
        this.load.image('lava', 'assets/sprites/blocks/lava.png');
        this.load.image('new lava', 'assets/sprites/blocks/new lava.png');
        this.load.image('bush', 'assets/sprites/background/bush.png');
        this.load.image('mountain', 'assets/sprites/background/mountain.png');
        this.load.spritesheet('32 files dungeon', 'assets/sprites/boss/32 files dungeon.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('cloud variation', 'assets/sprites/boss/cloud variation.png');
        this.load.image('moving-platform', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('moving-platform-img', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('wooden moving platform', 'assets/sprites/misc/wooden moving platform.png');
        this.load.image('spike', 'assets/sprites/misc/spike.png');
        this.load.image('misc/spike', 'assets/sprites/misc/spike.png');
        this.load.image('blocks/spike', 'assets/sprites/blocks/spike.png');
        this.load.spritesheet('jump-pad-img', 'assets/sprites/misc/jumppad sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('bridge-break', 'assets/sprites/misc/new bridge break sprite.png', { frameWidth: 96, frameHeight: 32 });
        this.load.spritesheet('coin', 'assets/sprites/collectibles/new_coin_sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('bullet-sprite', 'assets/sprites/misc/new bullet sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('checkpoint-sprite', 'assets/sprites/misc/checkpoint sprite.png');
        this.load.image('door', 'assets/sprites/misc/door.png');
        this.load.spritesheet('firebar-sprite', 'assets/sprites/misc/firebar sprite.png', { frameWidth: 32, frameHeight: 64 });
        this.load.spritesheet('enemy-fireball', 'assets/sprites/misc/fireball sprite.png', { frameWidth: 32, frameHeight: 32 });

        // Mob Sprites (Sandal, Lantern Spirit, Shapeshifter Fox, Bonsai Gripper, Pumpkin Bat, Lava Kappa, Shiro Onna)
        this.load.spritesheet('mob-sandal-l', 'assets/sprites/monsters/Sandal-Mob-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-sandal-r', 'assets/sprites/monsters/Sandal-Mob-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lantern-spirit-l', 'assets/sprites/monsters/Lantern-Spirit-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lantern-spirit-r', 'assets/sprites/monsters/Lantern-Spirit-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-shapeshifter-fox-l', 'assets/sprites/monsters/Shapeshifter-Fox-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-shapeshifter-fox-r', 'assets/sprites/monsters/Shapeshifter-Fox-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-bonsai-gripper', 'assets/sprites/monsters/Bonsai Gripper.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-pumpkin-bat', 'assets/sprites/monsters/Pumpkin Bat.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('mob-lava-kappa', 'assets/sprites/monsters/Lava Kappa.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('mob-shiro-onna', 'assets/sprites/monsters/Shiro Onna.png');

        // Collectibles (Totem & Gun)
        this.load.image('totem', 'assets/sprites/collectibles/frog_doll_totem.png');
        this.load.image('gun-powerup', 'assets/sprites/collectibles/gun_sprite.png');

        const particleSvg = `data:image/svg+xml;charset=utf8,<svg width="8" height="8" xmlns="http://www.w3.org/2000/svg"><circle cx="4" cy="4" r="4" fill="%23FFFFFF"/></svg>`;
        const fireballSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23FF4500"/><circle cx="8" cy="8" r="5" fill="%23FF8C00"/><circle cx="8" cy="8" r="3" fill="%23FFFF00"/></svg>`;
        const enemyBulletSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="%23DC2626"/><circle cx="8" cy="8" r="5" fill="%23F87171"/><circle cx="8" cy="8" r="2.5" fill="%23FFFFFF"/></svg>`;
        const windParticleSvg = `data:image/svg+xml;charset=utf8,<svg width="16" height="6" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="1" width="16" height="4" rx="2" fill="%23BAE6FD"/></svg>`;
        const cherryPetalSvg = `data:image/svg+xml;charset=utf8,<svg width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M5,0 C7,2 9,4 7,8 C5,10 4,9 3,7 C2,5 3,2 5,0 Z" fill="%23F472B6" fill-opacity="0.85"/></svg>`;

        this.load.image('particle', particleSvg);
        this.load.image('fireball', fireballSvg);
        this.load.image('enemy-bullet', enemyBulletSvg);
        this.load.image('wind-particle', windParticleSvg);
        this.load.image('cherry-petal', cherryPetalSvg);

        // Player Sprites
        this.load.image('idle-r', 'assets/sprites/player/Player-Standing-R.png');
        this.load.image('idle-l', 'assets/sprites/player/Player-Standing-L.png');
        this.load.spritesheet('idle-wind-r', 'assets/sprites/player/Player-Idle-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('idle-wind-l', 'assets/sprites/player/Player-Idle-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-jump', 'assets/sprites/player/Player-Jump.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-fall', 'assets/sprites/player/Player-Falling.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-r', 'assets/sprites/player/Player-Walk-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('walk-l', 'assets/sprites/player/Player-Walk-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-gun-fall', 'assets/sprites/player/Player-Gun-Fall.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-gun-walk-r', 'assets/sprites/player/Player-Gun-Walk-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-gun-walk-l', 'assets/sprites/player/Player-Gun-Walk-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-jump-gun-r', 'assets/sprites/player/Player-Jump-Gun-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-jump-gun-l', 'assets/sprites/player/Player-Jump-Gun-L.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-gun-idle-r', 'assets/sprites/player/Player-Gun-Idle-R.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('player-gun-idle-l', 'assets/sprites/player/Player-Gun-Idle-L.png', { frameWidth: 32, frameHeight: 32 });

        // Effects & Revive
        this.load.spritesheet('totem-revive', 'assets/sprites/player/totem revive sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('electric-death', 'assets/sprites/effects/electric death sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('simple-death', 'assets/sprites/effects/simple death sprite.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-l', 'assets/sprites/effects/lava death sprite-l.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('lava-death-r', 'assets/sprites/effects/lava death sprite-r.png', { frameWidth: 32, frameHeight: 32 });

        // Boss Sprites
        this.load.spritesheet('elecking-power', 'assets/sprites/boss/Elecking Power Attack Sprite 96.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('elecking-powerup', 'assets/sprites/boss/Elecking Powerup 96.png', { frameWidth: 96, frameHeight: 96 });
        this.load.spritesheet('temp-platforms', 'assets/sprites/boss/temp platforms.png', { frameWidth: 64, frameHeight: 32 });
        this.load.spritesheet('cloud-thunder-attack', 'assets/sprites/boss/cloud thunder attack.png', { frameWidth: 32, frameHeight: 240 });
        this.load.spritesheet('attack-orb', 'assets/sprites/boss/attack orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('victory-orb', 'assets/sprites/boss/victory orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('gravity-orb', 'assets/sprites/boss/gravity orb.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack-tiles', 'assets/sprites/boss/attack tiles.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack tiles', 'assets/sprites/boss/attack tiles.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack-tiles-new', 'assets/sprites/boss/new boss/attack tiles new.png', { frameWidth: 32, frameHeight: 32 });
        this.load.spritesheet('attack tiles new', 'assets/sprites/boss/new boss/attack tiles new.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image('dungeon background1', 'assets/sprites/background/dungeon background1.png');
        this.load.image('dungeon-background1', 'assets/sprites/background/dungeon background1.png');
        this.load.image('dungeon background 1', 'assets/sprites/background/dungeon background1.png');

        // Preload new boss sprites and skeleton minion animations
        preloadBossSprites(this);

        // Auto-discover and preload unique image files in public/assets/ (once per file, zero duplicate network requests)
        const autoAssetModules = import.meta.glob<{ default?: string } | string>(
            '../../public/assets/**/*.{png,jpg,jpeg,svg,webp}', 
            { eager: true, query: '?url', import: 'default' }
        );

        const queuedUrls = new Set<string>();
        Object.entries(autoAssetModules).forEach(([path, urlValue]) => {
            const cleanRelPath = path.replace(/^.*\/public\//, '');
            const url = typeof urlValue === 'string' ? urlValue : (urlValue as any)?.default || cleanRelPath;
            if (!queuedUrls.has(url)) {
                queuedUrls.add(url);
                if (!this.textures.exists(cleanRelPath)) {
                    this.load.image(cleanRelPath, url);
                }
            }
        });

        // Music and Sound Effects from SOUND_TOKENS
        Object.values(SOUND_TOKENS.music).forEach(track => {
            this.load.audio(track.key, track.path);
        });
        Object.values(SOUND_TOKENS.sfx).forEach(sound => {
            this.load.audio(sound.key, sound.path);
        });
    }

    create() {
        // Fast in-memory alias mapping for auto-discovered textures (0 network overhead)
        const autoAssetModules = import.meta.glob<{ default?: string } | string>(
            '../../public/assets/**/*.{png,jpg,jpeg,svg,webp}', 
            { eager: true, query: '?url', import: 'default' }
        );
        Object.entries(autoAssetModules).forEach(([path]) => {
            const cleanRelPath = path.replace(/^.*\/public\//, '');
            if (this.textures.exists(cleanRelPath)) {
                const srcImage = this.textures.get(cleanRelPath).getSourceImage() as HTMLImageElement;
                if (srcImage) {
                    const fileName = cleanRelPath.split('/').pop() || '';
                    const baseName = fileName.replace(/\.[^/.]+$/, '');
                    const aliases = [
                        baseName,
                        fileName,
                        cleanRelPath.replace(/\.[^/.]+$/, ''),
                        cleanRelPath.replace(/^assets\//, ''),
                        cleanRelPath.replace(/^assets\//, '').replace(/\.[^/.]+$/, ''),
                        baseName.replace(/[-_]/g, ' '),
                        baseName.replace(/\s+/g, '-'),
                        baseName.replace(/\s+/g, '_')
                    ];
                    aliases.forEach(alias => {
                        if (alias && !this.textures.exists(alias)) {
                            this.textures.addImage(alias, srcImage);
                        }
                    });
                }
            }
        });

        // Apply atmospheric perspective processing to mountain texture before creating tilemap layers
        this.applyAtmosphericPerspectiveToMountainTexture();

        const map = this.make.tilemap({ key: 'stage1' });
        this.createLayers(map);
        this.createAmbientAtmosphere();
        this.createAnimations();

        // Enforce clean nearest-neighbor pixel sampling on all textures to prevent edge bleeding
        this.textures.getTextureKeys().forEach(key => {
            if (this.textures.exists(key)) {
                this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
            }
        });

        const allObjectLayers = map.objects || [];
        const rawMapObjects = allObjectLayers.length > 0 
            ? allObjectLayers.flatMap(layer => layer.objects || [])
            : (map.getObjectLayer('Objects')?.objects || []);
        
        // Find initial spawn
        let spawnX = 100, spawnY = 100;
        const spawnObject = rawMapObjects.find(obj => obj.name === 'Spawn');
        if (spawnObject && spawnObject.x !== undefined && spawnObject.y !== undefined) {
            spawnX = spawnObject.x; 
            spawnY = spawnObject.y;
        }

        this.initialSpawnX = spawnX;
        this.initialSpawnY = spawnY;

        // Initialize Managers
        this.soundManager = new SoundManager(this);
        this.uiManager = new UIManager(this, this.soundManager);
        this.uiManager.createHUD(
            () => {
                if (this.isGameComplete) return;
                if (this.isGamePaused) {
                    this.resumeGame();
                } else {
                    this.pauseGame();
                }
            },
            () => {
                this.restartFullRun();
            }
        );

        this.player = new Player(this, spawnX, spawnY, this.soundManager);
        this.player.spawnX = spawnX; this.player.spawnY = spawnY;
        this.player.activeSpawnX = spawnX; this.player.activeSpawnY = spawnY;
        this.player.lastSafeX = spawnX; this.player.lastSafeY = spawnY;

        this.inventoryManager = new InventoryManager(this, this.player, this.uiManager, this.soundManager);
        this.envManager = new EnvironmentManager(this, this.player, this.uiManager, this.inventoryManager, this.soundManager);
        this.collectiblesManager = new CollectiblesManager(this, this.player, this.uiManager, this.inventoryManager, this.soundManager);
        this.enemyManager = new EnemyManager(this, this.player, this.uiManager, this.collectiblesManager, this.soundManager, this.envManager);

        // Setup Level Environment Objects & Checkpoints
        this.setupWellTunnelZones(map, rawMapObjects);
        this.envManager.setupCheckpoints(rawMapObjects);
        this.envManager.setupRevealTriggers(rawMapObjects);
        this.envManager.setupRevealTileLayers(map, this.allTilesets);
        this.envManager.setupWindZones(rawMapObjects);
        this.envManager.setupDoors(rawMapObjects);
        this.envManager.setupWells(map, rawMapObjects);
        this.envManager.setupGunDisarmZones(rawMapObjects);
        this.envManager.setupMovingPlatforms(map, rawMapObjects);
        this.envManager.setupJumpPads(map, rawMapObjects);
        this.envManager.setupFirebars(rawMapObjects);
        this.envManager.setupSmashTriggers(map, rawMapObjects);
        this.envManager.setupBridges(map, rawMapObjects);
        this.envManager.setupDandelions(rawMapObjects);
        this.envManager.setupStartTutorialCues(rawMapObjects, spawnX, spawnY);

        // Setup Entities & Level Objects
        this.enemyManager.setupGroundMobs(rawMapObjects, this.groundLayer, this.oneWayLayer, this.hazardsLayer, this.wellLayer);
        this.enemyManager.setupPipeMonsters(map, rawMapObjects);

        const bossSpawnObj = rawMapObjects.find(o => o.name === 'BossSpawn');
        if (bossSpawnObj && bossSpawnObj.x !== undefined && bossSpawnObj.y !== undefined) {
            this.eleckingBoss = new EleckingBoss(
                this, 
                bossSpawnObj.x, 
                bossSpawnObj.y, 
                this.player, 
                this.uiManager, 
                this.enemyManager, 
                this.envManager, 
                this.soundManager, 
                rawMapObjects, 
                map,
                this.inventoryManager
            );
        }

        // Ground mobs treat JumpPads and MovingPlatforms as solid obstacles to prevent getting stuck
        if (this.envManager.jumpPads.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.jumpPads, (mobObj, padObj) => {
                const mob = mobObj as Phaser.Physics.Arcade.Sprite;
                const pad = padObj as Phaser.Physics.Arcade.Sprite;
                const newDir = mob.x < pad.x ? -1 : 1;
                mob.setData('direction', newDir);
                mob.setVelocityX(((mob.getData('speed') as number) || 50) * newDir);
                mob.setData('lastTurnTime', this.time.now);
            });
        }
        if (this.envManager.movingPlatforms.length > 0) {
            this.physics.add.collider(this.enemyManager.groundMobs, this.envManager.movingPlatforms);
        }
        
        this.collectiblesManager.setupCollectibles(map);

        // Save initial snapshot for stage start (0% progression)
        this.collectiblesManager.saveCheckpointSnapshot();
        this.enemyManager.saveCheckpointSnapshot();
        this.inventoryManager.saveCheckpointSnapshot();
        this.envManager.saveCheckpointSnapshot();

        // Security and SurrealDB backend session start
        SecurityManager.getInstance().startNewRun('stage1');
        InputRecorder.getInstance().start();
        SurrealService.getInstance().startRun();

        // Checkpoint snapshot listener
        this.events.on('checkpoint-saved', () => {
            this.collectiblesManager.saveCheckpointSnapshot();
            this.enemyManager.saveCheckpointSnapshot();
            this.inventoryManager.saveCheckpointSnapshot();
            this.envManager.saveCheckpointSnapshot();
            SecurityManager.getInstance().recordEvent('CHECKPOINT', { x: this.player.x, y: this.player.y });
        });

        // Player death event: reset arena/boss if inside boss arena
        this.events.on('player-death', () => {
            this.totalDeaths++;
            SecurityManager.getInstance().recordDeath(this.totalDeaths);
            SecurityManager.getInstance().recordEvent('DEATH', { x: this.player.x, y: this.player.y, deaths: this.totalDeaths });
            
            const isInsideBossArena = Boolean(this.eleckingBoss?.isPlayerInArena() || this.eleckingBoss?.isEntranceRevealed);
            if (isInsideBossArena || (this.eleckingBoss && this.eleckingBoss.hasReachedPhase2)) {
                this.eleckingBoss?.resetAll(false);
            }
            this.player.bullets.clear(true, true);
        });

        // Player respawn event: restore everything ahead of latest checkpoint earned, persisting state before checkpoint
        this.events.on('player-respawn', () => {
            this.collectiblesManager.rollbackToCheckpoint();
            this.envManager.rollbackToCheckpoint();
            this.inventoryManager.rollbackToCheckpoint();
            this.enemyManager.rollbackToCheckpoint();
        });

        // ESC, R, and C Key listeners
        if (this.input.keyboard) {
            if (typeof document !== 'undefined') {
                document.addEventListener('fullscreenchange', this.onFullscreenChange);
            }

            this.escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            this.escKey.on('down', () => {
                if (this.isGameComplete) {
                    return; // Sticky: ESC cannot unpause or resume game once victory orb is collected
                }
                // When exiting fullscreen via Esc, browser exits fullscreen; ignore Esc for ~300ms so it doesn't also open pause menu
                if (performance.now() - this.lastFullscreenExitTime < 300) {
                    return;
                }
                if (this.isGamePaused) {
                    this.resumeGame();
                } else {
                    this.pauseGame();
                }
            });

            this.rKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
            this.rKey.on('down', () => {
                if (this.isGamePaused || this.isGameComplete) return;
                if (this.restartPromptActive && this.restartPromptElapsedMs < this.RESTART_WINDOW_MS) {
                    this.restartPromptActive = false;
                    this.restartPromptElapsedMs = 0;
                    GameEventBus.getInstance().emit('prompt:restart', { active: false, progress: 0 });
                    this.restartFullRun();
                } else {
                    if (this.checkpointPromptActive) {
                        this.checkpointPromptActive = false;
                        this.checkpointPromptElapsedMs = 0;
                        GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });
                    }
                    this.restartPromptActive = true;
                    this.restartPromptElapsedMs = 0;
                    GameEventBus.getInstance().emit('prompt:restart', { active: true, progress: 1.0 });
                }
            });

            this.cKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
            this.cKey.on('down', () => {
                if (this.isGamePaused || this.isGameComplete) return;
                if (this.eleckingBoss && this.eleckingBoss.isFightActive()) {
                    return;
                }
                if (!this.envManager.hasActiveCheckpoint()) {
                    GameEventBus.getInstance().emit('toast:show', {
                        id: 'no-checkpoint-active',
                        title: 'NO CHECKPOINT ACTIVE',
                        icon: 'checkpoint',
                        variant: 'warning',
                    });
                    return;
                }

                if (this.checkpointPromptActive && this.checkpointPromptElapsedMs < this.CHECKPOINT_WINDOW_MS) {
                    this.checkpointPromptActive = false;
                    this.checkpointPromptElapsedMs = 0;
                    GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });
                    this.respawnAtActiveCheckpoint();
                } else {
                    if (this.restartPromptActive) {
                        this.restartPromptActive = false;
                        this.restartPromptElapsedMs = 0;
                        GameEventBus.getInstance().emit('prompt:restart', { active: false, progress: 0 });
                    }
                    this.checkpointPromptActive = true;
                    this.checkpointPromptElapsedMs = 0;
                    GameEventBus.getInstance().emit('prompt:checkpoint', { active: true, progress: 1.0 });
                }
            });

            this.mKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
            this.mKey.on('down', () => {
                GameEventBus.getInstance().emit('action:trigger', { type: 'TOGGLE_SOUND' });
            });
        }

        // Accidental Reload Guard (beforeunload event)
        window.addEventListener('beforeunload', this.beforeUnloadHandler);

        // GameEventBus Action Dispatcher (React UI -> Phaser Game)
        const bus = GameEventBus.getInstance();
        const unsubAction = bus.on('action:trigger', (action) => {
            switch (action.type) {
                case 'RESUME_GAME':
                    this.resumeGame();
                    break;
                case 'PAUSE_GAME':
                    this.pauseGame();
                    break;
                case 'TOGGLE_PAUSE':
                    if (this.isGameComplete) return;
                    if (this.isGamePaused) this.resumeGame();
                    else this.pauseGame();
                    break;
                case 'RESPAWN_CHECKPOINT':
                    if (this.eleckingBoss && this.eleckingBoss.isFightActive()) {
                        return;
                    }
                    if (this.envManager.hasActiveCheckpoint()) {
                        this.respawnAtActiveCheckpoint();
                    }
                    break;
                case 'RESTART_RUN':
                    this.restartFullRun();
                    break;
                case 'TOGGLE_SOUND':
                    const now = performance.now();
                    if (now - this.lastSoundToggleTime < 180) {
                        return; // Prevent duplicate rapid triggers
                    }
                    this.lastSoundToggleTime = now;

                    const nextMuted = !this.soundManager.isMuted;
                    this.soundManager.setMuted(nextMuted);
                    bus.emit('sound:status', !nextMuted);

                    // Dismiss prior sound notifications to ensure clean swap and prevent stacking
                    bus.emit('toast:dismiss', 'sound-status-toast');
                    bus.emit('toast:dismiss', 'sound-muted-toast');
                    bus.emit('toast:dismiss', 'sound-unmuted-toast');
                    bus.emit('toast:dismiss', 'sound-toggle-toast');

                    if (!nextMuted) {
                        if (this.eleckingBoss?.isPlayerInArena() && !this.eleckingBoss.isDead) {
                            if (this.eleckingBoss.phase === 2 || this.eleckingBoss.hasReachedPhase2) {
                                this.soundManager.playBossPhase2Music();
                            } else {
                                this.soundManager.playBossMusic();
                            }
                        } else {
                            this.soundManager.playGameMusic();
                        }
                    }

                    bus.emit('toast:show', {
                        id: 'sound-status-toast',
                        title: nextMuted ? 'GAME SOUND MUTED' : 'GAME SOUND RESUMED',
                        variant: nextMuted ? 'warning' : 'info',
                        durationMs: 2200,
                    });
                    if (!nextMuted) {
                        this.soundManager.playMenuSelect();
                    }
                    break;
                case 'OPEN_LEADERBOARD':
                    this.soundManager.playMenuSelect();
                    break;
            }
        });

        // Sound pauseOnBlur disabled so our pauseGame/resumeGame has full authoritative control
        if (this.sound) {
            this.sound.pauseOnBlur = false;
        }

        // Window Focus / Blur & Tab Switch / Alt-Tab Event Listeners
        window.addEventListener('blur', this.onWindowBlur);
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this.onVisibilityChange);
        }

        const cleanup = () => {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            window.removeEventListener('blur', this.onWindowBlur);
            if (typeof document !== 'undefined') {
                document.removeEventListener('fullscreenchange', this.onFullscreenChange);
                document.removeEventListener('visibilitychange', this.onVisibilityChange);
            }
            unsubAction();
        };

        this.events.on(Phaser.Scenes.Events.SHUTDOWN, cleanup);
        this.events.on(Phaser.Scenes.Events.DESTROY, cleanup);

        // World Colliders
        this.physics.add.collider(this.player, this.groundLayer, undefined, (_p, tile) => {
            return this.checkTileWellCollision(tile as Phaser.Tilemaps.Tile, this.player.body as Phaser.Physics.Arcade.Body);
        });
        this.physics.add.collider(this.player, this.oneWayLayer, undefined, (_p, tile) => {
            const t = tile as Phaser.Tilemaps.Tile;
            if (t.index === -1) return false; 
            const body = this.player.body as Phaser.Physics.Arcade.Body;
            if (!this.checkTileWellCollision(t, body)) return false;
            return body.velocity.y > 0 && body.bottom <= t.pixelY + 10;
        });

        // Bullets vs Ground / Walls (pass through inside Well tunnel)
        this.physics.add.collider(this.player.bullets, this.groundLayer, (bulletObj, tileObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (!bullet || !bullet.active || !bullet.scene) return;
            const t = tileObj as Phaser.Tilemaps.Tile;
            if (t && this.wellZones && this.wellZones.length > 0) {
                const tileCenterX = t.pixelX + t.width / 2;
                const tileCenterY = t.pixelY + t.height / 2;
                const inWell = this.wellZones.some(z => 
                    tileCenterX >= z.left && tileCenterX <= z.right &&
                    tileCenterY >= z.top && tileCenterY <= z.bottom
                );
                if (inWell) return;
            }
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
            this.uiManager.spawnParticles(bx, by, 0xFF8C00);
        }, (bulletObj, tile) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (!bullet || !bullet.active || !bullet.body || !bullet.scene) return false;
            const t = tile as Phaser.Tilemaps.Tile;
            if (!t || t.index === -1) return false;
            if (this.wellZones && this.wellZones.length > 0) {
                const tileCenterX = t.pixelX + t.width / 2;
                const tileCenterY = t.pixelY + t.height / 2;
                const inWell = this.wellZones.some(z => 
                    tileCenterX >= z.left && tileCenterX <= z.right &&
                    tileCenterY >= z.top && tileCenterY <= z.bottom
                );
                if (inWell) return false;
            }
            return true;
        });

        if (this.wellLayer) {
            this.physics.add.collider(this.player, this.wellLayer, undefined, (_p, tile) => {
                return this.checkTileWellCollision(tile as Phaser.Tilemaps.Tile, this.player.body as Phaser.Physics.Arcade.Body);
            });

            this.physics.add.collider(this.player.bullets, this.wellLayer, (bulletObj) => {
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
                bullet.destroy();
                this.uiManager.spawnParticles(bx, by, 0xFF8C00);
            }, (bulletObj) => {
                const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                return Boolean(bullet && bullet.active && bullet.body && bullet.scene);
            });
        }

        if (this.hazardsLayer) {
            this.physics.add.overlap(
                this.player, 
                this.hazardsLayer, 
                (_p, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    const isLava = t.tileset?.name === 'lava' || t.tileset?.name === 'new lava' || (t.index >= 2663 && t.index <= 2665) || (t.index >= 4053 && t.index <= 4056) || (t.index >= 2730 && t.index <= 2732);
                    this.player.die(isLava ? 'lava' : 'default');
                }, 
                (_p, tile) => {
                    const t = tile as Phaser.Tilemaps.Tile;
                    if (t.index === -1) return false;

                    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                    if (!pBody) return false;

                    const isLava = t.tileset?.name === 'lava' || t.tileset?.name === 'new lava' || (t.index >= 2663 && t.index <= 2665) || (t.index >= 4053 && t.index <= 4056) || (t.index >= 2730 && t.index <= 2732);
                    const tileTop = t.pixelY;
                    const tileBottom = t.pixelY + t.height;
                    const tileLeft = t.pixelX;
                    const tileRight = t.pixelX + t.width;

                    if (isLava) {
                        // Lava: player must visibly fall inside the molten liquid (down at least 10px into the tile)
                        const isHorizontallyInLava = pBody.right > tileLeft + 3 && pBody.left < tileRight - 3;
                        const isVerticallyInLava = pBody.bottom >= tileTop + 10 && pBody.top <= tileBottom;
                        return isHorizontallyInLava && isVerticallyInLava;
                    } else if (t.index === 3596) {
                        // Up spike (pointing upwards from floor)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 8 && pBody.top <= tileBottom - 2;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3598) {
                        // Down spike (hanging downwards from ceiling)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.top <= tileBottom - 8 && pBody.bottom >= tileTop + 2;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3597) {
                        // Right spike (pointing right from wall)
                        const isHorizontallyTouching = pBody.left <= tileRight - 8 && pBody.right >= tileLeft + 2;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 6 && pBody.top <= tileBottom - 6;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else if (t.index === 3599) {
                        // Left spike (pointing left from wall)
                        const isHorizontallyTouching = pBody.right >= tileLeft + 8 && pBody.left <= tileRight - 2;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 6 && pBody.top <= tileBottom - 6;
                        return isHorizontallyTouching && isVerticallyTouching;
                    } else {
                        // Spikes / other hazards fallback: pixel-accurate inner bounding box to prevent clipping air margins
                        const isHorizontallyTouching = pBody.right >= tileLeft + 6 && pBody.left <= tileRight - 6;
                        const isVerticallyTouching = pBody.bottom >= tileTop + 8 && pBody.top <= tileBottom - 4;
                        return isHorizontallyTouching && isVerticallyTouching;
                    }
                }
            );
        }

        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.startFollow(this.player);
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.TILE_BIAS = 32;

        // Ambient background cherry blossom petals drifting with the breeze
        this.createAmbientAtmosphere();

        this.game.canvas.setAttribute('tabindex', '0');
        this.game.canvas.focus();
        this.input.on('pointerdown', () => this.game.canvas.focus());

        // Disable right-click context menu so mouse interactions never interfere with keyboard movement
        this.input.mouse?.disableContextMenu();
        if (this.game.canvas) {
            this.game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        if (typeof window !== 'undefined') {
            (window as any).__scene = this;
            (window as any).__player = this.player;
        }

        this.activeRunTimeMs = 0;
        this.soundManager.playGameMusic();
    }

    private beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = '';
    };

    private pauseGame() {
        if (this.isGamePaused) return;
        this.isGamePaused = true;
        if (this.restartPromptActive) {
            this.restartPromptActive = false;
            this.restartPromptElapsedMs = 0;
            GameEventBus.getInstance().emit('prompt:restart', { active: false, progress: 0 });
        }
        if (this.checkpointPromptActive) {
            this.checkpointPromptActive = false;
            this.checkpointPromptElapsedMs = 0;
            GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });
        }
        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        this.time.paused = true;
        this.soundManager.pauseAll();
        this.soundManager.playMenuSelect();

        // Release keyboard capture and disable listeners while modal is open
        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = false;
            this.input.keyboard.resetKeys();
        }

        const formattedTime = this.getFormattedElapsedTime();
        const hasCheckpoint = this.envManager.hasActiveCheckpoint();

        this.uiManager.showPauseMenu(
            () => this.resumeGame(),
            () => this.respawnAtActiveCheckpoint(),
            () => this.restartFullRun(),
            {
                time: formattedTime,
                deaths: this.totalDeaths,
                coins: this.collectiblesManager.coinsCollected,
                kills: this.enemyManager.enemiesKilled,
                hasCheckpoint: hasCheckpoint
            }
        );
    }

    private resumeGame() {
        if (!this.isGamePaused) return;
        this.isGamePaused = false;
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
        this.time.paused = false;
        this.soundManager.resumeAll();
        this.uiManager.hidePauseMenu();
        this.soundManager.playMenuSelect();

        this.player?.enforceKeyLift();

        // Re-enable Phaser keyboard capture after 1 frame so activating keypress doesn't trigger in-game jump
        setTimeout(() => {
            if (!this.isGamePaused && !this.isGameComplete && this.input && this.input.keyboard) {
                this.input.keyboard.enabled = true;
                this.input.keyboard.resetKeys();
            }
        }, 50);
    }

    private respawnAtActiveCheckpoint() {
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.checkpointPromptActive = false;
        this.checkpointPromptElapsedMs = 0;
        GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });
        this.player.cancelDeathEffect();
        this.uiManager.hideDeathScreen();
        this.uiManager.hidePauseMenu();
        this.uiManager.cancelFlyingOrbs();
        this.totalDeaths++;
        this.player.setPosition(this.player.activeSpawnX, this.player.activeSpawnY);
        this.player.setVelocity(0, 0);
        const isInsideBossArena = Boolean(this.eleckingBoss?.isPlayerInArena());
        if (isInsideBossArena || (this.eleckingBoss && this.eleckingBoss.hasReachedPhase2)) {
            this.eleckingBoss?.resetAll(false);
        }
        this.player.bullets.clear(true, true);

        this.collectiblesManager.rollbackToCheckpoint();
        this.envManager.rollbackToCheckpoint();
        this.inventoryManager.rollbackToCheckpoint();
        this.enemyManager.rollbackToCheckpoint();

        const isBossPhase2 = Boolean(
            this.eleckingBoss && 
            (this.eleckingBoss.phase === 2 || this.eleckingBoss.hasReachedPhase2) && 
            !this.eleckingBoss.isDead
        );
        if (isBossPhase2) {
            this.player.hasGun = true;
            this.inventoryManager.addGun();
        }

        const gunIdleKey = this.player.facing === 'right' ? 'gun-idle-r-anim' : 'gun-idle-l-anim';
        const defaultIdleKey = this.player.facing === 'right' ? 'idle-r-anim' : 'idle-l-anim';
        const chosenAnim = this.player.hasGun && this.anims.exists(gunIdleKey) ? gunIdleKey : defaultIdleKey;

        if (this.anims.exists(chosenAnim)) {
            this.player.anims.play(chosenAnim, true);
        } else {
            this.player.anims.stop();
            this.player.setTexture(this.player.facing === 'right' ? 'idle-r' : 'idle-l');
        }
        this.player.enforceKeyLift();
        this.soundManager?.playRespawn();
    }

    private restartFullRun() {
        this.isGameComplete = false;
        this.uiManager.hideVictoryMenu();
        if (this.isGamePaused) {
            this.resumeGame();
        }
        this.physics.resume();
        this.anims.resumeAll();
        this.tweens.resumeAll();
        this.time.paused = false;
        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = true;
            this.input.keyboard.resetKeys();
        }
        this.player.cancelDeathEffect();
        this.uiManager.hideDeathScreen();
        this.uiManager.hidePauseMenu();
        this.uiManager.cancelFlyingOrbs();
        this.totalDeaths = 0;
        this.activeRunTimeMs = 0;

        // Reset spawn back to stage entrance (0%)
        this.player.spawnX = this.initialSpawnX;
        this.player.spawnY = this.initialSpawnY;
        this.player.activeSpawnX = this.initialSpawnX;
        this.player.activeSpawnY = this.initialSpawnY;
        this.player.lastSafeX = this.initialSpawnX;
        this.player.lastSafeY = this.initialSpawnY;
        this.player.setPosition(this.initialSpawnX, this.initialSpawnY);
        this.player.setVelocity(0, 0);
        this.player.hasGun = false;
        this.player.hasTotem = false;
        this.player.clearTint();
        this.player.bullets.clear(true, true);
        this.player.enforceKeyLift();

        this.collectiblesManager.resetAll();
        this.envManager.resetAll();
        this.envManager.resetCheckpoints();
        this.inventoryManager.resetAll();
        this.enemyManager.resetAll();
        this.eleckingBoss?.resetAll(true);
        SecurityManager.getInstance().startNewRun('stage1');
        InputRecorder.getInstance().reset();
        SurrealService.getInstance().startRun();

        this.restartPromptActive = false;
        this.restartPromptElapsedMs = 0;
        this.checkpointPromptActive = false;
        this.checkpointPromptElapsedMs = 0;
        GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });

        GameEventBus.getInstance().resetCache();
        GameEventBus.getInstance().emit('toast:show', {
            id: 'run-restarted',
            title: 'RUN RESTARTED',
            icon: 'restart',
            variant: 'info',
            durationMs: 1500,
        });
        this.soundManager?.playPowerup();
        this.soundManager?.playGameMusic();
    }

    public getElapsedMilliseconds(): number {
        return this.activeRunTimeMs;
    }

    private getFormattedElapsedTime(): string {
        const elapsedMs = Math.round(this.activeRunTimeMs);
        const minutes = Math.floor(elapsedMs / 60000);
        const seconds = Math.floor((elapsedMs % 60000) / 1000);
        const millis = Math.floor(elapsedMs % 1000);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
    }

    private createLayers(map: Phaser.Tilemaps.Tilemap) {
        const addTileset = (tilesetName: string, textureKey: string) => {
            if (map.tilesets && map.tilesets.some(t => t.name === tilesetName) && this.textures.exists(textureKey)) {
                return map.addTilesetImage(tilesetName, textureKey);
            }
            return null;
        };

        const levelObjectsTileset = addTileset('LevelObjectTiles', 'levelobjects');
        const landTileset = addTileset('LandTiles_32_32', 'landtiles');
        const skyTileset = addTileset('sky', 'sky');
        const clouds1Tileset = addTileset('clouds1', 'clouds1');
        const cloud2Tileset = addTileset('cloud2', 'cloud2');
        const smallTreeTileset = addTileset('smallTree', 'smallTree');
        const largeTreeTileset = addTileset('largeTree', 'largeTree');
        const grassTileset = addTileset('grass', 'grass');
        const cherryBlossomBlocksTileset = addTileset('cherry blossom blocks', 'cherry blossom blocks');
        const grassTemplateTileset = addTileset('grass template', 'grass template');
        const cbTemplateTileset = addTileset('cb template', 'cb template');
        const dirtAndGrassRemadeTileset = addTileset('DIRT AND GRASS REMADE', 'DIRT AND GRASS REMADE');
        const bridgeExtraTileset = addTileset('bridge extra', 'bridge extra');
        const wellTileset = addTileset('well', 'well');
        const well2Tileset = addTileset('well2', 'well2');
        const waterTileset = addTileset('water', 'water');
        const lavaTileset = addTileset('lava', 'lava');
        const bushTileset = addTileset('bush', 'bush');
        const dandelionTileset = addTileset('dandelion flower sprite', 'dandelion');
        const woodenPlatformTileset = addTileset('wooden moving platform', 'wooden moving platform');
        const jumpPadTileset = addTileset('jumppad sprite', 'jump-pad-img');
        const mountainTileset = addTileset('mountain', 'mountain');
        const dungeon32Tileset = addTileset('32 files dungeon', '32 files dungeon');
        const cloudVariationTileset = addTileset('cloud variation', 'cloud variation');
        const tempPlatformsTileset = addTileset('temp platforms', 'temp platforms');
        const gravityOrbTileset = addTileset('gravity orb', 'gravity orb');
        const attackTilesTileset = addTileset('attack tiles', 'attack tiles') || addTileset('attack tiles', 'attack-tiles');
        const attackTilesNewTileset = addTileset('attack tiles new', 'attack tiles new') || addTileset('attack tiles new', 'attack-tiles-new');
        const cherryBlossomTreeTileset = addTileset('cherry blossom tree', 'cherry blossom tree');
        const newLavaTileset = addTileset('new lava', 'new lava');
        const dungeonBg1Tileset = addTileset('dungeon background1', 'dungeon background1');
        const spikeTileset = addTileset('spike', 'spike');
        const japaneseBuildingTileset = addTileset('japanese building', 'japanese building');
        const japaneseBuilding3Tileset = addTileset('japanese_building_3', 'japanese_building_3');
        const cherryBlossom2Tileset = addTileset('cherry blossom 2', 'cherry blossom 2');
        const cherryBlossom3Tileset = addTileset('cherry blossom 3', 'cherry blossom 3');
        const tree1Tileset = addTileset('tree 1', 'tree 1');
        const tree2Tileset = addTileset('tree 2', 'tree 2');
        const tree3Tileset = addTileset('tree 3', 'tree 3');
        const tree4Tileset = addTileset('tree 4', 'tree 4');
        const flowerBushTileset = addTileset('flower bush', 'flower bush');
        const grass1Tileset = addTileset('grass 1', 'grass 1');
        const grass2Tileset = addTileset('grass 2', 'grass 2');
        const bigWellTileset = addTileset('big ahh well', 'big ahh well');
        const obstaclesTileset = addTileset('obstacles sprite', 'obstacles sprite');
        const doorTileset = addTileset('door', 'door');

        const allTilesets = [
            levelObjectsTileset,
            landTileset,
            skyTileset,
            clouds1Tileset,
            cloud2Tileset,
            smallTreeTileset,
            largeTreeTileset,
            grassTileset,
            cherryBlossom2Tileset,
            cherryBlossom3Tileset,
            cherryBlossomTreeTileset,
            cherryBlossomBlocksTileset,
            japaneseBuildingTileset,
            japaneseBuilding3Tileset,
            tree1Tileset,
            tree2Tileset,
            tree3Tileset,
            tree4Tileset,
            flowerBushTileset,
            grass1Tileset,
            grass2Tileset,
            bigWellTileset,
            obstaclesTileset,
            grassTemplateTileset,
            cbTemplateTileset,
            dirtAndGrassRemadeTileset,
            bridgeExtraTileset,
            wellTileset,
            well2Tileset,
            waterTileset,
            lavaTileset,
            newLavaTileset,
            bushTileset,
            dandelionTileset,
            woodenPlatformTileset,
            jumpPadTileset,
            mountainTileset,
            dungeon32Tileset,
            cloudVariationTileset,
            tempPlatformsTileset,
            gravityOrbTileset,
            attackTilesTileset,
            attackTilesNewTileset,
            dungeonBg1Tileset,
            spikeTileset,
            doorTileset
        ].filter(Boolean) as Phaser.Tilemaps.Tileset[];

        // Automatically link any tilesets referenced in map.tilesets that match loaded textures
        if (map.tilesets && map.tilesets.length > 0) {
            map.tilesets.forEach(ts => {
                if (!allTilesets.some(t => t.name === ts.name)) {
                    const cleanImg = (ts as any).image ? (ts as any).image.replace(/^(\.\.\/)+/, '').replace(/\.[^/.]+$/, '') : '';
                    const candidates = [
                        ts.name,
                        cleanImg,
                        cleanImg.replace(/^assets\//, ''),
                        cleanImg.replace(/^sprites\//, ''),
                        cleanImg.split('/').pop() || '',
                        ts.name.replace(/\.[^/.]+$/, ''),
                        ts.name.replace(/[-_]/g, ' '),
                        ts.name.replace(/\s+/g, '-'),
                        ts.name.replace(/\s+/g, '_'),
                        ts.name.split('/').pop() || '',
                        (ts.name.split('/').pop() || '').replace(/\.[^/.]+$/, '')
                    ];
                    const matchedKey = candidates.find(k => k && this.textures.exists(k));
                    if (matchedKey) {
                        const added = map.addTilesetImage(ts.name, matchedKey);
                        if (added) allTilesets.push(added);
                    }
                }
            });
        }

        this.allTilesets = allTilesets;

        // Dynamically create all tile layers from the stage JSON in their exact layer stack order
        const tileLayers = (map.layers || []).filter(l => !(l as any).type || (l as any).type === 'tilelayer');

        tileLayers.forEach((layerData, idx) => {
            const layerName = layerData.name;
            const lowerName = layerName.toLowerCase();

            const created = map.createLayer(layerName, allTilesets, 0, 0);
            if (!created) return;
            const layer = created as Phaser.Tilemaps.TilemapLayer;

            // Set visibility and opacity from stage JSON
            if (layerData.visible !== undefined) {
                layer.setVisible(layerData.visible);
            }
            if (layerData.alpha !== undefined) {
                layer.setAlpha(layerData.alpha);
            } else if ((layerData as any).opacity !== undefined) {
                layer.setAlpha((layerData as any).opacity);
            }

            // Depth calculation: Tiled custom property -> default order-aware depth
            const fallbackDepth = this.getDefaultLayerDepth(layerName, idx, map.layers);
            const depth = this.getTiledLayerDepth(map, layerName, fallbackDepth);
            layer.setDepth(depth);

            // Parallax scroll factor (Tiled properties -> default parallax for distant layers like Mountain)
            const scrollFactor = this.getLayerScrollFactor(map, layerData);
            if (scrollFactor.x !== 1 || scrollFactor.y !== 1) {
                layer.setScrollFactor(scrollFactor.x, scrollFactor.y);
                layer.setCullPadding(8, 8);
            }

            // Bind collision & core references
            if (lowerName === 'ground') {
                this.groundLayer = layer;
                this.groundLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'well' || lowerName === 'smashground' || lowerName === 'smash') {
                this.wellLayer = layer;
                this.wellLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'onewayplatforms' || lowerName === 'oneway') {
                this.oneWayLayer = layer;
                this.oneWayLayer.setCollisionByExclusion([-1]);
            } else if (lowerName === 'hazards' || lowerName === 'hazard') {
                this.hazardsLayer = layer;
                this.hazardsLayer.setCollisionByExclusion([-1]);
            }
        });

        // Initialize 2-frame automated animated lava tiles loop
        this.setupAnimatedLavaTiles(map);
    }

    private setupAnimatedLavaTiles(map: Phaser.Tilemaps.Tilemap) {
        const newLavaTileset = map.tilesets.find(t => t.name === 'new lava' || String((t as any).image || '').includes('new lava'));
        if (!newLavaTileset) return;

        const firstGid = newLavaTileset.firstgid;
        // Surface: row 1 (frames 0 & 1)
        const surfaceGid1 = firstGid;
        const surfaceGid2 = firstGid + 1;
        // Block: row 2 (frames 2 & 3)
        const blockGid1 = firstGid + 2;
        const blockGid2 = firstGid + 3;

        const layersWithLava: { surfaceTiles: Phaser.Tilemaps.Tile[], blockTiles: Phaser.Tilemaps.Tile[] }[] = [];

        map.layers.forEach(layerData => {
            const tilemapLayer = layerData.tilemapLayer;
            if (!tilemapLayer) return;

            const surfaceTiles: Phaser.Tilemaps.Tile[] = [];
            const blockTiles: Phaser.Tilemaps.Tile[] = [];

            tilemapLayer.forEachTile(tile => {
                if (tile.index === surfaceGid1 || tile.index === surfaceGid2) {
                    surfaceTiles.push(tile);
                } else if (tile.index === blockGid1 || tile.index === blockGid2) {
                    blockTiles.push(tile);
                }
            });

            if (surfaceTiles.length > 0 || blockTiles.length > 0) {
                layersWithLava.push({ surfaceTiles, blockTiles });
            }
        });

        if (layersWithLava.length === 0) return;

        this.time.addEvent({
            delay: 300,
            loop: true,
            callback: () => {
                layersWithLava.forEach(({ surfaceTiles, blockTiles }) => {
                    for (let i = 0; i < surfaceTiles.length; i++) {
                        const tile = surfaceTiles[i];
                        tile.index = (tile.index === surfaceGid1) ? surfaceGid2 : surfaceGid1;
                    }
                    for (let i = 0; i < blockTiles.length; i++) {
                        const tile = blockTiles[i];
                        tile.index = (tile.index === blockGid1) ? blockGid2 : blockGid1;
                    }
                });
            }
        });
    }

    private setupWellTunnelZones(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        this.wellZones = [];
        this.wellForegroundLayers = [];

        const wellRectObjs = rawMapObjects.filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return (name === 'well' || name.startsWith('well') || type === 'well' || type.startsWith('well')) && 
                obj.gid === undefined && 
                (obj.width || 0) > 0 && 
                (obj.height || 0) > 0;
        });

        wellRectObjs.forEach((obj: any, idx: number) => {
            const rect = new Phaser.Geom.Rectangle(obj.x, obj.y, obj.width, obj.height);
            this.wellZones.push(rect);

            // Create a foreground tilemap layer to render the tiles covered by this Well in front of the player (hiding the player like foreground)
            const fgLayer = map.createBlankLayer(`WellTunnelForeground_${idx}`, this.allTilesets, 0, 0);
            if (fgLayer) {
                fgLayer.setDepth(6.0); // Player depth is 5.0, so this renders directly over the player
                (map.layers || []).forEach(lData => {
                    const tLayer = lData.tilemapLayer;
                    if (tLayer && tLayer !== fgLayer && !lData.name.toLowerCase().includes('sky') && !lData.name.toLowerCase().includes('mountain')) {
                        const tiles = tLayer.getTilesWithinWorldXY(rect.x, rect.y, rect.width, rect.height);
                        tiles.forEach(tile => {
                            if (tile && tile.index !== -1) {
                                fgLayer.putTileAt(tile.index, tile.x, tile.y);
                            }
                        });
                    }
                });
                this.wellForegroundLayers.push(fgLayer);
            }
        });
    }

    public checkTileWellCollision(tile: Phaser.Tilemaps.Tile, pBody: Phaser.Physics.Arcade.Body): boolean {
        if (!tile || tile.index === -1) return false;
        if (!pBody) return true;

        if (this.wellZones && this.wellZones.length > 0) {
            const tileCenterX = tile.pixelX + tile.width / 2;
            const tileCenterY = tile.pixelY + tile.height / 2;

            const wellZone = this.wellZones.find(z => 
                tileCenterX >= z.left - 2 && tileCenterX <= z.right + 2 &&
                tileCenterY >= z.top - 2 && tileCenterY <= z.bottom + 2
            );

            if (wellZone) {
                const isSurface = tileCenterY <= wellZone.top + 32;
                const isLeftEdge = wellZone.width >= 64 && tileCenterX < wellZone.left + 32;
                const isRightEdge = wellZone.width >= 64 && tileCenterX > wellZone.right - 32;
                const isEdgeTile = isLeftEdge || isRightEdge;

                // Edge tiles below the surface are ALWAYS solid from both outside and inside
                if (isEdgeTile && !isSurface) {
                    return true;
                }

                // If player is strictly outside the well horizontally on the left side attempting to push right:
                if (pBody.right <= wellZone.left + 2) {
                    return true;
                }
                // If player is strictly outside the well horizontally on the right side attempting to push left:
                if (pBody.left >= wellZone.right - 2) {
                    return true;
                }

                // Center vertical shaft and top surface entry allow pass-through
                return false;
            }
        }

        return true;
    }

    private getDefaultLayerDepth(layerName: string, index: number, allLayers: any[]): number {
        const lowerName = layerName.toLowerCase();
        
        // Find index of main ground/gameplay layer in map.layers
        const groundIndex = allLayers.findIndex(l => l.name && l.name.toLowerCase() === 'ground');
        const effectiveGroundIndex = groundIndex > 0 ? groundIndex : 6;

        if (lowerName === 'ground') return 3.0;
        if (lowerName === 'well' || lowerName === 'smashground' || lowerName === 'smash') return 8.0;
        if (lowerName === 'onewayplatforms' || lowerName === 'oneway') return 3.2;
        if (lowerName === 'hazards' || lowerName === 'hazard') return 3.3;

        // Background layers (layers below ground stack)
        if (index < effectiveGroundIndex) {
            return (index / effectiveGroundIndex) * 2.85;
        }

        // Foreground / overlay layers (layers above ground stack)
        return 8.0 + (index - effectiveGroundIndex) * 0.1;
    }

    private getTiledLayerDepth(map: Phaser.Tilemaps.Tilemap, layerName: string, fallbackDepth: number): number {
        const layerData = map.layers.find(l => l.name === layerName);
        if (layerData) {
            const rawProps = (layerData as any).properties;
            if (rawProps && Array.isArray(rawProps)) {
                const depthProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'depth' || 
                        p.name.toLowerCase() === 'zindex' || 
                        p.name.toLowerCase() === 'z-index' || 
                        p.name.toLowerCase() === 'z_index' ||
                        p.name.toLowerCase() === 'layerdepth'
                    )
                );
                if (depthProp && depthProp.value !== undefined) {
                    return Number(depthProp.value);
                }
            }
        }
        return fallbackDepth;
    }

    private getLayerScrollFactor(_map: Phaser.Tilemaps.Tilemap, layerData: any): { x: number, y: number } {
        const name = (layerData.name || '').toLowerCase();
        
        // 1. Check native Tiled parallax properties
        let sx = layerData.parallaxx !== undefined ? Number(layerData.parallaxx) : undefined;
        let sy = layerData.parallaxy !== undefined ? Number(layerData.parallaxy) : undefined;

        // 2. Check custom properties from Tiled
        const rawProps = layerData.properties;
        if (rawProps && Array.isArray(rawProps)) {
            const pxProp = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallaxx' || 
                p.name.toLowerCase() === 'scrollfactorx' ||
                p.name.toLowerCase() === 'parallax_x' ||
                p.name.toLowerCase() === 'scroll_factor_x'
            ));
            if (pxProp && pxProp.value !== undefined) sx = Number(pxProp.value);

            const pyProp = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallaxy' || 
                p.name.toLowerCase() === 'scrollfactory' ||
                p.name.toLowerCase() === 'parallax_y' ||
                p.name.toLowerCase() === 'scroll_factor_y'
            ));
            if (pyProp && pyProp.value !== undefined) sy = Number(pyProp.value);

            const pAll = rawProps.find((p: any) => p.name && (
                p.name.toLowerCase() === 'parallax' || 
                p.name.toLowerCase() === 'scrollfactor'
            ));
            if (pAll && pAll.value !== undefined) {
                if (sx === undefined) sx = Number(pAll.value);
                if (sy === undefined) sy = Number(pAll.value);
            }
        }

        // Explicit Tiled properties take priority
        if (sx !== undefined || sy !== undefined) {
            return { x: sx ?? 1, y: sy ?? 1 };
        }

        // 3. Fallbacks: ONLY mountain has default parallax fallback if not specified in Tiled
        if (name === 'mountain') {
            return { x: 0.3, y: 1 };
        }

        // All other layers (Sky, Background, Trees, Ground, SmashGround, etc.) scroll 1:1 with the world
        return { x: 1, y: 1 };
    }

    private createAmbientAtmosphere() {
        if (!this.textures.exists('cherry-petal')) return;

        const petalsEmitter = this.add.particles(0, 0, 'cherry-petal', {
            x: { min: -100, max: 1200 },
            y: -20,
            lifespan: { min: 6000, max: 10000 },
            speedX: { min: 20, max: 60 },
            speedY: { min: 25, max: 55 },
            scale: { start: 0.8, end: 0.35 },
            alpha: { start: 0.75, end: 0 },
            rotate: { min: 0, max: 360 },
            frequency: 450,
            blendMode: Phaser.BlendModes.NORMAL
        });

        petalsEmitter.setDepth(2.4);
        petalsEmitter.setScrollFactor(0);
    }

    private applyAtmosphericPerspectiveToMountainTexture() {
        const mountainTextureKeys = ['mountain', 'assets/sprites/background/mountain.png'];
        const targetKey = mountainTextureKeys.find(k => this.textures.exists(k));
        if (!targetKey) return;

        const texture = this.textures.get(targetKey);
        const sourceImage = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        if (!sourceImage || !sourceImage.width || !sourceImage.height) return;

        // Create an offscreen canvas to process the pixels
        const canvas = document.createElement('canvas');
        canvas.width = sourceImage.width;
        canvas.height = sourceImage.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(sourceImage, 0, 0);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Atmospheric perspective parameters:
        // 1. Desaturate colors by ~25%
        // 2. Reduce contrast by ~15%
        // 3. Shift palette toward sky atmospheric blue (#8cb2d4 / [140, 178, 212]) by ~20%
        // 4. Preserve 100% opacity (no alpha fading)
        const skyR = 140, skyG = 178, skyB = 212;

        for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a === 0) continue;

            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // 1. Desaturate ~25%
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            let nr = r * 0.75 + gray * 0.25;
            let ng = g * 0.75 + gray * 0.25;
            let nb = b * 0.75 + gray * 0.25;

            // 2. Reduce contrast ~15%
            nr = (nr - 128) * 0.85 + 128;
            ng = (ng - 128) * 0.85 + 128;
            nb = (nb - 128) * 0.85 + 128;

            // 3. Shift toward sky atmospheric blue ~20%
            nr = Math.min(255, Math.max(0, Math.round(nr * 0.80 + skyR * 0.20)));
            ng = Math.min(255, Math.max(0, Math.round(ng * 0.80 + skyG * 0.20)));
            nb = Math.min(255, Math.max(0, Math.round(nb * 0.80 + skyB * 0.20)));

            data[i] = nr;
            data[i + 1] = ng;
            data[i + 2] = nb;
            // Full opacity retained
        }

        ctx.putImageData(imgData, 0, 0);

        // Update texture in Phaser TextureManager
        mountainTextureKeys.forEach(k => {
            if (this.textures.exists(k)) {
                this.textures.remove(k);
            }
            this.textures.addCanvas(k, canvas);
        });
    }

    private createAnimations() {
        createBossAnimations(this);
        this.anims.create({ key: 'idle-r-anim', frames: this.anims.generateFrameNumbers('idle-wind-r', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'idle-l-anim', frames: this.anims.generateFrameNumbers('idle-wind-l', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'walk-r-anim', frames: this.anims.generateFrameNumbers('walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'walk-l-anim', frames: this.anims.generateFrameNumbers('walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-l-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'fall-r-anim', frames: this.anims.generateFrameNumbers('player-fall', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });

        // Gun Movement Animations
        this.anims.create({ key: 'gun-walk-r-anim', frames: this.anims.generateFrameNumbers('player-gun-walk-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'gun-walk-l-anim', frames: this.anims.generateFrameNumbers('player-gun-walk-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'gun-fall-l-anim', frames: this.anims.generateFrameNumbers('player-gun-fall', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'gun-fall-r-anim', frames: this.anims.generateFrameNumbers('player-gun-fall', { start: 8, end: 11 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'gun-jump-r-anim', frames: this.anims.generateFrameNumbers('player-jump-gun-r', { start: 0, end: 2 }), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'gun-jump-l-anim', frames: this.anims.generateFrameNumbers('player-jump-gun-l', { start: 0, end: 2 }), frameRate: 10, repeat: 0 });
        this.anims.create({ key: 'gun-idle-r-anim', frames: this.anims.generateFrameNumbers('player-gun-idle-r', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });
        this.anims.create({ key: 'gun-idle-l-anim', frames: this.anims.generateFrameNumbers('player-gun-idle-l', { start: 0, end: 1 }), frameRate: 4, repeat: -1 });

        this.anims.create({ key: 'coin-spin', frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 5 }), frameRate: 10, repeat: -1 });

        // Totem Revive Effect (Right: top row 0..10 left-to-right; Left: bottom row 32..22 right-to-left)
        this.anims.create({
            key: 'totem-revive-r-anim',
            frames: this.anims.generateFrameNumbers('totem-revive', { start: 0, end: 10 }),
            frameRate: 14,
            repeat: 0
        });

        this.anims.create({
            key: 'totem-revive-l-anim',
            frames: [
                { key: 'totem-revive', frame: 32 },
                { key: 'totem-revive', frame: 31 },
                { key: 'totem-revive', frame: 30 },
                { key: 'totem-revive', frame: 29 },
                { key: 'totem-revive', frame: 28 },
                { key: 'totem-revive', frame: 27 },
                { key: 'totem-revive', frame: 26 },
                { key: 'totem-revive', frame: 25 },
                { key: 'totem-revive', frame: 24 },
                { key: 'totem-revive', frame: 23 },
                { key: 'totem-revive', frame: 22 }
            ],
            frameRate: 14,
            repeat: 0
        });

        // Electric Death Effect (Right: top row 0..7 left-to-right; Left: bottom row 23..16 right-to-left)
        this.anims.create({
            key: 'electric-death-r-anim',
            frames: this.anims.generateFrameNumbers('electric-death', { start: 0, end: 7 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'electric-death-l-anim',
            frames: [
                { key: 'electric-death', frame: 23 },
                { key: 'electric-death', frame: 22 },
                { key: 'electric-death', frame: 21 },
                { key: 'electric-death', frame: 20 },
                { key: 'electric-death', frame: 19 },
                { key: 'electric-death', frame: 18 },
                { key: 'electric-death', frame: 17 },
                { key: 'electric-death', frame: 16 }
            ],
            frameRate: 12,
            repeat: 0
        });

        // Simple Death Effect (Right: top row 0..5 left-to-right; Left: bottom row 17..12 right-to-left)
        this.anims.create({
            key: 'simple-death-r-anim',
            frames: this.anims.generateFrameNumbers('simple-death', { start: 0, end: 5 }),
            frameRate: 12,
            repeat: 0
        });

        this.anims.create({
            key: 'simple-death-l-anim',
            frames: [
                { key: 'simple-death', frame: 17 },
                { key: 'simple-death', frame: 16 },
                { key: 'simple-death', frame: 15 },
                { key: 'simple-death', frame: 14 },
                { key: 'simple-death', frame: 13 },
                { key: 'simple-death', frame: 12 }
            ],
            frameRate: 12,
            repeat: 0
        });

        // Lava Death Effects (Right: frame 0 -> 5 from lava-death-r; Left: frame 5 -> 0 from lava-death-l)
        this.anims.create({
            key: 'lava-death-r-anim',
            frames: this.anims.generateFrameNumbers('lava-death-r', { start: 0, end: 5 }),
            frameRate: 14,
            repeat: 0
        });

        this.anims.create({
            key: 'lava-death-l-anim',
            frames: [
                { key: 'lava-death-l', frame: 5 },
                { key: 'lava-death-l', frame: 4 },
                { key: 'lava-death-l', frame: 3 },
                { key: 'lava-death-l', frame: 2 },
                { key: 'lava-death-l', frame: 1 },
                { key: 'lava-death-l', frame: 0 }
            ],
            frameRate: 14,
            repeat: 0
        });

        // Player Bullet Animations (32x32: Row 1 frames 0..1 Left, Row 2 frames 2..3 Right)
        this.anims.create({
            key: 'bullet-left-anim',
            frames: this.anims.generateFrameNumbers('bullet-sprite', { start: 0, end: 1 }),
            frameRate: 8,
            repeat: -1
        });
        this.anims.create({
            key: 'bullet-right-anim',
            frames: this.anims.generateFrameNumbers('bullet-sprite', { start: 2, end: 3 }),
            frameRate: 8,
            repeat: -1
        });

        // Enemy Shooter Fireball (32x32: 0..3 Left, 4..7 Right)
        this.anims.create({ key: 'enemy-fireball-l', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });
        this.anims.create({ key: 'enemy-fireball-r', frames: this.anims.generateFrameNumbers('enemy-fireball', { start: 4, end: 7 }), frameRate: 10, repeat: -1 });

        // Lantern Spirit: 3 frames (0..2)
        this.anims.create({ key: 'mob-lantern-spirit-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-spirit-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-lantern-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-spirit-walk-l', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-l', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-spirit-walk-r', frames: this.anims.generateFrameNumbers('mob-lantern-spirit-r', { start: 0, end: 2 }), frameRate: 6, repeat: -1 });

        // Shapeshifter Fox: 4 frames (0..3)
        this.anims.create({ key: 'mob-shapeshifter-fox-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-fox-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-shapeshifter-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-fox-walk-l', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-l', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-fox-walk-r', frames: this.anims.generateFrameNumbers('mob-shapeshifter-fox-r', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });

        // Bonsai Gripper, Pumpkin Bat, Sandal Mob
        this.anims.create({ key: 'mob-bonsai-gripper-walk-l', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-bonsai-gripper-walk-r', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-gripper-walk-l', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-gripper-walk-r', frames: this.anims.generateFrameNumbers('mob-bonsai-gripper', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Pumpkin Bat: 6 frames total - 0..2 Left fly, 3..5 Right fly
        this.anims.create({ key: 'mob-pumpkin-bat-walk-l', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-pumpkin-bat-walk-r', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bat-walk-l', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 0, end: 2 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-bat-walk-r', frames: this.anims.generateFrameNumbers('mob-pumpkin-bat', { start: 3, end: 5 }), frameRate: 8, repeat: -1 });

        // Sandal Mob: 4 frames each
        this.anims.create({ key: 'mob-sandal-walk-l', frames: this.anims.generateFrameNumbers('mob-sandal-l', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-walk-r', frames: this.anims.generateFrameNumbers('mob-sandal-r', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-mob-walk-l', frames: this.anims.generateFrameNumbers('mob-sandal-l', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });
        this.anims.create({ key: 'mob-sandal-mob-walk-r', frames: this.anims.generateFrameNumbers('mob-sandal-r', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Lava Kappa: 8 frames total - 0..3 Left walk, 4..7 Right walk
        this.anims.create({ key: 'mob-lava-kappa-walk-l', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-lava-kappa-walk-r', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 4, end: 7 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-kappa-walk-l', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 0, end: 3 }), frameRate: 8, repeat: -1 });
        this.anims.create({ key: 'mob-kappa-walk-r', frames: this.anims.generateFrameNumbers('mob-lava-kappa', { start: 4, end: 7 }), frameRate: 8, repeat: -1 });

        // Firebar spinning fire animation (4 frames)
        this.anims.create({ key: 'firebar-spin', frames: this.anims.generateFrameNumbers('firebar-sprite', { start: 0, end: 3 }), frameRate: 10, repeat: -1 });

        // Dandelion gentle sway animation (4 frames)
        this.anims.create({ key: 'dandelion-sway', frames: this.anims.generateFrameNumbers('dandelion', { start: 0, end: 3 }), frameRate: 6, repeat: -1 });

        // Jump Pad spring bounce animation (4 frames: 0 -> 1 -> 2 -> 3)
        this.anims.create({
            key: 'jump-pad-spring',
            frames: this.anims.generateFrameNumbers('jump-pad-img', { start: 0, end: 3 }),
            frameRate: 16,
            repeat: 0
        });
        this.anims.create({
            key: 'jumppad-spring',
            frames: this.anims.generateFrameNumbers('jump-pad-img', { start: 0, end: 3 }),
            frameRate: 16,
            repeat: 0
        });

        // Bridge break shattering animation (4 frames: 0 -> 1 -> 2 -> 3)
        this.anims.create({
            key: 'bridge-break-anim',
            frames: this.anims.generateFrameNumbers('bridge-break', { start: 0, end: 3 }),
            frameRate: 6,
            repeat: 0
        });
    }

    update(_time: number, delta: number) {
        if (this.isGamePaused || this.isGameComplete) {
            if (this.isGamePaused) {
                this.uiManager.updatePauseMenu();
            }
            return;
        }

        // Update draining restart confirmation prompt
        if (this.restartPromptActive) {
            this.restartPromptElapsedMs += delta;
            const progress = Math.max(0, 1 - this.restartPromptElapsedMs / this.RESTART_WINDOW_MS);
            if (progress <= 0) {
                this.restartPromptActive = false;
                this.restartPromptElapsedMs = 0;
                GameEventBus.getInstance().emit('prompt:restart', { active: false, progress: 0 });
            } else {
                GameEventBus.getInstance().emit('prompt:restart', { active: true, progress });
            }
        }

        // Update draining checkpoint confirmation prompt
        if (this.checkpointPromptActive) {
            this.checkpointPromptElapsedMs += delta;
            const progress = Math.max(0, 1 - this.checkpointPromptElapsedMs / this.CHECKPOINT_WINDOW_MS);
            if (progress <= 0) {
                this.checkpointPromptActive = false;
                this.checkpointPromptElapsedMs = 0;
                GameEventBus.getInstance().emit('prompt:checkpoint', { active: false, progress: 0 });
            } else {
                GameEventBus.getInstance().emit('prompt:checkpoint', { active: true, progress });
            }
        }

        // Only accumulate active run time when player is alive (strictly paused during all deaths)
        if (this.player && !this.player.isDying) {
            this.activeRunTimeMs += delta;
        }

        const formattedTime = this.getFormattedElapsedTime();

        this.uiManager.updateHUD(
            formattedTime, 
            this.collectiblesManager.coinsCollected, 
            this.enemyManager.enemiesKilled,
            this.totalDeaths
        );

        this.player.update();

        // Keep player strictly inside the vertical well tunnel laterally while in transit
        if (this.wellZones && this.wellZones.length > 0) {
            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            if (pBody) {
                let insideAnyWell = false;
                for (const wellZone of this.wellZones) {
                    const shaftLeft = wellZone.width >= 64 ? wellZone.left + 32 : wellZone.left;
                    const shaftRight = wellZone.width >= 64 ? wellZone.right - 32 : wellZone.right;

                    if (pBody.top >= wellZone.top && pBody.bottom <= wellZone.bottom + 16 &&
                        pBody.right > shaftLeft && pBody.left < shaftRight) {
                        insideAnyWell = true;
                        this.player.x = Phaser.Math.Clamp(
                            this.player.x, 
                            shaftLeft + pBody.halfWidth, 
                            shaftRight - pBody.halfWidth
                        );
                        break;
                    }
                }
                this.player.isPassingThroughWell = insideAnyWell;
            }
        } else if (this.wellLayer && this.player.isPassingThroughWell) {
            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            if (pBody) {
                const overlappingTiles = this.wellLayer.getTilesWithinWorldXY(
                    pBody.left,
                    pBody.top,
                    pBody.width,
                    pBody.height,
                    { isNotEmpty: true }
                );
                const isStillInside = overlappingTiles && overlappingTiles.some(t => t.index !== -1);
                if (!isStillInside) {
                    this.player.isPassingThroughWell = false;
                }
            }
        }

        this.envManager.update(delta);
        this.inventoryManager.update();
        this.enemyManager.update(this.groundLayer, this.oneWayLayer, delta);
        if (this.eleckingBoss) this.eleckingBoss.update(_time, delta);
        SecurityManager.getInstance().logPlayerPosition(this.player.x, this.player.y);

        const currentFrame = Math.floor(this.activeRunTimeMs / 16.6667);
        InputRecorder.getInstance().logFrame(currentFrame, this.player.getActiveKeys());
    }

    public onStageComplete() {
        if (this.isGameComplete) return;
        this.isGameComplete = true;

        this.physics.pause();
        this.anims.pauseAll();
        this.tweens.pauseAll();
        this.time.paused = true;
        this.player.setVelocity(0, 0);

        if (this.input && this.input.keyboard) {
            this.input.keyboard.enabled = false;
            this.input.keyboard.resetKeys();
        }

        const netDurationMs = Math.round(this.getElapsedMilliseconds());
        const payload = SecurityManager.getInstance().finishRun(
            this.collectiblesManager.coinsCollected,
            this.enemyManager.enemiesKilled,
            this.totalDeaths,
            netDurationMs
        );
        const savedPlayerName = (typeof localStorage !== 'undefined' && localStorage.getItem('onion_boy_player_name')) || 'Speedy Onion';
        const savedWallet = (typeof localStorage !== 'undefined' && localStorage.getItem('onion_boy_wallet')) || SurrealService.getInstance().getConnectedWallet();
        LeaderboardManager.getInstance().submitRun(payload, savedPlayerName, savedWallet);
        this.soundManager?.playVictory();

        const formattedTime = this.getFormattedElapsedTime();
        this.uiManager.updateHUD(
            formattedTime,
            this.collectiblesManager.coinsCollected,
            this.enemyManager.enemiesKilled,
            this.totalDeaths
        );

        this.uiManager.showVictoryMenu(
            () => this.restartFullRun(),
            {
                time: formattedTime,
                deaths: this.totalDeaths,
                coins: this.collectiblesManager.coinsCollected,
                kills: this.enemyManager.enemiesKilled
            }
        );
    }
}
