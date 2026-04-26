import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/publish/queue
 *
 * Returns pending publish queue items formatted for Playwright/Puppeteer consumption.
 * This endpoint provides real-time queue data for browser automation scripts.
 *
 * Query params:
 *   type: 'playwright' | 'json' (default: 'playwright')
 */
export async function GET(request: NextRequest) {
  const queueFormat = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    format: 'playwright-puppeteer',
    instructions: {
      usage: 'node playwright-publisher.js queue-export.json',
      requirements: ['Node.js 18+', 'playwright (npm install playwright)'],
      behavior: {
        typingDelay: { min: 30, max: 120, description: 'Random delay between keystrokes (ms)' },
        mouseDelay: { min: 100, max: 300, description: 'Random delay for mouse movements (ms)' },
        actionDelay: { min: 500, max: 2000, description: 'Random pause between actions (ms)' },
        postDelay: { min: 10000, max: 30000, description: 'Delay between posts (ms)' },
        scrollDelay: { min: 300, max: 800, description: 'Natural scroll speed (ms)' },
      },
    },
    items: [] as Array<Record<string, unknown>>,
    meta: {
      totalItems: 0,
      source: 'lottong-pinoy-banner-studio',
    },
  };

  return NextResponse.json(queueFormat);
}

/**
 * POST /api/publish/queue
 *
 * Accepts a batch of items to add to the publish queue.
 * The client-side Export Queue button sends items here for persistence.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      items?: Array<Record<string, unknown>>;
    };

    const items = body.items || [];

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No items provided' },
        { status: 400 },
      );
    }

    const processedItems = items.map((item, index) => ({
      id: `queue-${Date.now()}-${index}`,
      ...item,
      status: 'pending',
      queuedAt: new Date().toISOString(),
      action: {
        type: 'post',
        platform: item.platform || 'facebook',
        text: `${item.caption || ''}${item.hashtags ? '\n\n' + item.hashtags : ''}`.trim(),
        imagePath: item.imageData || null,
      },
    }));

    return NextResponse.json({
      success: true,
      message: `${processedItems.length} item(s) added to publish queue`,
      queuedAt: new Date().toISOString(),
      items: processedItems,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
