/**
 * Dynamic Lighting, Darkness Mask & Raycast Shadow Occlusion System
 * Creates claustrophobic 3-5 tile visibility, wall occlusion, and flickering lights.
 */

import { TILE_SIZE, TileType } from './mapData';

export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  flicker?: boolean;
  color?: string;
}

export class LightingSystem {
  private darknessCanvas: HTMLCanvasElement;
  private darknessCtx: CanvasRenderingContext2D;

  constructor() {
    this.darknessCanvas = document.createElement('canvas');
    this.darknessCtx = this.darknessCanvas.getContext('2d')!;
  }

  public renderLighting(
    destCtx: CanvasRenderingContext2D,
    screenWidth: number,
    screenHeight: number,
    cameraX: number,
    cameraY: number,
    playerX: number,
    playerY: number,
    isHiding: boolean,
    antonioX: number,
    antonioY: number,
    antonioFacing: string,
    isChasing: boolean,
    roomLights: LightSource[],
    map: number[][]
  ) {
    if (this.darknessCanvas.width !== screenWidth || this.darknessCanvas.height !== screenHeight) {
      this.darknessCanvas.width = screenWidth;
      this.darknessCanvas.height = screenHeight;
    }

    const ctx = this.darknessCtx;
    // 1. Base Pitch Black
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(6, 8, 14, 0.97)';
    ctx.fillRect(0, 0, screenWidth, screenHeight);

    // 2. Cut out light shapes with 'destination-out'
    ctx.globalCompositeOperation = 'destination-out';

    // Player screen position
    const pScreenX = playerX - cameraX;
    const pScreenY = playerY - cameraY;

    if (isHiding) {
      // Hiding in locker: Narrow slit view
      const slitWidth = 140;
      const slitHeight = 44;
      const grad = ctx.createRadialGradient(
        pScreenX,
        pScreenY,
        10,
        pScreenX,
        pScreenY,
        slitWidth / 1.5
      );
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(pScreenX - slitWidth / 2, pScreenY - slitHeight / 2, slitWidth, slitHeight);

      // Vent bars
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(10, 10, 15, 0.9)';
      for (let i = -slitWidth / 2 + 10; i < slitWidth / 2; i += 18) {
        ctx.fillRect(pScreenX + i, pScreenY - slitHeight / 2, 5, slitHeight);
      }
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      // Normal: Flashlight with soft radial falloff (approx 4 tiles = 130px)
      const baseRadius = 135;
      const flickerFactor = Math.sin(Date.now() / 140) * 4 + Math.random() * 2;
      const lightRadius = Math.max(90, baseRadius + flickerFactor);

      // Cast rays to prevent light leaking through walls
      this.castShadowPolygon(ctx, playerX, playerY, lightRadius, cameraX, cameraY, map);
    }

    // Antonio's Flashlight Beam (creates dread when he turns corners!)
    const aScreenX = antonioX - cameraX;
    const aScreenY = antonioY - cameraY;

    // Render Antonio's beam only if within visible proximity to camera
    if (
      aScreenX > -200 &&
      aScreenX < screenWidth + 200 &&
      aScreenY > -200 &&
      aScreenY < screenHeight + 200
    ) {
      let angle = Math.PI / 2;
      if (antonioFacing === 'up') angle = -Math.PI / 2;
      else if (antonioFacing === 'left') angle = Math.PI;
      else if (antonioFacing === 'right') angle = 0;

      const beamLength = isChasing ? 190 : 150;
      const beamSpread = Math.PI * 0.28;

      ctx.save();
      ctx.translate(aScreenX, aScreenY);
      ctx.rotate(angle);

      const aGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, beamLength);
      aGrad.addColorStop(0, isChasing ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 230, 120, 0.85)');
      aGrad.addColorStop(0.7, isChasing ? 'rgba(200, 20, 20, 0.4)' : 'rgba(220, 180, 80, 0.3)');
      aGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.fillStyle = aGrad;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, beamLength, -beamSpread / 2, beamSpread / 2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Room lights (e.g. emergency lamps, library lamps, restored power)
    roomLights.forEach((light) => {
      const lScreenX = light.x - cameraX;
      const lScreenY = light.y - cameraY;

      if (
        lScreenX > -100 &&
        lScreenX < screenWidth + 100 &&
        lScreenY > -100 &&
        lScreenY < screenHeight + 100
      ) {
        let r = light.radius;
        if (light.flicker && Math.random() < 0.15) {
          r *= 0.7; // Buzzing flicker
        }

        const lGrad = ctx.createRadialGradient(lScreenX, lScreenY, 5, lScreenX, lScreenY, r);
        lGrad.addColorStop(0, `rgba(255, 255, 220, ${light.intensity})`);
        lGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = lGrad;
        ctx.beginPath();
        ctx.arc(lScreenX, lScreenY, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 3. Composite darkness mask onto final destination canvas
    destCtx.save();
    destCtx.globalCompositeOperation = 'source-over';
    destCtx.drawImage(this.darknessCanvas, 0, 0);

    // Vignette ring around viewport edges for horror claustrophobia
    const vigGrad = destCtx.createRadialGradient(
      screenWidth / 2,
      screenHeight / 2,
      Math.min(screenWidth, screenHeight) * 0.35,
      screenWidth / 2,
      screenHeight / 2,
      Math.max(screenWidth, screenHeight) * 0.75
    );
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, isChasing ? 'rgba(80, 0, 0, 0.65)' : 'rgba(0, 0, 0, 0.75)');

    destCtx.fillStyle = vigGrad;
    destCtx.fillRect(0, 0, screenWidth, screenHeight);
    destCtx.restore();
  }

  /**
   * Casts radial rays around player to compute visibility polygon,
   * stopping at solid walls so flashlight does NOT shine through walls.
   */
  private castShadowPolygon(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    radius: number,
    cameraX: number,
    cameraY: number,
    map: number[][]
  ) {
    const numRays = 48;
    const pScreenX = px - cameraX;
    const pScreenY = py - cameraY;

    ctx.beginPath();
    ctx.moveTo(pScreenX, pScreenY);

    for (let i = 0; i <= numRays; i++) {
      const angle = (i * 2 * Math.PI) / numRays;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // Ray march out to radius
      let dist = radius;
      const step = 8;
      for (let d = 8; d <= radius; d += step) {
        const checkX = px + cos * d;
        const checkY = py + sin * d;
        const col = Math.floor(checkX / TILE_SIZE);
        const row = Math.floor(checkY / TILE_SIZE);

        if (
          row >= 0 &&
          row < map.length &&
          col >= 0 &&
          col < map[0].length &&
          (map[row][col] === TileType.WALL_SOLID ||
            map[row][col] === TileType.WALL_BORDER ||
            map[row][col] === TileType.OBSTACLE_DESK ||
            map[row][col] === TileType.OBSTACLE_SHELF)
        ) {
          dist = d;
          break;
        }
      }

      const endScreenX = px + cos * dist - cameraX;
      const endScreenY = py + sin * dist - cameraY;
      ctx.lineTo(endScreenX, endScreenY);
    }

    ctx.closePath();

    const radGrad = ctx.createRadialGradient(pScreenX, pScreenY, 8, pScreenX, pScreenY, radius);
    radGrad.addColorStop(0, 'rgba(0, 0, 0, 0.98)');
    radGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.85)');
    radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = radGrad;
    ctx.fill();
  }
}

export const lightingSystem = new LightingSystem();
