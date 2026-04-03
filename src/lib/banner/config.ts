// Game display names
export const GAME_NAMES: Record<string, string> = {
  '6/58': 'Ultra Lotto 6/58',
  '6/55': 'Grand Lotto 6/55',
  '6/49': 'Super Lotto 6/49',
  '6/45': 'Mega Lotto 6/45',
  '6/42': 'Lotto 6/42',
  '6D': '6D Lotto',
  '4D': '4D Lotto',
  '3D': '3D Swertres',
  '2D': '2D EZ2',
};

// Game colors (used for circle backgrounds in banners) - 60% opacity
export const GAME_COLORS_HEX: Record<string, string> = {
  '6/58': 'rgba(37, 99, 235, 0.60)',
  '6/55': 'rgba(0, 176, 255, 0.60)',
  '6/49': 'rgba(255, 105, 0, 0.60)',
  '6/45': 'rgba(22, 163, 74, 0.60)',
  '6/42': 'rgba(234, 179, 8, 0.60)',
  '6D': 'rgba(0, 201, 179, 0.60)',
  '4D': 'rgba(99, 102, 241, 0.60)',
  '3D': 'rgba(147, 51, 234, 0.60)',
  '2D': 'rgba(220, 38, 38, 0.60)',
};

// Maximum number for each game (used for frequency calculation range)
export const GAME_MAX_NUMBERS: Record<string, number> = {
  '6/58': 58, '6/55': 55, '6/49': 49,
  '6/45': 45, '6/42': 42,
  '6D': 9, '4D': 9, '3D': 9, '2D': 9,
};

// Number of balls to pick for each game
export const GAME_BALL_COUNT: Record<string, number> = {
  '6/58': 6, '6/55': 6, '6/49': 6,
  '6/45': 6, '6/42': 6,
  '6D': 6, '4D': 4, '3D': 3, '2D': 2,
};

// Blueprint schedule: which game to feature on each day of the week
// 0=Sunday, 1=Monday, ..., 6=Saturday
export const BLUEPRINT_SCHEDULE: Record<number, string[]> = {
  0: ['6/58'],  // Sunday -> Ultra Lotto
  1: ['6/55'],  // Monday -> Grand Lotto
  2: ['6/49'],  // Tuesday -> Super Lotto
  3: ['6/45'],  // Wednesday -> Mega Lotto
  4: ['6/42'],  // Thursday -> Lotto 6/42
  5: ['4D'],    // Friday -> 4D
  6: ['6D'],    // Saturday -> 6D
};

// PCSO draw schedule by day of week
export const SCHEDULE_MAP: Record<number, string[]> = {
  0: ['6/58', '6/45', '4D', '3D', '2D'],
  1: ['4D', '3D', '2D'],
  2: ['6D', '3D', '2D'],
  3: ['6/45', '4D', '3D', '2D'],
  4: ['6/55', '3D', '2D'],
  5: ['6/45', '6D', '3D', '2D'],
  6: ['6/55', '6/42', '6D', '3D', '2D'],
};

// Number of circles in the Blueprint grid (5x4)
export const BLUEPRINT_GRID_SIZE = 20;

// Number of rows and columns in the blueprint grid
export const BLUEPRINT_GRID_COLS = 5;
export const BLUEPRINT_GRID_ROWS = 4;

// Banner dimensions
export const BANNER_WIDTH = 1080;
export const BANNER_HEIGHT = 1350;
