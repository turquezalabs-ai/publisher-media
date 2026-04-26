/**
 * Data Preprocessor for Lottong Pinoy
 *
 * Cleans, normalizes, and organizes raw scraper data into
 * a format the analysis engine and cron system can reliably use.
 *
 * Handles:
 *  - Copyright trap removal
 *  - Date normalization (MM/DD/YYYY → ISO)
 *  - Game name → game code mapping
 *  - Newest-first sorting per game
 *  - Draw existence check (for holiday detection)
 */

import type { LottoResult } from './types';

// ==========================================
// GAME NAME → GAME CODE MAPPING
// ==========================================
const GAME_NAME_MAP: Record<string, string> = {
  'Ultra Lotto 6/58': '6/58',
  'Grand Lotto 6/55': '6/55',
  'Superlotto 6/49': '6/49',
  'Super Lotto 6/49': '6/49',     // alternate spelling from scraper
  'Megalotto 6/45': '6/45',
  'Mega Lotto 6/45': '6/45',      // alternate spelling from scraper
  'Lotto 6/42': '6/42',
  '6D Lotto': '6D',
  '4D Lotto': '4D',
  // 3D time slots — consolidated into single game code
  '3D Lotto 2PM': '3D',
  '3D Lotto 5PM': '3D',
  '3D Lotto 9PM': '3D',
  'Suertres Lotto 11:30AM': '3D',
  'Suertres Lotto 12:30PM': '3D',
  'Suertres Lotto 2PM': '3D',
  // 2D time slots — consolidated into single game code
  '2D Lotto 2PM': '2D',
  '2D Lotto 5PM': '2D',
  '2D Lotto 9PM': '2D',
  'EZ2 Lotto 11:30AM': '2D',
  'EZ2 Lotto 12:30PM': '2D',
  'EZ2 Lotto 2PM': '2D',
};

// Games included in auto-analysis posting (2D/3D excluded per user request)
const AUTO_ANALYSIS_GAMES = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'];

// Copyright trap signatures — entries the scraper injects to catch data thieves
const COPYRIGHT_TRAPS = [
  'COPYRIGHT',
  'THIS-DATA-IS-STOLEN',
  'THIS-DATA-IS-STOPLEN',
];

// ==========================================
// DATE NORMALIZATION
// ==========================================

/**
 * Normalize various date formats to YYYY-MM-DD.
 * Handles: "4/3/2026", "04/03/2026", "4/03/2026", "2026-04-03", etc.
 * Assumes MM/DD/YYYY format for slash-separated dates (US format, matching PCSO website).
 */
export function normalizeDate(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') return '';

  const trimmed = dateStr.trim();

  // Already ISO format (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Slash-separated: MM/DD/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback: try native parsing
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return trimmed; // return as-is if nothing works
}

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date object at midnight UTC.
 */
export function parseISODate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Get the day of week (0=Sunday, 6=Saturday) for an ISO date string.
 */
export function getDayOfWeek(dateStr: string): number {
  const d = parseISODate(dateStr);
  return d.getUTCDay();
}

/**
 * Format an ISO date for display: "Month Day, Year" (e.g. "April 3, 2026")
 */
export function formatDisplayDate(isoDate: string): string {
  const d = parseISODate(isoDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Get today's date in Asia/Manila timezone as YYYY-MM-DD.
 */
export function getTodayPH(): string {
  const now = new Date();
  const phOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  const parts = new Intl.DateTimeFormat('en-CA', phOptions).format(now);
  // en-CA format is YYYY-MM-DD
  return parts;
}

/**
 * Get yesterday's date in Asia/Manila timezone as YYYY-MM-DD.
 */
export function getYesterdayPH(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const phOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  return new Intl.DateTimeFormat('en-CA', phOptions).format(d);
}

/**
 * Get current hour and minute in Asia/Manila timezone.
 */
export function getCurrentTimePH(): { hour: number; minute: number } {
  const now = new Date();
  const phTime = now.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const [hourStr, minuteStr] = phTime.split(':').map(Number);
  return { hour: hourStr, minute: minuteStr };
}

// ==========================================
// DATA CLEANING
// ==========================================

/**
 * Check if an entry is the copyright trap.
 */
function isCopyrightTrap(entry: Record<string, unknown>): boolean {
  const combo = String(entry.combination || '');
  const game = String(entry.game || '');
  return COPYRIGHT_TRAPS.some(trap => combo.includes(trap) || game.includes(trap));
}

/**
 * Check if an entry has valid data (at least a combination with digits).
 */
function isValidEntry(entry: Record<string, unknown>): boolean {
  if (isCopyrightTrap(entry)) return false;
  const combo = String(entry.combination || '');
  return /\d/.test(combo);
}

/**
 * Map scraper game name to game code.
 */
export function mapGameName(scraperName: string): string {
  return GAME_NAME_MAP[scraperName] || scraperName;
}

// ==========================================
// MAIN PREPROCESSOR
// ==========================================

/**
 * Process raw scraper data into clean, organized data.
 *
 * Steps:
 *  1. Filter out garbage entries and copyright traps
 *  2. Normalize dates to YYYY-MM-DD
 *  3. Map game names to game codes
 *  4. Normalize prize and winners fields
 *  5. Sort each game's data newest-first
 *
 * Returns an array of LottoResult sorted newest-first globally,
 * and also grouped by game.
 */
export function preprocessData(rawData: unknown[]): {
  all: LottoResult[];
  byGame: Record<string, LottoResult[]>;
  games: string[];
} {
  // Step 1: Filter valid entries
  const valid = (rawData || []).filter(
    (entry: unknown) => isValidEntry(entry as Record<string, unknown>)
  );

  // Step 2-4: Normalize each entry
  const processed: LottoResult[] = valid.map((entry: unknown) => {
    const e = entry as Record<string, string>;

    // Normalize game name to game code
    const game = mapGameName(e.game || '');

    // Normalize date
    const date = normalizeDate(e.date || '');

    // Normalize combination (remove extra spaces)
    const combination = (e.combination || '').replace(/\s+/g, '-').trim();

    // Normalize prize
    let prize = e.prize || '';
    if (prize === '0' || prize === '0.00') prize = '₱ TBA';
    else if (!prize.startsWith('₱') && prize !== '₱ TBA') prize = `₱ ${prize}`;

    // Normalize winners
    const winners = (!e.winners || e.winners === '') ? '0' : e.winners;

    return {
      game,
      combination,
      date,
      prize,
      winners,
    } as LottoResult;
  });

  // Step 5: Sort newest-first globally by date
  processed.sort((a, b) => {
    // Sort by date descending
    const dateCompare = b.date.localeCompare(a.date);
    return dateCompare;
  });

  // Group by game
  const byGame: Record<string, LottoResult[]> = {};
  const gameSet = new Set<string>();

  for (const entry of processed) {
    if (!byGame[entry.game]) byGame[entry.game] = [];
    byGame[entry.game].push(entry);
    gameSet.add(entry.game);
  }

  return {
    all: processed,
    byGame,
    games: [...gameSet],
  };
}

// ==========================================
// DRAW LOOKUP HELPERS
// ==========================================

/**
 * Find the most recent draw for a specific game.
 * Returns the latest draw or null if not found.
 */
export function getLatestDraw(game: string, data: LottoResult[]): LottoResult | null {
  const gameData = data.filter(d => d.game === game);
  if (gameData.length === 0) return null;

  // Already sorted newest-first, so first entry is latest
  return gameData[0];
}

/**
 * Find the most recent draw for a game that was drawn on or before a specific date.
 * Used to find "the draw from yesterday" for analysis posts.
 */
export function getDrawOnOrBeforeDate(
  game: string,
  dateISO: string,
  data: LottoResult[]
): LottoResult | null {
  const gameData = data.filter(d => d.game === game && d.date <= dateISO);
  if (gameData.length === 0) return null;

  // Return the one closest to (but not after) the target date
  // Data is sorted newest-first, so first match is the most recent on or before date
  return gameData[0];
}

/**
 * Check if a draw exists for a specific game on a specific date.
 * Used for holiday detection — if no draw on a scheduled draw day, skip the post.
 */
export function drawExistsForDate(
  game: string,
  dateISO: string,
  data: LottoResult[]
): boolean {
  return data.some(d => d.game === game && d.date === dateISO);
}

/**
 * Get all game data for a specific game, sorted newest-first.
 */
export function getGameData(game: string, data: LottoResult[]): LottoResult[] {
  return data.filter(d => d.game === game);
}

/**
 * Get the most recent draw date for a game.
 * Returns null if no draws exist for this game.
 */
export function getLatestDrawDate(game: string, data: LottoResult[]): string | null {
  const latest = getLatestDraw(game, data);
  return latest ? latest.date : null;
}

// ==========================================
// LOCAL FALLBACK
// ==========================================

/**
 * Load and preprocess data from the local results.json file.
 */
async function loadLocalData(): Promise<{
  all: LottoResult[];
  byGame: Record<string, LottoResult[]>;
  games: string[];
}> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'public', 'results.json');
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    console.log(`[Cron] Loaded ${Array.isArray(raw) ? raw.length : 0} records from local results.json`);
    return preprocessData(Array.isArray(raw) ? raw : []);
  } catch (err) {
    console.error('[Cron] Failed to read local results.json:', err);
    return { all: [], byGame: {}, games: [] };
  }
}

// ==========================================
// DATA LOADING
// ==========================================

/**
 * Fetch and preprocess lotto data from the configured source.
 * Tries DATA_SOURCE_URL first, falls back to local results.json.
 *
 * FIX: Now properly falls back to local file when URL returns empty data.
 */
export async function fetchAndProcessData(): Promise<{
  all: LottoResult[];
  byGame: Record<string, LottoResult[]>;
  games: string[];
}> {
  const dataSourceUrl = process.env.DATA_SOURCE_URL;

  if (dataSourceUrl && dataSourceUrl.trim().length > 0) {
    try {
      console.log(`[Cron] Fetching from DATA_SOURCE_URL: ${dataSourceUrl}`);
      const response = await fetch(dataSourceUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LottongPinoy-Cron/1.0',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
        signal: AbortSignal.timeout(15000),
      });

      console.log(`[Cron] Response status: ${response.status} ${response.statusText}`);
      console.log(`[Cron] Response content-type: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        console.warn(`[Cron] DATA_SOURCE_URL returned ${response.status}, falling back to local`);
        return loadLocalData();
      }

      const raw = await response.json();
      console.log(`[Cron] Raw data type: ${typeof raw}, isArray: ${Array.isArray(raw)}`);

      let dataArray: unknown[];

      if (Array.isArray(raw)) {
        dataArray = raw;
      } else if (raw && typeof raw === 'object') {
        // Log keys for debugging
        const keys = Object.keys(raw);
        console.log(`[Cron] Object keys: ${keys.join(', ')}`);
        dataArray = (raw as Record<string, unknown>).data as unknown[]
          || (raw as Record<string, unknown>).results as unknown[]
          || [];
      } else {
        dataArray = [];
      }

      console.log(`[Cron] Extracted array length: ${dataArray.length}`);

      if (dataArray.length === 0) {
        console.warn(`[Cron] DATA_SOURCE_URL returned empty data, falling back to local`);
        return loadLocalData();
      }

      console.log(`[Cron] Fetched ${dataArray.length} records from DATA_SOURCE_URL`);
      return preprocessData(dataArray);

    } catch (err) {
      console.warn(`[Cron] Failed to fetch DATA_SOURCE_URL:`, err);
      return loadLocalData();
    }
  }

  // No DATA_SOURCE_URL configured — use local file
  return loadLocalData();
}