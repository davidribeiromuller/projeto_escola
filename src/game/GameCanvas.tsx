/**
 * Core 2D Pixel Art Canvas Game Component
 * Renders the top-down retro school, players, Antonio stalker, lighting, and sound waves.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  generateSchoolMap,
  INITIAL_INTERACTIVE_ITEMS,
  InteractiveItem,
  MAP_COLS,
  MAP_ROWS,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
  TileType,
  SCHOOL_ZONES,
} from './mapData';
import { SpriteRegistry } from './spriteGenerator';
import { AntonioAI, AntonioState } from './antonioAI';
import { lightingSystem, LightSource } from './lightingSystem';
import { audioSystem } from '../services/audioSystem';
import { noiseSystem, NoiseEvent } from '../services/noiseSystem';
import { multiplayerService, RemotePlayer, MissionStateNetwork } from '../services/multiplayer';

interface GameCanvasProps {
  playerIndex: 1 | 2;
  playerName: string;
  isHost: boolean;
  onExitToMenu: () => void;
  onGameOver: (reason: string) => void;
  onVictory: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  playerIndex,
  playerName,
  isHost,
  onExitToMenu,
  onGameOver,
  onVictory,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Game World State
  const [map] = useState<number[][]>(() => generateSchoolMap());
  const [items, setItems] = useState<InteractiveItem[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_INTERACTIVE_ITEMS))
  );

  // Local Player State
  const playerRef = useRef({
    x: playerIndex === 1 ? 22 * TILE_SIZE : 24 * TILE_SIZE,
    y: 33 * TILE_SIZE,
    facing: 'up' as 'up' | 'down' | 'left' | 'right',
    isMoving: false,
    isRunning: false,
    isHiding: false,
    hidingSpotId: null as string | null,
    isDowned: false,
    stamina: 100, // 0 - 100
    walkFrame: 0,
    heldItem: null as string | null, // e.g. 'book_1', 'fuse_1'
    collectedClues: [] as string[],
    reviveProgress: 0,
    gateProgressHold: 0,
    _eDebounce: false,
  });

  // Remote Player State
  const remotePlayerRef = useRef<RemotePlayer | null>(null);

  // Antonio AI State
  const antonioAIRef = useRef<AntonioAI>(new AntonioAI());
  const remoteAntonioRef = useRef<{
    x: number;
    y: number;
    state: AntonioState;
    facing: 'up' | 'down' | 'left' | 'right';
  }>({
    x: 23 * TILE_SIZE,
    y: 30 * TILE_SIZE,
    state: 'PATROL',
    facing: 'down',
  });

  // Missions & Objectives State
  const [missionState, setMissionState] = useState<MissionStateNetwork>({
    booksCollected: 0,
    booksRequired: 3,
    fusesInstalled: 0,
    fusesRequired: 3,
    passwordCluesFound: 0,
    passwordEntered: false,
    mainGateProgress: 0,
  });

  // Room Lights & Powered wings
  const [roomLights, setRoomLights] = useState<LightSource[]>([
    { x: 23 * TILE_SIZE, y: 32 * TILE_SIZE, radius: 100, intensity: 0.6, flicker: true },
    { x: 23 * TILE_SIZE, y: 18 * TILE_SIZE, radius: 90, intensity: 0.5, flicker: true },
    { x: 9 * TILE_SIZE, y: 11 * TILE_SIZE, radius: 80, intensity: 0.4, flicker: false },
    { x: 38 * TILE_SIZE, y: 10 * TILE_SIZE, radius: 85, intensity: 0.5, flicker: false },
  ]);

  // Keys Ref
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastStepSoundTime = useRef<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [currentZone, setCurrentZone] = useState<string>('Entrada Principal');
  const [partnerDowned, setPartnerDowned] = useState<boolean>(false);
  const [noiseLevel, setNoiseLevel] = useState<number>(0); // 0 to 100 for HUD gauge
  const [staminaLevel, setStaminaLevel] = useState<number>(100);

  // Match Timer (15 minutes = 900s)
  const [timeRemaining, setTimeRemaining] = useState<number>(900);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Custom frame file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sound and Sprite Setup
  useEffect(() => {
    audioSystem.startAmbientLoop();
    return () => {
      audioSystem.stopAmbient();
    };
  }, []);

  // Keyboard Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      keysRef.current[code] = true;

      if (e.key === 'Escape') {
        setIsPaused((p) => !p);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code.toLowerCase();
      keysRef.current[code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Multiplayer Listeners
  useEffect(() => {
    const onRemotePlayerUpdate = (data: any) => {
      remotePlayerRef.current = {
        id: data.id,
        playerIndex: data.playerIndex,
        x: data.x,
        y: data.y,
        facing: data.facing,
        isMoving: data.isMoving,
        isRunning: data.isRunning,
        isHiding: data.isHiding,
        hidingSpotId: data.hidingSpotId,
        isDowned: data.isDowned,
      };
      setPartnerDowned(data.isDowned);
    };

    const onSoundBroadcast = (data: any) => {
      noiseSystem.emitNoise(data.x, data.y, data.category, data.sourcePlayerId);
    };

    const onAntonioUpdate = (data: any) => {
      if (!isHost) {
        remoteAntonioRef.current = data.antonio;
      }
    };

    const onMissionUpdate = (data: any) => {
      setMissionState(data.missionState);
    };

    const onPlayerDownedEvent = (data: any) => {
      if (data.downedPlayerId !== multiplayerService.playerId) {
        setPartnerDowned(true);
      }
    };

    const onPlayerRevivedEvent = (data: any) => {
      if (data.revivedPlayerId === multiplayerService.playerId) {
        playerRef.current.isDowned = false;
      } else {
        setPartnerDowned(false);
      }
    };

    const onMatchEnded = (data: any) => {
      if (data.reason === 'VICTORY') {
        onVictory();
      } else {
        onGameOver(data.message || 'Vocês foram capturados!');
      }
    };

    multiplayerService.on('REMOTE_PLAYER_UPDATE', onRemotePlayerUpdate);
    multiplayerService.on('SOUND_BROADCAST', onSoundBroadcast);
    multiplayerService.on('ANTONIO_UPDATE', onAntonioUpdate);
    multiplayerService.on('MISSION_STATE_UPDATE', onMissionUpdate);
    multiplayerService.on('PLAYER_DOWNED_EVENT', onPlayerDownedEvent);
    multiplayerService.on('PLAYER_REVIVED_EVENT', onPlayerRevivedEvent);
    multiplayerService.on('MATCH_ENDED', onMatchEnded);

    return () => {
      multiplayerService.off('REMOTE_PLAYER_UPDATE', onRemotePlayerUpdate);
      multiplayerService.off('SOUND_BROADCAST', onSoundBroadcast);
      multiplayerService.off('ANTONIO_UPDATE', onAntonioUpdate);
      multiplayerService.off('MISSION_STATE_UPDATE', onMissionUpdate);
      multiplayerService.off('PLAYER_DOWNED_EVENT', onPlayerDownedEvent);
      multiplayerService.off('PLAYER_REVIVED_EVENT', onPlayerRevivedEvent);
      multiplayerService.off('MATCH_ENDED', onMatchEnded);
    };
  }, [isHost, onGameOver, onVictory]);

  // Match 15:00 Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onGameOver('O tempo da escola esgotou! A escola foi trancada para sempre.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onGameOver]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let networkSyncTimer = 0;

    const sprites = SpriteRegistry.getInstance();
    const antonioAI = antonioAIRef.current;

    const gameLoop = (currentTime: number) => {
      const deltaMs = Math.min(currentTime - lastTime, 100);
      lastTime = currentTime;

      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(gameLoop);
        return;
      }

      ctx.imageSmoothingEnabled = false;

      const p = playerRef.current;
      const remote = remotePlayerRef.current;
      const keys = keysRef.current;

      // 1. Process Local Player Input & Movement
      if (!p.isDowned && !p.isHiding && !isPaused) {
        let dx = 0;
        let dy = 0;

        if (keys['keyw'] || keys['arrowup']) dy -= 1;
        if (keys['keys'] || keys['arrowdown']) dy += 1;
        if (keys['keya'] || keys['arrowleft']) dx -= 1;
        if (keys['keyd'] || keys['arrowright']) dx += 1;

        const isRunning = (keys['shiftleft'] || keys['shiftright']) && p.stamina > 10 && (dx !== 0 || dy !== 0);
        p.isRunning = isRunning;

        // Stamina management
        if (isRunning) {
          p.stamina = Math.max(0, p.stamina - (deltaMs / 1000) * 25);
        } else {
          p.stamina = Math.min(100, p.stamina + (deltaMs / 1000) * 16);
        }
        setStaminaLevel(Math.round(p.stamina));

        const speed = isRunning ? 160 : 92;

        if (dx !== 0 || dy !== 0) {
          p.isMoving = true;
          const length = Math.hypot(dx, dy);
          const vx = (dx / length) * speed * (deltaMs / 1000);
          const vy = (dy / length) * speed * (deltaMs / 1000);

          if (Math.abs(dx) > Math.abs(dy)) {
            p.facing = dx > 0 ? 'right' : 'left';
          } else {
            p.facing = dy > 0 ? 'down' : 'up';
          }

          // Wall Collision Checking
          const newX = p.x + vx;
          const newY = p.y + vy;

          if (!isSolid(newX, p.y, map)) p.x = newX;
          if (!isSolid(p.x, newY, map)) p.y = newY;

          // Sound emission on steps
          const stepInterval = isRunning ? 280 : 440;
          if (currentTime - lastStepSoundTime.current > stepInterval) {
            lastStepSoundTime.current = currentTime;
            p.walkFrame = (p.walkFrame + 1) % 4;

            // Audio synth
            audioSystem.playFootstep(isRunning);

            // Emit noise wave
            const noise = noiseSystem.emitNoise(
              p.x,
              p.y,
              isRunning ? 'run' : 'walk',
              multiplayerService.playerId
            );
            multiplayerService.sendSoundEmitted(
              p.x,
              p.y,
              noise.intensity,
              noise.radius,
              noise.category
            );
            setNoiseLevel(isRunning ? 85 : 30);
          }
        } else {
          p.isMoving = false;
          setNoiseLevel(0);
        }
      } else {
        p.isMoving = false;
        setNoiseLevel(0);
      }

      // Check current zone name
      const playerTileX = Math.floor(p.x / TILE_SIZE);
      const playerTileY = Math.floor(p.y / TILE_SIZE);
      const activeZone = SCHOOL_ZONES.find(
        (z) =>
          playerTileX >= z.x1 &&
          playerTileX <= z.x2 &&
          playerTileY >= z.y1 &&
          playerTileY <= z.y2
      );
      if (activeZone && activeZone.name !== currentZone) {
        setCurrentZone(activeZone.name);
      }

      // 2. Interaction Checks [E]
      const nearbyItem = items.find((item) => {
        const dist = Math.hypot(p.x - (item.x + item.width / 2), p.y - (item.y + item.height / 2));
        return dist < 42;
      });

      // Teammate revive check
      const distToRemote = remote
        ? Math.hypot(p.x - remote.x, p.y - remote.y)
        : Infinity;
      const canReviveTeammate = remote && remote.isDowned && distToRemote < 50;

      if (canReviveTeammate) {
        setCurrentPrompt('Segure [E] para reanimar seu parceiro');
        if (keys['keye']) {
          p.reviveProgress += (deltaMs / 1000) * 40;
          if (p.reviveProgress >= 100) {
            p.reviveProgress = 0;
            multiplayerService.sendPlayerRevived(remote.id);
            audioSystem.playItemPickup();
          }
        } else {
          p.reviveProgress = 0;
        }
      } else if (nearbyItem) {
        if (nearbyItem.type === 'locker') {
          setCurrentPrompt(p.isHiding ? 'Pressione [E] para sair do armário' : 'Pressione [E] para esconder-se');
        } else if (nearbyItem.type === 'book' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] para pegar ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'book_drop') {
          setCurrentPrompt(
            p.heldItem?.startsWith('book')
              ? 'Pressione [E] para devolver livro à estante'
              : `Estante da Biblioteca (${missionState.booksCollected}/3 livros devolvidos)`
          );
        } else if (nearbyItem.type === 'fuse' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] para pegar ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'fuse_box' && !nearbyItem.completed) {
          setCurrentPrompt(
            p.heldItem?.startsWith('fuse')
              ? 'Pressione [E] para instalar fusível no quadro'
              : 'Painel elétrico sem fusível'
          );
        } else if (nearbyItem.type === 'clue' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] para ler ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'computer') {
          setCurrentPrompt(
            missionState.passwordEntered
              ? 'Terminal Desbloqueado - Trava de emergência liberada!'
              : p.collectedClues.length >= 3
              ? 'Pressione [E] para digitar a senha completa'
              : `Terminal da Diretoria (Pistas: ${p.collectedClues.length}/3)`
          );
        } else if (nearbyItem.type === 'main_gate') {
          const allMissionsDone =
            missionState.booksCollected >= 3 &&
            missionState.fusesInstalled >= 3 &&
            missionState.passwordEntered;
          if (!allMissionsDone) {
            setCurrentPrompt('Portão trancado por correntes! Complete as missões primeiro.');
          } else {
            setCurrentPrompt(
              `Segure [E] para forçar o portão de saída! (${Math.round(missionState.mainGateProgress)}%)`
            );
          }
        }
      } else {
        setCurrentPrompt(null);
      }

      // Handle Key E Press
      if (keys['keye'] && !p.isDowned) {
        if (nearbyItem) {
          if (nearbyItem.type === 'locker' && !p._eDebounce) {
            p._eDebounce = true;
            p.isHiding = !p.isHiding;
            p.hidingSpotId = p.isHiding ? nearbyItem.id : null;
            audioSystem.playLocker(p.isHiding);
            const noise = noiseSystem.emitNoise(p.x, p.y, 'door', multiplayerService.playerId);
            multiplayerService.sendSoundEmitted(p.x, p.y, noise.intensity, noise.radius, 'door');
          } else if (nearbyItem.type === 'book' && !nearbyItem.collected && !p.heldItem) {
            nearbyItem.collected = true;
            p.heldItem = nearbyItem.id;
            audioSystem.playItemPickup();
            setItems([...items]);
          } else if (nearbyItem.type === 'book_drop' && p.heldItem?.startsWith('book') && !p._eDebounce) {
            p._eDebounce = true;
            p.heldItem = null;
            audioSystem.playItemPickup();
            multiplayerService.sendMissionAction('BOOK_DELIVERED');
          } else if (nearbyItem.type === 'fuse' && !nearbyItem.collected && !p.heldItem) {
            nearbyItem.collected = true;
            p.heldItem = nearbyItem.id;
            audioSystem.playItemPickup();
            setItems([...items]);
          } else if (nearbyItem.type === 'fuse_box' && p.heldItem?.startsWith('fuse') && !nearbyItem.completed && !p._eDebounce) {
            p._eDebounce = true;
            p.heldItem = null;
            nearbyItem.completed = true;
            audioSystem.playFuseEngage();
            const noise = noiseSystem.emitNoise(p.x, p.y, 'fuse', multiplayerService.playerId);
            multiplayerService.sendSoundEmitted(p.x, p.y, noise.intensity, noise.radius, 'fuse');
            multiplayerService.sendMissionAction('FUSE_INSTALLED');
            // Add light
            setRoomLights((prev) => [
              ...prev,
              { x: nearbyItem.x, y: nearbyItem.y, radius: 140, intensity: 0.7, flicker: false },
            ]);
          } else if (nearbyItem.type === 'clue' && !nearbyItem.collected) {
            nearbyItem.collected = true;
            if (nearbyItem.codeFragment) {
              p.collectedClues.push(nearbyItem.codeFragment);
            }
            audioSystem.playItemPickup();
            setItems([...items]);
          } else if (nearbyItem.type === 'computer' && !missionState.passwordEntered && p.collectedClues.length >= 3 && !p._eDebounce) {
            p._eDebounce = true;
            audioSystem.playItemPickup();
            multiplayerService.sendMissionAction('PASSWORD_SOLVED');
          } else if (nearbyItem.type === 'main_gate') {
            const allMissionsDone =
              missionState.booksCollected >= 3 &&
              missionState.fusesInstalled >= 3 &&
              missionState.passwordEntered;
            if (allMissionsDone) {
              p.gateProgressHold += (deltaMs / 1000) * 12;
              audioSystem.playGateProgress();
              multiplayerService.sendMissionAction('GATE_PROGRESS', (deltaMs / 1000) * 12);
            }
          }
        }
      } else {
        (p as any)._eDebounce = false;
      }

      // 3. Update Antonio AI (Authoritative on Host, Synced to Guest)
      noiseSystem.update();

      let activeAntonioX = antonioAI.x;
      let activeAntonioY = antonioAI.y;
      let activeAntonioFacing = antonioAI.facing;
      let activeAntonioState = antonioAI.state;

      if (isHost) {
        // Build targets array
        const targets = [
          {
            id: multiplayerService.playerId,
            x: p.x,
            y: p.y,
            isHiding: p.isHiding,
            isDowned: p.isDowned,
          },
        ];
        if (remote) {
          targets.push({
            id: remote.id,
            x: remote.x,
            y: remote.y,
            isHiding: remote.isHiding,
            isDowned: remote.isDowned,
          });
        }

        const heardNoise = noiseSystem.checkHearing(antonioAI.x, antonioAI.y);
        antonioAI.update(deltaMs, targets, map, heardNoise);

        activeAntonioX = antonioAI.x;
        activeAntonioY = antonioAI.y;
        activeAntonioFacing = antonioAI.facing;
        activeAntonioState = antonioAI.state;

        // Check capture collision with local host player
        if (!p.isHiding && !p.isDowned) {
          const distToP = Math.hypot(p.x - antonioAI.x, p.y - antonioAI.y);
          if (distToP < 28) {
            p.isDowned = true;
            multiplayerService.sendPlayerDowned();
            audioSystem.playChaseAlert();
          }
        }
      } else {
        // Guest uses synchronized Antonio
        activeAntonioX = remoteAntonioRef.current.x;
        activeAntonioY = remoteAntonioRef.current.y;
        activeAntonioFacing = remoteAntonioRef.current.facing;
        activeAntonioState = remoteAntonioRef.current.state;

        // Check capture collision with guest player
        if (!p.isHiding && !p.isDowned) {
          const distToP = Math.hypot(p.x - activeAntonioX, p.y - activeAntonioY);
          if (distToP < 28) {
            p.isDowned = true;
            multiplayerService.sendPlayerDowned();
            audioSystem.playChaseAlert();
          }
        }
      }

      // Dynamic Heartbeat sound based on Antonio distance
      const distToAntonio = Math.hypot(p.x - activeAntonioX, p.y - activeAntonioY);
      audioSystem.setHeartbeatProximity(distToAntonio, 420);

      // 4. Network Sync (30 times/sec throttled)
      networkSyncTimer += deltaMs;
      if (networkSyncTimer >= 40) {
        networkSyncTimer = 0;
        multiplayerService.sendPlayerSync(
          p.x,
          p.y,
          p.facing,
          p.isMoving,
          p.isRunning,
          p.isHiding,
          p.hidingSpotId,
          p.isDowned
        );

        if (isHost) {
          multiplayerService.sendAntonioHostSync(
            antonioAI.x,
            antonioAI.y,
            antonioAI.state,
            antonioAI.facing,
            antonioAI.targetX,
            antonioAI.targetY
          );
        }
      }

      // 5. CAMERA CENTERING
      const screenWidth = canvas.width;
      const screenHeight = canvas.height;
      let cameraX = p.x - screenWidth / 2;
      let cameraY = p.y - screenHeight / 2;

      // Clamp camera
      cameraX = Math.max(0, Math.min(MAP_WIDTH - screenWidth, cameraX));
      cameraY = Math.max(0, Math.min(MAP_HEIGHT - screenHeight, cameraY));

      // 6. RENDER BACKGROUND & MAP TILES
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, screenWidth, screenHeight);

      const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
      const endCol = Math.min(MAP_COLS - 1, Math.ceil((cameraX + screenWidth) / TILE_SIZE));
      const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
      const endRow = Math.min(MAP_ROWS - 1, Math.ceil((cameraY + screenHeight) / TILE_SIZE));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = map[r][c];
          const tx = c * TILE_SIZE - cameraX;
          const ty = r * TILE_SIZE - cameraY;

          let texKey = 'floor_tile';
          if (tile === TileType.FLOOR_WOOD) texKey = 'floor_wood';
          else if (tile === TileType.FLOOR_CARPET) texKey = 'floor_carpet';
          else if (tile === TileType.WALL_SOLID || tile === TileType.WALL_BORDER) texKey = 'wall_solid';

          const tex = sprites.tileTextures.get(texKey);
          if (tex) {
            ctx.drawImage(tex, tx, ty);
          } else {
            ctx.fillStyle = tile === TileType.WALL_SOLID ? '#0f172a' : '#1e293b';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // 7. RENDER INTERACTIVE ITEMS
      items.forEach((item) => {
        if (item.collected) return;
        const ix = item.x - cameraX;
        const iy = item.y - cameraY;

        if (ix > -60 && ix < screenWidth + 60 && iy > -60 && iy < screenHeight + 60) {
          const itemTex = sprites.itemTextures.get(item.type);
          if (itemTex) {
            ctx.drawImage(itemTex, ix, iy);
          } else {
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(ix, iy, item.width, item.height);
          }

          // Subtle pulse ring for uncollected quest items
          if (item.type === 'book' || item.type === 'fuse' || item.type === 'clue') {
            const pulse = (Math.sin(Date.now() / 200) + 1) * 2;
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(ix - pulse, iy - pulse, item.width + pulse * 2, item.height + pulse * 2);
          }
        }
      });

      // 8. RENDER NOISE RIPPLES (Sonic waves expanding on floor)
      const noises = noiseSystem.getActiveNoises();
      noises.forEach((noise) => {
        const nx = noise.x - cameraX;
        const ny = noise.y - cameraY;
        const progress = (Date.now() - noise.createdAt) / noise.duration; // 0 to 1
        if (progress >= 1) return;

        const currentRadius = noise.radius * progress;
        const alpha = (1 - progress) * 0.45;

        ctx.strokeStyle =
          noise.intensity === 'high' || noise.intensity === 'critical'
            ? `rgba(239, 68, 68, ${alpha})`
            : `rgba(96, 165, 250, ${alpha})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(nx, ny, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 9. RENDER REMOTE PLAYER
      if (remote && !remote.isHiding) {
        const rx = remote.x - cameraX;
        const ry = remote.y - cameraY;
        const remoteSprites = remote.playerIndex === 1 ? sprites.player1Sprites : sprites.player2Sprites;
        const animKey = remote.isMoving ? (remote.isRunning ? 'run' : 'walk') : 'idle';
        const frameIndex = remote.isMoving ? p.walkFrame % (remoteSprites[remote.facing]?.[animKey]?.length || 1) : 0;
        const spriteFrame = remoteSprites[remote.facing]?.[animKey]?.[frameIndex];

        if (spriteFrame) {
          if (remote.isDowned) {
            // Downed: rotated / fallen
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(spriteFrame.canvas, -16, -16);
            ctx.restore();

            // Help icon
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('SOCORRO!', rx - 24, ry - 22);
          } else {
            ctx.drawImage(spriteFrame.canvas, rx - 16, ry - 16);
          }
        }
      }

      // 10. RENDER LOCAL PLAYER
      if (!p.isHiding) {
        const px = p.x - cameraX;
        const py = p.y - cameraY;
        const localSprites = playerIndex === 1 ? sprites.player1Sprites : sprites.player2Sprites;
        const animKey = p.isMoving ? (p.isRunning ? 'run' : 'walk') : 'idle';
        const frameIndex = p.isMoving ? p.walkFrame % (localSprites[p.facing]?.[animKey]?.length || 1) : 0;
        const spriteFrame = localSprites[p.facing]?.[animKey]?.[frameIndex];

        if (spriteFrame) {
          if (p.isDowned) {
            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(spriteFrame.canvas, -16, -16);
            ctx.restore();
          } else {
            ctx.drawImage(spriteFrame.canvas, px - 16, py - 16);
          }
        }
      }

      // 11. RENDER ANTÔNIO (THE STALKER)
      const ax = activeAntonioX - cameraX;
      const ay = activeAntonioY - cameraY;
      const customImg = sprites.getCustomAntonioImage();

      if (customImg) {
        // If user loaded custom frames
        ctx.drawImage(customImg, ax - 18, ay - 21, 36, 42);
      } else {
        const aSprites = sprites.antonioSprites;
        const aFacing = (activeAntonioFacing || 'down') as 'up' | 'down' | 'left' | 'right';
        const isAChasing = activeAntonioState === 'CHASE';
        const aAnim = isAChasing ? 'run' : 'walk';
        const aFrameIdx = p.walkFrame % (aSprites[aFacing]?.[aAnim]?.length || 1);
        const aFrame = aSprites[aFacing]?.[aAnim]?.[aFrameIdx] || aSprites[aFacing]?.idle?.[0];

        if (aFrame) {
          ctx.drawImage(aFrame.canvas, ax - 18, ay - 21);
        }
      }

      // Red Stalker Alert Indicator when chasing or searching
      if (activeAntonioState === 'CHASE') {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('!', ax - 3, ay - 26);
      } else if (activeAntonioState === 'HEARD_NOISE' || activeAntonioState === 'SEARCH') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('?', ax - 3, ay - 26);
      }

      // 12. DYNAMIC LIGHTING MASK & WALL SHADOWS
      lightingSystem.renderLighting(
        ctx,
        screenWidth,
        screenHeight,
        cameraX,
        cameraY,
        p.x,
        p.y,
        p.isHiding,
        activeAntonioX,
        activeAntonioY,
        activeAntonioFacing,
        activeAntonioState === 'CHASE',
        roomLights,
        map
      );

      // Loop continues
      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [items, map, playerIndex, isHost, isPaused, missionState, currentZone]);

  const handleCustomFramesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          SpriteRegistry.getInstance().setCustomAntonioFrames(img);
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const isSolid = (px: number, py: number, currentMap: number[][]) => {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);
    if (row < 0 || row >= currentMap.length || col < 0 || col >= currentMap[0].length) {
      return true;
    }
    const t = currentMap[row][col];
    return (
      t === TileType.WALL_SOLID ||
      t === TileType.WALL_BORDER ||
      t === TileType.OBSTACLE_DESK ||
      t === TileType.OBSTACLE_SHELF
    );
  };

  // Format mm:ss
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none font-mono text-white">
      {/* 2D Canvas */}
      <canvas
        ref={canvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        className="w-full h-full block cursor-crosshair"
      />

      {/* TOP HUD BAR */}
      <div className="absolute top-4 left-4 right-4 flex items-start justify-between pointer-events-none z-20">
        {/* Objectives Box */}
        <div className="bg-black/80 border border-neutral-700/80 p-3 rounded shadow-2xl backdrop-blur-sm max-w-sm">
          <div className="text-xs uppercase tracking-wider text-amber-400 font-bold mb-2 flex items-center justify-between">
            <span>OBJETIVOS</span>
            <span className="text-[10px] text-neutral-400">{currentZone}</span>
          </div>
          <ul className="text-xs space-y-1.5">
            <li className={`flex items-center gap-2 ${missionState.booksCollected >= 3 ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.booksCollected >= 3 ? '☑' : '☐'}</span>
              <span>Devolver os 3 livros na Biblioteca ({missionState.booksCollected}/3)</span>
            </li>
            <li className={`flex items-center gap-2 ${missionState.fusesInstalled >= 3 ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.fusesInstalled >= 3 ? '☑' : '☐'}</span>
              <span>Restaurar fusíveis dos disjuntores ({missionState.fusesInstalled}/3)</span>
            </li>
            <li className={`flex items-center gap-2 ${missionState.passwordEntered ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.passwordEntered ? '☑' : '☐'}</span>
              <span>Desbloquear terminal da Secretaria ({playerRef.current.collectedClues.length}/3 pistas)</span>
            </li>
            <li className={`flex items-center gap-2 font-bold ${missionState.mainGateProgress >= 100 ? 'text-emerald-400' : missionState.booksCollected >= 3 && missionState.fusesInstalled >= 3 && missionState.passwordEntered ? 'text-amber-300 animate-pulse' : 'text-neutral-500'}`}>
              <span>{missionState.mainGateProgress >= 100 ? '☑' : '☐'}</span>
              <span>Escapar pelo Portão Principal ({Math.round(missionState.mainGateProgress)}%)</span>
            </li>
          </ul>
        </div>

        {/* Center Timer & Partner Status */}
        <div className="flex flex-col items-center gap-2">
          <div className={`px-4 py-1.5 rounded border ${timeRemaining <= 120 ? 'bg-red-950/80 border-red-500 text-red-400 animate-pulse' : 'bg-black/80 border-neutral-700 text-neutral-200'} font-bold tracking-widest text-lg shadow-xl`}>
            TEMPO {formatTimer(timeRemaining)}
          </div>

          {partnerDowned && (
            <div className="bg-red-900/90 text-red-200 text-xs px-3 py-1 rounded border border-red-600 animate-bounce">
              ⚠️ PARCEIRO CAPTURADO! Encontre-o e segure [E] para reanimar!
            </div>
          )}
        </div>

        {/* Right Audio & Custom Sprite Controls */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex items-center gap-2">
            <button
              onClick={() => audioSystem.toggleMute()}
              className="bg-neutral-900/80 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs px-2.5 py-1.5 rounded transition cursor-pointer"
            >
              {audioSystem.getIsMuted() ? '🔇 Mudo' : '🔊 Som'}
            </button>
            <button
              onClick={() => setIsPaused(true)}
              className="bg-neutral-900/80 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs px-2.5 py-1.5 rounded transition cursor-pointer"
            >
              Menu [ESC]
            </button>
          </div>

          {/* Stalker Custom Frames Injection button */}
          <div className="text-right">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleCustomFramesUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-neutral-400 hover:text-amber-300 underline bg-black/60 px-2 py-0.5 rounded cursor-pointer"
              title="Carregar imagem/frames personalizados de Antônio"
            >
              + Inserir Sprite do Perseguidor
            </button>
          </div>
        </div>
      </div>

      {/* BOTTOM HUD GAUGES (Stamina, Noise, Prompt) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20 pointer-events-none">
        {/* Interaction Prompt Box */}
        {currentPrompt && (
          <div className="bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs px-4 py-2 rounded shadow-2xl backdrop-blur-md animate-pulse font-bold">
            {currentPrompt}
          </div>
        )}

        {/* Status Meters */}
        <div className="flex items-center gap-6 bg-black/75 border border-neutral-800 px-4 py-2 rounded-full backdrop-blur-md">
          {/* Stamina Meter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Stamina [Shift]</span>
            <div className="w-24 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${staminaLevel}%` }}
              />
            </div>
          </div>

          {/* Noise Decibel Meter */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase font-semibold">Ruído</span>
            <div className="w-24 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
              <div
                className={`h-full transition-all duration-150 ${noiseLevel > 60 ? 'bg-red-500' : noiseLevel > 20 ? 'bg-amber-400' : 'bg-neutral-500'}`}
                style={{ width: `${noiseLevel}%` }}
              />
            </div>
          </div>

          {/* Inventory item */}
          {playerRef.current.heldItem && (
            <div className="text-[11px] text-amber-300 flex items-center gap-1">
              <span>Item:</span>
              <span className="bg-amber-900/60 px-2 py-0.5 rounded border border-amber-600/60 uppercase text-[10px]">
                {playerRef.current.heldItem.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* PAUSE / IN-GAME MENU MODAL */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-lg max-w-sm w-full text-center space-y-4">
            <h2 className="text-xl font-bold text-amber-400 tracking-wider">JOGO PAUSADO</h2>
            <div className="text-xs text-neutral-400 space-y-1.5 text-left border-y border-neutral-800 py-3">
              <p><strong className="text-neutral-200">WASD / Setas:</strong> Movimentação</p>
              <p><strong className="text-neutral-200">Shift:</strong> Correr (Atenção ao barulho!)</p>
              <p><strong className="text-neutral-200">E:</strong> Interagir / Esconder em Armários</p>
              <p><strong className="text-neutral-200">Silêncio:</strong> Evite correr próximo a Antônio</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => setIsPaused(false)}
                className="bg-amber-600 hover:bg-amber-500 text-black font-bold py-2 rounded text-sm transition cursor-pointer"
              >
                Continuar Partida
              </button>
              <button
                onClick={onExitToMenu}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 py-2 rounded text-sm transition cursor-pointer"
              >
                Voltar ao Menu Principal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
