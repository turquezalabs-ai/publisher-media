import { NextResponse } from 'next/server';
import { renderBlueprintToBuffer } from '@/lib/banner/server-render';
import { publishToFacebookWithBuffer } from '@/lib/publish/meta';
import { generateBlueprintNumbers } from '@/lib/banner/analysis';
import { generateBlueprintCaptionV2 } from '@/lib/banner/captions';
import { fetchAndProcessData, getGameData } from '@/lib/banner/data-preprocessor';

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const cronSecret = process.env.CRON_SECRET;

  return NextResponse.json({
    env: {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenFirst10: token?.substring(0, 10) + '...',
      pageId,
      pageIdExpected: '1084782124707657',
      pageIdMatch: pageId === '1084782124707657',
      hasCronSecret: !!cronSecret,
    }
  });
}

export async function POST() {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!token || !pageId) {
      return NextResponse.json({ error: 'Missing token or pageId', token: !!token, pageId });
    }

    const { all: data } = await fetchAndProcessData();
    const gameData = getGameData('6/45', data);
    const numbers = generateBlueprintNumbers(gameData, '6/45');
    const imageBuffer = await renderBlueprintToBuffer('6/45', numbers);
    const caption = 'Test post — debug mode';

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: token,
      pageId,
      imageBuffer,
      fileName: 'debug-test.png',
      mimeType: 'image/png',
      caption,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
}