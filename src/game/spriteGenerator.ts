/**
 * Pixel Art Sprite Generator & Frame Registry for "Depois da Última Aula"
 * Features the Stalker: Professora Cientista / Antônio
 * (Blonde hair, black sunglasses, white lab coat, pens in pocket, dark shirt, jeans & sneakers)
 * 
 * Supports:
 * - Direct slicing from the user's 3-row sprite sheet:
 *   Row 1: CORRENDO (6 frames)
 *   Row 2: PARADO PENSANDO (4 frames with '?' mark)
 *   Row 3: PARADO PULANDO FELIZ (5 frames)
 * - Directional mirroring (left/right/up/down)
 * - Instant fallback procedural pixel art for zero-delay rendering
 */

import stalkerSheetImg from '../assets/images/antonio_spritesheet_1791456764297.jpg';

export interface SpriteFrame {
  canvas: HTMLCanvasElement;
}

export interface CharacterAnimations {
  idle: SpriteFrame[];
  walk: SpriteFrame[];
  run: SpriteFrame[];
  search?: SpriteFrame[];
  capture?: SpriteFrame[];
}

export class SpriteRegistry {
  private static instance: SpriteRegistry;
  public player1Sprites!: Record<string, CharacterAnimations>;
  public player2Sprites!: Record<string, CharacterAnimations>;
  public solangeSprites!: Record<string, CharacterAnimations>;
  public tileTextures: Map<string, HTMLCanvasElement> = new Map();
  public itemTextures: Map<string, HTMLCanvasElement> = new Map();

  // Custom Stalker image frames
  private customSolangeSheet: HTMLImageElement | null = null;
  public isCustomLoaded: boolean = false;

  private constructor() {
    this.generateAll();
    this.loadDefaultSpriteSheet();
  }

  public static getInstance(): SpriteRegistry {
    if (!SpriteRegistry.instance) {
      SpriteRegistry.instance = new SpriteRegistry();
    }
    return SpriteRegistry.instance;
  }

  // Alias for backward-compat
  public get antonioSprites(): Record<string, CharacterAnimations> {
    return this.solangeSprites;
  }
  public set antonioSprites(val: Record<string, CharacterAnimations>) {
    this.solangeSprites = val;
  }

  private loadDefaultSpriteSheet() {
    if (typeof window === 'undefined') return;
    const img = new Image();
    img.src = stalkerSheetImg;
    img.onload = () => {
      this.parseAndSetSpriteSheet(img);
    };
  }

  /**
   * Sets custom user-uploaded sprite sheet image and parses the 3 animation rows:
   * 1. CORRENDO (6 frames)
   * 2. PARADO PENSANDO (4 frames)
   * 3. PARADO PULANDO FELIZ (5 frames)
   */
  public setCustomSolangeFrames(img: HTMLImageElement) {
    this.customSolangeSheet = img;
    this.parseAndSetSpriteSheet(img);
  }

  public setCustomAntonioFrames(img: HTMLImageElement) {
    this.setCustomSolangeFrames(img);
  }

  public parseAndSetSpriteSheet(img: HTMLImageElement) {
    this.customSolangeSheet = img;
    this.isCustomLoaded = true;

    try {
      const parsedAnimations = this.sliceStalkerSheet(img);
      if (parsedAnimations) {
        this.solangeSprites = parsedAnimations;
      }
    } catch (e) {
      console.warn('Error parsing stalker spritesheet:', e);
    }
  }

  /**
   * Slices the 3 labeled rows from the user's sprite sheet:
   * Row 1 (top ~33%): CORRENDO -> 6 frames
   * Row 2 (middle ~33%): PARADO PENSANDO -> 4 frames
   * Row 3 (bottom ~33%): PARADO PULANDO FELIZ -> 5 frames
   */
  private sliceStalkerSheet(img: HTMLImageElement): Record<string, CharacterAnimations> | null {
    const totalW = img.naturalWidth || img.width;
    const totalH = img.naturalHeight || img.height;

    if (!totalW || !totalH) return null;

    // Helper to extract a single frame
    const extractFrame = (sx: number, sy: number, sw: number, sh: number, flipX: boolean = false): SpriteFrame => {
      const c = document.createElement('canvas');
      c.width = 44;
      c.height = 48;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;

      ctx.save();
      if (flipX) {
        ctx.translate(44, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(img, sx, sy, sw, sh, 2, 2, 40, 44);
      ctx.restore();
      return { canvas: c };
    };

    // Row vertical boundaries (avoiding the title labels at the top of each row)
    const rowH = totalH / 3;
    const labelMarginTop = rowH * 0.16;
    const contentH = rowH * 0.82;

    // Row 1: CORRENDO (6 frames)
    const r1Y = 0 * rowH + labelMarginTop;
    const r1FrameW = totalW / 6;
    const runFramesRight: SpriteFrame[] = [];
    const runFramesLeft: SpriteFrame[] = [];
    for (let i = 0; i < 6; i++) {
      runFramesRight.push(extractFrame(i * r1FrameW + r1FrameW * 0.08, r1Y, r1FrameW * 0.84, contentH, false));
      runFramesLeft.push(extractFrame(i * r1FrameW + r1FrameW * 0.08, r1Y, r1FrameW * 0.84, contentH, true));
    }

    // Row 2: PARADO PENSANDO (4 frames)
    const r2Y = 1 * rowH + labelMarginTop;
    const r2FrameW = totalW / 4;
    const idleFramesRight: SpriteFrame[] = [];
    const idleFramesLeft: SpriteFrame[] = [];
    const searchFramesRight: SpriteFrame[] = [];
    const searchFramesLeft: SpriteFrame[] = [];
    for (let i = 0; i < 4; i++) {
      const frR = extractFrame(i * r2FrameW + r2FrameW * 0.08, r2Y, r2FrameW * 0.84, contentH, false);
      const frL = extractFrame(i * r2FrameW + r2FrameW * 0.08, r2Y, r2FrameW * 0.84, contentH, true);
      idleFramesRight.push(frR);
      idleFramesLeft.push(frL);
      if (i >= 2) {
        searchFramesRight.push(frR);
        searchFramesLeft.push(frL);
      }
    }

    // Row 3: PARADO PULANDO FELIZ (5 frames)
    const r3Y = 2 * rowH + labelMarginTop;
    const r3FrameW = totalW / 5;
    const captureFramesRight: SpriteFrame[] = [];
    const captureFramesLeft: SpriteFrame[] = [];
    for (let i = 0; i < 5; i++) {
      captureFramesRight.push(extractFrame(i * r3FrameW + r3FrameW * 0.08, r3Y, r3FrameW * 0.84, contentH, false));
      captureFramesLeft.push(extractFrame(i * r3FrameW + r3FrameW * 0.08, r3Y, r3FrameW * 0.84, contentH, true));
    }

    const result: Record<string, CharacterAnimations> = {
      right: {
        idle: idleFramesRight,
        walk: runFramesRight.slice(0, 4),
        run: runFramesRight,
        search: searchFramesRight.length ? searchFramesRight : idleFramesRight,
        capture: captureFramesRight,
      },
      left: {
        idle: idleFramesLeft,
        walk: runFramesLeft.slice(0, 4),
        run: runFramesLeft,
        search: searchFramesLeft.length ? searchFramesLeft : idleFramesLeft,
        capture: captureFramesLeft,
      },
      down: {
        idle: idleFramesRight.slice(0, 2),
        walk: runFramesRight,
        run: runFramesRight,
        search: searchFramesRight.length ? searchFramesRight : idleFramesRight,
        capture: captureFramesRight,
      },
      up: {
        idle: idleFramesRight.slice(0, 2),
        walk: runFramesRight,
        run: runFramesRight,
        search: searchFramesRight.length ? searchFramesRight : idleFramesRight,
        capture: captureFramesRight,
      },
    };

    return result;
  }

  public getCustomSolangeImage(): HTMLImageElement | null {
    return this.customSolangeSheet;
  }

  public getCustomAntonioImage(): HTMLImageElement | null {
    return this.getCustomSolangeImage();
  }

  private generateAll() {
    this.player1Sprites = this.createHumanCharacterSet('#3b82f6', '#1e3a8a', '#10b981'); // Student 1 (Blue)
    this.player2Sprites = this.createHumanCharacterSet('#f59e0b', '#b45309', '#ec4899'); // Student 2 (Amber)
    this.solangeSprites = this.createScientistProfessorCharacterSet();
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

    // Legs & Shoes
    ctx.fillStyle = pantsColor;
    ctx.fillRect(11 + legOffset, 20, 4, 8);
    ctx.fillRect(17 - legOffset, 20, 4, 8);
    ctx.fillStyle = '#111827';
    ctx.fillRect(10 + legOffset, 27, 5, 3);
    ctx.fillRect(17 - legOffset, 27, 5, 3);

    // Body (Hoodie / School Jacket)
    ctx.fillStyle = jacketColor;
    ctx.fillRect(10, 11, 12, 10);

    // Backpack
    ctx.fillStyle = accentColor;
    if (direction === 'down') {
      ctx.fillRect(12, 13, 2, 7);
      ctx.fillRect(18, 13, 2, 7);
    } else if (direction === 'up') {
      ctx.fillRect(11, 12, 10, 8);
    } else if (direction === 'left' || direction === 'right') {
      ctx.fillRect(direction === 'left' ? 18 : 10, 12, 4, 8);
    }

    // Arms
    ctx.fillStyle = jacketColor;
    if (direction === 'left') ctx.fillRect(13, 13 + armBob, 4, 7);
    else if (direction === 'right') ctx.fillRect(15, 13 + armBob, 4, 7);
    else {
      ctx.fillRect(7, 12 + armBob, 3, 7);
      ctx.fillRect(22, 12 - armBob, 3, 7);
    }

    // Head & Hair
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(11, 4, 10, 8);
    ctx.fillStyle = '#374151';
    ctx.fillRect(10, 3, 12, 4);

    if (direction === 'down') {
      ctx.fillRect(10, 3, 3, 6);
      ctx.fillRect(19, 3, 3, 6);
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

    return { canvas };
  }

  /**
   * Procedural Fallback of the Professora Cientista:
   * Blonde hair, cool black sunglasses, white open lab coat, pens in pocket, dark shirt, jeans and sneakers!
   */
  private createScientistProfessorCharacterSet() {
    const directions = ['up', 'down', 'left', 'right'];
    const result: Record<string, CharacterAnimations> = {};

    directions.forEach((dir) => {
      result[dir] = {
        idle: [
          this.renderScientistFrame(dir, 0, 'idle'),
          this.renderScientistFrame(dir, 1, 'thinking'),
          this.renderScientistFrame(dir, 2, 'question'),
        ],
        walk: [
          this.renderScientistFrame(dir, 1, 'run'),
          this.renderScientistFrame(dir, 0, 'run'),
          this.renderScientistFrame(dir, 2, 'run'),
          this.renderScientistFrame(dir, 0, 'run'),
        ],
        run: [
          this.renderScientistFrame(dir, 1, 'run'),
          this.renderScientistFrame(dir, 2, 'run'),
          this.renderScientistFrame(dir, 3, 'run'),
        ],
        search: [
          this.renderScientistFrame(dir, 1, 'thinking'),
          this.renderScientistFrame(dir, 2, 'question'),
        ],
        capture: [
          this.renderScientistFrame(dir, 1, 'jump'),
          this.renderScientistFrame(dir, 2, 'jump'),
        ],
      };
    });

    return result;
  }

  private renderScientistFrame(direction: string, step: number, state: string): SpriteFrame {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 44;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const legShift = step === 1 ? -4 : step === 2 ? 4 : 0;
    const isJumping = state === 'jump';
    const yOff = isJumping ? -4 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(20, 40, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Black & White Sneakers
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12 + legShift, 36 + yOff, 6, 4);
    ctx.fillRect(22 - legShift, 36 + yOff, 6, 4);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(13 + legShift, 35 + yOff, 5, 2);
    ctx.fillRect(23 - legShift, 35 + yOff, 5, 2);

    // Blue Denim Jeans with black belt
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(13 + legShift, 25 + yOff, 6, 11);
    ctx.fillRect(21 - legShift, 25 + yOff, 6, 11);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(13, 24 + yOff, 14, 2); // Belt

    // Inner Black T-Shirt
    ctx.fillStyle = '#18181b';
    ctx.fillRect(15, 13 + yOff, 10, 11);

    // White Open Lab Coat (Flowing)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(10, 12 + yOff, 5, 15);
    ctx.fillRect(25, 12 + yOff, 5, 15);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(9, 14 + yOff, 2, 13);
    ctx.fillRect(29, 14 + yOff, 2, 13);

    // Pens in Breast Pocket (Red & Blue pens)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(11, 16 + yOff, 1, 3);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(13, 16 + yOff, 1, 3);

    // Arms & White Coat Sleeves
    ctx.fillStyle = '#f8fafc';
    if (isJumping) {
      // Arms raised high in victory
      ctx.fillRect(6, 4 + yOff, 5, 10);
      ctx.fillRect(29, 4 + yOff, 5, 10);
      ctx.fillStyle = '#fed7aa'; // Hands
      ctx.fillRect(6, 2 + yOff, 5, 3);
      ctx.fillRect(29, 2 + yOff, 5, 3);
    } else if (state === 'thinking' || state === 'question') {
      // Hand on chin
      ctx.fillRect(7, 13 + yOff, 4, 8);
      ctx.fillRect(24, 15 + yOff, 7, 4);
      ctx.fillStyle = '#fed7aa';
      ctx.fillRect(21, 10 + yOff, 4, 4); // Hand touching chin
    } else {
      ctx.fillRect(6, 13 + yOff, 4, 8);
      ctx.fillRect(30, 13 + yOff, 4, 8);
    }

    // Black Wristband
    ctx.fillStyle = '#09090b';
    ctx.fillRect(6, 18 + yOff, 4, 2);

    // Face / Skin
    ctx.fillStyle = '#fed7aa';
    ctx.fillRect(13, 5 + yOff, 14, 9);

    // Blonde Hair with cute side clips
    ctx.fillStyle = '#fde047';
    ctx.fillRect(11, 2 + yOff, 18, 5);
    ctx.fillRect(9, 5 + yOff, 4, 8);
    ctx.fillRect(27, 5 + yOff, 4, 8);

    // Black Hairpins / Clips
    ctx.fillStyle = '#18181b';
    ctx.fillRect(10, 4 + yOff, 3, 2);

    // Cool Black Sunglasses
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(13, 7 + yOff, 6, 4);
    ctx.fillRect(21, 7 + yOff, 6, 4);
    ctx.fillRect(19, 8 + yOff, 2, 2); // Bridge
    ctx.fillStyle = '#334155'; // Lens glint
    ctx.fillRect(14, 8 + yOff, 2, 1);
    ctx.fillRect(22, 8 + yOff, 2, 1);

    // Question Mark '?' above head for thinking/lost state
    if (state === 'question') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('?', 27, 4 + yOff);
    }

    return { canvas };
  }

  private generateTileTextures() {
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

    const wallSolid = document.createElement('canvas');
    wallSolid.width = 32;
    wallSolid.height = 32;
    const wlctx = wallSolid.getContext('2d')!;
    wlctx.fillStyle = '#0f172a';
    wlctx.fillRect(0, 0, 32, 32);
    wlctx.fillStyle = '#1e293b';
    wlctx.fillRect(0, 0, 32, 6);
    wlctx.fillStyle = '#334155';
    wlctx.fillRect(2, 8, 12, 10);
    wlctx.fillRect(16, 8, 14, 10);
    wlctx.fillRect(2, 20, 28, 10);
    wlctx.strokeStyle = '#090d16';
    wlctx.strokeRect(0, 0, 32, 32);
    this.tileTextures.set('wall_solid', wallSolid);
  }

  private generateItemTextures() {
    const locker = document.createElement('canvas');
    locker.width = 32;
    locker.height = 48;
    const lctx = locker.getContext('2d')!;
    lctx.fillStyle = '#475569';
    lctx.fillRect(2, 2, 28, 44);
    lctx.strokeStyle = '#1e293b';
    lctx.strokeRect(2, 2, 28, 44);
    lctx.fillStyle = '#0f172a';
    lctx.fillRect(8, 8, 16, 2);
    lctx.fillRect(8, 12, 16, 2);
    lctx.fillRect(8, 16, 16, 2);
    lctx.fillStyle = '#cbd5e1';
    lctx.fillRect(22, 24, 3, 6);
    this.itemTextures.set('locker', locker);

    const book = document.createElement('canvas');
    book.width = 24;
    book.height = 24;
    const bctx = book.getContext('2d')!;
    bctx.fillStyle = '#991b1b';
    bctx.fillRect(3, 4, 18, 16);
    bctx.fillStyle = '#fef08a';
    bctx.fillRect(5, 6, 14, 2);
    bctx.fillStyle = '#f8fafc';
    bctx.fillRect(19, 4, 3, 16);
    this.itemTextures.set('book', book);

    const fuse = document.createElement('canvas');
    fuse.width = 20;
    fuse.height = 20;
    const fsctx = fuse.getContext('2d')!;
    fsctx.fillStyle = '#cbd5e1';
    fsctx.fillRect(3, 7, 4, 6);
    fsctx.fillRect(13, 7, 4, 6);
    fsctx.fillStyle = '#0ea5e9';
    fsctx.fillRect(7, 6, 6, 8);
    fsctx.fillStyle = '#fbbf24';
    fsctx.fillRect(8, 9, 4, 2);
    this.itemTextures.set('fuse', fuse);

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

    const fbox = document.createElement('canvas');
    fbox.width = 32;
    fbox.height = 32;
    const fbctx = fbox.getContext('2d')!;
    fbctx.fillStyle = '#334155';
    fbctx.fillRect(2, 2, 28, 28);
    fbctx.strokeStyle = '#0f172a';
    fbctx.strokeRect(2, 2, 28, 28);
    fbctx.fillStyle = '#ef4444';
    fbctx.fillRect(6, 6, 4, 4);
    fbctx.fillStyle = '#22c55e';
    fbctx.fillRect(14, 10, 10, 12);
    this.itemTextures.set('fuse_box', fbox);

    const comp = document.createElement('canvas');
    comp.width = 32;
    comp.height = 32;
    const cmctx = comp.getContext('2d')!;
    cmctx.fillStyle = '#1e293b';
    cmctx.fillRect(4, 4, 24, 18);
    cmctx.fillStyle = '#0284c7';
    cmctx.fillRect(6, 6, 20, 14);
    cmctx.fillStyle = '#38bdf8';
    cmctx.fillRect(8, 8, 8, 2);
    cmctx.fillRect(8, 12, 12, 2);
    cmctx.fillStyle = '#334155';
    cmctx.fillRect(6, 24, 20, 6);
    this.itemTextures.set('computer', comp);

    const gate = document.createElement('canvas');
    gate.width = 64;
    gate.height = 32;
    const gctx = gate.getContext('2d')!;
    gctx.fillStyle = '#0f172a';
    gctx.fillRect(0, 0, 64, 32);
    gctx.fillStyle = '#64748b';
    for (let x = 4; x < 60; x += 6) {
      gctx.fillRect(x, 2, 3, 28);
    }
    gctx.fillStyle = '#e2e8f0';
    gctx.fillRect(26, 12, 12, 8);
    gctx.fillStyle = '#eab308';
    gctx.fillRect(29, 14, 6, 6);
    this.itemTextures.set('main_gate', gate);
  }
}
