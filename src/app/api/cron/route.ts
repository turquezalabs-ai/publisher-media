/**
 * Cron API Route — Auto-Publishing System
 *
 * Triggered by cron every 30 minutes.
 * Checks the current PH time and determines what to publish:
 *
 *  - Blueprint: 10:00 AM PH daily
 *  - Analysis:  7:30 AM PH with 30-min gaps per game
 *  - Daily Winners: 6:30 AM PH
 *  - PULSE: 3PM, 6PM, 10PM PH
 *
 * Security: Requires CRON_SECRET header or query param.
 * Force mode: ?force=blueprint|daily-winners|analysis|pulse
 */

import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { publishToFacebookWithBuffer, publishToInstagramWithBuffer } from '@/lib/publish/meta';
import {
  fetchAndProcessData,
  getDrawOnOrBeforeDate,
  drawExistsForDate,
  getYesterdayPH,
  getCurrentTimePH,
  formatDisplayDate,
  getDayOfWeek,
  getGameData,
  normalizeDate,
} from '@/lib/banner/data-preprocessor';
import {
  GAME_NAMES,
  BLUEPRINT_ROTATION,
  BLUEPRINT_CYCLE_DAYS,
  SCHEDULE_MAP,
  ANALYSIS_POST_START_TIME,
  ANALYSIS_POST_GAP_MINUTES,
} from '@/lib/banner/config';
import { generateBlueprintNumbers } from '@/lib/banner/analysis';
import { generateBlueprintCaptionV2, generateAnalysisCaption, generateDailyWinnersCaption } from '@/lib/banner/captions';
import { renderBlueprintToBuffer, renderAnalysisToBuffer, renderDailyWinnersToBuffer } from '@/lib/banner/server-render';
import { calculateFrequency, classifyNumbers, parseCombination } from '@/lib/banner/analysis';
import { fetchPulseData } from '@/lib/banner/pulse-engine';
import { renderPulseToBuffer } from '@/lib/banner/server-render';
import { generatePulseCaption } from '@/lib/banner/captions';
import { PULSE_POST_TIMES } from '@/lib/banner/config';
import type { PulseTimeSlot } from '@/lib/banner/config';
import type { LottoResult, NumberData } from '@/lib/banner/types';

const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '1498874648244130';
const BLUEPRINT_EPOCH = '2026-01-01';
const AUTO_ANALYSIS_GAMES = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'];

// ==========================================
// DEDUPE SYSTEM — prevents duplicate posts
// ==========================================

const PUBLISH_LOG_DIR = join(process.cwd(), '.publish-log');
const PUBLISH_LOG_FILE = join(PUBLISH_LOG_DIR, 'published.json');

interface PublishedRecord {
  date: string;       // YYYY-MM-DD PH date
  type: string;       // blueprint, analysis, daily-winners, pulse
  game: string;       // game key or slot identifier
  postId?: string;    // FB post ID for reference
  timestamp: string;  // ISO timestamp
}

function ensureLogDir(): void {
  if (!existsSync(PUBLISH_LOG_DIR)) {
    mkdirSync(PUBLISH_LOG_DIR, { recursive: true });
  }
}

function getTodayPH(): string {
  return new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');
  // Returns: 04-09-2026 → convert to 2026-04-09
}

function getTodayPHISO(): string {
  const parts = getTodayPH().split('-');
  return `${parts[2]}-${parts[0]}-${parts[1]}`;
}

function loadPublishedLog(): PublishedRecord[] {
  ensureLogDir();
  try {
    if (existsSync(PUBLISH_LOG_FILE)) {
      const raw = readFileSync(PUBLISH_LOG_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[CRON] Error reading publish log:', e);
  }
  return [];
}

function savePublishedLog(records: PublishedRecord[]): void {
  ensureLogDir();
  try {
    writeFileSync(PUBLISH_LOG_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (e) {
    console.error('[CRON] Error writing publish log:', e);
  }
}

function wasPublishedToday(type: string, game: string): boolean {
  const today = getTodayPHISO();
  const log = loadPublishedLog();
  return log.some(r => r.date === today && r.type === type && r.game === game);
}

function markPublished(type: string, game: string, postId?: string): void {
  const today = getTodayPHISO();
  const log = loadPublishedLog();
  // Remove any existing record for same type+game+date (overwrite)
  const filtered = log.filter(r => !(r.date === today && r.type === type && r.game === game));
  filtered.push({
    date: today,
    type,
    game,
    postId,
    timestamp: new Date().toISOString(),
  });
  savePublishedLog(filtered);
  console.log(`[CRON] Marked as published: ${type}/${game} on ${today}`);
}

// ==========================================
// BLUEPRINT HELPERS
// ==========================================

function getBlueprintDayIndex(): number {
  const todayPH = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const today = new Date(todayPH.split(',')[0]);
  const epoch = new Date(BLUEPRINT_EPOCH);
  const diffDays = Math.floor((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const dayIndex = ((diffDays % BLUEPRINT_CYCLE_DAYS) + BLUEPRINT_CYCLE_DAYS) % BLUEPRINT_CYCLE_DAYS;
  return dayIndex + 1;
}

function getTodayBlueprintGame(): string {
  const day = getBlueprintDayIndex();
  return BLUEPRINT_ROTATION[(day - 1) % BLUEPRINT_ROTATION.length];
}

// ==========================================
// TIME CHECKS — narrowed windows (±4 min)
// ==========================================

function getAnalysisSlot(): number {
  const { hour, minute } = getCurrentTimePH();
  const slots = [
    { targetHour: 7, targetMinute: 30, index: 0 },
    { targetHour: 8, targetMinute: 0, index: 1 },
    { targetHour: 8, targetMinute: 30, index: 2 },
    { targetHour: 9, targetMinute: 0, index: 3 },
    { targetHour: 9, targetMinute: 30, index: 4 },
  ];
  for (const slot of slots) {
    const targetTotalMin = slot.targetHour * 60 + slot.targetMinute;
    const currentTotalMin = hour * 60 + minute;
    if (Math.abs(currentTotalMin - targetTotalMin) <= 4) {
      return slot.index;
    }
  }
  return -1;
}

function isBlueprintTime(): boolean {
  const { hour, minute } = getCurrentTimePH();
  return hour === 10 && minute >= 0 && minute <= 4;
}

function isDailyWinnersTime(): boolean {
  const { hour, minute } = getCurrentTimePH();
  return hour === 6 && minute >= 30 && minute <= 34;
}

function getPulseTimeSlot(): PulseTimeSlot | null {
  const { hour, minute } = getCurrentTimePH();
  for (const pt of PULSE_POST_TIMES) {
    if (hour === pt.postHour && minute >= pt.postMinute && minute <= pt.postMinute + 4) {
      return pt.draw as PulseTimeSlot;
    }
  }
  return null;
}

// ==========================================
// LOGGING
// ==========================================

interface CronLogEntry {
  timestamp: string;
  type: 'blueprint' | 'analysis' | 'daily-winners' | 'pulse';
  game: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  postId?: string;
}

function log(entry: CronLogEntry): void {
  console.log(`[CRON] ${entry.timestamp} | ${entry.type} | ${entry.game} | ${entry.status} | ${entry.message}`);
}

// ==========================================
// INSTAGRAM CROSS-POSTING
// ==========================================

async function crossPostToInstagram(
  imageBuffer: Buffer,
  caption: string,
  type: string,
  game: string
): Promise<void> {
  const token = process.env.META_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const igId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  if (!token || !pageId || !igId) {
    log({ timestamp: new Date().toISOString(), type: type as any, game, status: 'skipped', message: 'Instagram credentials missing — skipping cross-post.' });
    return;
  }

  try {
    const result = await publishToInstagramWithBuffer({
      pageAccessToken: token,
      pageId,
      instagramBusinessAccountId: igId,
      imageBuffer,
      fileName: `ig-${type}-${game}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({ timestamp: new Date().toISOString(), type: type as any, game, status: 'success', message: `Instagram published! Media ID: ${result.mediaId}` });
    } else {
      log({ timestamp: new Date().toISOString(), type: type as any, game, status: 'error', message: `Instagram publish failed: ${result.error}` });
    }
  } catch (err) {
    log({ timestamp: new Date().toISOString(), type: type as any, game, status: 'error', message: `Instagram exception: ${err instanceof Error ? err.message : String(err)}` });
  }
}

// ==========================================
// PUBLISH FUNCTIONS — with dedupe checks
// ==========================================

async function publishBlueprint(data: LottoResult[]): Promise<void> {
  const game = getTodayBlueprintGame();
  const dayIndex = getBlueprintDayIndex();
  const gameName = GAME_NAMES[game] || game;

  // DEDUPE CHECK: Already published today?
  if (wasPublishedToday('blueprint', game)) {
    log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'skipped', message: `Already published ${gameName} today. Skipping.` });
    return;
  }

  log({
    timestamp: new Date().toISOString(),
    type: 'blueprint',
    game,
    status: 'success',
    message: `Starting blueprint publish: ${gameName} (Day ${dayIndex})`,
  });

  try {
    const gameData = getGameData(game, data);
    if (gameData.length === 0) {
      log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'skipped', message: `No draw data for ${gameName}. Skipping.` });
      return;
    }

    const numbers = generateBlueprintNumbers(gameData, game);
    const imageBuffer = await renderBlueprintToBuffer(game, numbers);
    const caption = generateBlueprintCaptionV2(dayIndex, game);

    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'error', message: 'META_ACCESS_TOKEN not configured' });
      return;
    }

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId: FACEBOOK_PAGE_ID,
      imageBuffer,
      fileName: `blueprint-${game}-day${dayIndex}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'success', message: `Facebook published! Post ID: ${result.postId}`, postId: result.postId });
      markPublished('blueprint', game, result.postId);
      await crossPostToInstagram(imageBuffer, caption, 'blueprint', game);
    } else {
      log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'error', message: `Facebook publish failed: ${result.error}` });
    }
  } catch (err) {
    log({ timestamp: new Date().toISOString(), type: 'blueprint', game, status: 'error', message: `Exception: ${err instanceof Error ? err.message : String(err)}` });
  }
}

async function publishDailyWinners(data: LottoResult[]): Promise<void> {
  // DEDUPE CHECK
  if (wasPublishedToday('daily-winners', 'all')) {
    log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'skipped', message: 'Already published daily winners today. Skipping.' });
    return;
  }

  const availableDates = [...new Set(data.map(d => d.date))].sort((a, b) => b.localeCompare(a));
  const latestDate = availableDates[0];

  if (!latestDate) {
    log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'skipped', message: 'No data available at all.' });
    return;
  }

  const displayDate = formatDisplayDate(latestDate);

  log({
    timestamp: new Date().toISOString(),
    type: 'daily-winners',
    game: 'all',
    status: 'success',
    message: `Starting daily winners publish for ${latestDate} (latest available)`,
  });

  try {
    const latestDraws = data.filter(d => d.date === latestDate);

    if (latestDraws.length === 0) {
      log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'skipped', message: `No draws found for ${latestDate}. Skipping.` });
      return;
    }

    const imageBuffer = await renderDailyWinnersToBuffer(displayDate, latestDraws);
    const majorGames = latestDraws.map(d => d.game).filter(g => ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'].includes(g));
    const caption = generateDailyWinnersCaption(latestDate, [...new Set(majorGames)]);

    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'error', message: 'META_ACCESS_TOKEN not configured' });
      return;
    }

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId: FACEBOOK_PAGE_ID,
      imageBuffer,
      fileName: `daily-winners-${latestDate}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'success', message: `Facebook published! Post ID: ${result.postId}`, postId: result.postId });
      markPublished('daily-winners', 'all', result.postId);
      await crossPostToInstagram(imageBuffer, caption, 'daily-winners', 'all');
    } else {
      log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'error', message: `Facebook publish failed: ${result.error}` });
    }
  } catch (err) {
    log({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'error', message: `Exception: ${err instanceof Error ? err.message : String(err)}` });
  }
}

async function publishAnalysis(data: LottoResult[], slot: number): Promise<void> {
  // DEDUPE CHECK
  if (wasPublishedToday('analysis', `slot-${slot}`)) {
    log({ timestamp: new Date().toISOString(), type: 'analysis', game: `slot-${slot}`, status: 'skipped', message: `Already published analysis slot ${slot} today. Skipping.` });
    return;
  }

  const yesterdayISO = getYesterdayPH();
  const drawnGames = data
    .filter(d => d.date === yesterdayISO && AUTO_ANALYSIS_GAMES.includes(d.game))
    .map(d => d.game);
  const analysisGames = [...new Set(drawnGames)];

  if (slot >= analysisGames.length) {
    log({ timestamp: new Date().toISOString(), type: 'analysis', game: `slot-${slot}`, status: 'skipped', message: `Slot ${slot} has no game (only ${analysisGames.length} games drawn yesterday).` });
    return;
  }

  const game = analysisGames[slot];
  const gameName = GAME_NAMES[game] || game;

  log({
    timestamp: new Date().toISOString(),
    type: 'analysis',
    game,
    status: 'success',
    message: `Starting analysis publish: ${gameName} (slot ${slot})`,
  });

  try {
    if (!drawExistsForDate(game, yesterdayISO, data)) {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'skipped', message: `No draw found for ${gameName} on ${yesterdayISO}. Holiday or cancelled — skipping.` });
      return;
    }

    const draw = getDrawOnOrBeforeDate(game, yesterdayISO, data);
    if (!draw) {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'skipped', message: `Could not find draw data for ${gameName} on ${yesterdayISO}.` });
      return;
    }

    const gameData = getGameData(game, data);
    if (gameData.length < 5) {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'skipped', message: `Not enough historical data for ${gameName} (${gameData.length} draws). Need at least 5.` });
      return;
    }

    const freqMap = calculateFrequency(gameData, game);
    const classifiedNumbers: NumberData[] = classifyNumbers(freqMap);
    const displayDate = formatDisplayDate(draw.date);
    const winningNumbers = parseCombination(draw.combination);

    const imageBuffer = await renderAnalysisToBuffer(game, gameName, displayDate, draw, classifiedNumbers, gameData);
    const caption = generateAnalysisCaption(game, gameName, draw.date, winningNumbers, gameData);

    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'error', message: 'META_ACCESS_TOKEN not configured' });
      return;
    }

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId: FACEBOOK_PAGE_ID,
      imageBuffer,
      fileName: `analysis-${game}-${yesterdayISO}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'success', message: `Facebook published! Post ID: ${result.postId}`, postId: result.postId });
      markPublished('analysis', `slot-${slot}`, result.postId);
      await crossPostToInstagram(imageBuffer, caption, 'analysis', game);
    } else {
      log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'error', message: `Facebook publish failed: ${result.error}` });
    }
  } catch (err) {
    log({ timestamp: new Date().toISOString(), type: 'analysis', game, status: 'error', message: `Exception: ${err instanceof Error ? err.message : String(err)}` });
  }
}

async function publishPulse(data: LottoResult[], timeSlot: PulseTimeSlot): Promise<void> {
  // DEDUPE CHECK
  if (wasPublishedToday('pulse', timeSlot)) {
    log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'skipped', message: `Already published PULSE ${timeSlot} today. Skipping.` });
    return;
  }

  log({
    timestamp: new Date().toISOString(),
    type: 'pulse',
    game: `pulse-${timeSlot}`,
    status: 'success',
    message: `Starting PULSE publish for ${timeSlot}`,
  });

  try {
    const pulseData = await fetchPulseData(data, timeSlot);
    if (!pulseData) {
      log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'skipped', message: 'No PULSE data available.' });
      return;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const imageBuffer = await renderPulseToBuffer(timeSlot, dateStr, pulseData);
    const caption = generatePulseCaption(timeSlot);

    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'error', message: 'META_ACCESS_TOKEN not configured' });
      return;
    }

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId: FACEBOOK_PAGE_ID,
      imageBuffer,
      fileName: `pulse-${timeSlot}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'success', message: `Facebook PULSE published! Post ID: ${result.postId}`, postId: result.postId });
      markPublished('pulse', timeSlot, result.postId);
    } else {
      log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'error', message: `Facebook publish failed: ${result.error}` });
    }
  } catch (err) {
    log({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${timeSlot}`, status: 'error', message: `Exception: ${err instanceof Error ? err.message : String(err)}` });
  }
}

// ==========================================
// MAIN CRON HANDLER
// ==========================================

export async function GET(request: NextRequest) {
  // ---- 1. Verify cron secret ----
  const authHeader = request.headers.get('authorization');
  const querySecret = new URL(request.url).searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured.' }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized. Invalid or missing cron secret.' }, { status: 401 });
  }

  const { hour, minute } = getCurrentTimePH();

  // ---- 1b. Force mode (bypass time checks + dedupe) ----
  const forceType = new URL(request.url).searchParams.get('force');
  if (forceType === 'blueprint' || forceType === 'daily-winners' || forceType === 'analysis' || forceType === 'pulse') {
    const { all: data } = await fetchAndProcessData();
    if (data.length === 0) {
      return NextResponse.json({ status: 'error', message: 'No lotto data available.' });
    }
    if (forceType === 'blueprint') await publishBlueprint(data);
    else if (forceType === 'daily-winners') await publishDailyWinners(data);
    else if (forceType === 'analysis') {
      const slot = parseInt(new URL(request.url).searchParams.get('slot') || '0', 10);
      await publishAnalysis(data, slot);
    } else if (forceType === 'pulse') {
      const slot = (new URL(request.url).searchParams.get('slot') || '2PM') as PulseTimeSlot;
      await publishPulse(data, slot);
    }
    return NextResponse.json({ status: 'forced', type: forceType, phTime: `${hour}:${String(minute).padStart(2, '0')}` });
  }

  // ---- 2. Determine what to run ----
  const tasks: { type: string; slot?: number; pulseSlot?: PulseTimeSlot | null }[] = [];

  if (isDailyWinnersTime()) tasks.push({ type: 'daily-winners' });
  if (isBlueprintTime()) tasks.push({ type: 'blueprint' });

  const analysisSlot = getAnalysisSlot();
  if (analysisSlot >= 0) tasks.push({ type: 'analysis', slot: analysisSlot });

  // PULSE — check once, add to tasks
  const pulseSlot = getPulseTimeSlot();
  if (pulseSlot) tasks.push({ type: 'pulse', pulseSlot });

  if (tasks.length === 0) {
    return NextResponse.json({
      status: 'idle',
      message: `Nothing to run at ${hour}:${String(minute).padStart(2, '0')} PH time.`,
      phTime: `${hour}:${String(minute).padStart(2, '0')}`,
    });
  }

  // ---- 3. Fetch and preprocess data ----
  const { all: data } = await fetchAndProcessData();

  if (data.length === 0) {
    return NextResponse.json({ status: 'error', message: 'No lotto data available. Check DATA_SOURCE_URL or public/results.json.' });
  }

  // ---- 4. Execute tasks (each has dedupe built in) ----
  const results: CronLogEntry[] = [];

  for (const task of tasks) {
    if (task.type === 'blueprint') {
      await publishBlueprint(data);
      results.push({ timestamp: new Date().toISOString(), type: 'blueprint', game: getTodayBlueprintGame(), status: 'success', message: 'Blueprint job executed' });
    } else if (task.type === 'daily-winners') {
      await publishDailyWinners(data);
      results.push({ timestamp: new Date().toISOString(), type: 'daily-winners', game: 'all', status: 'success', message: 'Daily winners job executed' });
    } else if (task.type === 'analysis' && task.slot !== undefined) {
      await publishAnalysis(data, task.slot);
      results.push({ timestamp: new Date().toISOString(), type: 'analysis', game: `slot-${task.slot}`, status: 'success', message: `Analysis slot ${task.slot} executed` });
    } else if (task.type === 'pulse' && task.pulseSlot) {
      await publishPulse(data, task.pulseSlot);
      results.push({ timestamp: new Date().toISOString(), type: 'pulse', game: `pulse-${task.pulseSlot}`, status: 'success', message: `PULSE ${task.pulseSlot} job executed` });
    }
  }

  return NextResponse.json({ status: 'completed', phTime: `${hour}:${String(minute).padStart(2, '0')}`, tasks: results });
}

export async function POST(request: NextRequest) {
  return GET(request);
}