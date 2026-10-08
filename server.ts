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
}

interface Room {
  code: string;
  hostId: string;
  players: Map<string, PlayerState>;
  status: 'waiting' | 'countdown' | 'playing' | 'gameover' | 'victory';
  countdown: number;
  gameTimeRemaining: number; // 900 seconds (15 min)
  missionState: {
    booksCollected: number;
    booksRequired: number;
    fusesInstalled: number;
    fusesRequired: number;
    passwordCluesFound: number;
    passwordEntered: boolean;
    mainGateProgress: number; // 0 to 100
  };
  antonio: {
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

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
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
  rooms.delete(code);
}

wss.on('connection', (ws: WebSocket) => {
  let currentRoomCode: string | null = null;
  let playerId: string | null = null;

  ws.on('message', (data: string) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'CREATE_ROOM': {
          let code = generateRoomCode();
          while (rooms.has(code)) {
            code = generateRoomCode();
          }

          const validPlayerId: string = msg.playerId || `p_${Math.random().toString(36).substring(2, 9)}`;
          playerId = validPlayerId;
          currentRoomCode = code;

          const player: PlayerState = {
            id: validPlayerId,
            name: msg.name || 'Jogador 1',
            playerIndex: 1,
            x: 160,
            y: 480,
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
            antonio: {
              x: 1000,
              y: 700,
              state: 'PATROL',
              facing: 'down',
            },
          };

          rooms.set(code, room);

          ws.send(
            JSON.stringify({
              type: 'ROOM_CREATED',
              roomCode: code,
              playerId,
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
            x: 200,
            y: 480,
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

          // Notify existing players
          broadcastToRoom(room, {
            type: 'PLAYER_JOINED',
            playerId,
            name: player.name,
            playerIndex: 2,
            playersCount: room.players.size,
          });

          // Check if ready to start 5s countdown
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

                // Start authoritative 15-minute sync timer
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

            // Broadcast to other player
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
          }
          break;
        }

        case 'SOUND_EMITTED': {
          if (!currentRoomCode) return;
          const room = rooms.get(currentRoomCode);
          if (!room) return;

          // Broadcast noise event to room
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

        case 'ANTONIO_HOST_SYNC': {
          // Host player calculates Antonio AI and broadcasts authoritative state
          if (!currentRoomCode || !playerId) return;
          const room = rooms.get(currentRoomCode);
          if (!room || room.hostId !== playerId) return;

          room.antonio = {
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
              type: 'ANTONIO_UPDATE',
              antonio: room.antonio,
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

          // Check if both players are downed
          const allDown = Array.from(room.players.values()).every((p) => p.isDowned);
          if (allDown && room.status === 'playing') {
            room.status = 'gameover';
            broadcastToRoom(room, {
              type: 'MATCH_ENDED',
              reason: 'CAPTURED',
              message: 'Antônio capturou os dois jogadores!',
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
          // If host left, elect new host
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

// Vite middleware in dev or static files in production
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
