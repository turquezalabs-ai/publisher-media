import { NextResponse } from 'next/server';
import { fetchAndProcessData, getYesterdayPH } from '@/lib/banner/data-preprocessor';

export async function GET() {
  const { all } = await fetchAndProcessData();
  const yesterday = getYesterdayPH();
  
  const dates = all.map(d => d.date).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10);
  const yesterdayDraws = all.filter(d => d.date === yesterday);
  
  return NextResponse.json({
    yesterday,
    availableDates: dates,
    yesterdayDrawCount: yesterdayDraws.length,
    yesterdayGames: yesterdayDraws.map(d => d.game),
    totalRecords: all.length,
  });
}