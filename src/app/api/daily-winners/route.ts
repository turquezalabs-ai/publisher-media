/**
 * Daily Winners Banner API Route
 *
 * Renders a Daily Winners banner for a given date and returns it as PNG.
 * Used by the UI for manual preview/download and by the publish flow.
 *
 * GET /api/daily-winners?date=2026-04-04
 *   - Renders banner for the given date
 *   - Returns PNG image
 *   - Optional: ?download=true to set Content-Disposition header
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchAndProcessData, formatDisplayDate, normalizeDate } from '@/lib/banner/data-preprocessor';
import { renderDailyWinnersToBuffer } from '@/lib/banner/server-render';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    if (!dateParam) {
      return NextResponse.json(
        { error: 'Missing "date" parameter. Use format: YYYY-MM-DD' },
        { status: 400 },
      );
    }

    // Normalize the date
    const dateISO = normalizeDate(dateParam);
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) {
      return NextResponse.json(
        { error: `Invalid date format: "${dateParam}". Use YYYY-MM-DD.` },
        { status: 400 },
      );
    }

    // Fetch and preprocess data
    const { all: data } = await fetchAndProcessData();

    if (data.length === 0) {
      return NextResponse.json(
        { error: 'No lotto data available.' },
        { status: 500 },
      );
    }

    // Find draws for the given date
    const dayDraws = data.filter(d => d.date === dateISO);

    if (dayDraws.length === 0) {
      return NextResponse.json(
        { error: `No draws found for ${dateISO}. May be a holiday or no data available.` },
        { status: 404 },
      );
    }

    // Format the display date
    const displayDate = formatDisplayDate(dateISO);

    // Render the banner
    const imageBuffer = await renderDailyWinnersToBuffer(displayDate, dayDraws);

    // Check if this is a download request
    const isDownload = searchParams.get('download') === 'true';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(imageBuffer.length),
        'Cache-Control': 'public, max-age=3600',
        ...(isDownload ? {
          'Content-Disposition': `attachment; filename="DailyWinners_${dateISO}.png"`,
        } : {}),
      },
    });
  } catch (err) {
    console.error('[DailyWinners API] Error:', err);
    return NextResponse.json(
      { error: `Failed to render banner: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
