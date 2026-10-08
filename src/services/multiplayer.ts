/**
 * Unified Multiplayer Service for "Depois da Última Aula"
 * Realtime communication with room codes, max 2 players validation,
 * state synchronization, and reconnection handling.
 */

export interface RemotePlayer {
  id: string;
  name?: string;
  playerIndex: 1 | 2;
  x: number;
  y: number;
  facing: 'up' | 'down' | 'left' | 'right';
  isMoving: boolean;
  isRunning: boolean;
  isHiding: boolean;
  hidingSpotId: string | null;
  isDowned: boolean;
}

export interface MissionStateNetwork {
  booksCollected: number;
  booksRequired: number;
  fusesInstalled: number;
  fusesRequired: number;
  passwordCluesFound: number;
  passwordEntered: boolean;
  mainGateProgress: number;
}

type MessageCallback = (data: any) => void;

class MultiplayerService {
  private ws: WebSocket | null = null;
  public playerId: string = `p_${Math.random().toString(36).substring(2, 9)}`;
  public roomCode: string | null = null;
  public isHost: boolean = false;
  public playerIndex: 1 | 2 = 1;
  public isConnected: boolean = false;

  private listeners: Map<string, Set<MessageCallback>> = new Map();
  private reconnectInterval: number | null = null;

  constructor() {
    this.connectSocket();
  }

  private getSocketUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  public connectSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.getSocketUrl());

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('SOCKET_CONNECTED', {});
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.type, msg);
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('SOCKET_DISCONNECTED', {});
        // Auto-reconnect every 2 seconds
        if (!this.reconnectInterval) {
          this.reconnectInterval = window.setInterval(() => {
            this.connectSocket();
          }, 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('Socket connection note:', err);
      };
    } catch (e) {
      console.warn('WebSocket init exception:', e);
    }
  }

  public on(type: string, cb: MessageCallback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(cb);
  }

  public off(type: string, cb: MessageCallback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type)!.delete(cb);
    }
  }

  private emit(type: string, data: any) {
    const list = this.listeners.get(type);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  }

  public send(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      // If socket is closed, try to reconnect and queue
      this.connectSocket();
      setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(msg));
        }
      }, 500);
    }
  }

  public createRoom(name: string) {
    this.isHost = true;
    this.playerIndex = 1;
    this.send({
      type: 'CREATE_ROOM',
      playerId: this.playerId,
      name,
    });
  }

  public joinRoom(roomCode: string, name: string) {
    this.isHost = false;
    this.playerIndex = 2;
    this.roomCode = roomCode.toUpperCase().trim();
    this.send({
      type: 'JOIN_ROOM',
      roomCode: this.roomCode,
      playerId: this.playerId,
      name,
    });
  }

  public sendPlayerSync(
    x: number,
    y: number,
    facing: 'up' | 'down' | 'left' | 'right',
    isMoving: boolean,
    isRunning: boolean,
    isHiding: boolean,
    hidingSpotId: string | null,
    isDowned: boolean
  ) {
    this.send({
      type: 'PLAYER_SYNC',
      x,
      y,
      facing,
      isMoving,
      isRunning,
      isHiding,
      hidingSpotId,
      isDowned,
    });
  }

  public sendSoundEmitted(
    x: number,
    y: number,
    intensity: string,
    radius: number,
    category: string
  ) {
    this.send({
      type: 'SOUND_EMITTED',
      x,
      y,
      intensity,
      radius,
      category,
    });
  }

  public sendAntonioHostSync(
    x: number,
    y: number,
    state: string,
    facing: string,
    targetX?: number,
    targetY?: number
  ) {
    this.send({
      type: 'ANTONIO_HOST_SYNC',
      x,
      y,
      state,
      facing,
      targetX,
      targetY,
    });
  }

  public sendMissionAction(action: string, delta?: number) {
    this.send({
      type: 'MISSION_ACTION',
      action,
      delta,
    });
  }

  public sendPlayerDowned() {
    this.send({
      type: 'PLAYER_DOWNED',
    });
  }

  public sendPlayerRevived(targetPlayerId: string) {
    this.send({
      type: 'PLAYER_REVIVED',
      targetPlayerId,
    });
  }
}

export const multiplayerService = new MultiplayerService();
