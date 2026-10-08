/**
 * Unified Input Manager for "FUJA DA SOLANGE!!"
 * 
 * Supports:
 * - Keyboard (WASD / Arrow Keys, Shift, E, Escape)
 * - Remote Virtual Controller (dx, dy from -1 to +1, run, interact)
 * - Seamless integration: either input source feeds the same movement vector
 */

export interface InputState {
  dx: number;
  dy: number;
  isRunning: boolean;
  isInteracting: boolean;
  isHidingAction: boolean;
}

export class InputManager {
  private static instance: InputManager;

  // Keyboard raw state
  private keys: { [key: string]: boolean } = {};

  // Remote controller raw state
  private remoteDx: number = 0;
  private remoteDy: number = 0;
  private remoteRunning: boolean = false;
  private remoteInteracting: boolean = false;
  private remoteHiding: boolean = false;
  public isRemoteControllerActive: boolean = false;

  private constructor() {
    this.setupKeyboardListeners();
  }

  public static getInstance(): InputManager {
    if (!InputManager.instance) {
      InputManager.instance = new InputManager();
    }
    return InputManager.instance;
  }

  private setupKeyboardListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code.toLowerCase()] = true;
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code.toLowerCase()] = false;
    });
  }

  public setRemoteInput(dx: number, dy: number, run: boolean, interact: boolean, hide?: boolean) {
    this.remoteDx = dx;
    this.remoteDy = dy;
    this.remoteRunning = run;
    this.remoteInteracting = interact;
    this.remoteHiding = hide || false;
    this.isRemoteControllerActive = true;
  }

  public setRemoteDisconnected() {
    this.remoteDx = 0;
    this.remoteDy = 0;
    this.remoteRunning = false;
    this.remoteInteracting = false;
    this.remoteHiding = false;
    this.isRemoteControllerActive = false;
  }

  /**
   * Returns merged, normalized movement vector and actions
   */
  public getInputState(): InputState {
    let kx = 0;
    let ky = 0;

    if (this.keys['keyw'] || this.keys['arrowup']) ky -= 1;
    if (this.keys['keys'] || this.keys['arrowdown']) ky += 1;
    if (this.keys['keya'] || this.keys['arrowleft']) kx -= 1;
    if (this.keys['keyd'] || this.keys['arrowright']) kx += 1;

    const keyboardRunning = Boolean(this.keys['shiftleft'] || this.keys['shiftright']);
    const keyboardInteracting = Boolean(this.keys['keye']);

    // Merge keyboard and remote inputs
    let totalDx = kx !== 0 ? kx : this.remoteDx;
    let totalDy = ky !== 0 ? ky : this.remoteDy;

    // Normalization to prevent diagonal speed abuse
    const length = Math.hypot(totalDx, totalDy);
    if (length > 1) {
      totalDx /= length;
      totalDy /= length;
    }

    const isRunning = keyboardRunning || this.remoteRunning;
    const isInteracting = keyboardInteracting || this.remoteInteracting;
    const isHidingAction = this.remoteHiding;

    return {
      dx: totalDx,
      dy: totalDy,
      isRunning,
      isInteracting,
      isHidingAction,
    };
  }

  public isKeyPressed(code: string): boolean {
    return Boolean(this.keys[code.toLowerCase()]);
  }
}

export const inputManager = InputManager.getInstance();
