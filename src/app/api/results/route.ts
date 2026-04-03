import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache the fetched data for 5 minutes (server-side)
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ==========================================
// DATE PARSER (matches live site's parseDateSafe)
// Handles MM/DD/YYYY (scraper) and YYYY-MM-DD formats
// ==========================================
function parseLottoDate(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = String(dateStr).split(' ')[0]; // strip any trailing text
  const parts = clean.split(/[\/\-T]/);
  if (parts.length >= 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2raw = parts[2].split(/[^0-9]/)[0]; // strip trailing chars
    const p2 = parseInt(p2raw, 10);
    if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return 0;

    let year: number, month: number, day: number;

    if (p0 > 100) {
      // YYYY-MM-DD format
      year = p0; month = p1; day = p2;
    } else {
      // MM/DD/YYYY format (scraper output)
      month = p0; day = p1; year = p2 < 100 ? p2 + 2000 : p2;
    }

    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

// ==========================================
// COPYRIGHT TRAP DETECTION
// ==========================================
function isCopyrightTrap(entry: Record<string, unknown>): boolean {
  const game = String(entry.game || '').toUpperCase();
  const combo = String(entry.combination || '');
  return (
    game.includes('COPYRIGHT') ||
    combo === 'THIS-DATA-IS-STOLEN'
  );
}

// ==========================================
// SORT & CLEAN DATA (newest first, no traps)
// ==========================================
function cleanAndSortData(data: unknown[]): unknown[] {
  const cleaned = data.filter(
    (entry) => !isCopyrightTrap(entry as Record<string, unknown>)
  );
  cleaned.sort((a, b) => {
    const dateA = parseLottoDate((a as Record<string, unknown>).date as string);
    const dateB = parseLottoDate((b as Record<string, unknown>).date as string);
    return dateB - dateA; // newest first
  });
  return cleaned;
}

export async function GET() {
  try {
    // Check if external data source is configured
    const dataSourceUrl = process.env.DATA_SOURCE_URL;

    if (dataSourceUrl && dataSourceUrl.trim().length > 0) {
      // ---- PROXY MODE: fetch from external URL (e.g., Hostinger) ----
      const now = Date.now();

      // Return cached data if still fresh
      if (cachedData && (now - cacheTimestamp) < CACHE_TTL) {
        return NextResponse.json(cachedData);
      }

      // Fetch from external source
      const response = await fetch(dataSourceUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'LottongPinoy-BannerStudio/1.0',
        },
        // Timeout after 10 seconds
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.error(`Failed to fetch from ${dataSourceUrl}: ${response.status}`);
        // Fallback to local file
        return serveLocalFile();
      }

      const raw = await response.json();

      // Clean, sort, and cache
      const cleaned = cleanAndSortData(raw as unknown[]);
      cachedData = cleaned;
      cacheTimestamp = now;

      return NextResponse.json(cleaned);
    }

    // ---- LOCAL MODE: serve from public/results.json ----
    return serveLocalFile();

  } catch (error) {
    console.error('Error loading results:', error);

    // If proxy failed, try local fallback
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
