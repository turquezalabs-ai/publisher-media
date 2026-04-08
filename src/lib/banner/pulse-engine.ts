import type { LottoResult } from './types';
import { generate2DPatterns, generate3DPatterns } from './pulse-patterns';
import type { PulseInsight } from './pulse-patterns';

export interface PulseSection {
  lastDraw: number[];
  patterns: PulseInsight[];
  numberCategories: Record<number, 'hot' | 'warm' | 'cold'>; // each drawn number -> category
}

export interface PulseData {
  '2d': PulseSection;
  '3d': PulseSection;
}

function parseCombination(combo: string): number[] {
  return combo.split(/[-,]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }
  return trimmed;
}

/**
 * Calculate frequency for fire emoji (hot numbers)
 */
/**
 * Classify each drawn number as hot, warm, or cold
 */
function classifyDrawNumbers(
  draws: LottoResult[],
  currentDraw: number[],
  min: number,
  max: number
): Record<number, 'hot' | 'warm' | 'cold'> {
  // Calculate frequency for all possible numbers
  const freq = new Map<number, number>();
  for (const draw of draws) {
    const parts = parseCombination(draw.combination);
    for (const num of parts) {
      if (num >= min && num <= max) {
        freq.set(num, (freq.get(num) || 0) + 1);
      }
    }
  }

  // Get all frequency values and find thresholds
  const freqValues = [...freq.values()].sort((a, b) => a - b);
  const total = freqValues.length;
  const third = Math.floor(total / 3);

  let coldThreshold = 0;
  let hotThreshold = 0;
  if (total >= 3) {
    coldThreshold = freqValues[third - 1] || 0;
    hotThreshold = freqValues[total - third] || 1;
  } else if (total > 0) {
    coldThreshold = freqValues[0];
    hotThreshold = freqValues[total - 1];
  }

  // Classify each drawn number
  const categories: Record<number, 'hot' | 'warm' | 'cold'> = {};
  for (const num of currentDraw) {
    const f = freq.get(num) || 0;
    if (f >= hotThreshold && total >= 3) {
      categories[num] = 'hot';
    } else if (f <= coldThreshold && total >= 3) {
      categories[num] = 'cold';
    } else {
      categories[num] = 'warm';
    }
  }

  return categories;
}

async function fetchTemp2D3DData(tempUrl: string): Promise<LottoResult[]> {
  try {
    console.log(`[Pulse] Fetching temp 2D/3D from: ${tempUrl}`);
    const response = await fetch(tempUrl, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'LottongPinoy-Cron/1.0', 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) { console.warn(`[Pulse] Temp file returned ${response.status}`); return []; }
    const raw = await response.json();
    let dataArray: unknown[] = Array.isArray(raw) ? raw : (raw.data || raw.results || []);
    console.log(`[Pulse] Temp file: ${dataArray.length} records`);
    return dataArray.map((entry: unknown) => {
      const e = entry as Record<string, string>;
      const game = e.game || '';
      let gameCode = game;
      if (game.includes('2D')) gameCode = '2D';
      else if (game.includes('3D')) gameCode = '3D';
      return { game: gameCode, combination: (e.combination || '').replace(/\s+/g, '-').trim(), date: normalizeDate(e.date || ''), prize: e.prize || '', winners: e.winners || '0', originalGame: game } as LottoResult;
    }).filter((d: LottoResult) => d.combination && d.date);
  } catch (err) {
    console.warn(`[Pulse] Failed to fetch temp 2D/3D:`, err);
    return [];
  }
}

/**
 * Fetch PULSE data with pattern analysis
 */
export async function fetchPulseData(
  historicalData: LottoResult[],
  timeSlot: '2PM' | '5PM' | '9PM'
): Promise<PulseData | null> {
  // Get historical 2D/3D
  const hist2d = historicalData.filter(d => d.game === '2D').slice(0, 90);
  const hist3d = historicalData.filter(d => d.game === '3D').slice(0, 90);

  // Get temp data
  const tempUrl = process.env.DATA_SOURCE_2D3D_URL;
  let tempDraws: LottoResult[] = [];
  if (tempUrl) {
    tempDraws = await fetchTemp2D3DData(tempUrl);
  }

  const temp2d = tempDraws.filter(d => d.game === '2D');
  const temp3d = tempDraws.filter(d => d.game === '3D');

  console.log(`[Pulse] Historical: ${hist2d.length} 2D, ${hist3d.length} 3D`);
  console.log(`[Pulse] Temp today: ${temp2d.length} 2D, ${temp3d.length} 3D`);

  // Merge for frequency analysis
  const all2d = [...temp2d, ...hist2d].slice(0, 90);
  const all3d = [...temp3d, ...hist3d].slice(0, 90);

  if (all2d.length < 3 && all3d.length < 3) {
    console.warn('[Pulse] Not enough data');
    return null;
  }

  // Get time-slot specific draws
  const slot2d = all2d.filter(d => {
    const og = (d as any).originalGame;
    if (og) return og === `2D Lotto ${timeSlot}`;
    return false; // Only use time-specific data from scraper
  });
  // If we have multiple draws without time slots, take unique dates
  const seen2dDates = new Set<string>();
  const unique2d = slot2d.filter(d => {
    if (seen2dDates.has(d.date)) return false;
    seen2dDates.add(d.date);
    return true;
  });

  const slot3d = all3d.filter(d => {
    const og = (d as any).originalGame;
    if (og) return og === `3D Lotto ${timeSlot}`;
    return false; // Only use time-specific data from scraper
  });
  const seen3dDates = new Set<string>();
  const unique3d = slot3d.filter(d => {
    if (seen3dDates.has(d.date)) return false;
    seen3dDates.add(d.date);
    return true;
  });

  // 2D Analysis
  const last2dDraw = unique2d.length > 0 ? parseCombination(unique2d[0].combination) : [];
  const prev2d = unique2d.length > 1 ? unique2d[1] : null;
  const patterns2d = last2dDraw.length === 2 ? generate2DPatterns(last2dDraw, all2d, prev2d) : [];
    const cat2d = last2dDraw.length > 0 ? classifyDrawNumbers(all2d, last2dDraw, 1, 31) : {};

  // 3D Analysis
  const last3dDraw = unique3d.length > 0 ? parseCombination(unique3d[0].combination) : [];
  const prev3d = unique3d.length > 1 ? unique3d[1] : null;
  const patterns3d = last3dDraw.length === 3 ? generate3DPatterns(last3dDraw, all3d, prev3d) : [];
    const cat3d = last3dDraw.length > 0 ? classifyDrawNumbers(all3d, last3dDraw, 0, 9) : {};

  return {
        '2d': { lastDraw: last2dDraw, patterns: patterns2d, numberCategories: cat2d },
        '3d': { lastDraw: last3dDraw, patterns: patterns3d, numberCategories: cat3d },
  };
}

export function getTimeSlotLabel(timeSlot: '2PM' | '5PM' | '9PM'): string {
  const labels: Record<string, string> = { '2PM': 'Alas-Dos (2PM)', '5PM': 'Alas-Singko (5PM)', '9PM': 'Alas-Nwebe (9PM)' };
  return labels[timeSlot] || timeSlot;
}