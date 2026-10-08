/**
 * Circular Minimap Component for "FUJA DA SOLANGE!!"
 * 
 * Rules:
 * 1. Formato CÍRCULO no canto inferior direito.
 * 2. Mostra APENAS o que está dentro do campo de visão (FOV) atual do jogador.
 * 3. Paredes bloqueiam a visão do minimapa por raycast.
 * 4. NUNCA mostra Solange ou o parceiro se estiverem atrás de paredes ou na escuridão!
 * 5. Borda discreta em pixel art.
 */

import React, { useRef, useEffect } from 'react';
import { TILE_SIZE, TileType, MAP_COLS, MAP_ROWS } from './mapData';

interface CircularMinimapProps {
  playerX: number;
  playerY: number;
  isHiding: boolean;
  map: number[][];
  solangeX: number;
  solangeY: number;
  solangeVisible: boolean; // True ONLY if within direct player line-of-sight
  remotePlayerX?: number;
  remotePlayerY?: number;
  remotePlayerVisible?: boolean;
}

export const CircularMinimap: React.FC<CircularMinimapProps> = ({
  playerX,
  playerY,
  isHiding,
  map,
  solangeX,
  solangeY,
  solangeVisible,
  remotePlayerX,
  remotePlayerY,
  remotePlayerVisible,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;

    const size = canvas.width;
    const center = size / 2;
    const radius = center - 4; // Circle radius inside border
    const worldRadius = 140; // World pixels visible around player (approx 4.5 tiles)
    const scale = radius / worldRadius;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // 1. Clip to Circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    // Background darkness
    ctx.fillStyle = '#06080e';
    ctx.fillRect(0, 0, size, size);

    if (!isHiding) {
      // 2. Compute Raycast Visibility Polygon
      const numRays = 48;
      const rayPoints: { x: number; y: number }[] = [];

      for (let i = 0; i <= numRays; i++) {
        const angle = (i * 2 * Math.PI) / numRays;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        let dist = worldRadius;
        const step = 6;
        for (let d = 6; d <= worldRadius; d += step) {
          const cx = playerX + cos * d;
          const cy = playerY + sin * d;
          const col = Math.floor(cx / TILE_SIZE);
          const row = Math.floor(cy / TILE_SIZE);

          if (
            row >= 0 &&
            row < MAP_ROWS &&
            col >= 0 &&
            col < MAP_COLS &&
            (map[row][col] === TileType.WALL_SOLID ||
              map[row][col] === TileType.WALL_BORDER ||
              map[row][col] === TileType.OBSTACLE_DESK ||
              map[row][col] === TileType.OBSTACLE_SHELF)
          ) {
            dist = d;
            break;
          }
        }

        rayPoints.push({
          x: center + cos * dist * scale,
          y: center + sin * dist * scale,
        });
      }

      // 3. Draw Visible Geometry inside Raycast Polygon
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(rayPoints[0].x, rayPoints[0].y);
      for (let i = 1; i < rayPoints.length; i++) {
        ctx.lineTo(rayPoints[i].x, rayPoints[i].y);
      }
      ctx.closePath();
      ctx.clip();

      // Draw visible map tiles
      const startCol = Math.max(0, Math.floor((playerX - worldRadius) / TILE_SIZE));
      const endCol = Math.min(MAP_COLS - 1, Math.ceil((playerX + worldRadius) / TILE_SIZE));
      const startRow = Math.max(0, Math.floor((playerY - worldRadius) / TILE_SIZE));
      const endRow = Math.min(MAP_ROWS - 1, Math.ceil((playerY + worldRadius) / TILE_SIZE));

      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const tile = map[r][c];
          const rx = center + (c * TILE_SIZE - playerX) * scale;
          const ry = center + (r * TILE_SIZE - playerY) * scale;
          const tSize = TILE_SIZE * scale;

          if (
            tile === TileType.WALL_SOLID ||
            tile === TileType.WALL_BORDER
          ) {
            ctx.fillStyle = '#334155';
            ctx.fillRect(rx, ry, tSize + 0.5, tSize + 0.5);
          } else if (
            tile === TileType.OBSTACLE_DESK ||
            tile === TileType.OBSTACLE_SHELF
          ) {
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(rx, ry, tSize, tSize);
          } else {
            // Floor
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(rx, ry, tSize + 0.5, tSize + 0.5);
          }
        }
      }

      // Draw Teammate ONLY if in direct line of sight
      if (remotePlayerVisible && remotePlayerX !== undefined && remotePlayerY !== undefined) {
        const tX = center + (remotePlayerX - playerX) * scale;
        const tY = center + (remotePlayerY - playerY) * scale;
        ctx.fillStyle = '#38bdf8'; // Blue student
        ctx.beginPath();
        ctx.arc(tX, tY, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Solange ONLY if in direct line of sight (never through walls!)
      if (solangeVisible) {
        const sX = center + (solangeX - playerX) * scale;
        const sY = center + (solangeY - playerY) * scale;
        ctx.fillStyle = '#ef4444'; // Red stalker warning
        ctx.beginPath();
        ctx.arc(sX, sY, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    } else {
      // While hiding in locker: narrow horizontal slit on minimap
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(center - 18, center - 4, 36, 8);
    }

    // 4. Player Center Dot
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(center, center, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Restore unclipped

    // 5. Retro Pixel Art Circle Border & Crosshairs
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Subtle compass tick marks
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center, 1);
    ctx.lineTo(center, 5);
    ctx.moveTo(center, size - 5);
    ctx.lineTo(center, size - 1);
    ctx.moveTo(1, center);
    ctx.lineTo(5, center);
    ctx.moveTo(size - 5, center);
    ctx.lineTo(size - 1, center);
    ctx.stroke();
  }, [
    playerX,
    playerY,
    isHiding,
    map,
    solangeX,
    solangeY,
    solangeVisible,
    remotePlayerX,
    remotePlayerY,
    remotePlayerVisible,
  ]);

  return (
    <div className="relative flex flex-col items-center">
      <div className="text-[9px] uppercase tracking-wider text-neutral-400 font-bold mb-1">
        VISÃO LOCAL
      </div>
      <div className="relative w-36 h-36 bg-black/85 rounded-full p-1 border border-neutral-700/80 shadow-2xl backdrop-blur-md">
        <canvas
          ref={canvasRef}
          width={136}
          height={136}
          className="w-full h-full block rounded-full"
        />
      </div>
    </div>
  );
};
