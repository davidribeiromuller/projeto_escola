/**
 * Core 2D Pixel Art Canvas Game Component for "FUJA DA SOLANGE!!"
 * 
 * Features:
 * - Pre-Match Blueprint Map for 5-8 seconds
 * - Solange AI with A* Pathfinding starting strictly in Sala dos Professores
 * - Unified InputManager supporting both Keyboard and Tablet Virtual Controller
 * - Minimalist UI layout:
 *   - Top: "FUJA DA SOLANGE!!"
 *   - Top-Left: OBJETIVOS
 *   - Top-Right: TEMPO (14:32) + [Controlar pelo Tablet]
 *   - Bottom-Left: Estado do Jogador (Andando / Correndo / Escondido) + Estamina
 *   - Bottom-Right: MINIMAPA CIRCULAR (occluded by walls!)
 *   - Sound Pulse indicator ("Você está fazendo barulho")
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
  SOLANGE_INITIAL_SPAWN,
  PLAYER_SPAWNS,
} from './mapData';
import { SpriteRegistry } from './spriteGenerator';
import { SolangeAI, SolangeState } from './solangeAI';
import { lightingSystem, LightSource } from './lightingSystem';
import { audioSystem } from '../services/audioSystem';
import { noiseSystem, NoiseEvent } from '../services/noiseSystem';
import { multiplayerService, RemotePlayer, MissionStateNetwork } from '../services/multiplayer';
import { CircularMinimap } from './CircularMinimap';
import { PreMatchMapModal } from './PreMatchMapModal';
import { TabletPairingModal } from '../components/TabletPairingModal';
import { inputManager } from './InputManager';
import { Volume2, Smartphone } from 'lucide-react';

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

  // Pre-Match Map Screen State
  const [showPreMatchMap, setShowPreMatchMap] = useState<boolean>(true);

  // Tablet Pairing Modal State
  const [showTabletModal, setShowTabletModal] = useState<boolean>(false);
  const [controllerStatus, setControllerStatus] = useState<'OFFLINE' | 'ONLINE' | 'DISCONNECTED'>(
    multiplayerService.isControllerConnected ? 'ONLINE' : 'OFFLINE'
  );

  // Game World State
  const [map] = useState<number[][]>(() => generateSchoolMap());
  const [items, setItems] = useState<InteractiveItem[]>(() =>
    JSON.parse(JSON.stringify(INITIAL_INTERACTIVE_ITEMS))
  );

  // Initial Player Spawn: Player 1 = Sala 1; Player 2 = Refeitório
  const initialSpawn = PLAYER_SPAWNS[playerIndex - 1] || PLAYER_SPAWNS[0];

  // Local Player State
  const playerRef = useRef({
    x: initialSpawn.x,
    y: initialSpawn.y,
    facing: 'down' as 'up' | 'down' | 'left' | 'right',
    isMoving: false,
    isRunning: false,
    isHiding: false,
    hidingSpotId: null as string | null,
    isDowned: false,
    stamina: 100,
    walkFrame: 0,
    heldItem: null as string | null,
    collectedClues: [] as string[],
    reviveProgress: 0,
    gateProgressHold: 0,
    _eDebounce: false,
  });

  // Remote Player State
  const remotePlayerRef = useRef<RemotePlayer | null>(null);

  // Solange AI State
  const solangeAIRef = useRef<SolangeAI>(new SolangeAI());
  const remoteSolangeRef = useRef<{
    x: number;
    y: number;
    state: SolangeState;
    facing: 'up' | 'down' | 'left' | 'right';
  }>({
    x: SOLANGE_INITIAL_SPAWN.x,
    y: SOLANGE_INITIAL_SPAWN.y,
    state: 'PATROL',
    facing: 'down',
  });

  // Minimap Visibility State
  const [minimapState, setMinimapState] = useState({
    playerX: initialSpawn.x,
    playerY: initialSpawn.y,
    solangeX: SOLANGE_INITIAL_SPAWN.x,
    solangeY: SOLANGE_INITIAL_SPAWN.y,
    solangeVisible: false,
    remoteX: 0,
    remoteY: 0,
    remoteVisible: false,
    isHiding: false,
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

  // Dynamic Room Lights
  const [roomLights, setRoomLights] = useState<LightSource[]>([
    { x: 25 * TILE_SIZE, y: 38 * TILE_SIZE, radius: 110, intensity: 0.65, flicker: false },
    { x: 25 * TILE_SIZE, y: 16 * TILE_SIZE, radius: 120, intensity: 0.6, flicker: false },
    { x: 25 * TILE_SIZE, y: 9 * TILE_SIZE, radius: 95, intensity: 0.5, flicker: true },
    { x: 7 * TILE_SIZE, y: 4 * TILE_SIZE, radius: 85, intensity: 0.45, flicker: false },
    { x: 22 * TILE_SIZE, y: 27 * TILE_SIZE, radius: 85, intensity: 0.5, flicker: false },
  ]);

  const lastStepSoundTime = useRef<number>(0);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [currentZone, setCurrentZone] = useState<string>('Entrada Principal');
  const [partnerDowned, setPartnerDowned] = useState<boolean>(false);
  const [noiseLevel, setNoiseLevel] = useState<number>(0);
  const [staminaLevel, setStaminaLevel] = useState<number>(100);

  const [playerActionState, setPlayerActionState] = useState<string>('Parado');

  // Match Timer (15 minutes = 900s)
  const [timeRemaining, setTimeRemaining] = useState<number>(900);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  useEffect(() => {
    audioSystem.startAmbientLoop();
    return () => {
      audioSystem.stopAmbient();
    };
  }, []);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Multiplayer Listeners & Controller Input Routing
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

    const onSolangeUpdate = (data: any) => {
      if (!isHost) {
        remoteSolangeRef.current = data.solange || data.antonio;
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
        onGameOver(data.message || 'Solange pegou vocês no corredor!');
      }
    };

    // Remote Tablet Controller events
    const onControlConnected = () => {
      setControllerStatus('ONLINE');
    };

    const onControlDisconnected = () => {
      setControllerStatus('DISCONNECTED');
      inputManager.setRemoteDisconnected();
    };

    const onControlInput = (data: any) => {
      inputManager.setRemoteInput(data.dx, data.dy, data.run, data.interact, data.hide);
    };

    multiplayerService.on('REMOTE_PLAYER_UPDATE', onRemotePlayerUpdate);
    multiplayerService.on('SOUND_BROADCAST', onSoundBroadcast);
    multiplayerService.on('SOLANGE_UPDATE', onSolangeUpdate);
    multiplayerService.on('ANTONIO_UPDATE', onSolangeUpdate);
    multiplayerService.on('MISSION_STATE_UPDATE', onMissionUpdate);
    multiplayerService.on('PLAYER_DOWNED_EVENT', onPlayerDownedEvent);
    multiplayerService.on('PLAYER_REVIVED_EVENT', onPlayerRevivedEvent);
    multiplayerService.on('MATCH_ENDED', onMatchEnded);
    multiplayerService.on('CONTROL_CONNECTED', onControlConnected);
    multiplayerService.on('CONTROL_DISCONNECTED', onControlDisconnected);
    multiplayerService.on('CONTROL_INPUT', onControlInput);

    return () => {
      multiplayerService.off('REMOTE_PLAYER_UPDATE', onRemotePlayerUpdate);
      multiplayerService.off('SOUND_BROADCAST', onSoundBroadcast);
      multiplayerService.off('SOLANGE_UPDATE', onSolangeUpdate);
      multiplayerService.off('ANTONIO_UPDATE', onSolangeUpdate);
      multiplayerService.off('MISSION_STATE_UPDATE', onMissionUpdate);
      multiplayerService.off('PLAYER_DOWNED_EVENT', onPlayerDownedEvent);
      multiplayerService.off('PLAYER_REVIVED_EVENT', onPlayerRevivedEvent);
      multiplayerService.off('MATCH_ENDED', onMatchEnded);
      multiplayerService.off('CONTROL_CONNECTED', onControlConnected);
      multiplayerService.off('CONTROL_DISCONNECTED', onControlDisconnected);
      multiplayerService.off('CONTROL_INPUT', onControlInput);
    };
  }, [isHost, onGameOver, onVictory]);

  // Match 15:00 Timer
  useEffect(() => {
    if (showPreMatchMap) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onGameOver('O tempo acabou! A escola trancou as portas para sempre.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onGameOver, showPreMatchMap]);

  // Main 60 FPS Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    let networkSyncTimer = 0;
    let minimapSyncTimer = 0;

    const sprites = SpriteRegistry.getInstance();
    const solangeAI = solangeAIRef.current;

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

      // 1. Unified Input Processing (Keyboard OR Tablet Controller)
      const input = inputManager.getInputState();

      if (!p.isDowned && !p.isHiding && !isPaused && !showPreMatchMap) {
        const dx = input.dx;
        const dy = input.dy;

        const isRunning = input.isRunning && p.stamina > 10 && (dx !== 0 || dy !== 0);
        p.isRunning = isRunning;

        if (isRunning) {
          p.stamina = Math.max(0, p.stamina - (deltaMs / 1000) * 26);
        } else {
          p.stamina = Math.min(100, p.stamina + (deltaMs / 1000) * 16);
        }
        setStaminaLevel(Math.round(p.stamina));

        const speed = isRunning ? 165 : 90;

        if (dx !== 0 || dy !== 0) {
          p.isMoving = true;
          const vx = dx * speed * (deltaMs / 1000);
          const vy = dy * speed * (deltaMs / 1000);

          if (Math.abs(dx) > Math.abs(dy)) {
            p.facing = dx > 0 ? 'right' : 'left';
          } else {
            p.facing = dy > 0 ? 'down' : 'up';
          }

          const newX = p.x + vx;
          const newY = p.y + vy;

          if (!isSolid(newX, p.y, map)) p.x = newX;
          if (!isSolid(p.x, newY, map)) p.y = newY;

          // Steps noise
          const stepInterval = isRunning ? 260 : 430;
          if (currentTime - lastStepSoundTime.current > stepInterval) {
            lastStepSoundTime.current = currentTime;
            p.walkFrame = (p.walkFrame + 1) % 4;

            audioSystem.playFootstep(isRunning);

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
            setNoiseLevel(isRunning ? 90 : 35);
          }
        } else {
          p.isMoving = false;
          setNoiseLevel(0);
        }
      } else {
        p.isMoving = false;
        setNoiseLevel(0);
      }

      // HUD action state text
      if (p.isHiding) {
        setPlayerActionState('Escondido no Armário');
      } else if (p.isRunning && p.isMoving) {
        setPlayerActionState('Correndo (Ruidoso)');
      } else if (p.isMoving) {
        setPlayerActionState('Andando (Silencioso)');
      } else {
        setPlayerActionState('Parado');
      }

      // Zone name update
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

      // 2. Interaction Checks
      const nearbyItem = items.find((item) => {
        const dist = Math.hypot(p.x - (item.x + item.width / 2), p.y - (item.y + item.height / 2));
        return dist < 42;
      });

      const distToRemote = remote
        ? Math.hypot(p.x - remote.x, p.y - remote.y)
        : Infinity;
      const canReviveTeammate = remote && remote.isDowned && distToRemote < 50;

      if (canReviveTeammate) {
        setCurrentPrompt('Segure [E] / [INTERAGIR] para reanimar seu parceiro');
        if (input.isInteracting) {
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
          setCurrentPrompt(p.isHiding ? 'Pressione [E] / [INTERAGIR] para sair' : 'Pressione [E] / [INTERAGIR] para se esconder');
        } else if (nearbyItem.type === 'book' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] / [INTERAGIR] para pegar ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'book_drop') {
          setCurrentPrompt(
            p.heldItem?.startsWith('book')
              ? 'Pressione [E] / [INTERAGIR] para devolver livro à estante'
              : `Estante da Biblioteca (${missionState.booksCollected}/3 livros devolvidos)`
          );
        } else if (nearbyItem.type === 'fuse' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] / [INTERAGIR] para pegar ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'fuse_box' && !nearbyItem.completed) {
          setCurrentPrompt(
            p.heldItem?.startsWith('fuse')
              ? 'Pressione [E] / [INTERAGIR] para instalar fusível'
              : 'Painel elétrico sem fusível'
          );
        } else if (nearbyItem.type === 'clue' && !nearbyItem.collected) {
          setCurrentPrompt(`Pressione [E] / [INTERAGIR] para ler ${nearbyItem.label}`);
        } else if (nearbyItem.type === 'computer') {
          setCurrentPrompt(
            missionState.passwordEntered
              ? 'Terminal Desbloqueado - Saída liberada!'
              : p.collectedClues.length >= 3
              ? 'Pressione [E] / [INTERAGIR] para digitar a senha completa'
              : `Terminal da Diretoria (Pistas: ${p.collectedClues.length}/3)`
          );
        } else if (nearbyItem.type === 'main_gate') {
          const allMissionsDone =
            missionState.booksCollected >= 3 &&
            missionState.fusesInstalled >= 3 &&
            missionState.passwordEntered;
          if (!allMissionsDone) {
            setCurrentPrompt('Portão trancado por correntes! Complete todas as missões primeiro.');
          } else {
            setCurrentPrompt(
              `Segure [E] / [INTERAGIR] para forçar o portão! (${Math.round(missionState.mainGateProgress)}%)`
            );
          }
        }
      } else {
        setCurrentPrompt(null);
      }

      // Handle Interaction Press
      if (input.isInteracting && !p.isDowned && !showPreMatchMap) {
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
        p._eDebounce = false;
      }

      // 3. Update Solange AI
      noiseSystem.update();

      let activeSolangeX = solangeAI.x;
      let activeSolangeY = solangeAI.y;
      let activeSolangeFacing = solangeAI.facing;
      let activeSolangeState = solangeAI.state;

      if (isHost) {
        if (!showPreMatchMap) {
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

          const heardNoise = noiseSystem.checkHearing(solangeAI.x, solangeAI.y);
          solangeAI.update(deltaMs, targets, map, heardNoise);
        }

        activeSolangeX = solangeAI.x;
        activeSolangeY = solangeAI.y;
        activeSolangeFacing = solangeAI.facing;
        activeSolangeState = solangeAI.state;

        if (!p.isHiding && !p.isDowned && !showPreMatchMap) {
          const distToP = Math.hypot(p.x - solangeAI.x, p.y - solangeAI.y);
          if (distToP < 28) {
            p.isDowned = true;
            multiplayerService.sendPlayerDowned();
            audioSystem.playChaseAlert();
          }
        }
      } else {
        activeSolangeX = remoteSolangeRef.current.x;
        activeSolangeY = remoteSolangeRef.current.y;
        activeSolangeFacing = remoteSolangeRef.current.facing;
        activeSolangeState = remoteSolangeRef.current.state;

        if (!p.isHiding && !p.isDowned && !showPreMatchMap) {
          const distToP = Math.hypot(p.x - activeSolangeX, p.y - activeSolangeY);
          if (distToP < 28) {
            p.isDowned = true;
            multiplayerService.sendPlayerDowned();
            audioSystem.playChaseAlert();
          }
        }
      }

      // Dynamic Heartbeat based on distance to Solange
      const distToSolange = Math.hypot(p.x - activeSolangeX, p.y - activeSolangeY);
      audioSystem.setHeartbeatProximity(distToSolange, 420);

      // Line of sight check for Minimap (walls block view!)
      const distToS = Math.hypot(p.x - activeSolangeX, p.y - activeSolangeY);
      const isSolangeInSight = distToS <= 140 && !p.isHiding && solangeAI.hasClearLineOfSight(p.x, p.y, activeSolangeX, activeSolangeY, map);
      const isRemoteInSight = remote && !p.isHiding && !remote.isHiding && distToRemote <= 140 && solangeAI.hasClearLineOfSight(p.x, p.y, remote.x, remote.y, map);

      minimapSyncTimer += deltaMs;
      if (minimapSyncTimer >= 100) {
        minimapSyncTimer = 0;
        setMinimapState({
          playerX: p.x,
          playerY: p.y,
          solangeX: activeSolangeX,
          solangeY: activeSolangeY,
          solangeVisible: Boolean(isSolangeInSight),
          remoteX: remote ? remote.x : 0,
          remoteY: remote ? remote.y : 0,
          remoteVisible: Boolean(isRemoteInSight),
          isHiding: p.isHiding,
        });
      }

      // 4. Network Sync (30 Hz)
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
          p.isDowned,
          {
            stamina: p.stamina,
            heldItem: p.heldItem,
            noiseLevel: p.isRunning ? 80 : p.isMoving ? 25 : 0,
            zone: currentZone,
          }
        );

        if (isHost) {
          multiplayerService.sendSolangeHostSync(
            solangeAI.x,
            solangeAI.y,
            solangeAI.state,
            solangeAI.facing,
            solangeAI.targetX,
            solangeAI.targetY
          );
        }
      }

      // 5. CAMERA CENTERING
      const screenWidth = canvas.width;
      const screenHeight = canvas.height;
      let cameraX = p.x - screenWidth / 2;
      let cameraY = p.y - screenHeight / 2;

      cameraX = Math.max(0, Math.min(MAP_WIDTH - screenWidth, cameraX));
      cameraY = Math.max(0, Math.min(MAP_HEIGHT - screenHeight, cameraY));

      // 6. RENDER BACKGROUND & TILES
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
          else if (tile === TileType.PATIO_TILES) texKey = 'floor_tile';

          const tex = sprites.tileTextures.get(texKey);
          if (tex) {
            ctx.drawImage(tex, tx, ty);
          } else {
            ctx.fillStyle = tile === TileType.WALL_SOLID ? '#0f172a' : '#1e293b';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          }
        }
      }

      // 7. RENDER ITEMS
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

          if (item.type === 'book' || item.type === 'fuse' || item.type === 'clue') {
            const pulse = (Math.sin(Date.now() / 200) + 1) * 2;
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(ix - pulse, iy - pulse, item.width + pulse * 2, item.height + pulse * 2);
          }
        }
      });

      // 8. RENDER NOISE RIPPLES
      const noises = noiseSystem.getActiveNoises();
      noises.forEach((noise) => {
        const nx = noise.x - cameraX;
        const ny = noise.y - cameraY;
        const progress = (Date.now() - noise.createdAt) / noise.duration;
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
            ctx.save();
            ctx.translate(rx, ry);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(spriteFrame.canvas, -16, -16);
            ctx.restore();

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

      // 11. RENDER SOLANGE (THE STALKER)
      const sx = activeSolangeX - cameraX;
      const sy = activeSolangeY - cameraY;
      const sSprites = sprites.solangeSprites;
      const sFacing = (activeSolangeFacing || 'down') as 'up' | 'down' | 'left' | 'right';

      let sAnimKey: 'idle' | 'walk' | 'run' | 'search' | 'capture' = 'walk';
      if (activeSolangeState === 'CHASE') {
        sAnimKey = 'run';
      } else if (activeSolangeState === 'HEARD_NOISE' || activeSolangeState === 'SEARCH' || activeSolangeState === 'LOST') {
        sAnimKey = 'search';
      } else if (p.isDowned || partnerDowned) {
        sAnimKey = 'capture';
      } else {
        sAnimKey = 'walk';
      }

      const availableFrames = sSprites[sFacing]?.[sAnimKey] || sSprites[sFacing]?.walk || sSprites[sFacing]?.idle || [];
      const animSpeed = sAnimKey === 'run' ? 5 : sAnimKey === 'search' ? 2 : 3;
      const sFrameIdx = Math.floor(Date.now() / (1000 / animSpeed)) % Math.max(1, availableFrames.length);
      const sFrame = availableFrames[sFrameIdx] || sSprites[sFacing]?.idle?.[0];

      if (sFrame) {
        ctx.drawImage(sFrame.canvas, sx - 22, sy - 24, 44, 48);
      }

      if (activeSolangeState === 'CHASE') {
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('!', sx - 4, sy - 28);
      } else if (activeSolangeState === 'HEARD_NOISE' || activeSolangeState === 'SEARCH' || activeSolangeState === 'LOST') {
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('?', sx - 4, sy - 28);
      }

      // 12. DYNAMIC LIGHTING MASK & RAYCAST SHADOWS
      lightingSystem.renderLighting(
        ctx,
        screenWidth,
        screenHeight,
        cameraX,
        cameraY,
        p.x,
        p.y,
        p.isHiding,
        activeSolangeX,
        activeSolangeY,
        activeSolangeFacing,
        activeSolangeState === 'CHASE',
        roomLights,
        map
      );

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animId);
  }, [items, map, playerIndex, isHost, isPaused, missionState, currentZone, showPreMatchMap]);

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

      {/* PRE-MATCH BLUEPRINT MAP OVERVIEW (5-8 Seconds) */}
      {showPreMatchMap && (
        <PreMatchMapModal
          playerIndex={playerIndex}
          onDismiss={() => setShowPreMatchMap(false)}
        />
      )}

      {/* TABLET PAIRING QR CODE MODAL */}
      {showTabletModal && (
        <TabletPairingModal
          playerIndex={playerIndex}
          onClose={() => setShowTabletModal(false)}
        />
      )}

      {/* TOP HUD: FUJA DA SOLANGE!! (CENTER) */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center gap-1">
        <h1 className="text-sm md:text-base font-black tracking-widest text-amber-400 uppercase bg-black/80 px-4 py-1 rounded border border-neutral-800 shadow-xl drop-shadow-[0_2px_8px_rgba(245,158,11,0.3)]">
          FUJA DA SOLANGE!!
        </h1>

        {/* Remote Controller Status Badge */}
        {controllerStatus === 'ONLINE' ? (
          <div className="bg-emerald-950/80 border border-emerald-600 text-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shadow">
            <span>🎮 TABLET CONECTADO (JOGADOR {playerIndex})</span>
          </div>
        ) : controllerStatus === 'DISCONNECTED' ? (
          <div className="bg-red-950/80 border border-red-600 text-red-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 animate-pulse">
            <span>⚠️ CONTROLE DESCONECTADO</span>
          </div>
        ) : null}
      </div>

      {/* TOP-LEFT HUD: OBJETIVOS */}
      <div className="absolute top-3 left-3 pointer-events-none z-20">
        <div className="bg-black/85 border border-neutral-700/80 p-3 rounded shadow-2xl backdrop-blur-sm max-w-xs">
          <div className="text-[11px] uppercase tracking-wider text-amber-400 font-bold mb-1.5 flex items-center justify-between">
            <span>OBJETIVOS</span>
            <span className="text-[10px] text-neutral-400 font-normal">{currentZone}</span>
          </div>
          <ul className="text-[11px] space-y-1">
            <li className={`flex items-center gap-1.5 ${missionState.booksCollected >= 3 ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.booksCollected >= 3 ? '☑' : '☐'}</span>
              <span>Devolver livros na Biblioteca ({missionState.booksCollected}/3)</span>
            </li>
            <li className={`flex items-center gap-1.5 ${missionState.fusesInstalled >= 3 ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.fusesInstalled >= 3 ? '☑' : '☐'}</span>
              <span>Fusíveis dos disjuntores ({missionState.fusesInstalled}/3)</span>
            </li>
            <li className={`flex items-center gap-1.5 ${missionState.passwordEntered ? 'text-emerald-400 line-through' : 'text-neutral-200'}`}>
              <span>{missionState.passwordEntered ? '☑' : '☐'}</span>
              <span>Terminal da Secretaria ({playerRef.current.collectedClues.length}/3 pistas)</span>
            </li>
            <li className={`flex items-center gap-1.5 font-bold ${missionState.mainGateProgress >= 100 ? 'text-emerald-400' : missionState.booksCollected >= 3 && missionState.fusesInstalled >= 3 && missionState.passwordEntered ? 'text-amber-300 animate-pulse' : 'text-neutral-500'}`}>
              <span>{missionState.mainGateProgress >= 100 ? '☑' : '☐'}</span>
              <span>Escapar pelo Portão Principal ({Math.round(missionState.mainGateProgress)}%)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* TOP-RIGHT HUD: TEMPO & CONTROLE TABLET */}
      <div className="absolute top-3 right-3 flex items-start gap-2 z-20">
        <div className={`px-4 py-1.5 rounded border ${timeRemaining <= 120 ? 'bg-red-950/85 border-red-500 text-red-400 animate-pulse' : 'bg-black/85 border-neutral-700 text-neutral-200'} font-bold tracking-widest text-sm shadow-xl`}>
          TEMPO {formatTimer(timeRemaining)}
        </div>

        {/* Option to pair tablet controller */}
        <button
          onClick={() => setShowTabletModal(true)}
          className="bg-amber-600/90 hover:bg-amber-500 text-black font-bold text-xs px-2.5 py-1.5 rounded transition flex items-center gap-1 cursor-pointer shadow-lg"
          title="Usar celular ou tablet como controle remoto"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Controlar pelo Tablet</span>
        </button>

        <button
          onClick={() => audioSystem.toggleMute()}
          className="bg-neutral-900/80 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs px-2.5 py-1.5 rounded transition cursor-pointer"
        >
          {audioSystem.getIsMuted() ? '🔇' : '🔊'}
        </button>

        <button
          onClick={() => setIsPaused(true)}
          className="bg-neutral-900/80 border border-neutral-700 hover:border-neutral-500 text-neutral-300 text-xs px-2.5 py-1.5 rounded transition cursor-pointer"
        >
          Menu [ESC]
        </button>
      </div>

      {/* BOTTOM-LEFT HUD: ESTADO DO JOGADOR & ESTAMINA */}
      <div className="absolute bottom-4 left-4 z-20 pointer-events-none">
        <div className="bg-black/85 border border-neutral-800 p-2.5 rounded-lg shadow-xl backdrop-blur-md space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase">Estado:</span>
            <span className="text-xs font-bold text-amber-300">{playerActionState}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-neutral-400 uppercase">Stamina [Shift]:</span>
            <div className="w-24 h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${staminaLevel}%` }}
              />
            </div>
          </div>

          {playerRef.current.heldItem && (
            <div className="text-[10px] text-amber-300 pt-0.5">
              Item em mãos: <span className="font-bold">{playerRef.current.heldItem.replace('_', ' ').toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM-RIGHT HUD: MINIMAPA CIRCULAR */}
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
        <CircularMinimap
          playerX={minimapState.playerX}
          playerY={minimapState.playerY}
          isHiding={minimapState.isHiding}
          map={map}
          solangeX={minimapState.solangeX}
          solangeY={minimapState.solangeY}
          solangeVisible={minimapState.solangeVisible}
          remotePlayerX={minimapState.remoteX}
          remotePlayerY={minimapState.remoteY}
          remotePlayerVisible={minimapState.remoteVisible}
        />
      </div>

      {/* CENTER BOTTOM: INTERACTION PROMPT & NOISE INDICATOR */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20 pointer-events-none">
        {currentPrompt && (
          <div className="bg-amber-950/90 border border-amber-500/80 text-amber-200 text-xs px-4 py-1.5 rounded shadow-2xl backdrop-blur-md animate-pulse font-bold">
            {currentPrompt}
          </div>
        )}

        {noiseLevel > 10 && (
          <div className="flex items-center gap-2 bg-black/85 border border-red-900/80 px-3 py-1 rounded-full text-red-400 text-[10px] font-bold animate-pulse shadow-lg">
            <Volume2 className="w-3.5 h-3.5 animate-bounce text-red-500" />
            <span>Você está fazendo barulho! Solange pode ouvir!</span>
          </div>
        )}

        {partnerDowned && (
          <div className="bg-red-900/90 text-red-100 text-xs px-3 py-1 rounded border border-red-500 animate-bounce font-bold shadow-2xl">
            ⚠️ PARCEIRO CAPTURADO! Encontre-o e segure [E] para reanimar!
          </div>
        )}
      </div>

      {/* PAUSE MENU MODAL */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 p-6 rounded-lg max-w-sm w-full text-center space-y-4">
            <h2 className="text-xl font-bold text-amber-400 tracking-wider">FUJA DA SOLANGE!!</h2>
            <div className="text-xs text-neutral-400 space-y-1.5 text-left border-y border-neutral-800 py-3">
              <p><strong className="text-neutral-200">WASD / Setas:</strong> Movimentação</p>
              <p><strong className="text-neutral-200">Shift / Botão Correr:</strong> Correr (Gera muito ruído!)</p>
              <p><strong className="text-neutral-200">E / Botão Interagir:</strong> Interagir / Armários</p>
              <p><strong className="text-neutral-200">Atenção:</strong> Solange começou na Sala dos Professores!</p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => {
                  setIsPaused(false);
                  setShowTabletModal(true);
                }}
                className="bg-amber-600 hover:bg-amber-500 text-black font-bold py-2 rounded text-sm transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4" />
                Vincular Tablet / Celular
              </button>
              <button
                onClick={() => setIsPaused(false)}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 py-2 rounded text-sm transition cursor-pointer"
              >
                Continuar Partida
              </button>
              <button
                onClick={onExitToMenu}
                className="bg-neutral-900 hover:bg-neutral-800 text-neutral-400 py-2 rounded text-sm transition cursor-pointer"
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
