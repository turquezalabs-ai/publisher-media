import { NextRequest, NextResponse } from 'next/server';
import { renderBlueprintToBuffer, renderDailyWinnersToBuffer, renderAnalysisToBuffer } from '@/lib/banner/server-render';
import { fetchAndProcessData, getYesterdayPH, formatDisplayDate, getGameData } from '@/lib/banner/data-preprocessor';
import { generateBlueprintNumbers } from '@/lib/banner/analysis';
import { parseCombination } from '@/lib/banner/analysis';
import { getDrawOnOrBeforeDate, getDayOfWeek } from '@/lib/banner/data-preprocessor';
import { SCHEDULE_MAP, GAME_NAMES } from '@/lib/banner/config';

export async function GET(request: NextRequest) {
  const searchParams = new URL(request.url).searchParams;
  const type = searchParams.get('type') || 'blueprint';
  const customDate = searchParams.get('date');
  const { all: data } = await fetchAndProcessData();

  if (data.length === 0) {
    return NextResponse.json({ error: 'No data' });
  }

  let buffer: Buffer;

  if (type === 'blueprint') {
    const game = '6/58';
    const gameData = getGameData(game, data);
    const numbers = generateBlueprintNumbers(gameData, game);
    buffer = await renderBlueprintToBuffer(game, numbers);

  } else if (type === 'daily-winners') {
    const dateISO = customDate || getYesterdayPH();
    const displayDate = formatDisplayDate(dateISO);
    const dateDraws = data.filter(d => d.date === dateISO);
    if (dateDraws.length === 0) return NextResponse.json({ error: `No draws found for ${dateISO}` });
    buffer = await renderDailyWinnersToBuffer(displayDate, dateDraws);

  } else if (type === 'analysis') {
    const dateISO = customDate || getYesterdayPH();
    const dateDow = getDayOfWeek(dateISO);
    const drawnGames = SCHEDULE_MAP[dateDow] || [];
    const game = drawnGames[0] || '6/58';
    const draw = getDrawOnOrBeforeDate(game, dateISO, data);
    if (!draw) return NextResponse.json({ error: 'No draw found' });
    const gameName = GAME_NAMES[game] || game;
    const gameData = getGameData(game, data);
    const { calculateFrequency, classifyNumbers } = await import('@/lib/banner/analysis');
    const freqMap = calculateFrequency(gameData, game);
    const classified = classifyNumbers(freqMap);
    const displayDate = formatDisplayDate(draw.date);
    buffer = await renderAnalysisToBuffer(game, gameName, displayDate, draw, classified, gameData);

  } else {
    return NextResponse.json({ error: 'Invalid type. Use blueprint, daily-winners, or analysis' });
  }

  return new NextResponse(buffer, {
    headers: { 'Content-Type': 'image/png' },
  });
}