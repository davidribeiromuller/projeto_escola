import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

interface PlayerState {
  id: string;
  name: string;
  playerIndex: 1 | 2;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  isRunning: boolean;
  isHiding: boolean;
  hidingSpotId: string | null;
  isDowned: boolean;
  inventory: string[];
  ws: WebSocket;
  lastPing: number;
  controllerToken?: string;
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, PlayerState>;
  status: 'waiting' | 'countdown' | 'playing' | 'gameover' | 'victory';
  countdown: number;
  gameTimeRemaining: number;
  missionState: {
    booksCollected: number;
    booksRequired: number;
    fusesInstalled: number;
    fusesRequired: number;
    passwordCluesFound: number;
    passwordEntered: boolean;
    mainGateProgress: number;
  };
  solange: {
    x: number;
    y: number;
    state: string;
    facing: string;
    targetX?: number;
    targetY?: number;
  };
  countdownTimer?: NodeJS.Timeout;
  gameLoopTimer?: NodeJS.Timeout;
}

interface ControllerSession {
  code: string;
  token: string;
  roomCode: string;
  playerId: string;
  playerIndex: 1 | 2;
  ws?: WebSocket;
  createdAt: number;
}

const rooms = new Map<string, Room>();
// Controller codes mapping: 6-char code -> session
const controllerSessions = new Map<string, ControllerSession>();

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcastToRoom(room: Room, message: any, excludeId?: string) {
  const payload = JSON.stringify(message);
  room.players.forEach((player) => {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(payload);
    }
  });
}

function cleanUpRoom(code: string) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.countdownTimer) clearInterval(room.countdownTimer);
  if (room.gameLoopTimer) clearInterval(room.gameLoopTimer);

  // Invalidate any controller sessions associated with this room
  for (const [cCode, sess] of controllerSessions.entries()) {
    if (sess.roomCode === code) {
      if (sess.ws && sess.ws.readyState === WebSocket.OPEN) {
        sess.ws.send(JSON.stringify({ type: 'MATCH_ENDED', message: 'A partida foi encerrada.' }));
      }
      controllerSessions.delete(cCode);
    }
  }

  rooms.delete(code);
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let playerId: string | null = null;
  let isControllerSocket: boolean = false;
  let controllerCodeAssigned: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        // --- 1. TABLET CONTROLLER PAIRING MESSAGES ---
        case 'CREATE_CONTROLLER_TOKEN': {
          // PC player requests a remote tablet code
          if (!currentRoomCode || !playerId) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Você precisa estar em uma sala para criar um controle.' }));
            return;
          }
          const room = rooms.get(currentRoomCode);
          if (!room) return;
          const player = room.players.get(playerId);
          if (!player) return;

          let cCode = generateShortCode();
          while (controllerSessions.has(cCode)) {
            cCode = generateShortCode();
          }

          const token = `tok_${Math.random().toString(36).substring(2, 12)}`;
          const session: ControllerSession = {
            code: cCode,
            token,
            roomCode: currentRoomCode,
            playerId,
            playerIndex: player.playerIndex,
            createdAt: Date.now(),
          };

          controllerSessions.set(cCode, session);

          ws.send(
            JSON.stringify({
              type: 'CONTROLLER_TOKEN_CREATED',
              controllerCode: cCode,
              token,
              playerIndex: player.playerIndex,
            })
          );
          break;
        }

        case 'CONTROL_CONNECT': {
          // Tablet connects with the 6-character code
          const targetCode = (msg.code || '').toUpperCase().trim();
          const session = controllerSessions.get(targetCode);

          if (!session) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'Código de controle inválido ou expirado.',
              })
            );
            return;
          }

          const room = rooms.get(session.roomCode);
          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'A partida associada a este controle não existe mais.',
              })
            );
            return;
          }

          const player = room.players.get(session.playerId);
          if (!player) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'O jogador correspondente não está mais conectado.',
              })
            );
            return;
          }

          // Successfully bind tablet socket
          isControllerSocket = true;
          controllerCodeAssigned = targetCode;
          session.ws = ws;

          // Notify Tablet
          ws.send(
            JSON.stringify({
              type: 'CONTROL_CONNECTED',
              roomCode: session.roomCode,
              playerIndex: session.playerIndex,
              playerName: player.name,
              message: `Conectado ao Jogador ${session.playerIndex} (${player.name})`,
            })
          );

          // Notify PC Screen
          if (player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(
              JSON.stringify({
                type: 'CONTROL_CONNECTED',
                playerIndex: session.playerIndex,
                message: `Tablet conectado com sucesso ao Jogador ${session.playerIndex}!`,
              })
            );
          }
          break;
        }

        case 'CONTROL_INPUT': {
          // Tablet sends virtual joystick & action buttons
          if (!controllerCodeAssigned) return;
          const session = controllerSessions.get(controllerCodeAssigned);
          if (!session) return;

          const room = rooms.get(session.roomCode);
          if (!room) return;

          const player = room.players.get(session.playerId);
          if (player && player.ws.readyState === WebSocket.OPEN) {
            // Forward input strictly to that player's PC
            player.ws.send(
              JSON.stringify({
                type: 'CONTROL_INPUT',
                dx: msg.dx,
                dy: msg.dy,
                run: msg.run,
                interact: msg.interact,
                hide: msg.hide,
              })
            );
          }
          break;
        }

        // --- 2. ROOM & PLAYER LIFECYCLE ---
        case 'CREATE_ROOM': {
          let code = generateShortCode();
          while (rooms.has(code)) {
            code = generateShortCode();
          }

          const validPlayerId: string = msg.playerId || `p_${Math.random().toString(36).substring(2, 9)}`;
          playerId = validPlayerId;
          currentRoomCode = code;

          const player: PlayerState = {
            id: validPlayerId,
            name: msg.name || 'Jogador 1',
            playerIndex: 1,
            x: 7 * 32,
            y: 4 * 32, // Sala 1
            facing: 'down',
            isMoving: false,
            isRunning: false,
            isHiding: false,
            hidingSpotId: null,
            isDowned: false,
            inventory: [],
            ws,
            lastPing: Date.now(),
          };

          const room: Room = {
            code,
            hostId: validPlayerId,
            players: new Map([[validPlayerId, player]]),
            status: 'waiting',
            countdown: 5,
            gameTimeRemaining: 900,
            missionState: {
              booksCollected: 0,
              booksRequired: 3,
              fusesInstalled: 0,
              fusesRequired: 3,
              passwordCluesFound: 0,
              passwordEntered: false,
              mainGateProgress: 0,
            },
            solange: {
              x: 22 * 32,
              y: 27 * 32, // Sala dos Professores!
              state: 'PATROL',
              facing: 'down',
            },
          };

          rooms.set(code, room);

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomCode: code,
              playerId: validPlayerId,
              playerIndex: 1,
            })
          );
          break;
        }

        case 'JOIN_ROOM': {
          const targetCode = (msg.roomCode || '').toUpperCase().trim();
          const room = rooms.get(targetCode);

          if (!room) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'Partida não encontrada. Verifique o código.',
              })
            );
            return;
          }

          // STRICT CHECK: Maximum 2 players
          if (room.players.size >= 2) {
            ws.send(
              JSON.stringify({
                type: 'ERROR',
                message: 'Esta partida já está cheia. (Máximo 2 jogadores)',
              })
            );
            return;
          }

          const validJoinPlayerId: string = msg.playerId || `p_${Math.random().toString(36).substring(2, 9)}`;
          playerId = validJoinPlayerId;
          currentRoomCode = targetCode;

          const player: PlayerState = {
            id: validJoinPlayerId,
            name: msg.name || 'Jogador 2',
            playerIndex: 2,
            x: 23 * 32,
            y: 34 * 32, // Refeitório
            facing: 'down',
            isMoving: false,
            isRunning: false,
            isHiding: false,
            hidingSpotId: null,
            isDowned: false,
            inventory: [],
            ws,
            lastPing: Date.now(),
          };

          room.players.set(validJoinPlayerId, player);

          ws.send(
            JSON.stringify({
              type: 'ROOM_JOINED',
              roomCode: targetCode,
              playerId: validJoinPlayerId,
              playerIndex: 2,
            })
          );

          broadcastToRoom(room, {
            type: 'PLAYER_JOINED',
            playerId: validJoinPlayerId,
            name: player.name,
            playerIndex: 2,
            playersCount: room.players.size,
          });

          // If 2 players, start countdown
          if (room.players.size === 2 && room.status === 'waiting') {
            room.status = 'countdown';
            room.countdown = 5;

            broadcastToRoom(room, {
              type: 'COUNTDOWN_TICK',
              countdown: room.countdown,
            });

            room.countdownTimer = setInterval(() => {
              room.countdown -= 1;
              if (room.countdown <= 0) {
                if (room.countdownTimer) clearInterval(room.countdownTimer);
                room.status = 'playing';

                broadcastToRoom(room, {
                  type: 'MATCH_STARTED',
                  gameTimeRemaining: room.gameTimeRemaining,
                  missionState: room.missionState,
                });

                room.gameLoopTimer = setInterval(() => {
                  room.gameTimeRemaining -= 1;
                  if (room.gameTimeRemaining <= 0) {
                    if (room.gameLoopTimer) clearInterval(room.gameLoopTimer);
                    room.status = 'gameover';
                    broadcastToRoom(room, {
                      type: 'MATCH_ENDED',
                      reason: 'TIMEOUT',
                      message: 'A escola fechou! O tempo acabou.',
                    });
                  }
                }, 1000);
              } else {
                broadcastToRoom(room, {
                  type: 'COUNTDOWN_TICK',
                  countdown: room.countdown,
                });
              }
            }, 1000);
          }
          break;
        }

        case 'PLAYER_SYNC': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.get(playerId);
          if (player) {
            player.x = msg.x;
            player.y = msg.y;
            player.facing = msg.facing;
            player.isMoving = msg.isMoving;
            player.isRunning = msg.isRunning;
            player.isHiding = msg.isHiding;
            player.hidingSpotId = msg.hidingSpotId || null;
            player.isDowned = msg.isDowned || false;
            player.lastPing = Date.now();

            broadcastToRoom(
              room,
              {
                type: 'REMOTE_PLAYER_UPDATE',
                id: playerId,
                playerIndex: player.playerIndex,
                x: player.x,
                y: player.y,
                facing: player.facing,
                isMoving: player.isMoving,
                isRunning: player.isRunning,
                isHiding: player.isHiding,
                hidingSpotId: player.hidingSpotId,
                isDowned: player.isDowned,
              },
              playerId
            );

            // Forward mini telemetry to paired controller if connected
            for (const sess of controllerSessions.values()) {
              if (sess.playerId === playerId && sess.ws && sess.ws.readyState === WebSocket.OPEN) {
                sess.ws.send(
                  JSON.stringify({
                    type: 'CONTROLLER_TELEMETRY',
                    stamina: msg.stamina ?? 100,
                    isHiding: player.isHiding,
                    isDowned: player.isDowned,
                    heldItem: msg.heldItem ?? null,
                    noiseLevel: msg.noiseLevel ?? 0,
                    zone: msg.zone || '',
                  })
                );
              }
            }
          }
          break;
        }

        case 'SOUND_EMITTED': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          broadcastToRoom(room, {
            type: 'SOUND_BROADCAST',
            sourcePlayerId: playerId,
            x: msg.x,
            y: msg.y,
            intensity: msg.intensity,
            radius: msg.radius,
            category: msg.category || 'footstep',
          });
          break;
        }

        case 'SOLANGE_HOST_SYNC':
        case 'ANTONIO_HOST_SYNC': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== playerId) return;

          room.solange = {
            x: msg.x,
            y: msg.y,
            state: msg.state,
            facing: msg.facing,
            targetX: msg.targetX,
            targetY: msg.targetY,
          };

          broadcastToRoom(
            room,
            {
              type: 'SOLANGE_UPDATE',
              solange: room.solange,
            },
            playerId
          );
          break;
        }

        case 'MISSION_ACTION': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          if (msg.action === 'BOOK_DELIVERED') {
            room.missionState.booksCollected += 1;
          } else if (msg.action === 'FUSE_INSTALLED') {
            room.missionState.fusesInstalled += 1;
          } else if (msg.action === 'PASSWORD_SOLVED') {
            room.missionState.passwordEntered = true;
          } else if (msg.action === 'GATE_PROGRESS') {
            room.missionState.mainGateProgress = Math.min(100, (room.missionState.mainGateProgress || 0) + (msg.delta || 5));
          }

          broadcastToRoom(room, {
            type: 'MISSION_STATE_UPDATE',
            missionState: room.missionState,
            action: msg.action,
            playerId,
          });

          if (room.missionState.mainGateProgress >= 100 && room.status === 'playing') {
            room.status = 'victory';
            broadcastToRoom(room, {
              type: 'MATCH_ENDED',
              reason: 'VICTORY',
              message: 'Vocês conseguiram escapar da escola vivos!',
            });
          }
          break;
        }

        case 'PLAYER_DOWNED': {
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const player = room.players.get(playerId);
          if (player) {
            player.isDowned = true;
          }

          broadcastToRoom(room, {
            type: 'PLAYER_DOWNED_EVENT',
            downedPlayerId: playerId,
          });

          const allDown = Array.from(room.players.values()).every((p) => p.isDowned);
          if (allDown && room.status === 'playing') {
            room.status = 'gameover';
            broadcastToRoom(room, {
              type: 'MATCH_ENDED',
              reason: 'CAPTURED',
              message: 'Solange capturou os dois jogadores!',
            });
          }
          break;
        }

        case 'PLAYER_REVIVED': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          const targetPlayer = room.players.get(msg.targetPlayerId);
          if (targetPlayer) {
            targetPlayer.isDowned = false;
          }

          broadcastToRoom(room, {
            type: 'PLAYER_REVIVED_EVENT',
            revivedPlayerId: msg.targetPlayerId,
            reviverId: playerId,
          });
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }
      }
    } catch (e) {
      console.error('WebSocket message parsing error:', e);
    }
  });

  ws.on('close', () => {
    // If it's a tablet controller socket disconnecting
    if (isControllerSocket && controllerCodeAssigned) {
      const session = controllerSessions.get(controllerCodeAssigned);
      if (session) {
        const room = rooms.get(session.roomCode);
        if (room) {
          const player = room.players.get(session.playerId);
          if (player && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(
              JSON.stringify({
                type: 'CONTROL_DISCONNECTED',
                playerIndex: session.playerIndex,
                message: 'Controle remoto desconectado.',
              })
            );
          }
        }
        controllerSessions.delete(controllerCodeAssigned);
      }
      return;
    }

    // Normal player disconnect
    if (currentRoomCode && playerId) {
      const room = rooms.get(currentRoomCode);
      if (room) {
        room.players.delete(playerId);
        broadcastToRoom(room, {
          type: 'PLAYER_LEFT',
          playerId,
          message: 'Seu parceiro saiu da partida.',
          playersCount: room.players.size,
        });

        if (room.players.size === 0) {
          cleanUpRoom(currentRoomCode);
        } else {
          if (room.hostId === playerId) {
            const nextHost = room.players.keys().next().value;
            if (nextHost) {
              room.hostId = nextHost;
              const hostPlayer = room.players.get(nextHost);
              if (hostPlayer && hostPlayer.ws.readyState === WebSocket.OPEN) {
                hostPlayer.ws.send(JSON.stringify({ type: 'YOU_ARE_HOST' }));
              }
            }
          }
        }
      }
    }
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`[Game Server] Running on http://localhost:${PORT}`);
  });
}

startServer();
