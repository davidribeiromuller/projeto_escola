/**
 * Noise & Hearing System for "Depois da Última Aula"
 * Simulates acoustic sound propagation, intensity, radius, and AI hearing detection.
 */

export interface NoiseEvent {
  id: string;
  x: number;
  y: number;
  intensity: 'low' | 'medium' | 'high' | 'critical';
  radius: number; // in pixels (e.g. 1 tile = 32px; 3 tiles = ~96px, 12 tiles = ~384px)
  duration: number; // in milliseconds
  createdAt: number;
  category: 'walk' | 'run' | 'interact' | 'door' | 'fuse' | 'alarm' | 'drop';
  sourcePlayerId?: string;
}

class NoiseSystem {
  private activeNoises: NoiseEvent[] = [];

  public emitNoise(
    x: number,
    y: number,
    category: NoiseEvent['category'],
    sourcePlayerId?: string
  ): NoiseEvent {
    let radius = 80;
    let intensity: NoiseEvent['intensity'] = 'low';
    let duration = 600;

    switch (category) {
      case 'walk':
        radius = 85; // ~2.5 tiles
        intensity = 'low';
        duration = 450;
        break;
      case 'run':
        radius = 350; // ~11 tiles
        intensity = 'high';
        duration = 750;
        break;
      case 'interact':
        radius = 160; // ~5 tiles
        intensity = 'medium';
        duration = 600;
        break;
      case 'door':
        radius = 220; // ~7 tiles
        intensity = 'medium';
        duration = 700;
        break;
      case 'fuse':
        radius = 480; // ~15 tiles (loud electrical spark/buzz)
        intensity = 'high';
        duration = 1000;
        break;
      case 'alarm':
      case 'drop':
        radius = 600; // ~19 tiles (critical noise)
        intensity = 'critical';
        duration = 1200;
        break;
    }

    const noise: NoiseEvent = {
      id: `noise_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      x,
      y,
      intensity,
      radius,
      duration,
      createdAt: Date.now(),
      category,
      sourcePlayerId,
    };

    this.activeNoises.push(noise);
    return noise;
  }

  public update(): NoiseEvent[] {
    const now = Date.now();
    this.activeNoises = this.activeNoises.filter(
      (n) => now - n.createdAt < n.duration
    );
    return this.activeNoises;
  }

  public getActiveNoises(): NoiseEvent[] {
    return this.activeNoises;
  }

  /**
   * Evaluates if Antonio can hear any active noise.
   * If yes, returns the approximate location (with noise jitter so Antonio never has pinpoint coordinates).
   */
  public checkHearing(
    antonioX: number,
    antonioY: number
  ): { heard: boolean; approxX: number; approxY: number; category: string } | null {
    const now = Date.now();
    for (const noise of this.activeNoises) {
      // Ignore if noise is expired
      if (now - noise.createdAt > noise.duration) continue;

      const dx = antonioX - noise.x;
      const dy = antonioY - noise.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= noise.radius) {
        // Antônio hears it! Add realistic directional jitter (30 to 60 pixels of fuzziness)
        const jitterAngle = Math.random() * Math.PI * 2;
        const jitterDistance = 25 + Math.random() * 45;
        const approxX = noise.x + Math.cos(jitterAngle) * jitterDistance;
        const approxY = noise.y + Math.sin(jitterAngle) * jitterDistance;

        return {
          heard: true,
          approxX,
          approxY,
          category: noise.category,
        };
      }
    }
    return null;
  }
}

export const noiseSystem = new NoiseSystem();
