// src/managers/EnvironmentManager.ts
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { UIManager } from './UIManager';
import { InventoryManager } from './InventoryManager';
import { SoundManager } from './SoundManager';
import type { Firebar } from '../types';

export interface WindZoneData {
    zone: Phaser.GameObjects.Zone;
    forceX: number;
    forceY: number;
    turbulence: number;
    frequency: number;
    emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
}

export interface RevealTriggerData {
    name: string;
    id?: string;
    zone: Phaser.GameObjects.Zone;
    targetLayerNames: string[];
    isBossTrigger: boolean;
    activated: boolean;
    permanent: boolean;
}

export interface RevealTileLayerData {
    name: string;
    id?: string;
    layer: Phaser.Tilemaps.TilemapLayer;
    collider?: Phaser.Physics.Arcade.Collider;
    revealed: boolean;
    initialRevealed: boolean;
    snapshotRevealed: boolean;
    keepRevealed: boolean;
}

export interface CheckpointData {
    id: number | string;
    zone: Phaser.GameObjects.Zone;
    spawnX: number;
    spawnY: number;
    label: string;
    activated: boolean;
    sprite?: Phaser.GameObjects.Sprite;
}

export interface BridgeData {
    sprite: Phaser.Physics.Arcade.Sprite;
    initialX: number;
    initialY: number;
    width: number;
    height: number;
    broken: boolean;
    snapshotBroken: boolean;
    collider?: Phaser.Physics.Arcade.Collider;
    bulletCollider?: Phaser.Physics.Arcade.Collider;
}

export class EnvironmentManager {
    private scene: Phaser.Scene;
    private player: Player;
    private uiManager: UIManager;
    private inventoryManager: InventoryManager;
    private soundManager?: SoundManager;

    public movingPlatforms: Phaser.GameObjects.Sprite[] = [];
    public jumpPads: Phaser.Physics.Arcade.Sprite[] = [];
    public firebars: Firebar[] = [];
    public smashTriggers: Phaser.GameObjects.Zone[] = [];
    public bridges: BridgeData[] = [];
    public doorZones: Phaser.GameObjects.Zone[] = [];
    public doorExitZones: Phaser.GameObjects.Zone[] = [];
    public disarmZones: Phaser.GameObjects.Zone[] = [];
    public windZones: WindZoneData[] = [];
    public revealTriggers: RevealTriggerData[] = [];
    public revealTileLayers: RevealTileLayerData[] = [];
    public checkpoints: CheckpointData[] = [];
    public checkpointSprites: Phaser.GameObjects.Sprite[] = [];
    public dandelions: Phaser.GameObjects.Sprite[] = [];

    public doorExitX: number = 0;
    public doorExitY: number = 0;
    public doorExitTopY: number = 0;
    public doorExitDeepY: number = 0;
    public doorPrompts: Phaser.GameObjects.Container[] = [];
    public doorSprites: Phaser.GameObjects.Sprite[] = [];
    public wells?: Phaser.Physics.Arcade.StaticGroup;
    public wellObjects: { x: number, y: number, width: number, height: number, topY: number }[] = [];

    constructor(
        scene: Phaser.Scene, 
        player: Player, 
        uiManager: UIManager, 
        inventoryManager: InventoryManager,
        soundManager?: SoundManager
    ) {
        this.scene = scene;
        this.player = player;
        this.uiManager = uiManager;
        this.inventoryManager = inventoryManager;
        this.soundManager = soundManager;
    }

    public hasActiveCheckpoint(): boolean {
        return this.checkpoints.some(cp => cp.activated);
    }

    public activateCheckpoint(cp: CheckpointData) {
        if (cp.activated) return;
        // Mark all matching ID checkpoint entries as activated immediately
        this.checkpoints.forEach(c => {
            if (String(c.id) === String(cp.id)) {
                c.activated = true;
            }
        });

        this.player.spawnX = cp.spawnX;
        this.player.spawnY = cp.spawnY;
        this.player.activeSpawnX = cp.spawnX;
        this.player.activeSpawnY = cp.spawnY;
        this.player.lastSafeX = cp.spawnX;
        this.player.lastSafeY = cp.spawnY;

        this.scene.cameras.main.flash(200, 255, 255, 255);
        this.uiManager.showFloatingText(cp.spawnX, cp.spawnY - 20, cp.label, '#FFD700', 2500, 30);
        this.uiManager.spawnParticles(cp.spawnX, cp.spawnY, 0xFFD700);
        this.soundManager?.playCheckpoint();

        if (cp.sprite) {
            cp.sprite.setVisible(true);
            cp.sprite.setAlpha(0);
            cp.sprite.setScale(0.5);
            this.scene.tweens.add({
                targets: cp.sprite,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 350,
                ease: 'Back.easeOut'
            });
        }

        // Snapshot collected items and killed mobs up to this checkpoint
        this.scene.events.emit('checkpoint-saved');
    }

    public isPlayerTouchingBridge(): boolean {
        if (!this.player || !this.player.active) return false;
        const pBounds = this.player.getBounds();
        for (const bridge of this.bridges) {
            if (!bridge.broken && bridge.sprite && bridge.sprite.active) {
                const b = bridge.sprite.getBounds();
                const expanded = new Phaser.Geom.Rectangle(b.x - 4, b.y - 8, b.width + 8, b.height + 16);
                if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, expanded)) {
                    return true;
                }
            }
        }
        return false;
    }

    public isPlayerInCheckpointZone(): boolean {
        if (!this.player || !this.player.active) return false;
        const pBounds = this.player.getBounds();
        for (const cp of this.checkpoints) {
            if (cp.zone && cp.zone.active) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, cp.zone.getBounds())) {
                    return true;
                }
            }
        }
        return false;
    }

    public isPlayerInDoorZone(): boolean {
        if (!this.player || !this.player.active) return false;
        const pBounds = this.player.getBounds();
        for (const dZone of this.doorZones) {
            if (dZone && dZone.active && Phaser.Geom.Intersects.RectangleToRectangle(pBounds, dZone.getBounds())) {
                return true;
            }
        }
        for (const eZone of this.doorExitZones) {
            if (eZone && eZone.active && Phaser.Geom.Intersects.RectangleToRectangle(pBounds, eZone.getBounds())) {
                return true;
            }
        }
        return false;
    }

    public isPlayerInSafeZone(): boolean {
        return this.isPlayerInCheckpointZone() || this.isPlayerInDoorZone();
    }

    public isPositionInSafeZone(x: number, y: number): boolean {
        for (const cp of this.checkpoints) {
            if (cp.zone && cp.zone.active && cp.zone.getBounds().contains(x, y)) {
                return true;
            }
        }
        for (const dZone of this.doorZones) {
            if (dZone && dZone.active && dZone.getBounds().contains(x, y)) {
                return true;
            }
        }
        for (const eZone of this.doorExitZones) {
            if (eZone && eZone.active && eZone.getBounds().contains(x, y)) {
                return true;
            }
        }
        return false;
    }

    public isPositionInCheckpointZone(x: number, y: number): boolean {
        return this.isPositionInSafeZone(x, y);
    }

    setupCheckpoints(rawMapObjects: any[]) {
        this.checkpoints = [];
        this.checkpointSprites.forEach(s => s.destroy());
        this.checkpointSprites = [];

        // 1. Gather all checkpoint marker / spawn point locations from Tiled (e.g. Checkpoint1, Checkpoint2, Checkpoint3, Checkpoint4, etc.)
        const spawnMarkers: { [key: string]: { id: number | string, x: number, y: number, obj: any, sprite?: Phaser.GameObjects.Sprite } } = {};
        
        rawMapObjects.forEach((obj: any) => {
            const cleanName = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            const posX = obj.x + (obj.width ? obj.width / 2 : 16);
            const posY = obj.y + (obj.height ? obj.height : 32);

            if (/^(checkpoint|cp)\d*(spawn)?$/i.test(cleanName) && !cleanName.includes('zone') && !cleanName.includes('trigger')) {
                const match = cleanName.match(/\d+/);
                const cpId = match ? parseInt(match[0], 10) : cleanName;

                let cpSprite: Phaser.GameObjects.Sprite | undefined;
                if (this.scene.textures.exists('checkpoint-sprite')) {
                    cpSprite = this.scene.add.sprite(posX, posY, 'checkpoint-sprite');
                    cpSprite.setOrigin(0.5, 1.0);
                    cpSprite.setDepth(2.8);
                    cpSprite.setVisible(false);
                    this.checkpointSprites.push(cpSprite);
                }

                const markerData = { id: cpId, x: posX, y: posY, obj, sprite: cpSprite };
                spawnMarkers[String(cpId)] = markerData;
                spawnMarkers[cleanName] = markerData;
                spawnMarkers[cleanName.replace('spawn', '')] = markerData;
            }
        });

        // Track which checkpoint IDs have had an explicit CheckpointZone registered
        const registeredIds = new Set<string>();

        // 2. Setup Explicit CheckpointZone objects (if present with custom id property or naming)
        rawMapObjects.forEach((obj: any) => {
            const cleanName = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            const isExplicitZone = cleanName.includes('zone') || cleanName.includes('trigger');

            if (isExplicitZone && (cleanName.includes('checkpoint') || cleanName.includes('cp') || obj.properties?.some((p: any) => p.name?.toLowerCase() === 'checkpoint' || p.name?.toLowerCase() === 'id'))) {
                const zW = obj.width || 32;
                const zH = (obj.height || 48) + 80;
                const zX = obj.x + (obj.width ? obj.width / 2 : 16);
                const zY = obj.y + (obj.height ? obj.height / 2 : 16) - 40;

                let cpId: number | string = 1;
                if (obj.properties) {
                    const idProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'id' || p.name.toLowerCase() === 'checkpoint'));
                    if (idProp && idProp.value !== undefined) {
                        cpId = idProp.value;
                    }
                } else {
                    const match = cleanName.match(/\d+/);
                    if (match) {
                        cpId = parseInt(match[0], 10);
                    }
                }

                let targetSpawnKey = String(cpId);
                let label = `CHECKPOINT ${cpId} SAVED!`;

                if (obj.properties) {
                    const targetProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'target' || p.name.toLowerCase() === 'spawn'));
                    if (targetProp && targetProp.value) {
                        targetSpawnKey = String(targetProp.value).toLowerCase().trim().replace(/\s+/g, '');
                    }

                    const labelProp = obj.properties.find((p: any) => p.name && (p.name.toLowerCase() === 'label' || p.name.toLowerCase() === 'text'));
                    if (labelProp && labelProp.value) {
                        label = String(labelProp.value);
                    }
                }

                const marker = spawnMarkers[targetSpawnKey] || spawnMarkers[String(cpId)];
                const sX = marker ? marker.x : zX;
                const sY = marker ? (marker.y - 16) : (zY + (zH / 2) - 16);

                const zone = this.scene.add.zone(zX, zY, zW, zH);
                this.scene.physics.add.existing(zone, true);

                this.checkpoints.push({
                    id: cpId,
                    zone,
                    spawnX: sX,
                    spawnY: sY,
                    label,
                    activated: false,
                    sprite: marker?.sprite
                });

                registeredIds.add(String(cpId));
            }
        });

        // 3. For any Checkpoint1/2/3/4 marker without an explicit CheckpointZone:
        // Treat entering the Checkpoint object itself as the registration/trigger zone AND spawn point!
        Object.values(spawnMarkers).forEach((marker) => {
            const idStr = String(marker.id);
            if (!registeredIds.has(idStr)) {
                registeredIds.add(idStr);

                const obj = marker.obj;
                const zW = (obj.width || 32) + 16;
                const zH = (obj.height || 32) + 48;
                const zX = marker.x;
                const zY = marker.y - (zH / 2);

                const zone = this.scene.add.zone(zX, zY, zW, zH);
                this.scene.physics.add.existing(zone, true);

                this.checkpoints.push({
                    id: marker.id,
                    zone,
                    spawnX: marker.x,
                    spawnY: marker.y - 16,
                    label: `CHECKPOINT ${marker.id} SAVED!`,
                    activated: false,
                    sprite: marker.sprite
                });
            }
        });
    }

    setupRevealTriggers(rawMapObjects: any[]) {
        this.revealTriggers = [];

        rawMapObjects.forEach((obj: any) => {
            const rawName = String(obj.name || '').trim();
            const lowerName = rawName.toLowerCase();

            // Exclude BossArenaZone / BossLimit from being direct reveal triggers (revealed via BossFightEntrance)
            if (lowerName === 'bossarenazone' || lowerName === 'bossarena' || lowerName === 'bosslimit' || lowerName === 'bossfightzone') {
                return;
            }

            const isBoss = lowerName.includes('boss');
            const isTrigger = isBoss || 
                lowerName.includes('reveal') || 
                lowerName.includes('trigger') || 
                lowerName.includes('entrance') ||
                lowerName.includes('dungeon');

            if (!isTrigger) return;

            const width = obj.width || 32;
            const height = obj.height || 32;
            const x = (obj.x || 0) + width / 2;
            const y = (obj.y || 0) + height / 2;

            const targetLayerNames: string[] = [];
            let id = '';
            let permanent = true;

            if (isBoss) {
                targetLayerNames.push('BossFill', 'DungeonFill', 'Boss', 'Dungeon');
            }

            if (obj.properties && Array.isArray(obj.properties)) {
                const targetProp = obj.properties.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'target' || 
                        p.name.toLowerCase() === 'layer' || 
                        p.name.toLowerCase() === 'targetlayer' ||
                        p.name.toLowerCase() === 'reveal'
                    )
                );
                if (targetProp && targetProp.value) {
                    targetLayerNames.push(String(targetProp.value).trim());
                }

                const idProp = obj.properties.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'id' || 
                        p.name.toLowerCase() === 'linkid' || 
                        p.name.toLowerCase() === 'triggerid'
                    )
                );
                if (idProp && idProp.value !== undefined) {
                    id = String(idProp.value).trim();
                }

                const permProp = obj.properties.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'permanent' || 
                        p.name.toLowerCase() === 'keeprevealed'
                    )
                );
                if (permProp && permProp.value !== undefined) {
                    permanent = permProp.value === true || String(permProp.value).toLowerCase() === 'true';
                }
            }

            const zone = this.scene.add.zone(x, y, width, height);
            this.scene.physics.add.existing(zone, true);

            this.revealTriggers.push({
                name: rawName,
                id,
                zone,
                targetLayerNames,
                isBossTrigger: isBoss,
                activated: false,
                permanent
            });
        });
    }

    setupRevealTileLayers(map: Phaser.Tilemaps.Tilemap, allTilesets: Phaser.Tilemaps.Tileset[]) {
        const standardLayerNames = [
            'Sky', 'Trees', 'Background', 'Transparent', 
            'Ground', 'OneWayPlatforms', 'SmashGround', 'Well', 'well',
            'Hazards', 'Foreground'
        ];

        map.layers.forEach(layerData => {
            const name = layerData.name;
            if (standardLayerNames.includes(name)) return;

            const lowerName = name.toLowerCase();
            let keepRevealed = lowerName.includes('boss') || lowerName.includes('fill') || lowerName.includes('dungeon');

            // Calculate depth based on Tiled layer stack index or standard (below player 5, above ground 3)
            let depth = 4;
            const layerIndex = map.layers.indexOf(layerData);
            if (layerIndex !== -1) {
                depth = layerIndex;
            }

            // Check custom properties on the tile layer in Tiled
            const rawProps = (layerData as any).properties;
            let collides = true;
            let id = '';
            if (rawProps && Array.isArray(rawProps)) {
                const idProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'id' || 
                        p.name.toLowerCase() === 'linkid' ||
                        p.name.toLowerCase() === 'triggerid'
                    )
                );
                if (idProp && idProp.value !== undefined) {
                    id = String(idProp.value).trim();
                }

                const depthProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'depth' || 
                        p.name.toLowerCase() === 'zindex' || 
                        p.name.toLowerCase() === 'z-index' || 
                        p.name.toLowerCase() === 'z_index' ||
                        p.name.toLowerCase() === 'layerdepth'
                    )
                );
                if (depthProp && depthProp.value !== undefined && !isNaN(Number(depthProp.value))) {
                    depth = Number(depthProp.value);
                }

                const keepProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'keeprevealed' || 
                        p.name.toLowerCase() === 'permanent' ||
                        p.name.toLowerCase() === 'sticky'
                    )
                );
                if (keepProp && keepProp.value !== undefined) {
                    keepRevealed = keepProp.value === true || String(keepProp.value).toLowerCase() === 'true';
                }

                const colProp = rawProps.find((p: any) => 
                    p.name && (
                        p.name.toLowerCase() === 'collides' || 
                        p.name.toLowerCase() === 'solid' || 
                        p.name.toLowerCase() === 'collision'
                    )
                );
                if (colProp && colProp.value !== undefined) {
                    collides = colProp.value === true || String(colProp.value).toLowerCase() === 'true';
                }
            }

            const layer = layerData.tilemapLayer || (map.createLayer(name, allTilesets, 0, 0) as Phaser.Tilemaps.TilemapLayer);
            if (layer && 'setDepth' in layer) {
                layer.setDepth(depth);
                const initVis = layerData.visible !== false;
                layer.setVisible(initVis);
                layer.setAlpha(initVis ? (layerData.alpha ?? (layerData as any).opacity ?? 1) : 0);

                let collider: Phaser.Physics.Arcade.Collider | undefined;
                if (collides || lowerName.includes('fill') || lowerName.includes('ground') || lowerName.includes('wall') || lowerName.includes('dungeon')) {
                    layer.setCollisionByExclusion([-1], true);
                    collider = this.scene.physics.add.collider(this.player, layer);
                    collider.active = initVis;
                }

                this.revealTileLayers.push({
                    name,
                    id,
                    layer,
                    collider,
                    revealed: initVis,
                    initialRevealed: initVis,
                    snapshotRevealed: initVis,
                    keepRevealed
                });
            }
        });
    }

    setupWindZones(rawMapObjects: any[]) {
        rawMapObjects.filter((obj: any) => 
            obj.name === 'WindZone' || 
            obj.name === 'AirCurrent' || 
            obj.name === 'Wind'
        ).forEach((obj: any) => {
            const zX = obj.x + (obj.width ? obj.width / 2 : 16);
            const zY = obj.y + (obj.height ? obj.height / 2 : 16);
            const zW = obj.width || 64;
            const zH = obj.height || 64;

            let forceX = 0;
            let forceY = -220;
            let turbulence = 0;
            let frequency = 2.5;
            let color = 0xbae6fd;

            if (obj.properties) {
                const fx = obj.properties.find((p: any) => p.name.toLowerCase() === 'forcex' || p.name.toLowerCase() === 'fx');
                if (fx) forceX = Number(fx.value);

                const fy = obj.properties.find((p: any) => p.name.toLowerCase() === 'forcey' || p.name.toLowerCase() === 'fy');
                if (fy) forceY = Number(fy.value);

                const turb = obj.properties.find((p: any) => p.name.toLowerCase() === 'turbulence' || p.name.toLowerCase() === 'turb' || p.name.toLowerCase() === 'oscillation');
                if (turb) turbulence = Number(turb.value);

                const freq = obj.properties.find((p: any) => p.name.toLowerCase() === 'frequency' || p.name.toLowerCase() === 'freq');
                if (freq) frequency = Number(freq.value);

                const colProp = obj.properties.find((p: any) => p.name.toLowerCase() === 'color');
                if (colProp) color = Number(colProp.value);
            }

            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true);

            const angle = Phaser.Math.RadToDeg(Math.atan2(forceY, forceX !== 0 ? forceX : (turbulence > 0 ? 30 : 0)));
            const baseSpeed = Math.min(300, Math.max(80, Math.sqrt(forceX * forceX + forceY * forceY + turbulence * turbulence)));

            const emitter = this.scene.add.particles(zX, zY, 'wind-particle', {
                x: { min: -zW / 2, max: zW / 2 },
                y: { min: -zH / 2, max: zH / 2 },
                speed: baseSpeed,
                angle: { min: angle - 18, max: angle + 18 },
                scale: { start: 0.8, end: 0.2 },
                alpha: { start: 0.5, end: 0 },
                lifespan: Math.max(300, Math.min(1000, (Math.max(zW, zH) / baseSpeed) * 1000)),
                frequency: 50,
                tint: color
            }).setDepth(2.8);

            this.windZones.push({ zone, forceX, forceY, turbulence, frequency, emitter });
        });
    }

    setupDoors(rawMapObjects: any[]) {
        this.doorExitZones = [];
        this.doorSprites.forEach(s => s.destroy());
        this.doorSprites = [];

        // Teleport destination is Well / Checkpoint2 (inside the well)
        const wellObj = rawMapObjects.find((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name === 'well' || name.startsWith('well') || type === 'well';
        });

        const cp2Obj = rawMapObjects.find((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase().replace(/\s+/g, '');
            return name === 'checkpoint2' || name === 'cp2';
        });

        if (wellObj) {
            const w = wellObj.width || 32;
            const h = wellObj.height || 64;
            const topY = wellObj.gid !== undefined ? (wellObj.y - h) : wellObj.y;
            this.doorExitX = wellObj.x + (w / 2);
            this.doorExitTopY = topY;
            this.doorExitY = topY - 16; // player standing center Y on top of well
            this.doorExitDeepY = (wellObj.gid !== undefined ? wellObj.y : wellObj.y + h) - 8; // bottom inside well
        } else if (cp2Obj) {
            const w = cp2Obj.width || 32;
            const h = cp2Obj.height || 32;
            const topY = cp2Obj.gid !== undefined ? (cp2Obj.y - h) : cp2Obj.y;
            this.doorExitX = cp2Obj.x + (w / 2);
            this.doorExitTopY = topY;
            this.doorExitY = topY - 16;
            this.doorExitDeepY = topY + h + 32;
        } else {
            this.doorExitX = 2064;
            this.doorExitTopY = 672;
            this.doorExitY = 656;
            this.doorExitDeepY = 736;
        }
        
        this.doorZones = [];
        this.doorPrompts.forEach(p => p.destroy());
        this.doorPrompts = [];

        rawMapObjects.filter((obj: any) => obj.name === 'DoorZone' || obj.name === 'DoorEntrance').forEach((obj: any) => {
            const zW = obj.width || 32;
            const zH = (obj.height || 48) + 64;
            const zX = obj.x + (obj.width ? obj.width / 2 : 16);
            const zY = obj.y + (obj.height ? obj.height / 2 : 24) - 32;
            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true); 
            this.doorZones.push(zone);

            const doorSpriteX = obj.x + (obj.width ? obj.width / 2 : 16);
            const doorSpriteY = obj.gid !== undefined ? obj.y : obj.y + (obj.height || 32);
            if (this.scene.textures.exists('door')) {
                const dSprite = this.scene.add.sprite(doorSpriteX, doorSpriteY, 'door');
                dSprite.setOrigin(0.5, 1.0);
                dSprite.setDepth(2.5);
                this.doorSprites.push(dSprite);
            }

            // Static "[ E ]" badge permanently fixed directly above the teleporter door
            const promptX = zX;
            const topY = obj.gid !== undefined ? (obj.y - (obj.height || 32)) : (obj.y || 0);
            const promptY = topY - 14;

            const bg = this.scene.add.graphics();
            bg.fillStyle(0x0f172a, 0.9);
            bg.fillRoundedRect(-22, -12, 44, 24, 6);
            bg.lineStyle(1.5, 0x38bdf8, 0.95);
            bg.strokeRoundedRect(-22, -12, 44, 24, 6);

            const txt = this.scene.add.text(0, 0, '[ E ]', {
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                color: '#f8fafc',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            const prompt = this.scene.add.container(promptX, promptY, [bg, txt]);
            prompt.setDepth(30);
            this.doorPrompts.push(prompt);
        });
    }

    setupWells(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        this.wells = this.scene.physics.add.staticGroup();
        this.wellObjects = [];

        const wellObjs = rawMapObjects.filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name === 'well' || name.startsWith('well') || type === 'well' || type.startsWith('well');
        });

        wellObjs.forEach((obj: any) => {
            const w = obj.width || 32;
            const h = obj.height || 64;
            const hasGid = obj.gid !== undefined;
            const posX = obj.x + (w / 2);
            const posY = hasGid ? (obj.y - (h / 2)) : (obj.y + (h / 2));
            const topY = hasGid ? (obj.y - h) : obj.y;

            this.wellObjects.push({
                x: posX,
                y: posY,
                width: w,
                height: h,
                topY: topY
            });

            let textureKey = 'well2';
            let frameIndex: number | string | undefined = undefined;

            if (hasGid && map && map.tilesets) {
                const cleanGid = obj.gid & 0x1FFFFFFF;
                const tileset = map.tilesets.find((t: any) => cleanGid >= t.firstgid && cleanGid < t.firstgid + t.total);
                if (tileset) {
                    const localId = cleanGid - tileset.firstgid;
                    const candidates = [
                        tileset.name,
                        tileset.name.toLowerCase(),
                        'well2',
                        'Well2',
                        'well',
                        'Well',
                        'big ahh well'
                    ];
                    const matched = candidates.find(k => this.scene.textures.exists(k));
                    if (matched) {
                        textureKey = matched;
                    }

                    const tex = this.scene.textures.get(textureKey);
                    if (tex) {
                        const tileW = tileset.tileWidth || w;
                        const tileH = tileset.tileHeight || h;
                        const frameKey = `well_frame_${cleanGid}_${localId}`;
                        
                        if (!tex.has(frameKey)) {
                            const srcImg = tex.getSourceImage() as HTMLImageElement;
                            const imgW = (srcImg && srcImg.width) ? srcImg.width : 96;
                            const cols = tileset.columns || Math.max(1, Math.floor(imgW / tileW));
                            const col = localId % cols;
                            const row = Math.floor(localId / cols);
                            const frameX = col * tileW;
                            const frameY = row * tileH;
                            tex.add(frameKey, 0, frameX, frameY, tileW, tileH);
                        }
                        if (tex.has(frameKey)) {
                            frameIndex = frameKey;
                        }
                    }
                }
            } else if (!hasGid) {
                if (this.scene.textures.exists('well2')) {
                    textureKey = 'well2';
                } else if (this.scene.textures.exists('well')) {
                    textureKey = 'well';
                }
            }

            const sp = (frameIndex !== undefined)
                ? this.scene.physics.add.sprite(posX, posY, textureKey, frameIndex)
                : this.scene.physics.add.sprite(posX, posY, textureKey);

            sp.setOrigin(0.5, 0.5);
            sp.setDisplaySize(w, h);
            sp.setDepth(3.0);
            sp.setImmovable(true);
            const b = sp.body as Phaser.Physics.Arcade.Body;
            b.allowGravity = false;
            b.moves = false;
            b.setSize(w, h);
            this.wells!.add(sp);
        });

        // Solid collider with player:
        // When climbing from inside the well (isTeleporting), process callback allows rising up.
        // As soon as emergence finishes or in all regular gameplay, it acts 100% solid exactly like ground!
        this.scene.physics.add.collider(this.player, this.wells, undefined, () => {
            return !this.player.isTeleporting;
        });

        this.scene.physics.add.collider(this.player.bullets, this.wells, (bulletObj) => {
            const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
            if (!bullet || !bullet.active) return;
            const bx = bullet.x;
            const by = bullet.y;
            bullet.destroy();
            this.uiManager.spawnParticles(bx, by, 0x808080);
        });
    }

    setupGunDisarmZones(rawMapObjects: any[]) {
        rawMapObjects.filter((obj: any) => 
            obj.name === 'GunDisarmZone' || 
            obj.name === 'DisarmZone' || 
            obj.name === 'RemoveGunZone'
        ).forEach((obj: any) => {
            const zX = obj.x + (obj.width ? obj.width / 2 : 0);
            const zY = obj.y + (obj.height ? obj.height / 2 : 0);
            const zW = obj.width || 32;
            const zH = obj.height || 48;
            const zone = this.scene.add.zone(zX, zY, zW, zH);
            this.scene.physics.add.existing(zone, true);
            this.disarmZones.push(zone);
        });
    }

    setupMovingPlatforms(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        const platformObjects = map.createFromObjects('Objects', { name: 'MovingPlatform', key: 'moving-platform-img' });
        const rawPlatforms = rawMapObjects.filter((o: any) => o.name === 'MovingPlatform');

        platformObjects.forEach((obj: any, index: number) => {
            const rawObj = rawPlatforms[index];
            if (rawObj && rawObj.gid && map.tilesets) {
                const tileset = map.tilesets.find(t => rawObj.gid >= t.firstgid && rawObj.gid < t.firstgid + t.total);
                if (tileset && this.scene.textures.exists(tileset.name)) {
                    obj.setTexture(tileset.name);
                }
            }

            this.scene.physics.add.existing(obj);
            const platBody = obj.body as Phaser.Physics.Arcade.Body;
            platBody.allowGravity = false; 
            platBody.immovable = true;     
            
            // Tighten hitbox to match visible platform pixels (removing transparent padding and rounded ends to prevent floating in mid-air)
            const insetX = 8;
            const targetW = Math.max(16, obj.width - insetX * 2);
            platBody.setSize(targetW, 10).setOffset(insetX, 11);     
            
            let platSpeed = 250;
            let platDistance = 150;
            let platDirection = 1;
            let platFriction = 1;

            if (rawObj && rawObj.properties) {
                const speedProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'speed');
                if (speedProp && speedProp.value !== undefined) {
                    platSpeed = Math.abs(Number(speedProp.value));
                }

                const distProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'distance' || p.name.toLowerCase() === 'dist');
                if (distProp && distProp.value !== undefined) {
                    platDistance = Math.abs(Number(distProp.value));
                }

                const dirProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'direction' || p.name.toLowerCase() === 'dir');
                if (dirProp && dirProp.value !== undefined) {
                    const val = String(dirProp.value).toLowerCase().trim();
                    if (val === 'left' || val === '-1') platDirection = -1;
                    else if (val === 'right' || val === '1') platDirection = 1;
                }

                const frictionProp = rawObj.properties.find((p: any) => p.name.toLowerCase() === 'friction');
                if (frictionProp && frictionProp.value !== undefined) {
                    platFriction = Number(frictionProp.value);
                }
            }
            
            let minX = obj.x;
            let maxX = obj.x + platDistance;

            if (platDirection === -1) {
                minX = obj.x - platDistance;
                maxX = obj.x;
            }

            platBody.setVelocityX(platSpeed * platDirection); 
            platBody.setFriction(platFriction, 0); 
            obj.setData('startX', obj.x);
            obj.setData('minX', minX);
            obj.setData('maxX', maxX);
            obj.setData('speed', platSpeed); 
            obj.setData('distance', platDistance);
            obj.setData('initialDirection', platDirection);
            this.movingPlatforms.push(obj);
        });

        if (this.movingPlatforms.length > 0) {
            this.scene.physics.add.collider(this.player, this.movingPlatforms, (_p, plat) => {
                const pBody = (_p as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
                const platBody = (plat as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
                if (pBody.bottom <= platBody.top + 5 && pBody.right > platBody.left + 2 && pBody.left < platBody.right - 2) {
                    this.player.isOnPlatform = true;
                }
            });
        }
    }

    setupJumpPads(map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        const rawPads = rawMapObjects.filter((o: any) => {
            const name = (o.name || '').toLowerCase();
            const type = (o.type || '').toLowerCase();
            const className = (o.class || '').toLowerCase();
            return name === 'jumppad' || name === 'jump-pad' || name === 'jump_pad' || name === 'pad' ||
                   type === 'jumppad' || type === 'jump-pad' || className === 'jumppad' || className === 'jump-pad';
        });

        rawPads.forEach((rawObj: any) => {
            const posX = Math.round(rawObj.x);
            const posY = Math.round(rawObj.y);
            const padWidth = Math.round(rawObj.width || 32);
            const padHeight = Math.round(rawObj.height || 32);

            let textureKey = 'jump-pad-img';
            let frameIndex: number | string | undefined = undefined;
            let isCustomTile = false;

            if (rawObj.gid && map && map.tilesets) {
                const cleanGid = rawObj.gid & 0x1FFFFFFF;
                const tileset = map.tilesets.find((t: any) => cleanGid >= t.firstgid && cleanGid < t.firstgid + t.total);
                if (tileset) {
                    const localId = cleanGid - tileset.firstgid;
                    const tilesetKeyMap: Record<string, string> = {
                        'LevelObjectTiles': 'levelobjects',
                        'levelobjects': 'levelobjects',
                        'LandTiles_32_32': 'landtiles',
                        'landtiles': 'landtiles',
                        'sky': 'sky',
                        'clouds1': 'clouds1',
                        'cloud2': 'cloud2',
                        'smallTree': 'smallTree',
                        'largeTree': 'largeTree',
                        'grass': 'grass',
                        'cherry blossom': 'cherry blossom',
                        'well': 'well',
                        'water': 'water',
                        'lava': 'lava',
                        'moving-platform': 'moving-platform',
                        'moving-platform-img': 'moving-platform-img',
                        'wooden moving platform': 'wooden moving platform',
                        'jump-pad': 'jump-pad-img',
                        'jump-pad-img': 'jump-pad-img',
                        'jumppad sprite': 'jump-pad-img',
                        'dandelion': 'dandelion',
                        'dandelion flower sprite': 'dandelion',
                        'plain-ground': 'plain-ground',
                        'bush': 'bush',
                        'cherry blossom blocks': 'cherry blossom blocks',
                        'bridge extra': 'bridge extra',
                        'grass template': 'grass template',
                        'cb template': 'cb template',
                        'DIRT AND GRASS REMADE': 'DIRT AND GRASS REMADE',
                        'cherry blossom tree': 'cherry blossom tree',
                        'new lava': 'new lava',
                        'gravity orb': 'gravity-orb',
                        'attack tiles': 'attack-tiles',
                        'temp platforms': 'temp-platforms',
                        'dungeon background1': 'dungeon background1',
                        'dungeon-background1': 'dungeon-background1',
                        'dungeon background 1': 'dungeon background1'
                    };

                    const resolvedKey = tilesetKeyMap[tileset.name] || tileset.name;
                    if (resolvedKey !== 'jump-pad-img') {
                        isCustomTile = true;
                    }

                    if (this.scene.textures.exists(resolvedKey)) {
                        textureKey = resolvedKey;
                        const tex = this.scene.textures.get(resolvedKey);
                        const frameKey = String(localId);
                        
                        // If texture does not already have this individual tile frame, add it dynamically from tileset coordinates
                        if (!tex.has(frameKey)) {
                            const tileW = tileset.tileWidth || 32;
                            const tileH = tileset.tileHeight || 32;
                            const srcImg = tex.getSourceImage() as HTMLImageElement;
                            const imgW = (srcImg && srcImg.width) ? srcImg.width : (tileset.columns ? tileset.columns * tileW : 96);
                            const cols = tileset.columns || Math.max(1, Math.floor(imgW / tileW));
                            const col = localId % cols;
                            const row = Math.floor(localId / cols);
                            const frameX = col * tileW;
                            const frameY = row * tileH;
                            tex.add(frameKey, 0, frameX, frameY, tileW, tileH);
                        }
                        frameIndex = frameKey;
                    }
                }
            }

            const padSprite = (frameIndex !== undefined && String(frameIndex) !== '0')
                ? this.scene.physics.add.sprite(posX, posY, textureKey, frameIndex)
                : this.scene.physics.add.sprite(posX, posY, textureKey, 0);

            padSprite.setDepth(4).setOrigin(0, 1);
            padSprite.setDisplaySize(padWidth, padHeight);
            
            let bouncePower = 820; 
            if (rawObj.properties) {
                if (Array.isArray(rawObj.properties)) {
                    const pProp = rawObj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'power');
                    if (pProp && pProp.value !== undefined) bouncePower = Number(pProp.value);
                } else if (typeof rawObj.properties === 'object') {
                    if (rawObj.properties.power !== undefined) bouncePower = Number(rawObj.properties.power);
                }
            }
            padSprite.setData('bouncePower', -Math.abs(bouncePower));
            padSprite.setData('isCompressing', false);
            padSprite.setData('isCustomTile', isCustomTile);

            const padBody = padSprite.body as Phaser.Physics.Arcade.Body;
            const hitboxHeight = isCustomTile ? Math.min(padHeight, 16) : 8; // Visible spring pixel height at the bottom of the 32x32 tile
            const hitboxOffsetY = padHeight - hitboxHeight;
            padBody.setAllowGravity(false)
                   .setImmovable(true)
                   .setSize(padWidth, hitboxHeight)
                   .setOffset(0, hitboxOffsetY);
            this.jumpPads.push(padSprite);
        });

        this.scene.physics.add.collider(this.player, this.jumpPads, (_p, padObj) => {
            const pBody = (_p as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
            const padSprite = padObj as Phaser.Physics.Arcade.Sprite;
            const padBody = padSprite.body as Phaser.Physics.Arcade.Body;
            const isCustomTile = Boolean(padSprite.getData('isCustomTile'));
            
            // Only trigger if player physically touches/lands on the spring pixel hitbox from above
            const isTouchingTop = (pBody.touching.down || pBody.blocked.down || (pBody.bottom >= padBody.top - 2 && pBody.bottom <= padBody.top + 8 && pBody.velocity.y >= 0));
            const isHorizontallyAligned = (pBody.right > padBody.left + 2 && pBody.left < padBody.right - 2);

            if (isTouchingTop && isHorizontallyAligned && !padSprite.getData('isCompressing')) {
                padSprite.setData('isCompressing', true);

                if (isCustomTile) {
                    // Custom tile: Keep original tile graphic intact, do not use the jumppad sprite spring effect
                    this.player.setVelocityY(padSprite.getData('bouncePower'));
                    this.player.isNormalJump = false; 
                    this.player.ignoreGroundJumpUntil = this.scene.time.now + 200;
                    this.soundManager?.playJump();

                    // Gentle squash tween for tactile feedback
                    this.scene.tweens.add({
                        targets: padSprite,
                        scaleY: 0.85,
                        duration: 60,
                        yoyo: true,
                        ease: 'Quad.easeInOut',
                        onComplete: () => {
                            if (padSprite.active) padSprite.setData('isCompressing', false);
                        }
                    });
                } else {
                    // Standard jumppad sprite: 4-frame weight compression & launch animation
                    // a. Step 1: Display frame 1 (compressed spring under player weight)
                    padSprite.setFrame(1);
                    pBody.setVelocityY(0);

                    // b. Hold compressed frame briefly (~80ms) to feel the player's weight pressing down
                    this.scene.time.delayedCall(80, () => {
                        if (!padSprite.active) return;

                        // c. Step 2: Display frame 2 (extension starting)
                        padSprite.setFrame(2);

                        this.scene.time.delayedCall(30, () => {
                            if (!padSprite.active) return;

                            // Step 3: Display frame 3 (full launch extension) and shoot player upwards
                            padSprite.setFrame(3);
                            this.player.setVelocityY(padSprite.getData('bouncePower'));
                            this.player.isNormalJump = false; 
                            this.player.ignoreGroundJumpUntil = this.scene.time.now + 200;
                            this.soundManager?.playJump();

                            // Step 4: Reset back to resting frame 0
                            this.scene.time.delayedCall(80, () => {
                                if (padSprite.active) {
                                    padSprite.setFrame(0);
                                    padSprite.setData('isCompressing', false);
                                }
                            });
                        });
                    });
                }
            }
        });
    }

    setupFirebars(rawMapObjects: any[]) {
        const rawFirebars = rawMapObjects.filter((o: any) => o.name === 'Firebar');
        rawFirebars.forEach((obj: any) => {
            const pivotX = obj.x! + (obj.width || 0) / 2;
            const pivotY = obj.y! + (obj.height || 0) / 2;
            let length = 4;
            let rawSpeed = 0.05;
            let startAngleRad = 0;
            
            // Check Tiled properties (both array and object representations)
            if (obj.properties) {
                if (Array.isArray(obj.properties)) {
                    const lenProp = obj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'length');
                    if (lenProp && lenProp.value !== undefined) length = Number(lenProp.value);
                    
                    const speedProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'speed' || p.name.toLowerCase() === 'rotationspeed'));
                    if (speedProp && speedProp.value !== undefined) rawSpeed = Number(speedProp.value);

                    const angleProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'startangle' || p.name.toLowerCase() === 'angle' || p.name.toLowerCase() === 'initialangle'));
                    if (angleProp && angleProp.value !== undefined) {
                        const val = Number(angleProp.value);
                        startAngleRad = val > (2 * Math.PI) ? Phaser.Math.DegToRad(val) : val;
                    }
                } else if (typeof obj.properties === 'object') {
                    if (obj.properties.length !== undefined) length = Number(obj.properties.length);
                    if (obj.properties.speed !== undefined) rawSpeed = Number(obj.properties.speed);
                    if (obj.properties.startAngle !== undefined || obj.properties.angle !== undefined) {
                        const val = Number(obj.properties.startAngle ?? obj.properties.angle);
                        startAngleRad = val > (2 * Math.PI) ? Phaser.Math.DegToRad(val) : val;
                    }
                }
            }

            // Normalize Speed:
            // If user enters a multiplier (e.g. 1.0 = normal, 2.0 = double fast, -1.0 = reverse): scale by 0.05 baseline
            // If user enters direct radians step (e.g. 0.05, 0.08, 0.025, -0.05): use directly
            const speed = Math.abs(rawSpeed) >= 0.5 ? rawSpeed * 0.05 : rawSpeed;
            
            const scaleRatio = Math.max(0.5, (length * 16) / 31);
            const sprite = this.scene.add.sprite(pivotX, pivotY, 'firebar-sprite');
            // Exact center of the bottom hook: pixel (15.5, 48.5) in 32x64 frame
            sprite.setOrigin(15.5 / 32, 48.5 / 64);
            sprite.setScale(1, scaleRatio);
            sprite.setDepth(5);
            sprite.play('firebar-spin');
            sprite.setRotation(startAngleRad + Math.PI / 2);

            const barLength = 31 * scaleRatio;
            this.firebars.push({ pivotX, pivotY, angle: startAngleRad, speed, sprite, barLength });
        });
    }

    setupSmashTriggers(map: Phaser.Tilemaps.Tilemap, rawMapObjects?: any[]) {
        this.smashTriggers = [];
        const smashObjs = (rawMapObjects || []).filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name.includes('smash') || type.includes('smash');
        });

        if (smashObjs.length > 0) {
            smashObjs.forEach((obj: any) => {
                const zone = this.scene.add.zone(
                    obj.x + (obj.width ? obj.width / 2 : 16), 
                    obj.y + (obj.height ? obj.height / 2 : 16), 
                    obj.width || 32, 
                    obj.height || 32
                );
                this.scene.physics.add.existing(zone, true);
                this.smashTriggers.push(zone);
            });
        } else {
            const objectLayer = map.getObjectLayer('Objects');
            if (objectLayer) {
                objectLayer.objects.filter((obj: any) => {
                    const name = String(obj.name || '').trim().toLowerCase();
                    return name.includes('smash');
                }).forEach((obj: any) => {
                    const zone = this.scene.add.zone(obj.x! + (obj.width! / 2), obj.y! + (obj.height! / 2), obj.width!, obj.height!);
                    this.scene.physics.add.existing(zone, true);
                    this.smashTriggers.push(zone);
                });
            }
        }
    }

    setupBridges(_map: Phaser.Tilemaps.Tilemap, rawMapObjects: any[]) {
        this.bridges = [];

        // 1. Locate all Bridge objects from map object layer
        let bridgeObjs = rawMapObjects.filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name === 'bridge' || name.startsWith('bridge') || type === 'bridge';
        });

        // 2. Fallback in case tilemap on disk hasn't saved the object layer yet:
        // Populate standard smash ground locations at (2464, 736) and (4640, 768)
        if (bridgeObjs.length === 0) {
            bridgeObjs = [
                { name: 'Bridge', x: 2464, y: 736, width: 96, height: 32 },
                { name: 'Bridge', x: 4640, y: 768, width: 96, height: 32 }
            ];
        }

        bridgeObjs.forEach((obj: any) => {
            const hasGid = obj.gid !== undefined;
            const posX = obj.x || 0;
            const posY = hasGid ? (obj.y - (obj.height || 32)) : (obj.y || 0);
            const width = obj.width || 96;
            const height = obj.height || 32;

            const sprite = this.scene.physics.add.sprite(posX, posY, 'bridge-break', 0);
            sprite.setOrigin(0, 0);
            sprite.setDisplaySize(96, 32);
            sprite.setDepth(2.8);

            const body = sprite.body as Phaser.Physics.Arcade.Body;
            body.setAllowGravity(false);
            body.setImmovable(true);
            body.moves = false;
            body.setSize(96, 32);
            body.setOffset(0, 0);

            const bridgeData: BridgeData = {
                sprite,
                initialX: posX,
                initialY: posY,
                width,
                height,
                broken: false,
                snapshotBroken: false
            };

            // Player vs Bridge Collider
            const playerCollider = this.scene.physics.add.collider(
                this.player, 
                sprite, 
                undefined, 
                (_p, _s) => {
                    if (bridgeData.broken) return false;

                    const pBody = this.player.body as Phaser.Physics.Arcade.Body;
                    const bridgeTop = sprite.y;

                    // Bridge ONLY breaks when falling from a SmashTrigger (this.player.canSmash is active)
                    if (pBody.velocity.y > 0 && this.player.canSmash) {
                        this.breakBridge(bridgeData);
                        this.player.canSmash = false;
                        return false; // Break through without collision obstruction
                    }

                    // Solid platform when walking, standing, jumping, or landing on it normally
                    return pBody.velocity.y >= 0 && pBody.bottom <= bridgeTop + 24;
                }
            );
            bridgeData.collider = playerCollider;

            // Player Bullets vs Bridge Collider
            const bulletCollider = this.scene.physics.add.collider(
                this.player.bullets, 
                sprite, 
                (bulletObj) => {
                    if (!bridgeData.broken) {
                        const bullet = bulletObj as Phaser.Physics.Arcade.Sprite;
                        this.uiManager.spawnParticles(bullet.x, bullet.y, 0x8B5A2B);
                        bullet.destroy();
                    }
                },
                () => !bridgeData.broken
            );
            bridgeData.bulletCollider = bulletCollider;

            this.bridges.push(bridgeData);
        });
    }

    public breakBridge(bridge: BridgeData) {
        if (bridge.broken) return;
        bridge.broken = true;

        const sprite = bridge.sprite;
        const body = sprite.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.enable = false;
        }

        // Play 4-frame breaking animation (left to right: frame 0 -> 1 -> 2 -> 3)
        sprite.play('bridge-break-anim');

        // Sound effect: Crumbling wood / bridge break
        this.soundManager?.playBridgeBreak();

        // Screen shake
        this.scene.cameras.main.shake(250, 0.012);

        // Low density wooden break particles
        const centerX = sprite.x + 48;
        const centerY = sprite.y + 16;
        const woodColors = [0x8B4513, 0xA0522D, 0x6B4226, 0x5C3317, 0x7E481C, 0xCD853F];
        this.uiManager.spawnParticles(
            centerX + Phaser.Math.Between(-30, 30),
            centerY + Phaser.Math.Between(-8, 8),
            woodColors[1 % woodColors.length]
        );

        // Float impact feedback text
        this.uiManager.showFloatingText(centerX, sprite.y - 12, 'CRASH!', '#D2B48C');

        // Add impact resistance: dampen downward velocity upon smashing through the bridge
        if (this.player && this.player.body) {
            const pBody = this.player.body as Phaser.Physics.Arcade.Body;
            const currentVY = pBody.velocity.y;
            const resistedVY = Math.min(Math.max(currentVY * 0.22, 60), 130);
            pBody.setVelocityY(resistedVY);
        }
        this.player.canSmash = false;

        // Once animation completes, smooth fade
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            this.scene.tweens.add({
                targets: sprite,
                alpha: 0,
                duration: 500,
                delay: 200,
                ease: 'Power2'
            });
        });
    }

    setupDandelions(rawMapObjects: any[]) {
        this.dandelions = [];
        rawMapObjects.filter((obj: any) => {
            const name = String(obj.name || '').trim().toLowerCase();
            const type = String(obj.type || '').trim().toLowerCase();
            return name === 'dandelion' || type === 'dandelion' || name.startsWith('dandelion');
        }).forEach((obj: any) => {
            const posX = obj.x || 0;
            // Tiled objects with GID (tile objects) have origin at bottom-left (y is bottom)
            const hasGid = obj.gid !== undefined;
            const originY = hasGid ? 1 : 0;
            const posY = obj.y || 0;

            let depth = 2.5;
            let animSpeed = 6;

            if (obj.properties) {
                if (Array.isArray(obj.properties)) {
                    const depthProp = obj.properties.find((p: any) => p && p.name && p.name.toLowerCase() === 'depth');
                    if (depthProp && depthProp.value !== undefined) depth = Number(depthProp.value);

                    const speedProp = obj.properties.find((p: any) => p && p.name && (p.name.toLowerCase() === 'speed' || p.name.toLowerCase() === 'fps'));
                    if (speedProp && speedProp.value !== undefined) animSpeed = Number(speedProp.value);
                } else if (typeof obj.properties === 'object') {
                    if (obj.properties.depth !== undefined) depth = Number(obj.properties.depth);
                    if (obj.properties.speed !== undefined) animSpeed = Number(obj.properties.speed);
                }
            }

            const sprite = this.scene.add.sprite(posX, posY, 'dandelion')
                .setOrigin(0, originY)
                .setDepth(depth);

            // Optional custom scaling if specified in Tiled
            if (obj.width && obj.height && (obj.width !== 32 || obj.height !== 32)) {
                sprite.setDisplaySize(obj.width, obj.height);
            }

            // Stagger start frame randomly so multiple dandelions sway naturally out of sync
            const startFrame = Math.floor(Math.random() * 4);
            sprite.play({
                key: 'dandelion-sway',
                startFrame: startFrame,
                frameRate: animSpeed,
                repeat: -1
            });

            this.dandelions.push(sprite);
        });
    }

    setupStartTutorialCues(rawMapObjects: any[] = [], spawnX: number = 105, spawnY: number = 176) {
        const jumpObj = rawMapObjects.find((obj: any) => obj.name === 'JumpInstructions' || obj.name === 'jumpInstructions');

        const w = jumpObj?.width ? jumpObj.width : 220;
        const h = jumpObj?.height ? jumpObj.height : 52;
        const panelX = jumpObj ? jumpObj.x + w / 2 : (spawnX + 105);
        const panelY = jumpObj ? jumpObj.y + h / 2 : (spawnY - 10);

        const bg = this.scene.add.graphics();
        bg.fillStyle(0x0f172a, 0.5);
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
        bg.lineStyle(1.5, 0x38bdf8, 0.5);
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);

        const offset = Math.min(Math.max(h * 0.28, 14), h / 2 - 10);

        const header = this.scene.add.text(0, -offset, '▲ JUMP MECHANICS', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#38bdf8',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const controlsText = this.scene.add.text(0, 0, '[SPACE]  /  [W]  /  [↑]', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            color: '#f8fafc',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const mechanicsText = this.scene.add.text(0, offset, 'Tap: Short-Hop  •  Hold: High Jump', {
            fontSize: '9.5px',
            fontFamily: 'Arial, sans-serif',
            color: '#cbd5e1',
            fontStyle: 'normal'
        }).setOrigin(0.5);

        const container = this.scene.add.container(panelX, panelY, [bg, header, controlsText, mechanicsText]);
        container.setDepth(3);
    }

    update(delta: number = 16.667) {
        const deltaFactor = Math.min(delta / 16.6667, 3.0); // Normalized 60Hz delta scale
        const cam = this.scene.cameras.main;
        const camLeft = cam.scrollX - 200;
        const camRight = cam.scrollX + cam.width + 200;
        const pBounds = this.player.getBounds();
        const pBody = this.player.body as Phaser.Physics.Arcade.Body;

        this.firebars.forEach(bar => {
            bar.angle += bar.speed * deltaFactor;
            bar.sprite.setRotation(bar.angle + Math.PI / 2);

            // Only update collision if near the camera view
            if (bar.pivotX >= camLeft && bar.pivotX <= camRight && this.player && this.player.active) {
                const tipX = bar.pivotX + Math.cos(bar.angle) * bar.barLength;
                const tipY = bar.pivotY + Math.sin(bar.angle) * bar.barLength;
                
                // Pixel-accurate player body bounds (inset slightly to ignore empty border padding)
                const playerRect = new Phaser.Geom.Rectangle(
                    pBody.x + 2, 
                    pBody.y + 2, 
                    Math.max(1, pBody.width - 4), 
                    Math.max(1, pBody.height - 4)
                );
                const fireLine = new Phaser.Geom.Line(bar.pivotX, bar.pivotY, tipX, tipY);

                let isHit = Phaser.Geom.Intersects.LineToRectangle(fireLine, playerRect);
                if (!isHit) {
                    // Check flame pixel thickness (3.5px radius strictly along the rotating firebar)
                    const sampleCount = 6;
                    for (let s = 1; s <= sampleCount; s++) {
                        const dist = (bar.barLength * s) / sampleCount;
                        const sampleX = bar.pivotX + Math.cos(bar.angle) * dist;
                        const sampleY = bar.pivotY + Math.sin(bar.angle) * dist;
                        if (Phaser.Geom.Intersects.CircleToRectangle(new Phaser.Geom.Circle(sampleX, sampleY, 3.5), playerRect)) {
                            isHit = true;
                            break;
                        }
                    }
                }

                if (isHit) {
                    this.player.die('lava');
                }
            }
        });

        this.movingPlatforms.forEach(plat => {
            const platBody = plat.body as Phaser.Physics.Arcade.Body;
            const minX = plat.getData('minX') as number;
            const maxX = plat.getData('maxX') as number;
            const platSpeed = plat.getData('speed') as number;

            if (plat.x >= maxX) {
                platBody.setVelocityX(-platSpeed);
            } else if (plat.x <= minX) {
                platBody.setVelocityX(platSpeed);
            }
        });
        const currentTime = this.scene.time.now;

        // Handle Custom Checkpoint Zones
        for (const cp of this.checkpoints) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, cp.zone.getBounds())) {
                if (!cp.activated) {
                    this.activateCheckpoint(cp);
                }
            }
        }

        // Handle Reveal Triggers (e.g. BossFightEntrance, DungeonFill, Boss triggers, etc.)
        for (const trigger of this.revealTriggers) {
            const isInside = Phaser.Geom.Intersects.RectangleToRectangle(pBounds, trigger.zone.getBounds()) ||
                             Phaser.Geom.Intersects.RectangleToRectangle(new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height), trigger.zone.getBounds());
            if (isInside) {
                if (!trigger.activated) {
                    trigger.activated = true;
                    if (trigger.isBossTrigger) {
                        this.triggerRevealLayer('', true);
                    }
                    if (trigger.targetLayerNames.length > 0) {
                        for (const target of trigger.targetLayerNames) {
                            this.triggerRevealLayer(target, trigger.isBossTrigger);
                        }
                    }
                    if (trigger.id) {
                        this.triggerRevealLayer(trigger.id, trigger.isBossTrigger);
                    }
                }
            } else if (!trigger.permanent && trigger.activated) {
                trigger.activated = false;
                for (const reveal of this.revealTileLayers) {
                    if (!reveal.keepRevealed && reveal.revealed) {
                        reveal.revealed = false;
                        reveal.layer.setAlpha(0);
                        reveal.layer.setVisible(false);
                        if (reveal.collider) {
                            reveal.collider.active = false;
                        }
                    }
                }
            }
        }

        // Apply Environmental Wind Zone Forces
        for (const wind of this.windZones) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, wind.zone.getBounds())) {
                let currentForceX = wind.forceX;
                if (wind.turbulence > 0) {
                    currentForceX += Math.sin(currentTime * 0.003 * wind.frequency) * wind.turbulence;
                }

                if (currentForceX !== 0) {
                    pBody.velocity.x += currentForceX * 0.05;
                }
                if (wind.forceY !== 0) {
                    pBody.velocity.y += wind.forceY * 0.05;
                }
            }
        }

        // Handle Teleport Door (Entering door teleports player into Checkpoint2 well, climbing up)
        let isPlayerInDoor = false;
        for (const zone of this.doorZones) {
            if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, zone.getBounds())) {
                isPlayerInDoor = true;
                break;
            }
        }
        this.player.isNearDoor = isPlayerInDoor;

        if (isPlayerInDoor && this.doorExitX !== 0 && !this.player.isTeleporting && !this.player.isDying) {
            const enterPressed = Phaser.Input.Keyboard.JustDown(this.player.keyE) ||
                                 Phaser.Input.Keyboard.JustDown(this.player.enterKey) ||
                                 Phaser.Input.Keyboard.JustDown(this.player.cursors.up) ||
                                 (this.player.keyW && Phaser.Input.Keyboard.JustDown(this.player.keyW));

            if (enterPressed) {
                this.player.isNearDoor = false;
                this.player.isTeleporting = true;
                this.player.setVelocity(0, 0);

            if (pBody) {
                pBody.allowGravity = false;
                pBody.setVelocity(0, 0);
            }

            // Door entrance FX
            this.scene.cameras.main.flash(150, 255, 255, 255);
            this.uiManager.spawnParticles(this.player.x, this.player.y, 0x38BDF8);
            this.soundManager?.playTeleport();

            const targetX = this.doorExitX;
            const topY = this.doorExitTopY || (this.doorExitY + 16);
            const surfaceStandingY = topY - 16; // player center when standing on top of well (feet at topY)
            const wellDeepY = this.doorExitDeepY || (topY + 64); // bottom inside well
            const popOutPeakY = surfaceStandingY - 26; // peak ascent above the well rim (pop out into checkpoint zone)

            // Place player deep inside the well (depth 2.8 is behind ground/well layer at depth 3.0/3.5)
            // Keeping x locked strictly to targetX prevents side pixel clipping
            this.player.setPosition(targetX, wellDeepY);
            this.player.setDepth(2.8);
            this.player.setAlpha(1);

            // Center camera on destination
            this.scene.cameras.main.scrollX = targetX - this.scene.cameras.main.width / 2;
            this.scene.cameras.main.scrollY = surfaceStandingY - this.scene.cameras.main.height / 2;

            // Short pause, then smoothly rise up climbing from behind the well, popping out above the rim
            this.scene.time.delayedCall(120, () => {
                this.uiManager.spawnParticles(targetX, topY, 0x67E8F9);

                this.scene.tweens.add({
                    targets: this.player,
                    y: popOutPeakY,
                    duration: 650,
                    ease: 'Cubic.easeOut',
                    onUpdate: () => {
                        if (this.player && this.player.active) {
                            this.player.x = targetX;
                            this.player.setVelocity(0, 0);
                            // As soon as the player's bottom clears the well rim, bring to foreground
                            if (this.player.y <= surfaceStandingY) {
                                this.player.setDepth(5);
                            }
                        }
                    },
                    onComplete: () => {
                        if (this.player && this.player.active) {
                            this.player.x = targetX;
                            this.player.setDepth(5); // Foreground player depth
                            this.player.onTeleportComplete(); // Re-enables gravity and solid collision

                            // Water / dust emergence splash particles at well rim
                            this.uiManager.spawnParticles(targetX, topY, 0x38BDF8);
                            this.uiManager.spawnParticles(targetX - 8, topY, 0xFFFFFF);
                            this.uiManager.spawnParticles(targetX + 8, topY, 0xFFFFFF);

                            // Activate Checkpoint 2 (with safe spawn standing on top of well)
                            const cp2 = this.checkpoints.find(c => String(c.id) === '2');
                            if (cp2) {
                                this.activateCheckpoint(cp2);
                            } else {
                                this.player.spawnX = targetX;
                                this.player.spawnY = surfaceStandingY;
                                this.player.activeSpawnX = targetX;
                                this.player.activeSpawnY = surfaceStandingY;
                                this.player.lastSafeX = targetX;
                                this.player.lastSafeY = surfaceStandingY;
                                this.scene.events.emit('checkpoint-saved');
                            }
                        }
                    }
                });
            });
            }
        }

        // Handle Gun Disarm Zones
        if (this.player.hasGun || this.inventoryManager.gunCount > 0) {
            for (const zone of this.disarmZones) {
                if (Phaser.Geom.Intersects.RectangleToRectangle(pBounds, zone.getBounds())) {
                    this.inventoryManager.disarmGun();
                    this.uiManager.showFloatingText(this.player.x, this.player.y - 20, 'GUN DISARMED', '#00FFFF');
                    this.uiManager.spawnParticles(this.player.x, this.player.y, 0x00FFFF);
                    this.scene.cameras.main.shake(150, 0.005);
                    break;
                }
            }
        }

        // Handle Smash Triggers
        let touchingTrigger = false;
        this.smashTriggers.forEach(zone => {
            if (zone.getData('used')) return;
            const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
            if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, zone.getBounds())) {
                touchingTrigger = true;
                zone.setData('used', true);
            }
        });

        if (touchingTrigger) {
            this.player.canSmash = true;
        } else if (this.player.canSmash) {
            // If the fall is stopped anyhow before reaching the bridge:
            // e.g. landed on ground/platform, velocity reversed (jumped/bounced), teleporting, or dying
            const isFalling = pBody.velocity.y > 0;
            const landedElsewhere = (pBody.blocked.down || pBody.touching.down || this.player.isOnPlatform) && !this.isPlayerTouchingBridge();

            if (!isFalling || landedElsewhere || this.player.isDying || this.player.isTeleporting) {
                this.player.canSmash = false;
            }
        }

        // Proactive check: if player is falling downwards through/into any bridge zone WITH canSmash
        if (pBody.velocity.y > 0 && this.player.canSmash) {
            for (const bridge of this.bridges) {
                if (!bridge.broken && bridge.sprite && bridge.sprite.active) {
                    const b = bridge.sprite.getBounds();
                    const pRect = new Phaser.Geom.Rectangle(pBody.x, pBody.y, pBody.width, pBody.height);
                    const bridgeZone = new Phaser.Geom.Rectangle(b.x - 4, b.y - 10, b.width + 8, b.height + 20);
                    if (Phaser.Geom.Intersects.RectangleToRectangle(pRect, bridgeZone)) {
                        this.breakBridge(bridge);
                        this.player.canSmash = false;
                    }
                }
            }
        } 
    }

    public triggerRevealLayer(targetNameOrId?: string, isBoss: boolean = false) {
        const query = String(targetNameOrId || '').toLowerCase().trim();
        for (const reveal of this.revealTileLayers) {
            const rName = reveal.name.toLowerCase();
            const rId = String(reveal.id || '').toLowerCase().trim();
            const match = (
                (query !== '' && (rName === query || rName.includes(query) || rId === query)) ||
                (isBoss && (rName.includes('boss') || rName.includes('dungeon') || rName.includes('fill')))
            );

            if (match && !reveal.revealed) {
                reveal.revealed = true;
                reveal.layer.setVisible(true);
                reveal.layer.setAlpha(1);
                if (reveal.collider) {
                    reveal.collider.active = true;
                }
                console.log(`[EnvironmentManager] Revealed layer '${reveal.name}' (id: ${reveal.id})`);
            }
        }
    }

    public saveCheckpointSnapshot() {
        for (const reveal of this.revealTileLayers) {
            reveal.snapshotRevealed = reveal.revealed;
        }
        for (const bridge of this.bridges) {
            bridge.snapshotBroken = bridge.broken;
        }
        this.smashTriggers.forEach(z => z.setData('snapshotUsed', z.getData('used') || false));
    }

    public rollbackToCheckpoint() {
        for (const reveal of this.revealTileLayers) {
            if (reveal.keepRevealed && reveal.revealed) {
                reveal.layer.setVisible(true);
                reveal.layer.setAlpha(1);
                if (reveal.collider) reveal.collider.active = true;
            } else {
                reveal.revealed = reveal.snapshotRevealed;
                reveal.layer.setVisible(reveal.revealed);
                reveal.layer.setAlpha(reveal.revealed ? 1 : 0);
                if (reveal.collider) reveal.collider.active = reveal.revealed;
            }
        }

        this.player.canSmash = false;
        this.smashTriggers.forEach(z => z.setData('used', z.getData('snapshotUsed') || false));

        for (const bridge of this.bridges) {
            bridge.broken = bridge.snapshotBroken;
            const sprite = bridge.sprite;
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            if (bridge.broken) {
                sprite.setVisible(false);
                sprite.setAlpha(0);
                if (body) body.enable = false;
            } else {
                this.scene.tweens.killTweensOf(sprite);
                sprite.setVisible(true);
                sprite.setAlpha(1);
                sprite.setFrame(0);
                if (body) body.enable = true;
            }
        }
    }

    resetAll() {
        this.player.canSmash = false;
        this.smashTriggers.forEach(z => {
            z.setData('used', false);
            z.setData('snapshotUsed', false);
        });

        for (const trigger of this.revealTriggers) {
            trigger.activated = false;
        }

        for (const reveal of this.revealTileLayers) {
            reveal.revealed = reveal.initialRevealed;
            reveal.snapshotRevealed = reveal.initialRevealed;
            reveal.layer.setVisible(reveal.revealed);
            reveal.layer.setAlpha(reveal.revealed ? 1 : 0);
            if (reveal.collider) {
                reveal.collider.active = reveal.revealed;
            }
        }

        for (const bridge of this.bridges) {
            bridge.broken = false;
            bridge.snapshotBroken = false;
            const sprite = bridge.sprite;
            const body = sprite.body as Phaser.Physics.Arcade.Body;
            this.scene.tweens.killTweensOf(sprite);
            sprite.setVisible(true);
            sprite.setAlpha(1);
            sprite.setFrame(0);
            if (body) body.enable = true;
        }

        this.movingPlatforms.forEach(plat => {
            const startX = plat.getData('startX') as number;
            const platSpeed = plat.getData('speed') as number;
            const initDir = (plat.getData('initialDirection') as number) || 1;
            plat.setPosition(startX, plat.y);
            (plat.body as Phaser.Physics.Arcade.Body).setVelocityX(platSpeed * initDir);
        });
    }

    resetCheckpoints() {
        this.checkpoints.forEach(cp => {
            cp.activated = false;
            if (cp.sprite) {
                cp.sprite.setVisible(false);
            }
        });
    }
}
