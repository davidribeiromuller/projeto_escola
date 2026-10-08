/**
 * Solange's Artificial Intelligence & Robust A* Pathfinding Navigation
 * 
 * Rules:
 * 1. Solange SEMPRE começa na SALA DOS PROFESSORES.
 * 2. Movimentação estruturada com A* pathfinding por waypoints.
 * 3. Prevenção de corte de cantos (não atravessa quinas).
 * 4. Detector de bloqueio / stuckTimer para desatolar automaticamente.
 * 5. Separação de eixos (X/Y) e subpassos para movimento fluído.
 * 6. Velocidade de perseguição inferior à corrida máxima do jogador.
 */

import { SOLANGE_PATROL_ROUTE, SOLANGE_INITIAL_SPAWN, TILE_SIZE, TileType } from './mapData';
import { audioSystem } from '../services/audioSystem';
import { Pathfinding, Point } from './pathfinding';

export type SolangeState = 'PATROL' | 'HEARD_NOISE' | 'SEARCH' | 'CHASE' | 'LOST' | 'RETURN';

export interface PlayerTarget {
  id: string;
  x: number;
  y: number;
  isHiding: boolean;
  isDowned: boolean;
}

export class SolangeAI {
  public x: number = SOLANGE_INITIAL_SPAWN.x;
  public y: number = SOLANGE_INITIAL_SPAWN.y;
  public facing: 'up' | 'down' | 'left' | 'right' = 'down';
  public state: SolangeState = 'PATROL';

  // Navigation targets & A* waypoints
  public targetX: number = SOLANGE_INITIAL_SPAWN.x;
  public targetY: number = SOLANGE_INITIAL_SPAWN.y;
  public patrolIndex: number = 0;
  public pathWaypoints: Point[] = [];
  public currentWaypointIndex: number = 0;

  // Speeds: Player walk = 90 px/s, Player sprint = 165 px/s, Solange patrol = 54 px/s, Solange chase = 126 px/s
  public patrolSpeed: number = 54;
  public chaseSpeed: number = 126;
  public searchSpeed: number = 44;

  // Timers
  private initialGraceTimer: number = 3800; // 3.8s in Sala dos Professores before stepping out
  private recalculateTimer: number = 0;
  private searchTimer: number = 0;
  private searchDuration: number = 5200;
  private searchSubStep: number = 0;

  // Stuck Detection
  private stuckTimer: number = 0;
  private lastStuckCheckPos: Point = { x: SOLANGE_INITIAL_SPAWN.x, y: SOLANGE_INITIAL_SPAWN.y };

  // Targets
  public targetPlayerId: string | null = null;
  private lastSeenPlayerPos: Point | null = null;

  // Waypoint reached tolerance (pixels)
  private readonly WAYPOINT_TOLERANCE = 14;

  constructor() {
    this.x = SOLANGE_INITIAL_SPAWN.x;
    this.y = SOLANGE_INITIAL_SPAWN.y;
    this.targetX = SOLANGE_INITIAL_SPAWN.x;
    this.targetY = SOLANGE_INITIAL_SPAWN.y;
    this.lastStuckCheckPos = { x: this.x, y: this.y };
  }

  public update(
    deltaMs: number,
    players: PlayerTarget[],
    map: number[][],
    noiseAlert: { heard: boolean; approxX: number; approxY: number; category: string } | null
  ) {
    const dt = deltaMs / 1000;

    // Grace period in Sala dos Professores
    if (this.initialGraceTimer > 0) {
      this.initialGraceTimer -= deltaMs;
      if (this.initialGraceTimer <= 0) {
        this.setNextPatrolWaypoint(map);
      }
      return;
    }

    // 1. Check Noise Alert (Interrupts patrol/search/return)
    if (noiseAlert && noiseAlert.heard && this.state !== 'CHASE') {
      this.state = 'HEARD_NOISE';
      this.targetX = noiseAlert.approxX;
      this.targetY = noiseAlert.approxY;
      this.computePathTo(this.targetX, this.targetY, map);
      this.searchTimer = 0;
    }

    // 2. Line of Sight Check (Walls block vision!)
    const sightedPlayer = this.checkLineOfSight(players, map);

    if (sightedPlayer) {
      if (this.state !== 'CHASE') {
        audioSystem.playChaseAlert();
      }
      this.state = 'CHASE';
      this.targetPlayerId = sightedPlayer.id;
      this.targetX = sightedPlayer.x;
      this.targetY = sightedPlayer.y;
      this.lastSeenPlayerPos = { x: sightedPlayer.x, y: sightedPlayer.y };

      // Update path to moving player periodically
      this.recalculateTimer += deltaMs;
      if (this.recalculateTimer > 320) {
        this.recalculateTimer = 0;
        this.computePathTo(this.targetX, this.targetY, map);
      }
    } else if (this.state === 'CHASE') {
      // Just lost player! Move to last seen location
      this.state = 'LOST';
      this.searchTimer = 0;
      if (this.lastSeenPlayerPos) {
        this.targetX = this.lastSeenPlayerPos.x;
        this.targetY = this.lastSeenPlayerPos.y;
        this.computePathTo(this.targetX, this.targetY, map);
      }
    }

    // 3. State Machine Execution
    switch (this.state) {
      case 'PATROL':
        this.executeMoveAlongPath(dt, this.patrolSpeed, map, () => {
          this.patrolIndex = (this.patrolIndex + 1) % SOLANGE_PATROL_ROUTE.length;
          this.setNextPatrolWaypoint(map);
        });
        break;

      case 'HEARD_NOISE':
        this.executeMoveAlongPath(dt, this.patrolSpeed * 1.25, map, () => {
          this.state = 'SEARCH';
          this.searchTimer = 0;
          this.searchSubStep = 0;
        });
        break;

      case 'SEARCH':
        this.executeSearch(dt, deltaMs, map);
        break;

      case 'CHASE':
        this.executeMoveAlongPath(dt, this.chaseSpeed, map);
        break;

      case 'LOST':
        this.executeMoveAlongPath(dt, this.chaseSpeed * 0.85, map, () => {
          this.state = 'SEARCH';
          this.searchTimer = 0;
          this.searchSubStep = 0;
        });
        break;

      case 'RETURN':
        this.executeMoveAlongPath(dt, this.patrolSpeed, map, () => {
          this.state = 'PATROL';
          this.setNextPatrolWaypoint(map);
        });
        break;
    }

    // 4. Stuck Detection Mechanism
    this.checkStuck(deltaMs, map);
  }

  private setNextPatrolWaypoint(map: number[][]) {
    const wp = SOLANGE_PATROL_ROUTE[this.patrolIndex];
    if (wp) {
      this.targetX = wp.x;
      this.targetY = wp.y;
      this.computePathTo(wp.x, wp.y, map);
    }
  }

  private setNearestPatrolWaypoint(map: number[][]) {
    let nearestIdx = 0;
    let minDist = Infinity;
    SOLANGE_PATROL_ROUTE.forEach((wp, idx) => {
      const d = Math.hypot(this.x - wp.x, this.y - wp.y);
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    });
    this.patrolIndex = nearestIdx;
    this.setNextPatrolWaypoint(map);
  }

  public computePathTo(destX: number, destY: number, map: number[][]) {
    const rawPath = Pathfinding.findPath(this.x, this.y, destX, destY, map);
    this.pathWaypoints = rawPath;
    this.currentWaypointIndex = 0;
  }

  private executeMoveAlongPath(
    dt: number,
    speed: number,
    map: number[][],
    onDestinationReached?: () => void
  ) {
    if (!this.pathWaypoints || this.pathWaypoints.length === 0) {
      if (onDestinationReached) onDestinationReached();
      return;
    }

    const currentWp = this.pathWaypoints[this.currentWaypointIndex];
    if (!currentWp) {
      if (onDestinationReached) onDestinationReached();
      return;
    }

    const dx = currentWp.x - this.x;
    const dy = currentWp.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Reached current waypoint!
    if (dist <= this.WAYPOINT_TOLERANCE) {
      this.currentWaypointIndex++;
      if (this.currentWaypointIndex >= this.pathWaypoints.length) {
        this.pathWaypoints = [];
        if (onDestinationReached) onDestinationReached();
        return;
      }
      return;
    }

    // Direction vector
    const vx = (dx / dist) * speed * dt;
    const vy = (dy / dist) * speed * dt;

    // Facing direction
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }

    // Sub-step movement with separate X and Y axis collision
    this.moveWithAxisSeparation(vx, vy, map);
  }

  private moveWithAxisSeparation(vx: number, vy: number, map: number[][]) {
    // Check X axis
    const nextX = this.x + vx;
    if (!this.checkSolidCircle(nextX, this.y, 11, map)) {
      this.x = nextX;
    }

    // Check Y axis
    const nextY = this.y + vy;
    if (!this.checkSolidCircle(this.x, nextY, 11, map)) {
      this.y = nextY;
    }
  }

  private checkSolidCircle(px: number, py: number, radius: number, map: number[][]): boolean {
    const testOffsets = [
      { x: 0, y: 0 },
      { x: radius, y: 0 },
      { x: -radius, y: 0 },
      { x: 0, y: radius },
      { x: 0, y: -radius },
    ];

    for (const off of testOffsets) {
      const col = Math.floor((px + off.x) / TILE_SIZE);
      const row = Math.floor((py + off.y) / TILE_SIZE);

      if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
        return true;
      }

      const t = map[row][col];
      if (
        t === TileType.WALL_SOLID ||
        t === TileType.WALL_BORDER ||
        t === TileType.OBSTACLE_DESK ||
        t === TileType.OBSTACLE_SHELF
      ) {
        return true;
      }
    }

    return false;
  }

  private executeSearch(dt: number, deltaMs: number, map: number[][]) {
    this.searchTimer += deltaMs;

    if (this.searchTimer > (this.searchSubStep + 1) * 1100) {
      this.searchSubStep++;
      const dirs: ('up' | 'down' | 'left' | 'right')[] = ['right', 'down', 'left', 'up'];
      this.facing = dirs[this.searchSubStep % dirs.length];

      // Jitter look target
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      const a = angles[this.searchSubStep % angles.length];
      const searchTargetX = this.x + Math.cos(a) * 36;
      const searchTargetY = this.y + Math.sin(a) * 36;
      this.computePathTo(searchTargetX, searchTargetY, map);
    }

    this.executeMoveAlongPath(dt, this.searchSpeed, map);

    if (this.searchTimer >= this.searchDuration) {
      this.state = 'RETURN';
      this.setNearestPatrolWaypoint(map);
    }
  }

  /**
   * Robust Stuck Detection:
   * If Solange stays in nearly the same position for > 1.2s while attempting to move,
   * unstick her by teleporting slightly to the nearest guaranteed walkable cell and recomputing path!
   */
  private checkStuck(deltaMs: number, map: number[][]) {
    const movedDist = Math.hypot(this.x - this.lastStuckCheckPos.x, this.y - this.lastStuckCheckPos.y);

    if (movedDist < 3.5) {
      this.stuckTimer += deltaMs;
      if (this.stuckTimer > 1200) {
        // Solange is stuck!
        this.stuckTimer = 0;
        const currentCol = Math.floor(this.x / TILE_SIZE);
        const currentRow = Math.floor(this.y / TILE_SIZE);
        const freeNode = Pathfinding.findNearestWalkable(currentCol, currentRow, map);

        this.x = (freeNode.col + 0.5) * TILE_SIZE;
        this.y = (freeNode.row + 0.5) * TILE_SIZE;

        // Recalculate path towards next patrol waypoint
        if (this.state === 'CHASE' && this.lastSeenPlayerPos) {
          this.computePathTo(this.lastSeenPlayerPos.x, this.lastSeenPlayerPos.y, map);
        } else {
          this.setNearestPatrolWaypoint(map);
        }
      }
    } else {
      this.stuckTimer = 0;
      this.lastStuckCheckPos = { x: this.x, y: this.y };
    }
  }

  private checkLineOfSight(players: PlayerTarget[], map: number[][]): PlayerTarget | null {
    const maxVisionDist = 230;
    const halfFov = Math.PI * 0.38;

    for (const player of players) {
      if (player.isHiding || player.isDowned) continue;

      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > maxVisionDist) continue;

      const angleToPlayer = Math.atan2(dy, dx);
      let facingAngle = 0;
      if (this.facing === 'down') facingAngle = Math.PI / 2;
      else if (this.facing === 'up') facingAngle = -Math.PI / 2;
      else if (this.facing === 'left') facingAngle = Math.PI;
      else if (this.facing === 'right') facingAngle = 0;

      let angleDiff = Math.abs(angleToPlayer - facingAngle);
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      if (angleDiff <= halfFov || dist < 38) {
        if (this.hasClearLineOfSight(this.x, this.y, player.x, player.y, map)) {
          return player;
        }
      }
    }

    return null;
  }

  public hasClearLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    map: number[][]
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 12);

    for (let i = 1; i < steps; i++) {
      const cx = x1 + ((x2 - x1) * i) / steps;
      const cy = y1 + ((y2 - y1) * i) / steps;
      const col = Math.floor(cx / TILE_SIZE);
      const row = Math.floor(cy / TILE_SIZE);

      if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
        return false;
      }

      const t = map[row][col];
      if (
        t === TileType.WALL_SOLID ||
        t === TileType.WALL_BORDER ||
        t === TileType.OBSTACLE_DESK ||
        t === TileType.OBSTACLE_SHELF
      ) {
        return false;
      }
    }
    return true;
  }
}
