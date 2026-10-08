/**
 * Pixel Art Sprite Generator & Frame Registry for "Depois da Última Aula"
 * Generates crisp 2D retro sprites directly via offscreen canvas.
 * Also supports custom frame injection (user can upload/paste stalker frames).
 */

export interface SpriteFrame {
  canvas: HTMLCanvasElement;
}

export interface CharacterAnimations {
  idle: SpriteFrame[];
  walk: SpriteFrame[];
  run: SpriteFrame[];
  interact?: SpriteFrame[];
  scared?: SpriteFrame[];
  capture?: SpriteFrame[];
}

export class SpriteRegistry {
  private static instance: SpriteRegistry;
  public player1Sprites!: Record<string, CharacterAnimations>;
  public player2Sprites!: Record<string, CharacterAnimations>;
  public antonioSprites!: Record<string, CharacterAnimations>;
  public tileTextures: Map<string, HTMLCanvasElement> = new Map();
  public itemTextures: Map<string, HTMLCanvasElement> = new Map();
  private customAntonioImage: HTMLImageElement | null = null;

  private constructor() {
    this.generateAll();
  }

  public static getInstance(): SpriteRegistry {
    if (!SpriteRegistry.instance) {
      SpriteRegistry.instance = new SpriteRegistry();
    }
    return SpriteRegistry.instance;
  }

  /**
   * Allows user to inject custom image / frames for Antônio!
   */
  public setCustomAntonioFrames(img: HTMLImageElement) {
    this.customAntonioImage = img;
  }

  public getCustomAntonioImage(): HTMLImageElement | null {
    return this.customAntonioImage;
  }

  private generateAll() {
    this.player1Sprites = this.createHumanCharacterSet('#3b82f6', '#1e3a8a', '#10b981'); // Blue jacket / student
    this.player2Sprites = this.createHumanCharacterSet('#f59e0b', '#b45309', '#ec4899'); // Amber jacket / student
    this.antonioSprites = this.createAntonioCharacterSet();
    this.generateTileTextures();
    this.generateItemTextures();
  }

  private createHumanCharacterSet(jacketColor: string, pantsColor: string, accentColor: string) {
    const directions = ['up', 'down', 'left', 'right'];
    const result: Record<string, CharacterAnimations> = {};

    directions.forEach((dir) => {
      result[dir] = {
        idle: [this.renderHumanFrame(dir, 0, jacketColor, pantsColor, accentColor, 'idle')],
        walk: [
          this.renderHumanFrame(dir, 1, jacketColor, pantsColor, accentColor, 'walk'),
          this.renderHumanFrame(dir, 0, jacketColor, pantsColor, accentColor, 'walk'),
          this.renderHumanFrame(dir, 2, jacketColor, pantsColor, accentColor, 'walk'),
          this.renderHumanFrame(dir, 0, jacketColor, pantsColor, accentColor, 'walk'),
        ],
        run: [
          this.renderHumanFrame(dir, 1, jacketColor, pantsColor, accentColor, 'run'),
          this.renderHumanFrame(dir, 2, jacketColor, pantsColor, accentColor, 'run'),
        ],
        interact: [this.renderHumanFrame(dir, 3, jacketColor, pantsColor, accentColor, 'interact')],
      };
    });

    return result;
  }

  private renderHumanFrame(
    direction: string,
    step: number,
    jacketColor: string,
    pantsColor: string,
    accentColor: string,
    action: string
  ): SpriteFrame {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const legOffset = step === 1 ? -2 : step === 2 ? 2 : 0;
    const armBob = action === 'run' ? (step === 1 ? 3 : -3) : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(16, 29, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = pantsColor;
    ctx.fillRect(11 + legOffset, 20, 4, 8);
    ctx.fillRect(17 - legOffset, 20, 4, 8);

    // Shoes
    ctx.fillStyle = '#111827';
    ctx.fillRect(10 + legOffset, 27, 5, 3);
    ctx.fillRect(17 - legOffset, 27, 5, 3);

    // Body (Jacket / Hoodie)
    ctx.fillStyle = jacketColor;
    ctx.fillRect(10, 11, 12, 10);

    // Backpack straps / accent
    ctx.fillStyle = accentColor;
    if (direction === 'down') {
      ctx.fillRect(12, 13, 2, 7);
      ctx.fillRect(18, 13, 2, 7);
    } else if (direction === 'up') {
      // Backpack on back
      ctx.fillRect(11, 12, 10, 8);
    } else if (direction === 'left' || direction === 'right') {
      ctx.fillRect(direction === 'left' ? 18 : 10, 12, 4, 8);
    }

    // Arms
    ctx.fillStyle = jacketColor;
    if (direction === 'left') {
      ctx.fillRect(13, 13 + armBob, 4, 7);
    } else if (direction === 'right') {
      ctx.fillRect(15, 13 + armBob, 4, 7);
    } else {
      ctx.fillRect(7, 12 + armBob, 3, 7);
      ctx.fillRect(22, 12 - armBob, 3, 7);
    }

    // Hands
    ctx.fillStyle = '#fbcfe8';
    if (direction === 'down' || direction === 'up') {
      ctx.fillRect(7, 18 + armBob, 3, 2);
      ctx.fillRect(22, 18 - armBob, 3, 2);
    }

    // Head
    ctx.fillStyle = '#fed7aa'; // Skin
    ctx.fillRect(11, 4, 10, 8);

    // Hair
    ctx.fillStyle = '#374151';
    ctx.fillRect(10, 3, 12, 4);
    if (direction === 'down') {
      ctx.fillRect(10, 3, 3, 6);
      ctx.fillRect(19, 3, 3, 6);
      // Eyes
      ctx.fillStyle = '#111827';
      ctx.fillRect(13, 7, 2, 2);
      ctx.fillRect(17, 7, 2, 2);
    } else if (direction === 'left') {
      ctx.fillRect(10, 3, 5, 6);
      ctx.fillStyle = '#111827';
      ctx.fillRect(12, 7, 2, 2);
    } else if (direction === 'right') {
      ctx.fillRect(17, 3, 5, 6);
      ctx.fillStyle = '#111827';
      ctx.fillRect(18, 7, 2, 2);
    }

    // Flashlight in hand
    ctx.fillStyle = '#9ca3af';
    if (direction === 'down') ctx.fillRect(22, 19, 2, 4);
    else if (direction === 'right') ctx.fillRect(20, 16, 4, 2);
    else if (direction === 'left') ctx.fillRect(8, 16, 4, 2);

    return { canvas };
  }

  private createAntonioCharacterSet() {
    const directions = ['up', 'down', 'left', 'right'];
    const result: Record<string, CharacterAnimations> = {};

    directions.forEach((dir) => {
      result[dir] = {
        idle: [this.renderAntonioFrame(dir, 0, 'idle')],
        walk: [
          this.renderAntonioFrame(dir, 1, 'walk'),
          this.renderAntonioFrame(dir, 0, 'walk'),
          this.renderAntonioFrame(dir, 2, 'walk'),
          this.renderAntonioFrame(dir, 0, 'walk'),
        ],
        run: [
          this.renderAntonioFrame(dir, 1, 'chase'),
          this.renderAntonioFrame(dir, 2, 'chase'),
        ],
        capture: [this.renderAntonioFrame(dir, 3, 'capture')],
      };
    });

    return result;
  }

  private renderAntonioFrame(direction: string, step: number, state: string): SpriteFrame {
    // Antonio is taller (32x40) - imposing janitor / shadowy stalker
    const canvas = document.createElement('canvas');
    canvas.width = 36;
    canvas.height = 42;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const legShift = step === 1 ? -3 : step === 2 ? 3 : 0;
    const isChasing = state === 'chase';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(18, 39, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dark heavy work boots
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(11 + legShift, 34, 5, 5);
    ctx.fillRect(20 - legShift, 34, 5, 5);

    // Stained Janitor Pants / Overalls
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(11 + legShift, 24, 6, 11);
    ctx.fillRect(19 - legShift, 24, 6, 11);

    // Janitor Long Coat / Smock
    ctx.fillStyle = isChasing ? '#311010' : '#1c1917';
    ctx.fillRect(9, 11, 18, 17);

    // Keychain ring / tool belt on waist
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(12, 22, 3, 4); // Brass keys
    ctx.fillRect(21, 22, 2, 2);

    // Broad Shoulders & Arms
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(6, 12, 4, 11);
    ctx.fillRect(26, 12, 4, 11);

    // Heavy Janitor Flashlight (Ominous yellow brass)
    ctx.fillStyle = '#d97706';
    if (direction === 'down') {
      ctx.fillRect(27, 21, 4, 8);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(27, 28, 4, 2);
    } else if (direction === 'right') {
      ctx.fillRect(26, 17, 8, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(33, 17, 2, 4);
    } else if (direction === 'left') {
      ctx.fillRect(2, 17, 8, 4);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, 17, 2, 4);
    }

    // Pale sunken face / Head
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(12, 3, 12, 9);

    // Greying hair / Cap
    ctx.fillStyle = '#475569';
    ctx.fillRect(11, 1, 14, 4);

    // Glowing intense eyes
    ctx.fillStyle = isChasing ? '#dc2626' : '#f59e0b';
    if (direction === 'down') {
      ctx.fillRect(14, 6, 2, 2);
      ctx.fillRect(20, 6, 2, 2);
    } else if (direction === 'left') {
      ctx.fillRect(13, 6, 2, 2);
    } else if (direction === 'right') {
      ctx.fillRect(21, 6, 2, 2);
    }

    return { canvas };
  }

  private generateTileTextures() {
    // 1. Corridor Tile (Checkered hospital/school linoleum)
    const floorTile = document.createElement('canvas');
    floorTile.width = 32;
    floorTile.height = 32;
    const fctx = floorTile.getContext('2d')!;
    fctx.fillStyle = '#1e293b';
    fctx.fillRect(0, 0, 32, 32);
    fctx.strokeStyle = '#0f172a';
    fctx.lineWidth = 1;
    fctx.strokeRect(0, 0, 32, 32);
    fctx.fillStyle = '#334155';
    fctx.fillRect(1, 1, 15, 15);
    fctx.fillRect(16, 16, 15, 15);
    this.tileTextures.set('floor_tile', floorTile);

    // 2. Classroom Wood Parquet Floor
    const floorWood = document.createElement('canvas');
    floorWood.width = 32;
    floorWood.height = 32;
    const wctx = floorWood.getContext('2d')!;
    wctx.fillStyle = '#3e2723';
    wctx.fillRect(0, 0, 32, 32);
    wctx.fillStyle = '#4e342e';
    wctx.fillRect(0, 0, 32, 8);
    wctx.fillRect(0, 16, 32, 8);
    wctx.strokeStyle = '#271915';
    wctx.strokeRect(0, 0, 32, 32);
    this.tileTextures.set('floor_wood', floorWood);

    // 3. Library/Office Carpet Floor
    const floorCarpet = document.createElement('canvas');
    floorCarpet.width = 32;
    floorCarpet.height = 32;
    const cctx = floorCarpet.getContext('2d')!;
    cctx.fillStyle = '#1a365d';
    cctx.fillRect(0, 0, 32, 32);
    cctx.fillStyle = '#234e52';
    for (let i = 2; i < 30; i += 6) {
      for (let j = 2; j < 30; j += 6) {
        cctx.fillRect(i, j, 2, 2);
      }
    }
    this.tileTextures.set('floor_carpet', floorCarpet);

    // 4. Solid Brick/Concrete Wall
    const wallSolid = document.createElement('canvas');
    wallSolid.width = 32;
    wallSolid.height = 32;
    const wlctx = wallSolid.getContext('2d')!;
    wlctx.fillStyle = '#0f172a';
    wlctx.fillRect(0, 0, 32, 32);
    wlctx.fillStyle = '#1e293b';
    wlctx.fillRect(0, 0, 32, 6); // Top border
    wlctx.fillStyle = '#334155';
    wlctx.fillRect(2, 8, 12, 10);
    wlctx.fillRect(16, 8, 14, 10);
    wlctx.fillRect(2, 20, 28, 10);
    wlctx.strokeStyle = '#090d16';
    wlctx.strokeRect(0, 0, 32, 32);
    this.tileTextures.set('wall_solid', wallSolid);
  }

  private generateItemTextures() {
    // Locker
    const locker = document.createElement('canvas');
    locker.width = 32;
    locker.height = 48;
    const lctx = locker.getContext('2d')!;
    lctx.fillStyle = '#475569';
    lctx.fillRect(2, 2, 28, 44);
    lctx.strokeStyle = '#1e293b';
    lctx.strokeRect(2, 2, 28, 44);
    lctx.fillStyle = '#0f172a';
    // Vent slits
    lctx.fillRect(8, 8, 16, 2);
    lctx.fillRect(8, 12, 16, 2);
    lctx.fillRect(8, 16, 16, 2);
    // Handle
    lctx.fillStyle = '#cbd5e1';
    lctx.fillRect(22, 24, 3, 6);
    this.itemTextures.set('locker', locker);

    // Book
    const book = document.createElement('canvas');
    book.width = 24;
    book.height = 24;
    const bctx = book.getContext('2d')!;
    bctx.fillStyle = '#991b1b';
    bctx.fillRect(3, 4, 18, 16);
    bctx.fillStyle = '#fef08a';
    bctx.fillRect(5, 6, 14, 2);
    bctx.fillStyle = '#f8fafc';
    bctx.fillRect(19, 4, 3, 16); // Pages
    this.itemTextures.set('book', book);

    // Fuse
    const fuse = document.createElement('canvas');
    fuse.width = 20;
    fuse.height = 20;
    const fsctx = fuse.getContext('2d')!;
    fsctx.fillStyle = '#cbd5e1';
    fsctx.fillRect(3, 7, 4, 6);
    fsctx.fillRect(13, 7, 4, 6);
    fsctx.fillStyle = '#0ea5e9'; // Glass cylinder
    fsctx.fillRect(7, 6, 6, 8);
    fsctx.fillStyle = '#fbbf24'; // Filament wire
    fsctx.fillRect(8, 9, 4, 2);
    this.itemTextures.set('fuse', fuse);

    // Clue Note
    const clue = document.createElement('canvas');
    clue.width = 20;
    clue.height = 20;
    const cctx = clue.getContext('2d')!;
    cctx.fillStyle = '#fef08a';
    cctx.fillRect(2, 2, 16, 16);
    cctx.fillStyle = '#0f172a';
    cctx.fillRect(4, 5, 12, 2);
    cctx.fillRect(4, 9, 8, 2);
    cctx.fillRect(4, 13, 10, 2);
    this.itemTextures.set('clue', clue);

    // Fuse Box
    const fbox = document.createElement('canvas');
    fbox.width = 32;
    fbox.height = 32;
    const fbctx = fbox.getContext('2d')!;
    fbctx.fillStyle = '#334155';
    fbctx.fillRect(2, 2, 28, 28);
    fbctx.strokeStyle = '#0f172a';
    fbctx.strokeRect(2, 2, 28, 28);
    fbctx.fillStyle = '#ef4444'; // Red light (unpowered)
    fbctx.fillRect(6, 6, 4, 4);
    fbctx.fillStyle = '#22c55e'; // Green slot
    fbctx.fillRect(14, 10, 10, 12);
    this.itemTextures.set('fuse_box', fbox);

    // Computer Terminal
    const comp = document.createElement('canvas');
    comp.width = 32;
    comp.height = 32;
    const cmctx = comp.getContext('2d')!;
    cmctx.fillStyle = '#1e293b';
    cmctx.fillRect(4, 4, 24, 18);
    cmctx.fillStyle = '#0284c7'; // CRT Screen glowing
    cmctx.fillRect(6, 6, 20, 14);
    cmctx.fillStyle = '#38bdf8';
    cmctx.fillRect(8, 8, 8, 2);
    cmctx.fillRect(8, 12, 12, 2);
    // Keyboard & base
    cmctx.fillStyle = '#334155';
    cmctx.fillRect(6, 24, 20, 6);
    this.itemTextures.set('computer', comp);

    // Main Gate
    const gate = document.createElement('canvas');
    gate.width = 64;
    gate.height = 32;
    const gctx = gate.getContext('2d')!;
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 64, 32);
    // Iron Bars
    gctx.fillStyle = '#64748b';
    for (let x = 4; x < 60; x += 6) {
      gctx.fillRect(x, 2, 3, 28);
    }
    // Heavy chains
    gctx.fillStyle = '#e2e8f0';
    gctx.fillRect(26, 12, 12, 8);
    gctx.fillStyle = '#eab308'; // Padlock
    gctx.fillRect(29, 14, 6, 6);
    this.itemTextures.set('main_gate', gate);
  }
}
