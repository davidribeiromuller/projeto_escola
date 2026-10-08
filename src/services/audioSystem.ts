/**
 * Procedural Web Audio API Sound System for "Depois da Última Aula"
 * Generates realistic suspenseful audio directly in browser without external asset dependencies.
 */

class AudioSystem {
  private ctx: AudioContext | null = null;
  private ambientGain: GainNode | null = null;
  private heartbeatOsc: OscillatorNode | null = null;
  private isMuted: boolean = false;
  private heartbeatTimer: number | null = null;
  private currentHeartRate: number = 0; // 0 = none, 60 - 150 bpm

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ambientGain) {
      this.ambientGain.gain.value = this.isMuted ? 0 : 0.2;
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // --- Footsteps ---
  public playFootstep(isRunning: boolean, volume = 0.3) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isRunning ? 260 : 180, now);

    osc.type = isRunning ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isRunning ? 120 : 80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + (isRunning ? 0.08 : 0.05));

    gain.gain.setValueAtTime(volume * (isRunning ? 1.4 : 0.8), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isRunning ? 0.09 : 0.06));

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // --- Dynamic Heartbeat (Proportional to Solange's distance) ---
  public setHeartbeatProximity(distance: number, maxDistance: number = 400) {
    if (this.isMuted || distance > maxDistance || distance <= 0) {
      this.stopHeartbeat();
      return;
    }

    const intensity = 1 - Math.max(0, Math.min(1, distance / maxDistance)); // 0 to 1
    const targetBpm = Math.round(65 + intensity * 95); // 65 to 160 bpm

    if (this.currentHeartRate !== targetBpm) {
      this.currentHeartRate = targetBpm;
      this.startHeartbeatLoop(targetBpm, 0.25 + intensity * 0.55);
    }
  }

  private startHeartbeatLoop(bpm: number, volume: number) {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    const intervalMs = (60 / bpm) * 1000;

    const playThump = () => {
      if (this.isMuted || !this.ctx) return;
      const now = this.ctx.currentTime;

      // Double thump (Lub-dub)
      [0, 0.14].forEach((offset, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 55 : 45, now + offset);
        osc.frequency.exponentialRampToValueAtTime(25, now + offset + 0.12);

        gain.gain.setValueAtTime((idx === 0 ? volume : volume * 0.75), now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.14);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.15);
      });
    };

    playThump();
    this.heartbeatTimer = window.setInterval(playThump, intervalMs);
  }

  public stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.currentHeartRate = 0;
  }

  // --- Locker Open / Close ---
  public playLocker(isEntering: boolean) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.value = 3;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isEntering ? 300 : 150, now);
    osc.frequency.exponentialRampToValueAtTime(isEntering ? 120 : 380, now + 0.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // --- Door Squeak ---
  public playDoor() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(320, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.35);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // --- Mission Accomplished / Item Pickup ---
  public playItemPickup() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [330, 440];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.25, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.16);
    });
  }

  // --- Electrical Buzz (Fuse restored) ---
  public playFuseEngage() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.setValueAtTime(60, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  // --- Chase Alert Stinger (Antônio spots player!) ---
  public playChaseAlert() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';

    // Dissonant interval (minor second) for sudden dread
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.linearRampToValueAtTime(880, now + 0.3);

    osc2.frequency.setValueAtTime(466, now);
    osc2.frequency.linearRampToValueAtTime(932, now + 0.3);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  }

  // --- Gate opening heavy chain clang ---
  public playGateProgress() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // --- Continuous Ambient Drone ---
  public startAmbientLoop() {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx || this.ambientGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    this.ambientGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(48, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(90, now);

    this.ambientGain.gain.setValueAtTime(0.18, now);

    osc.connect(filter);
    filter.connect(this.ambientGain);
    this.ambientGain.connect(this.ctx.destination);

    osc.start();
  }

  public stopAmbient() {
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
      setTimeout(() => {
        this.ambientGain?.disconnect();
        this.ambientGain = null;
      }, 500);
    }
    this.stopHeartbeat();
  }
}

export const audioSystem = new AudioSystem();
