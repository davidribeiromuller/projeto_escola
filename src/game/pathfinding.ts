/**
 * High-Performance A* Grid Pathfinding System for "FUJA DA SOLANGE!!"
 * 
 * Features:
 * - 8-directional A* search
 * - Corner-cutting prevention (blocks diagonal movement if adjacent orthogonal tiles are solid)
 * - Nearest walkable tile fallback if target is close to an obstacle
 * - Raycast path smoothing for fluid organic movement
 */

import { TILE_SIZE, TileType, MAP_COLS, MAP_ROWS } from './mapData';

export interface Point {
  x: number;
  y: number;
}

export interface GridNode {
  col: number;
  row: number;
  g: number;
  h: number;
  f: number;
  parent: GridNode | null;
}

export class Pathfinding {
  public static isWalkable(col: number, row: number, map: number[][]): boolean {
    if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) {
      return false;
    }
    const tile = map[row][col];
    return !(
      tile === TileType.WALL_SOLID ||
      tile === TileType.WALL_BORDER ||
      tile === TileType.OBSTACLE_DESK ||
      tile === TileType.OBSTACLE_SHELF
    );
  }

  /**
   * Finds nearest walkable grid cell if target is currently blocked
   */
  public static findNearestWalkable(col: number, row: number, map: number[][]): { col: number; row: number } {
    if (this.isWalkable(col, row, map)) {
      return { col, row };
    }

    // Search in spirals (radius 1 to 4 tiles)
    for (let r = 1; r <= 4; r++) {
      for (let dc = -r; dc <= r; dc++) {
        for (let dr = -r; dr <= r; dr++) {
          if (Math.abs(dc) === r || Math.abs(dr) === r) {
            const nc = col + dc;
            const nr = row + dr;
            if (this.isWalkable(nc, nr, map)) {
              return { col: nc, row: nr };
            }
          }
        }
      }
    }

    return { col, row };
  }

  /**
   * Computes A* path from world (startX, startY) to (targetX, targetY).
   * Returns array of world coordinate waypoints.
   */
  public static findPath(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    map: number[][]
  ): Point[] {
    let startCol = Math.floor(startX / TILE_SIZE);
    let startRow = Math.floor(startY / TILE_SIZE);
    let targetCol = Math.floor(targetX / TILE_SIZE);
    let targetRow = Math.floor(targetY / TILE_SIZE);

    // Fallbacks if start or target are slightly inside an obstacle
    const safeStart = this.findNearestWalkable(startCol, startRow, map);
    startCol = safeStart.col;
    startRow = safeStart.row;

    const safeTarget = this.findNearestWalkable(targetCol, targetRow, map);
    targetCol = safeTarget.col;
    targetRow = safeTarget.row;

    if (startCol === targetCol && startRow === targetRow) {
      return [{ x: targetX, y: targetY }];
    }

    const openList: GridNode[] = [];
    const closedSet = new Set<number>();
    const nodeMap = new Map<number, GridNode>();

    const getKey = (c: number, r: number) => r * MAP_COLS + c;

    const startNode: GridNode = {
      col: startCol,
      row: startRow,
      g: 0,
      h: this.heuristic(startCol, startRow, targetCol, targetRow),
      f: 0,
      parent: null,
    };
    startNode.f = startNode.g + startNode.h;

    openList.push(startNode);
    nodeMap.set(getKey(startCol, startRow), startNode);

    // 8-direction offsets: [dc, dr, cost]
    const neighbors = [
      { dc: 0, dr: -1, cost: 1 }, // up
      { dc: 0, dr: 1, cost: 1 },  // down
      { dc: -1, dr: 0, cost: 1 }, // left
      { dc: 1, dr: 0, cost: 1 },  // right
      { dc: -1, dr: -1, cost: 1.414 }, // up-left
      { dc: 1, dr: -1, cost: 1.414 },  // up-right
      { dc: -1, dr: 1, cost: 1.414 },  // down-left
      { dc: 1, dr: 1, cost: 1.414 },   // down-right
    ];

    let iterations = 0;
    const maxIterations = 600; // Safeguard

    while (openList.length > 0 && iterations++ < maxIterations) {
      // Find node with lowest f cost
      let lowestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[lowestIdx].f) {
          lowestIdx = i;
        }
      }

      const current = openList[lowestIdx];

      // Reached target!
      if (current.col === targetCol && current.row === targetRow) {
        return this.reconstructPath(current, targetX, targetY);
      }

      // Remove from open list & mark in closed set
      openList.splice(lowestIdx, 1);
      const currentKey = getKey(current.col, current.row);
      closedSet.add(currentKey);

      for (const n of neighbors) {
        const nextCol = current.col + n.dc;
        const nextRow = current.row + n.dr;
        const nextKey = getKey(nextCol, nextRow);

        if (closedSet.has(nextKey)) continue;
        if (!this.isWalkable(nextCol, nextRow, map)) continue;

        // CRITICAL RULE: PREVENT CORNER CUTTING
        // If moving diagonally, both adjacent orthogonal tiles MUST be walkable!
        if (n.dc !== 0 && n.dr !== 0) {
          const ortho1 = this.isWalkable(current.col + n.dc, current.row, map);
          const ortho2 = this.isWalkable(current.col, current.row + n.dr, map);
          if (!ortho1 || !ortho2) {
            continue; // Corner blocked, do not cut diagonally!
          }
        }

        const tentativeG = current.g + n.cost;
        let nextNode = nodeMap.get(nextKey);

        if (!nextNode) {
          nextNode = {
            col: nextCol,
            row: nextRow,
            g: tentativeG,
            h: this.heuristic(nextCol, nextRow, targetCol, targetRow),
            f: 0,
            parent: current,
          };
          nextNode.f = nextNode.g + nextNode.h;
          nodeMap.set(nextKey, nextNode);
          openList.push(nextNode);
        } else if (tentativeG < nextNode.g) {
          nextNode.parent = current;
          nextNode.g = tentativeG;
          nextNode.f = nextNode.g + nextNode.h;
        }
      }
    }

    // Direct fallback if no full path found
    return [{ x: (safeTarget.col + 0.5) * TILE_SIZE, y: (safeTarget.row + 0.5) * TILE_SIZE }];
  }

  private static heuristic(c1: number, r1: number, c2: number, r2: number): number {
    // Octile distance heuristic
    const dx = Math.abs(c1 - c2);
    const dy = Math.abs(r1 - r2);
    return (dx + dy) + (1.414 - 2) * Math.min(dx, dy);
  }

  private static reconstructPath(endNode: GridNode, finalX: number, finalY: number): Point[] {
    const path: Point[] = [];
    let curr: GridNode | null = endNode;

    while (curr && curr.parent) {
      path.push({
        x: (curr.col + 0.5) * TILE_SIZE,
        y: (curr.row + 0.5) * TILE_SIZE,
      });
      curr = curr.parent;
    }

    path.reverse();

    // Replace last node with exact target coords
    if (path.length > 0) {
      path[path.length - 1] = { x: finalX, y: finalY };
    }

    return path;
  }
}
