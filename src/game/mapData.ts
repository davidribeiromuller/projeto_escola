/**
 * School Map Architecture for "FUJA DA SOLANGE!!"
 * Grid layout with:
 * - Salas de Aula (Sala 1, Sala 2, Sala 3, Sala 4)
 * - Corredor Principal
 * - Biblioteca, Pátio Central, Laboratório, Escadas
 * - Secretaria, Sala dos Professores (Solange's Mandatory Spawn), Depósito
 * - Banheiros, Refeitório, Ginásio
 * - Entrada / Saída
 */

export const TILE_SIZE = 32;
export const MAP_COLS = 52;
export const MAP_ROWS = 40;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

export enum TileType {
  FLOOR_TILE = 0,
  FLOOR_WOOD = 1,
  FLOOR_CARPET = 2,
  WALL_SOLID = 3,
  WALL_BORDER = 4,
  DOOR = 5,
  OBSTACLE_DESK = 6,
  OBSTACLE_SHELF = 7,
  STAIRS = 8,
  PATIO_TILES = 9,
}

export interface InteractiveItem {
  id: string;
  type: 'locker' | 'book' | 'book_drop' | 'fuse' | 'fuse_box' | 'clue' | 'computer' | 'main_gate' | 'door';
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  collected?: boolean;
  completed?: boolean;
  codeFragment?: string;
  roomName: string;
}

export interface ZoneArea {
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hasLights: boolean;
  lightFlicker?: boolean;
}

// Fixed Initial Spawns
export const SOLANGE_INITIAL_SPAWN = {
  x: 22 * TILE_SIZE,
  y: 27 * TILE_SIZE,
  room: 'Sala dos Professores',
};

export const PLAYER_SPAWNS = [
  { x: 7 * TILE_SIZE, y: 4 * TILE_SIZE, room: 'Sala 1 (Norte)' }, // Player 1
  { x: 23 * TILE_SIZE, y: 34 * TILE_SIZE, room: 'Refeitório (Sul)' }, // Player 2
  { x: 42 * TILE_SIZE, y: 34 * TILE_SIZE, room: 'Ginásio' },
  { x: 7 * TILE_SIZE, y: 15 * TILE_SIZE, room: 'Biblioteca' },
];

export function generateSchoolMap(): number[][] {
  const map: number[][] = [];

  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      // 1. Outer Border Walls
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        row.push(TileType.WALL_BORDER);
        continue;
      }

      // Default corridor floor
      let tile = TileType.FLOOR_TILE;

      // ---------------------------------------------
      // TOP: SALAS DE AULA 1, 2, 3, 4 (Rows 1..7)
      // ---------------------------------------------
      if (r <= 7) {
        // Walls separating classrooms
        if (r === 7) {
          tile = TileType.WALL_SOLID;
          // Classroom doors into Main Corridor
          if (c === 7 || c === 19 || c === 31 || c === 43) {
            tile = TileType.DOOR;
          }
        } else if (c === 13 || c === 25 || c === 37) {
          tile = TileType.WALL_SOLID;
        } else {
          tile = TileType.FLOOR_WOOD;
          // Classroom Desks
          if ((r === 3 || r === 5) && (c % 12 === 3 || c % 12 === 5 || c % 12 === 8 || c % 12 === 10)) {
            tile = TileType.OBSTACLE_DESK;
          }
        }
      }

      // ---------------------------------------------
      // CORREDOR PRINCIPAL (Rows 8..11)
      // ---------------------------------------------
      else if (r >= 8 && r <= 11) {
        tile = TileType.FLOOR_TILE;
      }

      // ---------------------------------------------
      // MIDDLE SECTORS (Rows 12..21)
      // Biblioteca (cols 1..16), Pátio Central (cols 17..33), Laboratório (cols 34..50)
      // ---------------------------------------------
      else if (r >= 12 && r <= 20) {
        // Biblioteca (West)
        if (c <= 16) {
          if (c === 16 || r === 12 || r === 20) {
            tile = TileType.WALL_SOLID;
            if ((c === 16 && r === 16) || (r === 12 && c === 8)) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_CARPET;
            // Bookshelves
            if ((c === 4 || c === 8 || c === 12) && r >= 14 && r <= 18) {
              tile = TileType.OBSTACLE_SHELF;
            }
          }
        }
        // Pátio Central (Open plaza with benches)
        else if (c >= 17 && c <= 33) {
          if (r === 12) {
            // Upper wall with 2 entrances from corridor
            tile = TileType.WALL_SOLID;
            if (c === 21 || c === 29) tile = TileType.DOOR;
          } else {
            tile = TileType.PATIO_TILES;
            // Central fountain / planter
            if ((r === 15 || r === 16) && (c === 24 || c === 25 || c === 26)) {
              tile = TileType.OBSTACLE_DESK;
            }
            // Benches around patio
            if (r === 14 && (c === 19 || c === 31)) tile = TileType.OBSTACLE_DESK;
          }
        }
        // Laboratório (East)
        else {
          if (c === 34 || r === 12 || r === 20) {
            tile = TileType.WALL_SOLID;
            if ((c === 34 && r === 16) || (r === 12 && c === 42)) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_TILE;
            // Lab workbenches
            if ((r === 14 || r === 17) && (c === 38 || c === 41 || c === 45 || c === 48)) {
              tile = TileType.OBSTACLE_DESK;
            }
          }
        }
      }

      // Stairs area below patio (cols 23..27, rows 21..22)
      else if (r === 21 && c >= 23 && c <= 27) {
        tile = TileType.STAIRS;
      }

      // ---------------------------------------------
      // SOUTH-MIDDLE SECTORS (Rows 22..30)
      // Secretaria (cols 1..14), Sala dos Professores (cols 15..29), Depósito (cols 30..50)
      // ---------------------------------------------
      else if (r >= 23 && r <= 30) {
        // Secretaria (West-Center)
        if (c <= 14) {
          if (c === 14 || r === 23 || r === 30) {
            tile = TileType.WALL_SOLID;
            if (c === 14 && r === 26) tile = TileType.DOOR;
            if (r === 23 && c === 8) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_CARPET;
            if (c === 7 && r === 26) tile = TileType.OBSTACLE_DESK;
          }
        }
        // Sala dos Professores (MANDATORY SOLANGE INITIAL SPAWN!)
        else if (c >= 15 && c <= 29) {
          if (c === 29 || r === 23 || r === 30) {
            tile = TileType.WALL_SOLID;
            if (c === 29 && r === 26) tile = TileType.DOOR;
            if (r === 23 && c === 22) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_CARPET;
            // Meeting table and coffee counter
            if (r === 25 && (c === 19 || c === 25)) tile = TileType.OBSTACLE_DESK;
          }
        }
        // Depósito do Zelador (East-Center)
        else {
          if (r === 23 || r === 30) {
            tile = TileType.WALL_SOLID;
            if (r === 23 && c === 37) tile = TileType.DOOR;
            if (r === 30 && c === 42) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_TILE;
            // Storage shelves & boxes
            if ((c === 35 || c === 46) && r >= 25 && r <= 28) {
              tile = TileType.OBSTACLE_SHELF;
            }
          }
        }
      }

      // ---------------------------------------------
      // SOUTH SECTORS (Rows 31..38)
      // Banheiros (cols 1..13), Refeitório (cols 14..32), Ginásio (cols 33..50)
      // ---------------------------------------------
      else if (r >= 31 && r <= 37) {
        // Banheiros (SW)
        if (c <= 13) {
          if (c === 13 || r === 31 || r === 37) {
            tile = TileType.WALL_SOLID;
            if (c === 13 && r === 34) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_TILE;
          }
        }
        // Refeitório (Center South)
        else if (c >= 14 && c <= 32) {
          if (r === 31) {
            tile = TileType.WALL_SOLID;
            if (c === 19 || c === 27) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_WOOD;
            // Cafeteria long tables
            if ((r === 33 || r === 35) && (c === 17 || c === 20 || c === 23 || c === 26 || c === 29)) {
              tile = TileType.OBSTACLE_DESK;
            }
          }
        }
        // Ginásio (SE)
        else {
          if (c === 33 || r === 31) {
            tile = TileType.WALL_SOLID;
            // 2 Exits for Fair Play
            if (c === 33 && r === 34) tile = TileType.DOOR;
            if (r === 31 && c === 42) tile = TileType.DOOR;
          } else {
            tile = TileType.FLOOR_WOOD;
            // Bleachers along eastern wall
            if (c === 48 && r >= 32 && r <= 36) {
              tile = TileType.OBSTACLE_SHELF;
            }
          }
        }
      }

      // ---------------------------------------------
      // ENTRADA PRINCIPAL / SAÍDA (Row 38..39, cols 21..31)
      // ---------------------------------------------
      if (r >= 38 && (c < 20 || c > 32)) {
        tile = TileType.WALL_SOLID;
      }

      row.push(tile);
    }
    map.push(row);
  }

  return map;
}

export const INITIAL_INTERACTIVE_ITEMS: InteractiveItem[] = [
  // --- Lockers (Hiding Spots) ---
  {
    id: 'locker_corridor_1',
    type: 'locker',
    x: 10 * TILE_SIZE,
    y: 9 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário do Corredor Oeste',
    roomName: 'Corredor Principal',
  },
  {
    id: 'locker_corridor_2',
    type: 'locker',
    x: 34 * TILE_SIZE,
    y: 9 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário do Corredor Leste',
    roomName: 'Corredor Principal',
  },
  {
    id: 'locker_deposito',
    type: 'locker',
    x: 44 * TILE_SIZE,
    y: 28 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário de Ferro do Depósito',
    roomName: 'Depósito',
  },
  {
    id: 'locker_ginasio',
    type: 'locker',
    x: 46 * TILE_SIZE,
    y: 33 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário dos Atletas',
    roomName: 'Ginásio',
  },
  {
    id: 'locker_banheiro',
    type: 'locker',
    x: 6 * TILE_SIZE,
    y: 35 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Cabine Trancada do Banheiro',
    roomName: 'Banheiros',
  },

  // --- Mission 1: Livros da Biblioteca ---
  {
    id: 'book_1',
    type: 'book',
    x: 5 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Livro de Química Orgânica',
    collected: false,
    roomName: 'Sala 1',
  },
  {
    id: 'book_2',
    type: 'book',
    x: 23 * TILE_SIZE,
    y: 35 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Atlas Escolar Perdido',
    collected: false,
    roomName: 'Refeitório',
  },
  {
    id: 'book_3',
    type: 'book',
    x: 41 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Compêndio de História Proibida',
    collected: false,
    roomName: 'Sala 4',
  },
  {
    id: 'library_book_drop',
    type: 'book_drop',
    x: 6 * TILE_SIZE,
    y: 14 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Estante de Devolução (Biblioteca)',
    completed: false,
    roomName: 'Biblioteca',
  },

  // --- Mission 2: Fusíveis dos Disjuntores ---
  {
    id: 'fuse_1',
    type: 'fuse',
    x: 46 * TILE_SIZE,
    y: 25 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível 20A do Depósito',
    collected: false,
    roomName: 'Depósito',
  },
  {
    id: 'fuse_2',
    type: 'fuse',
    x: 43 * TILE_SIZE,
    y: 15 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível do Laboratório',
    collected: false,
    roomName: 'Laboratório',
  },
  {
    id: 'fuse_3',
    type: 'fuse',
    x: 37 * TILE_SIZE,
    y: 35 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível de Alta Voltagem do Ginásio',
    collected: false,
    roomName: 'Ginásio',
  },
  {
    id: 'fuse_box_1',
    type: 'fuse_box',
    x: 10 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Disjuntor do Corredor Norte',
    completed: false,
    roomName: 'Corredor Principal',
  },
  {
    id: 'fuse_box_2',
    type: 'fuse_box',
    x: 38 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Disjuntor do Setor Leste',
    completed: false,
    roomName: 'Corredor Principal',
  },
  {
    id: 'fuse_box_3',
    type: 'fuse_box',
    x: 26 * TILE_SIZE,
    y: 32 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Disjuntor Central do Refeitório',
    completed: false,
    roomName: 'Refeitório',
  },

  // --- Mission 3: Senha do Terminal da Secretaria ---
  {
    id: 'clue_1',
    type: 'clue',
    x: 17 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Pista no Quadro da Sala 2 ("Dígito 8")',
    codeFragment: '8',
    collected: false,
    roomName: 'Sala 2',
  },
  {
    id: 'clue_2',
    type: 'clue',
    x: 29 * TILE_SIZE,
    y: 4 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Pista sob a Mesa da Sala 3 ("Dígito 4")',
    codeFragment: '4',
    collected: false,
    roomName: 'Sala 3',
  },
  {
    id: 'clue_3',
    type: 'clue',
    x: 20 * TILE_SIZE,
    y: 16 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Post-it no Banco do Pátio ("Dígito 1")',
    codeFragment: '1',
    collected: false,
    roomName: 'Pátio Central',
  },
  {
    id: 'computer_terminal',
    type: 'computer',
    x: 5 * TILE_SIZE,
    y: 26 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Terminal Central da Secretaria',
    completed: false,
    roomName: 'Secretaria',
  },

  // --- Final Objective: Main Gate Exit ---
  {
    id: 'main_gate',
    type: 'main_gate',
    x: 25 * TILE_SIZE,
    y: 38 * TILE_SIZE,
    width: 64,
    height: 32,
    label: 'Portão Principal de Saída (Correntes Pesadas)',
    completed: false,
    roomName: 'Entrada / Saída',
  },
];

// Patrol Waypoints for Solange starting from Sala dos Professores
export const SOLANGE_PATROL_ROUTE = [
  { x: 22 * TILE_SIZE, y: 27 * TILE_SIZE, zone: 'Sala dos Professores' },
  { x: 22 * TILE_SIZE, y: 22 * TILE_SIZE, zone: 'Saída dos Professores' },
  { x: 25 * TILE_SIZE, y: 16 * TILE_SIZE, zone: 'Pátio Central' },
  { x: 25 * TILE_SIZE, y: 10 * TILE_SIZE, zone: 'Corredor Principal' },
  { x: 10 * TILE_SIZE, y: 10 * TILE_SIZE, zone: 'Corredor Oeste' },
  { x: 10 * TILE_SIZE, y: 15 * TILE_SIZE, zone: 'Entrada da Biblioteca' },
  { x: 16 * TILE_SIZE, y: 26 * TILE_SIZE, zone: 'Entrada da Secretaria' },
  { x: 20 * TILE_SIZE, y: 34 * TILE_SIZE, zone: 'Refeitório' },
  { x: 38 * TILE_SIZE, y: 34 * TILE_SIZE, zone: 'Ginásio' },
  { x: 38 * TILE_SIZE, y: 26 * TILE_SIZE, zone: 'Depósito' },
  { x: 42 * TILE_SIZE, y: 15 * TILE_SIZE, zone: 'Laboratório' },
  { x: 38 * TILE_SIZE, y: 10 * TILE_SIZE, zone: 'Corredor Leste' },
];

export const SCHOOL_ZONES: ZoneArea[] = [
  { name: 'Sala 1', x1: 1, y1: 1, x2: 12, y2: 7, hasLights: true },
  { name: 'Sala 2', x1: 14, y1: 1, x2: 24, y2: 7, hasLights: false, lightFlicker: true },
  { name: 'Sala 3', x1: 26, y1: 1, x2: 36, y2: 7, hasLights: true },
  { name: 'Sala 4', x1: 38, y1: 1, x2: 50, y2: 7, hasLights: false },
  { name: 'Corredor Principal', x1: 1, y1: 8, x2: 50, y2: 11, hasLights: true, lightFlicker: true },
  { name: 'Biblioteca', x1: 1, y1: 12, x2: 16, y2: 20, hasLights: true, lightFlicker: true },
  { name: 'Pátio Central', x1: 17, y1: 12, x2: 33, y2: 20, hasLights: true },
  { name: 'Escadas', x1: 22, y1: 20, x2: 28, y2: 22, hasLights: false },
  { name: 'Laboratório', x1: 34, y1: 12, x2: 50, y2: 20, hasLights: false, lightFlicker: true },
  { name: 'Secretaria', x1: 1, y1: 23, x2: 14, y2: 30, hasLights: true },
  { name: 'Sala dos Professores', x1: 15, y1: 23, x2: 29, y2: 30, hasLights: true },
  { name: 'Depósito', x1: 30, y1: 23, x2: 50, y2: 30, hasLights: false },
  { name: 'Banheiros', x1: 1, y1: 31, x2: 13, y2: 37, hasLights: false, lightFlicker: true },
  { name: 'Refeitório', x1: 14, y1: 31, x2: 32, y2: 37, hasLights: true },
  { name: 'Ginásio', x1: 33, y1: 31, x2: 50, y2: 37, hasLights: true, lightFlicker: true },
  { name: 'Entrada / Saída', x1: 20, y1: 37, x2: 32, y2: 39, hasLights: true },
];
