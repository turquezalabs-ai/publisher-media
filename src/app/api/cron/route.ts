/**
 * Cron API Route — Auto-Publishing System
 *
 * Triggered by Vercel Cron every 30 minutes.
 * Checks the current PH time and determines what to publish:
 *
 *  - Blueprint: 10:00 AM PH daily (UTC 02:00)
 *  - Analysis:  7:30 AM PH (UTC 23:30 previous day) with 30-min gaps per game
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access.
 * Holiday rule: If no draw exists for a scheduled game, the post is skipped.
 */

import { NextRequest, NextResponse } from 'next/server';
import { publishToFacebookWithBuffer } from '@/lib/publish/meta';
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
import type { LottoResult, NumberData } from '@/lib/banner/types';

// ==========================================
// CONSTANTS
// ==========================================

// Facebook Page ID (your Lottong Pinoy page)
const FACEBOOK_PAGE_ID = process.env.FACEBOOK_PAGE_ID || '1498874648244130';

// Blueprint epoch: the date when the 30-day cycle started
// January 1, 2026 was a Wednesday → Day 1 = Mega (6/45) which matches BLUEPRINT_ROTATION[0]
const BLUEPRINT_EPOCH = '2026-01-01'; // Wednesday

// Games included in auto-analysis (2D/3D excluded)
const AUTO_ANALYSIS_GAMES = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'];

// ==========================================
// HELPERS
// ==========================================

/**
 * Calculate which day in the 30-day blueprint cycle we're on (1-based).
 */
function getBlueprintDayIndex(): number {
  const todayPH = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
  const today = new Date(todayPH.split(',')[0]);
  const epoch = new Date(BLUEPRINT_EPOCH);
  const diffDays = Math.floor((today.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24));
  const dayIndex = ((diffDays % BLUEPRINT_CYCLE_DAYS) + BLUEPRINT_CYCLE_DAYS) % BLUEPRINT_CYCLE_DAYS;
  return dayIndex + 1; // 1-based
}

/**
 * Get the game code for today's blueprint based on the rotation.
 */
function getTodayBlueprintGame(): string {
  const day = getBlueprintDayIndex();
  return BLUEPRINT_ROTATION[(day - 1) % BLUEPRINT_ROTATION.length];
}

/**
 * Check if a blueprint has already been posted today by checking
 * if the latest draw date for the blueprint game matches today.
 * (Simple heuristic — if today's draw exists, blueprint was likely posted.)
 *
 * For a more robust approach, we could use a database, but this is sufficient.
 */
function shouldRunBlueprint(): boolean {
  return true; // Always run — Facebook will show error if duplicate
}

/**
 * Get the analysis slot (0, 1, 2, 3) based on current PH time.
 * Returns -1 if not within any analysis slot window.
 */
function getAnalysisSlot(): number {
  const { hour, minute } = getCurrentTimePH();

  // Analysis windows (15-min tolerance each side of the target)
  const slots = [
    { targetHour: 7, targetMinute: 30, index: 0 },
    { targetHour: 8, targetMinute: 0, index: 1 },
    { targetHour: 8, targetMinute: 30, index: 2 },
    { targetHour: 9, targetMinute: 0, index: 3 },
  ];

  for (const slot of slots) {
    const targetTotalMin = slot.targetHour * 60 + slot.targetMinute;
    const currentTotalMin = hour * 60 + minute;

    // Within ±7 minutes of target time
    if (Math.abs(currentTotalMin - targetTotalMin) <= 7) {
      return slot.index;
    }
  }

  return -1;
}

/**
 * Check if it's time for the blueprint post.
 */
function isBlueprintTime(): boolean {
  const { hour, minute } = getCurrentTimePH();
  // 10:00 AM ± 7 minutes
  return hour === 10 && Math.abs(minute - 0) <= 7;
}

/**
 * Check if it's time for the daily winners post (6:30 AM PH ± 7 min).
 */
function isDailyWinnersTime(): boolean {
  const { hour, minute } = getCurrentTimePH();
  return hour === 6 && Math.abs(minute - 30) <= 7;
}

// ==========================================
// PUBLISH LOGGING
// ==========================================

interface CronLogEntry {
  timestamp: string;
  type: 'blueprint' | 'analysis' | 'daily-winners';
  game: string;
  status: 'success' | 'skipped' | 'error';
  message: string;
  postId?: string;
}

function log(entry: CronLogEntry): void {
  console.log(`[CRON] ${entry.timestamp} | ${entry.type} | ${entry.game} | ${entry.status} | ${entry.message}`);
}

// ==========================================
// BLUEPRINT PUBLISH
// ==========================================

async function publishBlueprint(data: LottoResult[]): Promise<void> {
  const game = getTodayBlueprintGame();
  const dayIndex = getBlueprintDayIndex();
  const gameName = GAME_NAMES[game] || game;

  log({
    timestamp: new Date().toISOString(),
    type: 'blueprint',
    game,
    status: 'success',
    message: `Starting blueprint publish: ${gameName} (Day ${dayIndex})`,
  });

  try {
    // Get game data for number generation
    const gameData = getGameData(game, data);
    if (gameData.length === 0) {
      log({
        timestamp: new Date().toISOString(),
        type: 'blueprint',
        game,
        status: 'skipped',
        message: `No draw data for ${gameName}. Skipping.`,
      });
      return;
    }

    // Generate blueprint numbers
    const numbers = generateBlueprintNumbers(gameData, game);

    // Render banner
    const imageBuffer = await renderBlueprintToBuffer(game, numbers);

    // Generate caption
    const caption = generateBlueprintCaptionV2(dayIndex, game);

    // Publish to Facebook
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({
        timestamp: new Date().toISOString(),
        type: 'blueprint',
        game,
        status: 'error',
        message: 'META_ACCESS_TOKEN not configured',
      });
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
      log({
        timestamp: new Date().toISOString(),
        type: 'blueprint',
        game,
        status: 'success',
        message: `Published! Post ID: ${result.postId}`,
        postId: result.postId,
      });
    } else {
      log({
        timestamp: new Date().toISOString(),
        type: 'blueprint',
        game,
        status: 'error',
        message: `Publish failed: ${result.error}`,
      });
    }
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      type: 'blueprint',
      game,
      status: 'error',
      message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ==========================================
// DAILY WINNERS PUBLISH
// ==========================================

async function publishDailyWinners(data: LottoResult[]): Promise<void> {
  const yesterdayISO = getYesterdayPH();
  const displayDate = formatDisplayDate(yesterdayISO);

  log({
    timestamp: new Date().toISOString(),
    type: 'daily-winners',
    game: 'all',
    status: 'success',
    message: `Starting daily winners publish for ${yesterdayISO}`,
  });

  try {
    // Get all draws from yesterday
    const yesterdayDraws = data.filter(d => d.date === yesterdayISO);

    if (yesterdayDraws.length === 0) {
      log({
        timestamp: new Date().toISOString(),
        type: 'daily-winners',
        game: 'all',
        status: 'skipped',
        message: `No draws found for ${yesterdayISO}. Holiday or no data — skipping.`,
      });
      return;
    }

    // Render banner
    const imageBuffer = await renderDailyWinnersToBuffer(displayDate, yesterdayDraws);

    // Determine which major games were drawn for hashtags
    const majorGames = yesterdayDraws
      .map(d => d.game)
      .filter(g => ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D'].includes(g));

    // Generate caption
    const caption = generateDailyWinnersCaption(yesterdayISO, [...new Set(majorGames)]);

    // Publish
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({
        timestamp: new Date().toISOString(),
        type: 'daily-winners',
        game: 'all',
        status: 'error',
        message: 'META_ACCESS_TOKEN not configured',
      });
      return;
    }

    const result = await publishToFacebookWithBuffer({
      pageAccessToken: accessToken,
      pageId: FACEBOOK_PAGE_ID,
      imageBuffer,
      fileName: `daily-winners-${yesterdayISO}-${Date.now()}.png`,
      mimeType: 'image/png',
      caption,
    });

    if (result.success) {
      log({
        timestamp: new Date().toISOString(),
        type: 'daily-winners',
        game: 'all',
        status: 'success',
        message: `Published! Post ID: ${result.postId}`,
        postId: result.postId,
      });
    } else {
      log({
        timestamp: new Date().toISOString(),
        type: 'daily-winners',
        game: 'all',
        status: 'error',
        message: `Publish failed: ${result.error}`,
      });
    }
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      type: 'daily-winners',
      game: 'all',
      status: 'error',
      message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ==========================================
// ANALYSIS PUBLISH
// ==========================================

async function publishAnalysis(data: LottoResult[], slot: number): Promise<void> {
  // Determine which draw day to look for (yesterday in PH time)
  const yesterdayISO = getYesterdayPH();
  const yesterdayDow = getDayOfWeek(yesterdayISO);

  // Get which games were drawn yesterday
  const drawnGames = SCHEDULE_MAP[yesterdayDow] || [];

  // Filter to only auto-analysis games
  const analysisGames = drawnGames.filter(g => AUTO_ANALYSIS_GAMES.includes(g));

  // Check if this slot has a game
  if (slot >= analysisGames.length) {
    log({
      timestamp: new Date().toISOString(),
      type: 'analysis',
      game: `slot-${slot}`,
      status: 'skipped',
      message: `Slot ${slot} has no game (only ${analysisGames.length} games drawn yesterday).`,
    });
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
    // HOLIDAY CHECK: Verify a draw actually happened yesterday for this game
    if (!drawExistsForDate(game, yesterdayISO, data)) {
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'skipped',
        message: `No draw found for ${gameName} on ${yesterdayISO}. Holiday or cancelled — skipping.`,
      });
      return;
    }

    // Find the draw from yesterday
    const draw = getDrawOnOrBeforeDate(game, yesterdayISO, data);
    if (!draw) {
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'skipped',
        message: `Could not find draw data for ${gameName} on ${yesterdayISO}.`,
      });
      return;
    }

    // Get all game data for analysis
    const gameData = getGameData(game, data);
    if (gameData.length < 5) {
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'skipped',
        message: `Not enough historical data for ${gameName} (${gameData.length} draws). Need at least 5.`,
      });
      return;
    }

    // Classify numbers
    const freqMap = calculateFrequency(gameData, game);
    const classifiedNumbers: NumberData[] = classifyNumbers(freqMap);

    // Format the display date
    const displayDate = formatDisplayDate(draw.date);

    // Parse winning numbers
    const winningNumbers = parseCombination(draw.combination);

    // Render banner
    const imageBuffer = await renderAnalysisToBuffer(
      game,
      gameName,
      displayDate,
      draw,
      classifiedNumbers,
      gameData,
    );

    // Generate caption
    const caption = generateAnalysisCaption(game, gameName, draw.date, winningNumbers, gameData);

    // Publish to Facebook
    const accessToken = process.env.META_ACCESS_TOKEN;
    if (!accessToken) {
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'error',
        message: 'META_ACCESS_TOKEN not configured',
      });
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
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'success',
        message: `Published! Post ID: ${result.postId}`,
        postId: result.postId,
      });
    } else {
      log({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game,
        status: 'error',
        message: `Publish failed: ${result.error}`,
      });
    }
  } catch (err) {
    log({
      timestamp: new Date().toISOString(),
      type: 'analysis',
      game,
      status: 'error',
      message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
}

// ==========================================
// MAIN CRON HANDLER
// ==========================================

export async function GET(request: NextRequest) {
  // ---- 1. Verify cron secret ----
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured. Set it in Vercel env vars.' },
      { status: 500 },
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized. Invalid or missing cron secret.' },
      { status: 401 },
    );
  }

  // ---- 2. Determine what to run ----
  const { hour, minute } = getCurrentTimePH();
  const tasks: { type: 'blueprint' | 'analysis' | 'daily-winners'; slot?: number }[] = [];

  // Daily Winners: 6:30 AM PH ± 7 min
  if (isDailyWinnersTime()) {
    tasks.push({ type: 'daily-winners' });
  }

  // Blueprint: 10:00 AM PH ± 7 min
  if (isBlueprintTime()) {
    tasks.push({ type: 'blueprint' });
  }

  // Analysis: check slots
  const analysisSlot = getAnalysisSlot();
  if (analysisSlot >= 0) {
    tasks.push({ type: 'analysis', slot: analysisSlot });
  }

  // If nothing to do, return early
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
    return NextResponse.json({
      status: 'error',
      message: 'No lotto data available. Check DATA_SOURCE_URL or public/results.json.',
    });
  }

  // ---- 4. Execute tasks ----
  const results: CronLogEntry[] = [];

  for (const task of tasks) {
    if (task.type === 'blueprint') {
      await publishBlueprint(data);
      results.push({
        timestamp: new Date().toISOString(),
        type: 'blueprint',
        game: getTodayBlueprintGame(),
        status: 'success',
        message: 'Blueprint job executed',
      });
    } else if (task.type === 'daily-winners') {
      await publishDailyWinners(data);
      results.push({
        timestamp: new Date().toISOString(),
        type: 'daily-winners',
        game: 'all',
        status: 'success',
        message: 'Daily winners job executed',
      });
    } else if (task.type === 'analysis' && task.slot !== undefined) {
      await publishAnalysis(data, task.slot);
      results.push({
        timestamp: new Date().toISOString(),
        type: 'analysis',
        game: `slot-${task.slot}`,
        status: 'success',
        message: `Analysis slot ${task.slot} executed`,
      });
    }
  }

  return NextResponse.json({
    status: 'completed',
    phTime: `${hour}:${String(minute).padStart(2, '0')}`,
    tasks: results,
  });
}

// Also support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request);
}
