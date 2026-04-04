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

// ==========================================
// BLUEPRINT ROTATION (30-day cycle, 7-game rotation)
// ==========================================
// The blueprint rotates through 7 games continuously:
// Day 1=Mega(6/45), Day 2=Lotto(6/42), Day 3=4D, Day 4=6D,
// Day 5=Ultra(6/58), Day 6=Grand(6/55), Day 7=Super(6/49)
// Then repeats. Each day gets a different caption template (30 total).
// Post time: 10:00 AM daily
export const BLUEPRINT_ROTATION: string[] = [
  '6/45',  // Day 1 → Wednesday
  '6/42',  // Day 2 → Thursday
  '4D',    // Day 3 → Friday
  '6D',    // Day 4 → Saturday
  '6/58',  // Day 5 → Sunday
  '6/55',  // Day 6 → Monday
  '6/49',  // Day 7 → Tuesday
];

// Blueprint post time (10:00 AM)
export const BLUEPRINT_POST_TIME = '10:00';

// Total blueprint days in one cycle
export const BLUEPRINT_CYCLE_DAYS = 30;

// Get the game for a specific blueprint day (1-based)
export function getBlueprintGameForDay(dayIndex: number): string {
  const day = Math.max(1, Math.min(BLUEPRINT_CYCLE_DAYS, dayIndex));
  const rotationIndex = (day - 1) % BLUEPRINT_ROTATION.length;
  return BLUEPRINT_ROTATION[rotationIndex];
}

// ==========================================
// PCSO DRAW SCHEDULE (actual draw days)
// ==========================================
// Updated per PCSO official schedule:
// Ultra Lotto 6/58 – Tuesday, Friday, Sunday at 9 PM
// Grand Lotto 6/55 – Monday, Wednesday, Saturday at 9 PM
// Super Lotto 6/49 – Tuesday, Thursday, Sunday at 9 PM
// Mega Lotto 6/45 – Monday, Wednesday, Friday at 9 PM
// Lotto 6/42 – Tuesday, Thursday, Saturday at 9 PM
// 6D Lotto – Tuesday, Thursday, Saturday at 9 PM
// 4D Lotto – Monday, Wednesday, Friday at 9 PM
// 0=Sunday, 1=Monday, ..., 6=Saturday
export const SCHEDULE_MAP: Record<number, string[]> = {
  0: ['6/58', '6/49'],                    // Sunday
  1: ['6/55', '6/45', '4D'],              // Monday
  2: ['6/58', '6/49', '6/42', '6D'],      // Tuesday
  3: ['6/55', '6/45', '4D'],              // Wednesday
  4: ['6/49', '6/42', '6D'],              // Thursday
  5: ['6/58', '6/45', '4D'],              // Friday
  6: ['6/55', '6/42', '6D'],              // Saturday
};

// Draw time (9:00 PM)
export const DRAW_TIME = '21:00';

// ==========================================
// ANALYSIS POSTING SCHEDULE
// ==========================================
// Analysis posts go out the NEXT MORNING after draws.
// Starting at 7:30 AM with 30-minute gaps between each game's post.
// Example: Friday draws (6/58, 6/45, 4D) → Saturday posts at 7:30, 8:00, 8:30 AM
export const ANALYSIS_POST_START_TIME = '07:30';
export const ANALYSIS_POST_GAP_MINUTES = 30;

// Get which games were drawn on a specific day of week
export function getDrawsForDayOfWeek(dayOfWeek: number): string[] {
  return SCHEDULE_MAP[dayOfWeek] || [];
}

// Get the next day's analysis post times based on draws from a given day
// Returns array of { game, postTime } sorted by post time
export function getNextDayAnalysisPosts(fromDayOfWeek: number): { game: string; postTime: string }[] {
  const drawnGames = getDrawsForDayOfWeek(fromDayOfWeek);
  const posts: { game: string; postTime: string }[] = [];
  const startHour = 7;
  const startMinute = 30;

  drawnGames.forEach((game, index) => {
    const totalMinutes = startHour * 60 + startMinute + (index * ANALYSIS_POST_GAP_MINUTES);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const postTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    posts.push({ game, postTime });
  });

  return posts;
}

// Legacy compat: keep old BLUEPRINT_SCHEDULE for batch ZIP generation
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

// Number of circles in the Blueprint grid (5x4)
export const BLUEPRINT_GRID_SIZE = 20;

// Number of rows and columns in the blueprint grid
export const BLUEPRINT_GRID_COLS = 5;
export const BLUEPRINT_GRID_ROWS = 4;

// Banner dimensions
export const BANNER_WIDTH = 1080;
export const BANNER_HEIGHT = 1350;

// ==========================================
// DAILY WINNERS SCHEDULE
// ==========================================
// Posts a recap of all yesterday's winning numbers.
// Post time: 6:30 AM PH daily
// Skipped if no draws (holiday, Holy Week).
export const DAILY_WINNERS_POST_TIME = '06:30';

// Major games shown in the Daily Winners banner
export const DAILY_WINNERS_MAJOR_GAMES = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'];

// Daily digit games shown in the Daily Winners banner
export const DAILY_WINNERS_DIGIT_GAMES = ['3D', '2D'];

// Time slots for daily digit games (2PM, 5PM, 9PM)
export const DAILY_DRAW_TIME_SLOTS = ['2PM', '5PM', '9PM'];

// Game name display for daily winners (shorter for layout)
export const DAILY_GAME_LABELS: Record<string, string> = {
  '6/58': 'Ultra Lotto 6/58',
  '6/55': 'Grand Lotto 6/55',
  '6/49': 'Super Lotto 6/49',
  '6/45': 'Mega Lotto 6/45',
  '6/42': 'Lotto 6/42',
  '6D': '6D Lotto',
  '4D': '4D Lotto',
  '3D': '3D Swertres',
  '2D': '2D EZ2 Lotto',
};
