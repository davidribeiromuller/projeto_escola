/**
 * Antônio's Artificial Intelligence & Finite State Machine
 * States: PATROL | HEARD_NOISE | SEARCH | CHASE | LOST | RETURN
 * Enforces line-of-sight wall occlusion and noise-based investigation.
 */

import { PATROL_WAYPOINTS, TILE_SIZE, TileType } from './mapData';
import { audioSystem } from '../services/audioSystem';

export type AntonioState = 'PATROL' | 'HEARD_NOISE' | 'SEARCH' | 'CHASE' | 'LOST' | 'RETURN';

export interface PlayerTarget {
  id: string;
  x: number;
  y: number;
  isHiding: boolean;
  isDowned: boolean;
}

export class AntonioAI {
  public x: number = 23 * TILE_SIZE;
  public y: number = 30 * TILE_SIZE;
  public facing: 'up' | 'down' | 'left' | 'right' = 'down';
  public state: AntonioState = 'PATROL';
  
  // Navigation & Targets
  public targetX: number = 23 * TILE_SIZE;
  public targetY: number = 20 * TILE_SIZE;
  public currentWaypointIndex: number = 0;
  
  // Speeds
  public patrolSpeed: number = 44; // px/s
  public chaseSpeed: number = 88; // px/s
  public searchSpeed: number = 36; // px/s
  
  // Search & Lost timers
  private searchTimer: number = 0;
  private searchDuration: number = 5000;
  private searchSubStep: number = 0;
  private lastSeenPlayerPos: { x: number; y: number } | null = null;
  private targetPlayerId: string | null = null;
  private wasChasing: boolean = false;

  constructor() {
    this.setNextPatrolWaypoint();
  }

  public update(
    deltaMs: number,
    players: PlayerTarget[],
    map: number[][],
    noiseAlert: { heard: boolean; approxX: number; approxY: number; category: string } | null
  ) {
    const dt = deltaMs / 1000;

    // 1. Noise Detection Check (can interrupt PATROL, SEARCH, RETURN)
    if (noiseAlert && noiseAlert.heard && this.state !== 'CHASE') {
      this.state = 'HEARD_NOISE';
      this.targetX = noiseAlert.approxX;
      this.targetY = noiseAlert.approxY;
      this.searchTimer = 0;
    }

    // 2. Vision Check: Can Antonio see any unhidden player?
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
      this.wasChasing = true;
    } else if (this.state === 'CHASE') {
      // Just lost visual contact!
      this.state = 'LOST';
      this.searchTimer = 0;
      if (this.lastSeenPlayerPos) {
        this.targetX = this.lastSeenPlayerPos.x;
        this.targetY = this.lastSeenPlayerPos.y;
      }
    }

    // 3. State Machine Execution
    switch (this.state) {
      case 'PATROL':
        this.executePatrol(dt, map);
        break;

      case 'HEARD_NOISE':
        this.executeMoveToTarget(dt, this.patrolSpeed * 1.25, map, () => {
          // Reached noise area, begin thorough search
          this.state = 'SEARCH';
          this.searchTimer = 0;
          this.searchSubStep = 0;
        });
        break;

      case 'SEARCH':
        this.executeSearch(dt, deltaMs, map);
        break;

      case 'CHASE':
        this.executeChase(dt, map);
        break;

      case 'LOST':
        this.executeMoveToTarget(dt, this.chaseSpeed * 0.8, map, () => {
          this.state = 'SEARCH';
          this.searchTimer = 0;
          this.searchSubStep = 0;
        });
        break;

      case 'RETURN':
        this.executeReturn(dt, map);
        break;
    }
  }

  private executePatrol(dt: number, map: number[][]) {
    this.executeMoveToTarget(dt, this.patrolSpeed, map, () => {
      this.currentWaypointIndex = (this.currentWaypointIndex + 1) % PATROL_WAYPOINTS.length;
      this.setNextPatrolWaypoint();
    });
  }

  private executeChase(dt: number, map: number[][]) {
    this.executeMoveToTarget(dt, this.chaseSpeed, map);
  }

  private executeSearch(dt: number, deltaMs: number, map: number[][]) {
    this.searchTimer += deltaMs;

    // Look around periodically
    if (this.searchTimer > (this.searchSubStep + 1) * 1100) {
      this.searchSubStep++;
      const dirs: ('up' | 'down' | 'left' | 'right')[] = ['right', 'down', 'left', 'up'];
      this.facing = dirs[this.searchSubStep % dirs.length];
      
      // Jitter around current spot
      const angles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
      const a = angles[this.searchSubStep % angles.length];
      this.targetX = this.x + Math.cos(a) * 35;
      this.targetY = this.y + Math.sin(a) * 35;
    }

    // Slowly shuffle towards search sub-target
    this.executeMoveToTarget(dt, this.searchSpeed, map);

    if (this.searchTimer >= this.searchDuration) {
      // Done searching, no player found. Return to patrol!
      this.state = 'RETURN';
      this.setNearestWaypoint();
    }
  }

  private executeReturn(dt: number, map: number[][]) {
    this.executeMoveToTarget(dt, this.patrolSpeed, map, () => {
      this.state = 'PATROL';
    });
  }

  private setNextPatrolWaypoint() {
    const wp = PATROL_WAYPOINTS[this.currentWaypointIndex];
    if (wp) {
      this.targetX = wp.x;
      this.targetY = wp.y;
    }
  }

  private setNearestWaypoint() {
    let nearestIdx = 0;
    let minDist = Infinity;
    PATROL_WAYPOINTS.forEach((wp, idx) => {
      const d = Math.hypot(this.x - wp.x, this.y - wp.y);
      if (d < minDist) {
        minDist = d;
        nearestIdx = idx;
      }
    });
    this.currentWaypointIndex = nearestIdx;
    this.setNextPatrolWaypoint();
  }

  private executeMoveToTarget(
    dt: number,
    speed: number,
    map: number[][],
    onArrival?: () => void
  ) {
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 12) {
      if (onArrival) onArrival();
      return;
    }

    // Direction vector
    let vx = (dx / dist) * speed * dt;
    let vy = (dy / dist) * speed * dt;

    // Update facing
    if (Math.abs(dx) > Math.abs(dy)) {
      this.facing = dx > 0 ? 'right' : 'left';
    } else {
      this.facing = dy > 0 ? 'down' : 'up';
    }

    // Move with wall collision check
    let newX = this.x + vx;
    let newY = this.y + vy;

    if (!this.isTileSolid(newX, this.y, map)) {
      this.x = newX;
    } else {
      // Slide along Y
      if (!this.isTileSolid(this.x, this.y + (dy > 0 ? 1 : -1) * speed * dt, map)) {
        this.y += (dy > 0 ? 1 : -1) * speed * dt;
      }
    }

    if (!this.isTileSolid(this.x, newY, map)) {
      this.y = newY;
    } else {
      // Slide along X
      if (!this.isTileSolid(this.x + (dx > 0 ? 1 : -1) * speed * dt, this.y, map)) {
        this.x += (dx > 0 ? 1 : -1) * speed * dt;
      }
    }
  }

  public isTileSolid(px: number, py: number, map: number[][]): boolean {
    const col = Math.floor(px / TILE_SIZE);
    const row = Math.floor(py / TILE_SIZE);

    if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
      return true;
    }

    const t = map[row][col];
    return (
      t === TileType.WALL_SOLID ||
      t === TileType.WALL_BORDER ||
      t === TileType.OBSTACLE_DESK ||
      t === TileType.OBSTACLE_SHELF
    );
  }

  /**
   * Field of View (FOV) & Line of Sight (LOS) calculation.
   * Checks distance, cone angle, and raycasts against map walls.
   */
  private checkLineOfSight(players: PlayerTarget[], map: number[][]): PlayerTarget | null {
    const maxVisionDist = 240; // ~7.5 tiles in pixels
    const halfFov = Math.PI * 0.38; // ~68 degrees on each side

    for (const player of players) {
      // Hidden players in lockers or already downed players are not chased
      if (player.isHiding || player.isDowned) continue;

      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > maxVisionDist) continue;

      // Check facing angle
      const angleToPlayer = Math.atan2(dy, dx);
      let facingAngle = 0;
      if (this.facing === 'down') facingAngle = Math.PI / 2;
      else if (this.facing === 'up') facingAngle = -Math.PI / 2;
      else if (this.facing === 'left') facingAngle = Math.PI;
      else if (this.facing === 'right') facingAngle = 0;

      let angleDiff = Math.abs(angleToPlayer - facingAngle);
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      // Sighted if within FOV cone, or very close (within 40px personal space)
      if (angleDiff <= halfFov || dist < 42) {
        // Raycast: verify no solid wall blocks line of sight
        if (this.hasClearLineOfSight(this.x, this.y, player.x, player.y, map)) {
          return player;
        }
      }
    }

    return null;
  }

  /**
   * Bresenham-style raycast check between two points.
   */
  public hasClearLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    map: number[][]
  ): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 12); // Check every 12 pixels

    for (let i = 1; i < steps; i++) {
      const cx = x1 + ((x2 - x1) * i) / steps;
      const cy = y1 + ((y2 - y1) * i) / steps;
      if (this.isTileSolid(cx, cy, map)) {
        return false; // Obstructed by wall
      }
    }
    return true;
  }
}
