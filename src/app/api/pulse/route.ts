import { NextRequest, NextResponse } from 'next/server';
import { fetchAndProcessData } from '@/lib/banner/data-preprocessor';
import { fetchPulseData } from '@/lib/banner/pulse-engine';
import { renderPulseToBuffer } from '@/lib/banner/server-render';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timeSlot = (searchParams.get('slot') || '2PM') as '2PM' | '5PM' | '9PM';

  try {
    const { all: data } = await fetchAndProcessData();

    if (data.length === 0) {
      return NextResponse.json({ error: 'No lotto data available' }, { status: 503 });
    }

    const pulseData = await fetchPulseData(data, timeSlot);

    if (!pulseData) {
      return NextResponse.json({ error: 'Insufficient PULSE data for analysis' }, { status: 503 });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const pngBuffer = await renderPulseToBuffer(timeSlot, dateStr, pulseData);

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(pngBuffer.length),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('[PULSE API] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate PULSE banner' },
      { status: 500 }
    );
  }
}