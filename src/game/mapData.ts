/**
 * School Map Data for "Depois da Última Aula"
 * Grid-based layout with classrooms, corridors, library, lab, office, lockers, and mission items.
 */

export const TILE_SIZE = 32;
export const MAP_COLS = 48;
export const MAP_ROWS = 36;
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
}

export interface InteractiveItem {
  id: string;
  type: 'locker' | 'book' | 'book_drop' | 'fuse' | 'fuse_box' | 'clue' | 'computer' | 'main_gate' | 'door';
  x: number; // tile coordinates or pixel
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

// Generate the 2D school tile map
export function generateSchoolMap(): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: number[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      // Outer borders
      if (r === 0 || r === MAP_ROWS - 1 || c === 0 || c === MAP_COLS - 1) {
        row.push(TileType.WALL_BORDER);
        continue;
      }

      // Default to corridor floor
      let tile = TileType.FLOOR_TILE;

      // Internal solid rooms division
      // 1. Library (NW: r 6..15, c 2..16)
      if (r >= 6 && r <= 15 && c >= 2 && c <= 16) {
        if (r === 6 || r === 15 || c === 2 || c === 16) {
          tile = TileType.WALL_SOLID;
          if (c === 16 && r === 11) tile = TileType.DOOR; // Door to hallway
        } else {
          tile = TileType.FLOOR_CARPET;
          // Bookshelves inside
          if ((c === 5 || c === 9 || c === 13) && r >= 8 && r <= 13) {
            tile = TileType.OBSTACLE_SHELF;
          }
        }
      }

      // 2. Classrooms 101 & 102 (W: r 17..27, c 2..16)
      else if (r >= 17 && r <= 27 && c >= 2 && c <= 16) {
        if (r === 17 || r === 27 || c === 2 || c === 16 || r === 22) {
          tile = TileType.WALL_SOLID;
          if (c === 16 && (r === 19 || r === 24)) tile = TileType.DOOR; // Classroom doors
        } else {
          tile = TileType.FLOOR_WOOD;
          // Desks
          if ((c === 5 || c === 8 || c === 11) && (r === 19 || r === 20 || r === 24 || r === 25)) {
            tile = TileType.OBSTACLE_DESK;
          }
        }
      }

      // 3. Restrooms (SW: r 29..34, c 2..14)
      else if (r >= 29 && r <= 34 && c >= 2 && c <= 14) {
        if (r === 29 || r === 34 || c === 2 || c === 14) {
          tile = TileType.WALL_SOLID;
          if (c === 14 && r === 31) tile = TileType.DOOR;
        } else {
          tile = TileType.FLOOR_TILE;
        }
      }

      // 4. North Wing: Gymnasium & Cafeteria (r 2..5, c 2..45)
      else if (r >= 2 && r <= 5) {
        tile = TileType.FLOOR_WOOD;
      }
      else if (r === 5) {
        // Wall separating North wing from central hallways
        tile = TileType.WALL_SOLID;
        if (c === 10 || c === 24 || c === 38) tile = TileType.DOOR;
      }

      // 5. East Wing: Principal / Secretaria (NE: r 6..14, c 31..45)
      else if (r >= 6 && r <= 14 && c >= 31 && c <= 45) {
        if (r === 6 || r === 14 || c === 31 || c === 45) {
          tile = TileType.WALL_SOLID;
          if (c === 31 && r === 10) tile = TileType.DOOR;
        } else {
          tile = TileType.FLOOR_CARPET;
          if (c === 38 && r === 10) tile = TileType.OBSTACLE_DESK;
        }
      }

      // 6. East Wing: Teachers' Lounge (E: r 16..22, c 31..45)
      else if (r >= 16 && r <= 22 && c >= 31 && c <= 45) {
        if (r === 16 || r === 22 || c === 31 || c === 45) {
          tile = TileType.WALL_SOLID;
          if (c === 31 && r === 19) tile = TileType.DOOR;
        } else {
          tile = TileType.FLOOR_CARPET;
          if ((c === 36 || c === 40) && r === 19) tile = TileType.OBSTACLE_DESK;
        }
      }

      // 7. Science Lab & Janitor Closet (SE: r 24..34, c 31..45)
      else if (r >= 24 && r <= 34 && c >= 31 && c <= 45) {
        if (r === 24 || r === 34 || c === 31 || c === 45 || r === 29) {
          tile = TileType.WALL_SOLID;
          if (c === 31 && (r === 26 || r === 31)) tile = TileType.DOOR;
        } else {
          tile = TileType.FLOOR_TILE;
          if (r >= 25 && r <= 28 && (c === 35 || c === 41)) {
            tile = TileType.OBSTACLE_DESK;
          }
        }
      }

      // 8. Main Entrance and Exit Gate (S: r 31..35, c 20..27)
      else if (r >= 33 && (c < 20 || c > 27)) {
        tile = TileType.WALL_SOLID;
      }

      row.push(tile);
    }
    map.push(row);
  }
  return map;
}

// Interactive objects seeded in map
export const INITIAL_INTERACTIVE_ITEMS: InteractiveItem[] = [
  // --- Lockers (Hiding spots) ---
  {
    id: 'locker_corridor_1',
    type: 'locker',
    x: 18 * TILE_SIZE,
    y: 11 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário de Aço',
    roomName: 'Corredor Central',
  },
  {
    id: 'locker_corridor_2',
    type: 'locker',
    x: 29 * TILE_SIZE,
    y: 11 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário de Aço',
    roomName: 'Corredor Leste',
  },
  {
    id: 'locker_lab',
    type: 'locker',
    x: 43 * TILE_SIZE,
    y: 26 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário do Laboratório',
    roomName: 'Laboratório',
  },
  {
    id: 'locker_gym',
    type: 'locker',
    x: 6 * TILE_SIZE,
    y: 3 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Armário do Ginásio',
    roomName: 'Ginásio',
  },
  {
    id: 'locker_bath',
    type: 'locker',
    x: 8 * TILE_SIZE,
    y: 32 * TILE_SIZE,
    width: 32,
    height: 48,
    label: 'Cabine do Banheiro',
    roomName: 'Banheiro',
  },

  // --- Mission 1: Library Books ---
  {
    id: 'book_1',
    type: 'book',
    x: 7 * TILE_SIZE,
    y: 19 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Livro Raro de História',
    collected: false,
    roomName: 'Sala 101',
  },
  {
    id: 'book_2',
    type: 'book',
    x: 37 * TILE_SIZE,
    y: 18 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Enciclopédia de Ciências',
    collected: false,
    roomName: 'Sala dos Professores',
  },
  {
    id: 'book_3',
    type: 'book',
    x: 38 * TILE_SIZE,
    y: 3 * TILE_SIZE,
    width: 24,
    height: 24,
    label: 'Volume de Literatura Antiga',
    collected: false,
    roomName: 'Refeitório',
  },
  {
    id: 'library_book_drop',
    type: 'book_drop',
    x: 7 * TILE_SIZE,
    y: 8 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Estante de Devolução (Biblioteca)',
    completed: false,
    roomName: 'Biblioteca',
  },

  // --- Mission 2: Circuit Breakers & Fuses ---
  {
    id: 'fuse_1',
    type: 'fuse',
    x: 38 * TILE_SIZE,
    y: 32 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível 20A (Depósito)',
    collected: false,
    roomName: 'Depósito do Zelador',
  },
  {
    id: 'fuse_2',
    type: 'fuse',
    x: 36 * TILE_SIZE,
    y: 27 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível Industrial (Lab)',
    collected: false,
    roomName: 'Laboratório',
  },
  {
    id: 'fuse_3',
    type: 'fuse',
    x: 16 * TILE_SIZE,
    y: 3 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Fusível Reserva (Ginásio)',
    collected: false,
    roomName: 'Ginásio',
  },
  {
    id: 'fuse_box_1',
    type: 'fuse_box',
    x: 18 * TILE_SIZE,
    y: 20 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Painel Elétrico Setor Oeste',
    completed: false,
    roomName: 'Corredor Oeste',
  },
  {
    id: 'fuse_box_2',
    type: 'fuse_box',
    x: 29 * TILE_SIZE,
    y: 20 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Painel Elétrico Setor Leste',
    completed: false,
    roomName: 'Corredor Leste',
  },
  {
    id: 'fuse_box_3',
    type: 'fuse_box',
    x: 23 * TILE_SIZE,
    y: 6 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Disjuntor Central',
    completed: false,
    roomName: 'Corredor Norte',
  },

  // --- Mission 3: Secretaria Computer & Password Clues ---
  {
    id: 'clue_1',
    type: 'clue',
    x: 10 * TILE_SIZE,
    y: 24 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Anotação no Quadro (Dígitos "79")',
    codeFragment: '79',
    collected: false,
    roomName: 'Sala 102',
  },
  {
    id: 'clue_2',
    type: 'clue',
    x: 41 * TILE_SIZE,
    y: 18 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Post-it dos Professores (Dígitos "41")',
    codeFragment: '41',
    collected: false,
    roomName: 'Sala dos Professores',
  },
  {
    id: 'clue_3',
    type: 'clue',
    x: 11 * TILE_SIZE,
    y: 13 * TILE_SIZE,
    width: 20,
    height: 20,
    label: 'Marcador de Livro (Dígitos "05")',
    codeFragment: '05',
    collected: false,
    roomName: 'Biblioteca',
  },
  {
    id: 'computer_terminal',
    type: 'computer',
    x: 41 * TILE_SIZE,
    y: 10 * TILE_SIZE,
    width: 32,
    height: 32,
    label: 'Terminal da Diretoria',
    completed: false,
    roomName: 'Secretaria',
  },

  // --- Final Objective: Main Gate ---
  {
    id: 'main_gate',
    type: 'main_gate',
    x: 23 * TILE_SIZE,
    y: 34 * TILE_SIZE,
    width: 64,
    height: 32,
    label: 'Portão Principal da Escola (Trancado)',
    completed: false,
    roomName: 'Entrada Principal',
  },
];

// Waypoints for Antônio's default patrol route
export const PATROL_WAYPOINTS = [
  { x: 23 * TILE_SIZE, y: 30 * TILE_SIZE, zone: 'Entrada' },
  { x: 23 * TILE_SIZE, y: 18 * TILE_SIZE, zone: 'Corredor Central' },
  { x: 18 * TILE_SIZE, y: 11 * TILE_SIZE, zone: 'Entrada da Biblioteca' },
  { x: 23 * TILE_SIZE, y: 6 * TILE_SIZE, zone: 'Corredor Norte' },
  { x: 29 * TILE_SIZE, y: 10 * TILE_SIZE, zone: 'Entrada da Secretaria' },
  { x: 29 * TILE_SIZE, y: 22 * TILE_SIZE, zone: 'Corredor Leste' },
  { x: 23 * TILE_SIZE, y: 24 * TILE_SIZE, zone: 'Cruzamento Sul' },
];

export const SCHOOL_ZONES: ZoneArea[] = [
  { name: 'Biblioteca', x1: 2, y1: 6, x2: 16, y2: 15, hasLights: true, lightFlicker: true },
  { name: 'Sala 101', x1: 2, y1: 17, x2: 16, y2: 21, hasLights: false },
  { name: 'Sala 102', x1: 2, y1: 22, x2: 16, y2: 27, hasLights: true, lightFlicker: true },
  { name: 'Banheiro', x1: 2, y1: 29, x2: 14, y2: 34, hasLights: false },
  { name: 'Ginásio', x1: 2, y1: 2, x2: 20, y2: 5, hasLights: true, lightFlicker: true },
  { name: 'Refeitório', x1: 27, y1: 2, x2: 45, y2: 5, hasLights: false },
  { name: 'Secretaria', x1: 31, y1: 6, x2: 45, y2: 14, hasLights: true },
  { name: 'Sala dos Professores', x1: 31, y1: 16, x2: 45, y2: 22, hasLights: true },
  { name: 'Laboratório', x1: 31, y1: 24, x2: 45, y2: 28, hasLights: false },
  { name: 'Depósito do Zelador', x1: 31, y1: 29, x2: 45, y2: 34, hasLights: false },
  { name: 'Corredores', x1: 17, y1: 6, x2: 30, y2: 32, hasLights: true, lightFlicker: true },
  { name: 'Entrada Principal', x1: 20, y1: 32, x2: 27, y2: 35, hasLights: true },
];
