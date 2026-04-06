import { NextResponse } from 'next/server';
import { renderDailyWinnersToBuffer } from '@/lib/banner/server-render';
import { fetchAndProcessData, getYesterdayPH, formatDisplayDate } from '@/lib/banner/data-preprocessor';
import { publishToFacebookWithBuffer } from '@/lib/publish/meta';
import { generateDailyWinnersCaption } from '@/lib/banner/captions';

export async function GET() {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  return NextResponse.json({
    hasToken: !!token,
    tokenLength: token?.length || 0,
    pageId,
    pageIdMatch: pageId === '1084782124707657',
  });
}