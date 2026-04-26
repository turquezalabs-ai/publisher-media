import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache the fetched data for 5 minutes (server-side)
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ==========================================
// GAME NAME → GAME CODE MAPPING
// ==========================================
const GAME_NAME_MAP: Record<string, string> = {
  'Ultra Lotto 6/58': '6/58',
  'Grand Lotto 6/55': '6/55',
  'Superlotto 6/49': '6/49',
  'Super Lotto 6/49': '6/49',
  'Megalotto 6/45': '6/45',
  'Mega Lotto 6/45': '6/45',
  'Lotto 6/42': '6/42',
  '6D Lotto': '6D',
  '4D Lotto': '4D',
  '3D Lotto 2PM': '3D',
  '3D Lotto 5PM': '3D',
  '3D Lotto 9PM': '3D',
  'Suertres Lotto 11:30AM': '3D',
  'Suertres Lotto 12:30PM': '3D',
  'Suertres Lotto 2PM': '3D',
  '2D Lotto 2PM': '2D',
  '2D Lotto 5PM': '2D',
  '2D Lotto 9PM': '2D',
  'EZ2 Lotto 11:30AM': '2D',
  'EZ2 Lotto 12:30PM': '2D',
  'EZ2 Lotto 2PM': '2D',
};

// ==========================================
// DATE NORMALIZATION → YYYY-MM-DD
// ==========================================
function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim().split(' ')[0]; // strip trailing text
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // MM/DD/YYYY (scraper format)
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  return trimmed; // fallback
}

// ==========================================
// COPYRIGHT TRAP & POISON DATA DETECTION
// ==========================================
function isTrapOrPoison(entry: Record<string, unknown>): boolean {
  const game = String(entry.game || '').toUpperCase();
  const combo = String(entry.combination || '');
  if (game.includes('COPYRIGHT')) return true;
  if (combo === 'THIS-DATA-IS-STOLEN') return true;
  // Filter out poison dates (2099, 2098, etc.)
  const date = normalizeDate(String(entry.date || ''));
  const year = parseInt(date.split('-')[0], 10);
  if (year > new Date().getFullYear() + 1) return true;
  return false;
}

// ==========================================
// SORT, CLEAN & NORMALIZE DATA
// ==========================================
function cleanAndSortData(data: unknown[]): unknown[] {
  // 1. Filter traps, poison, and invalid entries
  const cleaned = data.filter((entry) => {
    if (isTrapOrPoison(entry as Record<string, unknown>)) return false;
    const combo = String((entry as Record<string, unknown>).combination || '');
    return /\d/.test(combo);
  });

  // 2. Normalize dates to YYYY-MM-DD and game names
  const normalized = cleaned.map((entry) => {
    const e = entry as Record<string, string>;
    const originalGame = e.game || '';
    const gameCode = GAME_NAME_MAP[originalGame] || originalGame;
    const normalizedDate = normalizeDate(e.date || '');
    return {
      ...e,
      game: gameCode,
      date: normalizedDate,
      originalGame: originalGame !== gameCode ? originalGame : undefined,
    };
  });

  // 3. Sort newest first by normalized date
  normalized.sort((a, b) => {
    const dateA = (a as Record<string, unknown>).date as string;
    const dateB = (b as Record<string, unknown>).date as string;
    return dateB.localeCompare(dateA);
  });

  return normalized;
}

export async function GET() {
  try {
    const dataSourceUrl = process.env.DATA_SOURCE_URL;

    if (dataSourceUrl && dataSourceUrl.trim().length > 0) {
      const now = Date.now();

      if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
        return NextResponse.json(cachedData);
      }

      const response = await fetch(dataSourceUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LottongPinoy-BannerStudio/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(`Failed to fetch from ${dataSourceUrl}: ${response.status}`);
        return serveLocalFile();
      }

      const raw = await response.json();
      const cleaned = cleanAndSortData(raw as unknown[]);
      cachedData = cleaned;
      cacheTimestamp = now;

      return NextResponse.json(cleaned);
    }

    return serveLocalFile();

  } catch (error) {
    console.error('Error loading results:', error);
    try {
      return serveLocalFile();
    } catch {
      return NextResponse.json(
        { error: 'Failed to load lotto data' },
        { status: 500 }
      );
    }
  }
}

function serveLocalFile() {
  const filePath = path.join(process.cwd(), 'public', 'results.json');
  const fileContents = fs.readFileSync(filePath, 'utf-8');
  const raw = JSON.parse(fileContents);
  const cleaned = cleanAndSortData(raw as unknown[]);
  return NextResponse.json(cleaned);
}
