import { 
  GAME_MAX_NUMBERS, 
  BLUEPRINT_GRID_SIZE,
  BLUEPRINT_GRID_COLS,
  SCHEDULE_MAP
} from './config';
import type { 
  LottoResult, 
  TemperatureCategory, 
  BlueprintNumber, 
  FrequencyMap, 
  PatternResult,
  NumberData 
} from './types';

// ==========================================
// UTILITY: Parse combination string into numbers
// ==========================================
export function parseCombination(combination: string): number[] {
  if (!combination) return [];
  return String(combination)
    .split(/[-\s,]+/)
    .map(n => parseInt(n.trim(), 10))
    .filter(n => !isNaN(n));
}

// ==========================================
// FREQUENCY CALCULATOR
// ==========================================
export function calculateFrequency(
  data: LottoResult[], 
  game: string
): FrequencyMap {
  const maxNum = GAME_MAX_NUMBERS[game] || 58;
  const isDigitGame = game === '2D' || game === '3D' || game === '4D' || game === '6D';
  const startNum = isDigitGame ? 0 : 1;
  
  const freq: FrequencyMap = {};
  // Initialize all numbers
  for (let i = startNum; i <= maxNum; i++) {
    freq[i] = 0;
  }
  
  // Count occurrences
  data.forEach(d => {
    parseCombination(d.combination).forEach(n => {
      if (freq.hasOwnProperty(n)) {
        freq[n]++;
      }
    });
  });
  
  return freq;
}

// ==========================================
// HOT/WARM/COLD CLASSIFICATION
// ==========================================
export function classifyNumbers(
  freqMap: FrequencyMap
): NumberData[] {
  const entries = Object.entries(freqMap).map(([num, count]) => ({
    number: parseInt(num, 10),
    frequency: count,
    category: 'warm' as TemperatureCategory,
    emoji: '',
  }));
  
  // Sort by frequency descending
  entries.sort((a, b) => b.frequency - a.frequency);
  
  const total = entries.length;
  const third = Math.floor(total / 3);
  
  // Assign categories
  entries.forEach((entry, index) => {
    if (index < third) {
      entry.category = 'hot';
      entry.emoji = '🔥';
    } else if (index < third * 2) {
      entry.category = 'warm';
      entry.emoji = '🌡️';
    } else {
      entry.category = 'cold';
      entry.emoji = '❄️';
    }
  });
  
  return entries;
}

// ==========================================
// BLUEPRINT NUMBER GENERATOR (Random Mix)
// ==========================================
export function generateBlueprintNumbers(
  data: LottoResult[],
  game: string,
  count: number = BLUEPRINT_GRID_SIZE
): BlueprintNumber[] {
  const freqMap = calculateFrequency(data, game);
  const classified = classifyNumbers(freqMap);
  
  const hot = classified.filter(n => n.category === 'hot');
  const warm = classified.filter(n => n.category === 'warm');
  const cold = classified.filter(n => n.category === 'cold');
  
  // Shuffle each category
  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  
  const shuffledHot = shuffle(hot);
  const shuffledWarm = shuffle(warm);
  const shuffledCold = shuffle(cold);
  
  // Random mix: aim for ~35% hot, ~35% warm, ~30% cold
  const hotCount = Math.min(Math.floor(count * 0.35) + Math.floor(Math.random() * 3), shuffledHot.length);
  const coldCount = Math.min(Math.floor(count * 0.30) + Math.floor(Math.random() * 2), shuffledCold.length);
  const warmCount = Math.min(count - hotCount - coldCount, shuffledWarm.length);
  
  const selected: BlueprintNumber[] = [];
  
  // Pick from hot
  for (let i = 0; i < hotCount; i++) {
    selected.push({
      number: shuffledHot[i].number,
      category: 'hot',
      emoji: '🔥',
    });
  }
  
  // Pick from warm
  for (let i = 0; i < warmCount; i++) {
    selected.push({
      number: shuffledWarm[i].number,
      category: 'warm',
      emoji: '🌡️',
    });
  }
  
  // Pick from cold
  for (let i = 0; i < coldCount; i++) {
    selected.push({
      number: shuffledCold[i].number,
      category: 'cold',
      emoji: '❄️',
    });
  }
  
  // Final shuffle to randomize positions in grid
  return shuffle(selected).slice(0, count);
}

// ==========================================
// PATTERN CALCULATOR (Pairs & Trios)
// ==========================================
function getCombinations(arr: number[], k: number): number[][] {
  const result: number[][] = [];
  function combine(start: number, combo: number[]) {
    if (combo.length === k) {
      result.push(combo.slice());
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      combine(i + 1, combo);
      combo.pop();
    }
  }
  combine(0, []);
  return result;
}

export function calculatePatterns(data: LottoResult[]): {
  pairs: PatternResult[];
  trios: PatternResult[];
} {
  const pairCounts: Record<string, number> = {};
  const trioCounts: Record<string, number> = {};
  
  data.forEach(d => {
    const nums = parseCombination(d.combination);
    const pairs = getCombinations(nums, 2);
    pairs.forEach(pair => {
      const key = pair.sort((a, b) => a - b).join('-');
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    });
    
    const trios = getCombinations(nums, 3);
    trios.forEach(trio => {
      const key = trio.sort((a, b) => a - b).join('-');
      trioCounts[key] = (trioCounts[key] || 0) + 1;
    });
  });
  
  const sortAndSlice = (obj: Record<string, number>): PatternResult[] => {
    return Object.entries(obj)
      .map(([combo, count]) => ({ combo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };
  
  return {
    pairs: sortAndSlice(pairCounts),
    trios: sortAndSlice(trioCounts),
  };
}

// ==========================================
// INSIGHTS
// ==========================================
export interface Insight {
  icon: string;
  label: string;
  text: string;
  number?: number;
  style: string;
}

export function getHotTrendingInsight(gameData: LottoResult[]): Insight | null {
  if (gameData.length < 10) return null;
  
  const recent10 = gameData.slice(0, 10);
  const historical100 = gameData.slice(0, 100);
  const freqRecent: FrequencyMap = {};
  const freqHistorical: FrequencyMap = {};
  
  const countFreq = (data: LottoResult[], map: FrequencyMap) => {
    data.forEach(d => {
      parseCombination(d.combination).forEach(n => {
        if (!isNaN(n)) map[n] = (map[n] || 0) + 1;
      });
    });
  };
  
  countFreq(recent10, freqRecent);
  countFreq(historical100, freqHistorical);
  
  let bestNum: number | null = null;
  let bestDiff = 0;
  
  Object.keys(freqRecent).forEach(num => {
    const recentRate = (freqRecent[num] / 10) * 100;
    const histRate = ((freqHistorical[num] || 0) / (historical100.length || 1)) * 100;
    const diff = recentRate - histRate;
    if (diff > bestDiff) {
      bestDiff = diff;
      bestNum = parseInt(num, 10);
    }
  });
  
  if (bestNum && bestDiff > 5) {
    return {
      icon: '🔥',
      label: 'Hot & Trending',
      text: `#${bestNum} is trending! Appearing ${bestDiff.toFixed(0)}% more often than usual.`,
      number: bestNum,
      style: 'hot',
    };
  }
  return null;
}

export function getColdOverdueInsight(gameData: LottoResult[]): Insight | null {
  if (gameData.length < 10) return null;
  
  const lastSeen: Record<number, number> = {};
  
  gameData.forEach((d, index) => {
    parseCombination(d.combination).forEach(n => {
      if (!isNaN(n) && lastSeen[n] === undefined) {
        lastSeen[n] = index;
      }
    });
  });
  
  let coldestNum: number | null = null;
  let maxGap = 0;
  
  Object.entries(lastSeen).forEach(([num, index]) => {
    if (index > maxGap) {
      maxGap = index;
      coldestNum = parseInt(num, 10);
    }
  });
  
  if (coldestNum && maxGap >= 5) {
    return {
      icon: '❄️',
      label: 'Cold Number',
      text: `#${coldestNum} hasn't been seen in ${maxGap} draws.`,
      number: coldestNum,
      style: 'cold',
    };
  }
  return null;
}

export function getSukiPairsInsight(gameData: LottoResult[]): Insight | null {
  if (gameData.length < 5) return null;
  
  const pairFreq: Record<string, number> = {};
  const recent30 = gameData.slice(0, 30);
  
  recent30.forEach(d => {
    const nums = parseCombination(d.combination).filter(n => !isNaN(n));
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = [nums[i], nums[j]].sort((a, b) => a - b).join('-');
        pairFreq[key] = (pairFreq[key] || 0) + 1;
      }
    }
  });
  
  let topPair: string | null = null;
  let topCount = 0;
  
  Object.entries(pairFreq).forEach(([pair, count]) => {
    if (count > topCount) {
      topCount = count;
      topPair = pair;
    }
  });
  
  if (topPair !== null && topPair !== undefined && topCount >= 2) {
    return {
      icon: '💕',
      label: 'Power Couple',
      text: `${(topPair as string).replace('-', ' & ')} appeared together ${topCount} times in 30 days.`,
      style: 'couple',
    };
  }
  return null;
}

// ==========================================
// LAST SEEN CALCULATOR
// ==========================================
export function getLastSeenForNumber(
  gameData: LottoResult[],
  targetNumber: number,
  currentDrawIndex: number = 0
): number {
  // How many draws ago was this number last seen?
  // currentDrawIndex = 0 means current draw (the draw being analyzed)
  for (let i = currentDrawIndex + 1; i < gameData.length; i++) {
    const nums = parseCombination(gameData[i].combination);
    if (nums.includes(targetNumber)) {
      return i - currentDrawIndex; // number of draws between
    }
  }
  return gameData.length; // never seen
}

export function formatLastSeen(drawsAgo: number, gameData: LottoResult[], currentDrawIndex: number = 0): string {
  if (drawsAgo === 0) return 'Today';
  if (drawsAgo === 1) {
    // Check if the previous draw was "yesterday" (different date)
    const currentDate = new Date(gameData[currentDrawIndex]?.date || '');
    const prevDate = new Date(gameData[currentDrawIndex + 1]?.date || '');
    const diffDays = Math.floor((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 1 ? 'Yesterday' : `${diffDays} days ago`;
  }
  if (drawsAgo < 7) return `${drawsAgo} days ago`;
  if (drawsAgo < 30) {
    // Return the specific date
    const draw = gameData[currentDrawIndex + drawsAgo];
    if (draw) {
      const d = new Date(draw.date);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return `${drawsAgo} draws ago`;
  }
  if (drawsAgo < 90) {
    const months = Math.round(drawsAgo / 3); // rough: ~3 draws per month for weekly games
    return `~${months} month${months > 1 ? 's' : ''} ago`;
  }
  if (drawsAgo < 360) {
    const months = Math.round(drawsAgo / 3);
    return `~${months} month${months > 1 ? 's' : ''} ago`;
  }
  const years = (drawsAgo / 52).toFixed(0);
  return `~${years} year${parseInt(years) > 1 ? 's' : ''} ago`;
}

// ==========================================
// CONSECUTIVE NUMBERS CHECK
// ==========================================
export function getConsecutivePairs(numbers: number[]): number[][] {
  const sorted = [...numbers].sort((a, b) => a - b);
  const consecutive: number[][] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1] - sorted[i] === 1) {
      consecutive.push([sorted[i], sorted[i + 1]]);
    }
  }
  return consecutive;
}

export function getConsecutivePercentage(gameData: LottoResult[]): number {
  // What % of draws have at least one consecutive pair?
  let withConsecutive = 0;
  gameData.forEach(d => {
    const nums = parseCombination(d.combination);
    if (getConsecutivePairs(nums).length > 0) {
      withConsecutive++;
    }
  });
  return gameData.length > 0 ? Math.round((withConsecutive / gameData.length) * 100) : 0;
}

// ==========================================
// REPEAT FROM PREVIOUS DRAW
// ==========================================
export function getRepeatNumbers(
  currentDraw: LottoResult,
  previousDraw: LottoResult | undefined
): number[] {
  if (!previousDraw) return [];
  const currentNums = parseCombination(currentDraw.combination);
  const prevNums = parseCombination(previousDraw.combination);
  return currentNums.filter(n => prevNums.includes(n));
}

// ==========================================
// TOP PAIR IN PERIOD
// ==========================================
export function getTopPairInPeriod(
  gameData: LottoResult[],
  period: '5years' | '1year' | '30days' = '5years'
): { pair: string; count: number; period: string } | null {
  let dataSlice: LottoResult[];
  let periodLabel: string;

  if (period === '30days') {
    dataSlice = gameData.slice(0, 30);
    periodLabel = '30 days';
  } else if (period === '1year') {
    // Rough: ~52 draws per year for weekly games, ~150 for daily digit games
    const isWeekly = gameData[0]?.game?.includes('6/');
    dataSlice = gameData.slice(0, isWeekly ? 52 : 150);
    periodLabel = '1 year';
  } else {
    dataSlice = gameData;
    periodLabel = '5 years';
  }

  const pairFreq: Record<string, number> = {};
  dataSlice.forEach(d => {
    const nums = parseCombination(d.combination).filter(n => !isNaN(n));
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = [nums[i], nums[j]].sort((a, b) => a - b).join('-');
        pairFreq[key] = (pairFreq[key] || 0) + 1;
      }
    }
  });

  let topPair: string | null = null;
  let topCount = 0;
  Object.entries(pairFreq).forEach(([pair, count]) => {
    if (count > topCount) {
      topCount = count;
      topPair = pair;
    }
  });

  if (topPair && topCount >= 2) {
    return { pair: topPair, count: topCount, period: periodLabel };
  }
  return null;
}

// ==========================================
// DATA HELPERS
// ==========================================
export function filterByGame(data: LottoResult[], game: string): LottoResult[] {
  return data.filter(d => d.game && d.game.includes(game));
}

export function getLatestDraw(data: LottoResult[], game: string): LottoResult | undefined {
  const filtered = filterByGame(data, game);
  return filtered[0]; // Already sorted newest first from API
}

export function getPreviousDraw(data: LottoResult[], game: string): LottoResult | undefined {
  const filtered = filterByGame(data, game);
  return filtered[1]; // Second most recent
}

/**
 * Get a draw for a specific game on a specific date.
 * Matches the YYYY-MM-DD portion of the draw's date field.
 * If no draw exists for that exact date, falls back to the most recent
 * draw before the target date.
 *
 * This is used for the "Yesterday's Analysis" flow:
 * Since the last PCSO draw is at 9PM, posting late hurts reach.
 * So analysis always targets yesterday's draws, published today.
 */
export function getDrawByDate(
  data: LottoResult[],
  game: string,
  targetDateISO: string // e.g. "2026-04-25"
): LottoResult | undefined {
  const filtered = filterByGame(data, game);
  if (filtered.length === 0) return undefined;

  // Normalize target date to YYYY-MM-DD
  const targetDate = targetDateISO.split('T')[0].split(' ')[0];

  // Try exact date match first
  const exactMatch = filtered.find(d => {
    const drawDate = d.date.split('T')[0].split(' ')[0];
    return drawDate === targetDate;
  });
  if (exactMatch) return exactMatch;

  // Fallback: most recent draw BEFORE the target date
  const beforeTarget = filtered.find(d => {
    const drawDate = d.date.split('T')[0].split(' ')[0];
    return drawDate < targetDate;
  });
  return beforeTarget || filtered[filtered.length - 1]; // oldest as last resort
}

/**
 * Get yesterday's date in YYYY-MM-DD format, Philippine timezone.
 */
export function getYesterdayPH(): string {
  const now = new Date();
  // Convert to PH timezone (UTC+8)
  const phOffset = 8 * 60; // minutes
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const phTime = new Date(utc + phOffset * 60000);
  phTime.setDate(phTime.getDate() - 1);
  const yyyy = phTime.getFullYear();
  const mm = String(phTime.getMonth() + 1).padStart(2, '0');
  const dd = String(phTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Get today's date in YYYY-MM-DD format, Philippine timezone.
 */
export function getTodayPH(): string {
  const now = new Date();
  const phOffset = 8 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const phTime = new Date(utc + phOffset * 60000);
  const yyyy = phTime.getFullYear();
  const mm = String(phTime.getMonth() + 1).padStart(2, '0');
  const dd = String(phTime.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getGameCode(gameName: string): string | null {
  if (!gameName) return null;
  const lower = gameName.toLowerCase();
  if (lower.includes('ultra')) return '6/58';
  if (lower.includes('grand')) return '6/55';
  if (lower.includes('super')) return '6/49';
  if (lower.includes('mega')) return '6/45';
  if (lower.includes('6/42')) return '6/42';
  if (lower.includes('6d')) return '6D';
  if (lower.includes('4d')) return '4D';
  if (lower.includes('3d')) return '3D';
  if (lower.includes('2d')) return '2D';
  return null;
}

/**
 * Extract the game code from a LottoResult's `game` field.
 * Handles both normalized codes like "6/58" and partial matches.
 */
export function getGameCodeFromResult(result: LottoResult): string {
  const game = result.game || '';
  // Already a known game code
  const knownCodes = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D', '3D', '2D'];
  for (const code of knownCodes) {
    if (game.includes(code)) return code;
  }
  // Fallback: return as-is
  return game;
}

/**
 * Get the day of the week (0=Sun, 1=Mon, ..., 6=Sat) for a YYYY-MM-DD date
 * using Philippine timezone (UTC+8).
 */
export function getDayOfWeekPH(dateISO: string): number {
  // Parse the date parts manually and create a Date in UTC,
  // then adjust to PH timezone to get the correct day.
  const parts = dateISO.split('T')[0].split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  // Create date at noon UTC to avoid DST edge cases
  const utc = new Date(Date.UTC(year, month, day, 12, 0, 0));
  // Convert to PH timezone (UTC+8)
  const phTime = new Date(utc.getTime() + 8 * 60 * 60 * 1000);
  return phTime.getUTCDay();
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/**
 * Get the human-readable day name for a YYYY-MM-DD date in PH timezone.
 */
export function getDayNamePH(dateISO: string): string {
  return DAY_NAMES[getDayOfWeekPH(dateISO)] || '';
}

/**
 * Get ALL draws from yesterday across all games.
 * Returns draws sorted by game category (major games first, then digit games),
 * with multiple draws per digit game (2PM, 5PM, 9PM) grouped together.
 *
 * Schedule-aware: uses SCHEDULE_MAP to know which major games should have drawn.
 * 3D and 2D are daily games (draw at 2PM, 5PM, 9PM every day).
 * If a scheduled game has no data for yesterday, falls back to most recent draw.
 */
export function getYesterdayDraws(data: LottoResult[]): LottoResult[] {
  const yesterday = getYesterdayPH();
  const targetDate = yesterday.split('T')[0];
  const dow = getDayOfWeekPH(yesterday);

  // Get the list of major games scheduled for yesterday
  const scheduledMajorGames = SCHEDULE_MAP[dow] || [];
  // Daily digit games always draw (3D Swertres, 2D EZ2)
  const dailyDigitGames = ['3D', '2D'];

  // Filter all draws matching yesterday's date
  const yesterdayDraws = data.filter(d => {
    const drawDate = d.date.split('T')[0].split(' ')[0];
    return drawDate === targetDate;
  });

  const seen = new Set<string>();
  const results: LottoResult[] = [];

  // Scheduled major games first (in schedule order)
  for (const code of scheduledMajorGames) {
    const match = yesterdayDraws.find(d => {
      const dCode = getGameCodeFromResult(d);
      return dCode === code && !seen.has(code);
    });
    if (match) {
      results.push(match);
      seen.add(code);
    } else {
      // Fallback: no data for yesterday yet → use most recent draw for this game
      const recentDraw = getDrawByDate(data, code, yesterday);
      if (recentDraw && !seen.has(code)) {
        results.push(recentDraw);
        seen.add(code);
      }
    }
  }

  // Daily digit games (keep all time slots — 2PM, 5PM, 9PM)
  for (const code of dailyDigitGames) {
    const matches = yesterdayDraws.filter(d => getGameCodeFromResult(d) === code);
    if (matches.length > 0) {
      for (const m of matches) {
        results.push(m);
      }
    } else {
      // Fallback: use most recent draws if yesterday's data not yet available
      const recentDraws = data.filter(d => getGameCodeFromResult(d) === code);
      // Show up to 3 most recent for daily games
      results.push(...recentDraws.slice(0, 3));
    }
  }

  return results;
}

// ==========================================
// HUMAN-READABLE PATTERN STATEMENTS
// ==========================================
interface PatternStatement {
  text: string;
  weight: number; // 1=common, 2=notable, 3=rare/special
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Generate 3 random human-readable pattern statements from a draw.
 * Each statement is a natural sentence describing a statistical observation.
 */
export function generateHumanPatternStatements(
  winningNumbers: number[],
  gameData: LottoResult[],
  currentDraw: LottoResult,
  previousDraw: LottoResult | undefined,
): string[] {
  const sorted = [...winningNumbers].sort((a, b) => a - b);
  const statements: PatternStatement[] = [];

  // ---- 1. Consecutive numbers ----
  const consPairs = getConsecutivePairs(winningNumbers);
  if (consPairs.length > 0) {
    const pct = getConsecutivePercentage(gameData);
    for (const pair of consPairs) {
      statements.push({
        text: `<b>${pair[0]}</b> and <b>${pair[1]}</b> are consecutive. This occurs in about <b>${pct}%</b> of draws.`,
        weight: 2,
      });
    }
  }

  // ---- 2. Repeat from previous draw ----
  const repeatNums = getRepeatNumbers(currentDraw, previousDraw);
  if (repeatNums.length > 0) {
    // Calculate repeat %
    let repeatDraws = 0;
    for (let i = 0; i < gameData.length - 1; i++) {
      const curr = parseCombination(gameData[i].combination);
      const prev = parseCombination(gameData[i + 1].combination);
      if (curr.some(n => prev.includes(n))) repeatDraws++;
    }
    const repeatPct = gameData.length > 1 ? Math.round((repeatDraws / (gameData.length - 1)) * 100) : 50;
    const num = repeatNums[0];
    statements.push({
      text: `Number <b>${num}</b> repeated tonight. Back-to-backs happen <b>${repeatPct}%</b> of the time.`,
      weight: 2,
    });
  }

  // ---- 3. Pair from tonight appeared historically ----
  // Find the most frequent pair among tonight's numbers
  const tonightPairs = getCombinations(sorted, 2);
  const allPairFreq: Record<string, number> = {};
  gameData.slice(0, 200).forEach(d => {
    const nums = parseCombination(d.combination).filter(n => !isNaN(n));
    for (let i = 0; i < nums.length; i++) {
      for (let j = i + 1; j < nums.length; j++) {
        const key = [nums[i], nums[j]].sort((a, b) => a - b).join('-');
        allPairFreq[key] = (allPairFreq[key] || 0) + 1;
      }
    }
  });
  // Find best pair from tonight's pairs
  let bestTonightPair: string | null = null;
  let bestTonightCount = 0;
  for (const p of tonightPairs) {
    const key = p.sort((a, b) => a - b).join('-');
    const count = allPairFreq[key] || 0;
    if (count > bestTonightCount) {
      bestTonightCount = count;
      bestTonightPair = key;
    }
  }
  if (bestTonightPair && bestTonightCount >= 3) {
    const [a, b] = bestTonightPair.split('-').map(Number);
    statements.push({
      text: `Pair <b>${a}</b> & <b>${b}</b> drew tonight. They appeared <b>${bestTonightCount} times</b> in 5 years.`,
      weight: 2,
    });
  }

  // ---- 4. End digit matching ----
  const endDigitGroups: Record<number, number[]> = {};
  sorted.forEach(n => {
    const digit = n % 10;
    if (!endDigitGroups[digit]) endDigitGroups[digit] = [];
    endDigitGroups[digit].push(n);
  });
  const matchingEndDigits = Object.entries(endDigitGroups).filter(([_, nums]) => nums.length >= 2);
  if (matchingEndDigits.length > 0) {
    // Calculate how often end-digit matches happen
    let endMatchDraws = 0;
    gameData.slice(0, 200).forEach(d => {
      const nums = parseCombination(d.combination).filter(n => !isNaN(n));
      const digits: Record<number, number> = {};
      nums.forEach(n => { digits[n % 10] = (digits[n % 10] || 0) + 1; });
      if (Object.values(digits).some(c => c >= 2)) endMatchDraws++;
    });
    const endMatchPct = Math.round((endMatchDraws / Math.min(200, gameData.length)) * 100);
    const [digit, nums] = matchingEndDigits[0];
    const boldNums = (nums as number[]).map(n => `<b>${n}</b>`).join(' & ');
    statements.push({
      text: `${boldNums} share an end digit. This matches <b>${endMatchPct}%</b> of historical sets.`,
      weight: 2,
    });
  }

  // ---- 5. Decade groupings (same group of 10) ----
  const decadeGroups: Record<number, number[]> = {};
  sorted.forEach(n => {
    const decade = Math.floor(n / 10);
    if (!decadeGroups[decade]) decadeGroups[decade] = [];
    decadeGroups[decade].push(n);
  });
  const bigDecades = Object.entries(decadeGroups).filter(([_, nums]) => (nums as number[]).length >= 3);
  if (bigDecades.length > 0) {
    let decadeMatchDraws = 0;
    gameData.slice(0, 200).forEach(d => {
      const nums = parseCombination(d.combination).filter(n => !isNaN(n));
      const decades: Record<number, number> = {};
      nums.forEach(n => { decades[Math.floor(n / 10)] = (decades[Math.floor(n / 10)] || 0) + 1; });
      if (Object.values(decades).some(c => c >= 3)) decadeMatchDraws++;
    });
    const decadePct = Math.round((decadeMatchDraws / Math.min(200, gameData.length)) * 100);
    const [decade, nums] = bigDecades[0];
    const boldNums = (nums as number[]).map(n => `<b>${n}</b>`).join(', ');
    statements.push({
      text: `Three <b>${Number(decade) * 10}s</b> (${boldNums}) hit tonight. This grouping happens <b>${decadePct}%</b>.`,
      weight: 3,
    });
  }

  // ---- 6. Odd/Even balance ----
  const oddCount = sorted.filter(n => n % 2 !== 0).length;
  const evenCount = sorted.length - oddCount;
  let oddEvenDraws = 0;
  gameData.slice(0, 200).forEach(d => {
    const nums = parseCombination(d.combination).filter(n => !isNaN(n));
    const oc = nums.filter(n => n % 2 !== 0).length;
    if (oc === oddCount) oddEvenDraws++;
  });
  const oddEvenPct = Math.round((oddEvenDraws / Math.min(200, gameData.length)) * 100);
  statements.push({
    text: `Tonight has <b>${oddCount}</b> odd and <b>${evenCount}</b> even. This balance hits in <b>${oddEvenPct}%</b> of sets.`,
    weight: 1,
  });

  // ---- 7. Sum range ----
  const sum = sorted.reduce((a, b) => a + b, 0);
  const maxNum = sorted[sorted.length - 1]; // highest possible
  const minNum = sorted[0]; // lowest possible
  const ballCount = sorted.length;
  // Approximate normal range: mean ± 1 std dev
  const mean = ((minNum + maxNum) / 2) * ballCount;
  const stdDev = Math.sqrt(ballCount * ((maxNum - minNum) ** 2) / 12);
  const lowBound = Math.round(mean - stdDev);
  const highBound = Math.round(mean + stdDev);
  const inRange = sum >= lowBound && sum <= highBound;
  statements.push({
    text: `The sum of <b>${sum}</b> lands ${inRange ? 'perfectly' : 'outside'} the normal <b>${lowBound}-${highBound}</b> bell curve.`,
    weight: inRange ? 1 : 3,
  });

  // ---- 8. Number gap (longest absence) ----
  const gaps: { num: number; gap: number }[] = [];
  sorted.forEach(num => {
    const gap = getLastSeenForNumber(gameData, num, 0);
    gaps.push({ num, gap });
  });
  const longestGap = gaps.reduce((a, b) => a.gap > b.gap ? a : b, { num: 0, gap: 0 });
  if (longestGap.gap >= 5) {
    statements.push({
      text: `Number <b>${longestGap.num}</b> returned after <b>${longestGap.gap} draws</b>. ${longestGap.gap >= 10 ? 'A rare comeback!' : 'Gaps of 5+ are fairly common.'}`,
      weight: longestGap.gap >= 10 ? 3 : 1,
    });
  }

  // ---- 9. Prime numbers ----
  const primes = sorted.filter(isPrime);
  if (primes.length >= 2) {
    let primeDraws = 0;
    gameData.slice(0, 200).forEach(d => {
      const nums = parseCombination(d.combination).filter(n => !isNaN(n) && isPrime(n));
      if (nums.length >= primes.length) primeDraws++;
    });
    const primePct = Math.round((primeDraws / Math.min(200, gameData.length)) * 100);
    const boldPrimes = primes.map(n => `<b>${n}</b>`).join(', ');
    statements.push({
      text: `${boldPrimes.length > 2 ? 'Three' : 'Two'} primes (${boldPrimes}) drew tonight. Multi-primes are standard (<b>${primePct}%</b>).`,
      weight: 1,
    });
  }

  // ---- 10. High/Low balance ----
  const maxPossible = Math.max(...sorted);
  const midPoint = Math.floor(maxPossible / 2);
  const highNums = sorted.filter(n => n > midPoint).length;
  const lowNums = sorted.length - highNums;
  if (highNums === sorted.length || lowNums === sorted.length) {
    // All high or all low — very rare
    let allHighDraws = 0;
    gameData.slice(0, 200).forEach(d => {
      const nums = parseCombination(d.combination).filter(n => !isNaN(n));
      if (highNums === sorted.length && nums.every(n => n > midPoint)) allHighDraws++;
      else if (lowNums === sorted.length && nums.every(n => n <= midPoint)) allHighDraws++;
    });
    const allPct = Math.round((allHighDraws / Math.min(200, gameData.length)) * 100);
    statements.push({
      text: `All numbers are ${highNums === sorted.length ? 'over' : 'under'} <b>${midPoint}</b>. This all-${highNums === sorted.length ? 'high' : 'low'} is a <b>${allPct}%</b> event.`,
      weight: 3,
    });
  } else {
    let highLowDraws = 0;
    gameData.slice(0, 200).forEach(d => {
      const nums = parseCombination(d.combination).filter(n => !isNaN(n));
      const hn = nums.filter(n => n > midPoint).length;
      if (hn === highNums) highLowDraws++;
    });
    const hlPct = Math.round((highLowDraws / Math.min(200, gameData.length)) * 100);
    statements.push({
      text: `<b>${highNums}</b> high and <b>${lowNums}</b> low numbers tonight. This split occurs <b>${hlPct}%</b> of the time.`,
      weight: 1,
    });
  }

  // ---- 11. Spread / range ----
  const range = sorted[sorted.length - 1] - sorted[0];
  let tightDraws = 0;
  gameData.slice(0, 200).forEach(d => {
    const nums = parseCombination(d.combination).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (nums.length > 1 && (nums[nums.length - 1] - nums[0]) <= range) tightDraws++;
  });
  const spreadPct = Math.round((tightDraws / Math.min(200, gameData.length)) * 100);
  statements.push({
    text: `The spread is <b>${range}</b> (from <b>${sorted[0]}</b> to <b>${sorted[sorted.length - 1]}</b>). Tight spreads happen <b>${spreadPct}%</b> of the time.`,
    weight: range < 30 ? 2 : 1,
  });

  // ---- Pick 3 random statements, weighted towards interesting ones ----
  // Sort by weight (higher = more interesting)
  const weighted = shuffleArray(statements);
  weighted.sort((a, b) => b.weight - a.weight);

  // Pick top 3 (or fewer if not enough)
  const selected = weighted.slice(0, 3);

  // Final shuffle so they appear in random order
  return shuffleArray(selected).map(s => s.text);
}
