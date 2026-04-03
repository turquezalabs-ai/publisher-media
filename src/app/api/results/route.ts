import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache the fetched data for 5 minutes (server-side)
let cachedData: unknown = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

      const data = await response.json();

      // Cache the result
      cachedData = data;
      cacheTimestamp = now;

      return NextResponse.json(data);
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
  const data = JSON.parse(fileContents);
  return NextResponse.json(data);
}
