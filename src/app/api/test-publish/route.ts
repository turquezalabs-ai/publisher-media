/**
 * Test Publish Endpoint — One-click blueprint publish to Facebook
 *
 * GET /api/test-publish?game=6/45
 * Generates a blueprint banner for the specified game and publishes to Facebook.
 * Remove after testing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateBlueprintNumbers, calculateFrequency, classifyNumbers } from '@/lib/banner/analysis';
import { renderBlueprintToBuffer } from '@/lib/banner/server-render';
import { generateBlueprintCaptionV2 } from '@/lib/banner/captions';
import { publishToFacebookWithBuffer } from '@/lib/publish/meta';
import { fetchAndProcessData } from '@/lib/banner/data-preprocessor';
import { GAME_NAMES } from '@/lib/banner/config';

export async function GET(request: NextRequest) {
  const game = request.nextUrl.searchParams.get('game') || '6/45';
  const gameName = GAME_NAMES[game] || game;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.META_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return NextResponse.json(
      { error: 'FACEBOOK_PAGE_ID or META_ACCESS_TOKEN not configured' },
      { status: 500 }
    );
  }

  try {
    // 1. Fetch data
    const { all: data } = await fetchAndProcessData();
    if (data.length === 0) {
      return NextResponse.json({ error: 'No data available' }, { status: 500 });
    }

    // 2. Filter game data and generate blueprint
    const gameData = data.filter(d => d.game === game);
    if (gameData.length === 0) {
      return NextResponse.json({ error: `No data for ${gameName}` }, { status: 500 });
    }

    const numbers = generateBlueprintNumbers(gameData, game);

    // 3. Render banner to PNG buffer
    const imageBuffer = await renderBlueprintToBuffer(game, numbers);

    // 4. Generate caption
    const dayIndex = Math.floor(Math.random() * 30) + 1;
    const caption = generateBlueprintCaptionV2(dayIndex, game);

    // 5. Publish to Facebook
    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId,
      imageBuffer,
      fileName: `blueprint-${game}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `${gameName} Blueprint published!`,
        game,
        gameName,
        numbers: numbers.map(n => n.number),
        postId: result.postId,
        postUrl: result.postUrl,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        game,
        gameName,
      }, { status: 500 });
    }
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 });
  }
}
