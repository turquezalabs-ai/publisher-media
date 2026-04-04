/**
 * Server-Side Banner Renderer
 *
 * Generates 1080x1350px banner images using SVG + sharp.
 * Used by the cron system for auto-publishing when no browser is available.
 *
 * Uses system fonts (Arial/Helvetica) as Montserrat is not available server-side.
 * Emojis are rendered as Unicode text (supported by sharp/librsvg).
 */

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import type { LottoResult, BlueprintNumber, NumberData } from './types';
import { GAME_COLORS_HEX, GAME_BALL_COUNT, DAILY_DRAW_TIME_SLOTS, DAILY_WINNERS_MAJOR_GAMES, DAILY_WINNERS_DIGIT_GAMES, DAILY_GAME_LABELS } from './config';
import {
  parseCombination,
  calculateFrequency,
  classifyNumbers,
  getLastSeenForNumber,
  formatLastSeen,
  getPreviousDraw,
  generateHumanPatternStatements,
} from './analysis';

// ==========================================
// COLOR HELPERS
// ==========================================

function parseRGBA(rgba: string): { r: number; g: number; b: number; a: number } {
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]*)\)/);
  if (match) {
    return {
      r: parseInt(match[1]),
      g: parseInt(match[2]),
      b: parseInt(match[3]),
      a: match[4] ? parseFloat(match[4]) : 1,
    };
  }
  return { r: 37, g: 99, b: 235, a: 0.6 }; // fallback blue
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const alpha = Math.round(a * 255).toString(16).padStart(2, '0');
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${alpha}`;
}

function getCircleFill(game: string, opacity: number = 0.6): string {
  const rgba = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
  const parsed = parseRGBA(rgba);
  return rgbaToHex(parsed.r, parsed.g, parsed.b, opacity);
}

function getCircleFillAlt(game: string, opacity: number = 0.4): string {
  const rgba = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
  const parsed = parseRGBA(rgba);
  return rgbaToHex(parsed.r, parsed.g, parsed.b, opacity);
}

// ==========================================
// SVG HELPERS
// ==========================================

const FONT = 'Arial, Helvetica, sans-serif';

function svgCircle(cx: number, cy: number, r: number, fill: string, stroke: string = 'rgba(255,255,255,0.20)', strokeWidth: number = 4): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
}

function svgText(x: number, y: number, text: string, opts: {
  size?: number;
  weight?: string;
  color?: string;
  anchor?: string;
  font?: string;
  letterSpacing?: number;
} = {}): string {
  const {
    size = 20,
    weight = '700',
    color = 'white',
    anchor = 'middle',
    font = FONT,
    letterSpacing = 0,
  } = opts;

  const letterSpacingAttr = letterSpacing > 0 ? ` letter-spacing="${letterSpacing}"` : '';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${color}"${letterSpacingAttr}>${escapeXml(text)}</text>`;
}

function svgRect(x: number, y: number, w: number, h: number, fill: string, rx: number = 0): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" />`;
}

function svgImage(x: number, y: number, w: number, h: number, href: string, clip: string = 'rect'): string {
  if (clip === 'circle') {
    const r = w / 2;
    return `<defs><clipPath id="clip-${x}-${y}"><circle cx="${x + r}" cy="${y + r}" r="${r}" /></clipPath></defs>` +
      `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" clip-path="url(#clip-${x}-${y})" />`;
  }
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${href}" />`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ==========================================
// BLUEPRINT BANNER SVG
// ==========================================

function buildBlueprintSVG(game: string, gameName: string, numbers: BlueprintNumber[]): string {
  const circleFill = getCircleFill(game, 0.6);
  const circleR = 58; // 116/2
  const colLefts = [259, 393, 527, 661, 795]; // 201+58, 335+58, etc.
  const rowTops = [600, 743, 886, 1029]; // 542+58, 685+58, etc.

  // Count categories for display
  const hotCount = numbers.filter(n => n.category === 'hot').length;
  const warmCount = numbers.filter(n => n.category === 'warm').length;
  const coldCount = numbers.filter(n => n.category === 'cold').length;

  let svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, 1080, 1350, '#111E44');

  // Logo placeholder (circle + LP text)
  svg += svgCircle(132, 132, 68, 'rgba(255,255,255,0.10)', 'none', 0);
  svg += svgText(132, 125, 'LP', { size: 42, weight: '800', color: 'white' });
  svg += svgText(132, 148, '●', { size: 10, color: '#3B82F6' });

  // QR placeholder (rounded rect)
  svg += svgRect(880, 64, 136, 136, 'rgba(255,255,255,0.90)', 12);
  svg += svgText(948, 138, 'QR', { size: 28, weight: '700', color: '#333' });

  // Brand Title
  svg += svgText(540, 160, 'Lottong', { size: 68, weight: '800', color: 'white' });
  svg += svgText(540 + 170, 160, 'Pinoy', { size: 68, weight: '800', color: '#3B82F6' });

  // Subtitle
  svg += svgText(540, 206, 'DATA-DRIVEN COMBINATIONS', { size: 22, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3 });

  // Label
  svg += svgText(540, 270, 'WEEKLY BLUEPRINT', { size: 44, weight: '800', color: 'white', letterSpacing: 3 });

  // Game Name
  svg += svgText(540, 340, gameName, { size: 38, weight: '800', color: 'white', letterSpacing: 2 });

  // Legend
  const legendY = 400;
  svg += svgText(270, legendY, '🔥 HOT', { size: 20, weight: '600', color: 'white' });
  svg += svgText(270, legendY + 24, '(High occurrence)', { size: 16, weight: '500', color: 'rgba(255,255,255,0.50)' });
  svg += svgText(540, legendY, '🌡️ WARM', { size: 20, weight: '600', color: 'white' });
  svg += svgText(540, legendY + 24, '(Avg. occurrence)', { size: 16, weight: '500', color: 'rgba(255,255,255,0.50)' });
  svg += svgText(810, legendY, '❄️ COLD', { size: 20, weight: '600', color: 'white' });
  svg += svgText(810, legendY + 24, '(Low Occurrence)', { size: 16, weight: '500', color: 'rgba(255,255,255,0.50)' });

  // Number Grid (5x4)
  for (let i = 0; i < numbers.length; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const cx = colLefts[col];
    const cy = rowTops[row];
    const num = numbers[i];
    const numStr = String(num.number).padStart(2, '0');

    // Circle
    svg += svgCircle(cx, cy, circleR, circleFill, 'rgba(255,255,255,0.20)', 4);

    // Number
    svg += svgText(cx, cy + 12, numStr, { size: 35, weight: '700', color: 'white' });

    // Emoji at top-right
    svg += svgText(cx + 40, cy - 42, num.emoji, { size: 36, weight: '600' });
  }

  // Category summary
  const summaryY = 1140;
  svg += svgText(540, summaryY, `${hotCount} Hot  ·  ${warmCount} Warm  ·  ${coldCount} Cold`, {
    size: 20,
    weight: '600',
    color: 'rgba(255,255,255,0.60)',
  });

  // Disclaimer
  svg += svgText(540, 1210, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 18,
    weight: '500',
    color: 'rgba(255,255,255,0.50)',
  });
  svg += svgText(540, 1234, 'Lottong Pinoy does not facilitate betting.', {
    size: 18,
    weight: '500',
    color: 'rgba(255,255,255,0.50)',
  });

  // Website
  svg += svgText(540, 1290, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white' });

  svg += '</svg>';
  return svg;
}

// ==========================================
// ANALYSIS BANNER SVG
// ==========================================

function buildAnalysisSVG(
  game: string,
  gameName: string,
  date: string,
  draw: LottoResult,
  classifiedNumbers: NumberData[],
  gameData: LottoResult[]
): string {
  const circleFill = getCircleFill(game, 0.6);
  const microFill = getCircleFill(game, 0.3);
  const microFillAlt = getCircleFill(game, 0.4);

  const winningNumbers = parseCombination(draw.combination);
  const numBalls = winningNumbers.length;
  const ballSize = 113;
  const ballR = ballSize / 2;
  const ballSpacing = 137;
  const totalBallWidth = (numBalls - 1) * ballSpacing + ballSize;
  const ballStartX = Math.round((1080 - totalBallWidth) / 2);
  const ballCenterY = 400;

  // Micro grid data
  const microItems = winningNumbers.map((num) => {
    const classified = classifiedNumbers.find(n => n.number === num);
    const drawsAgo = getLastSeenForNumber(gameData, num);
    const lastSeen = formatLastSeen(drawsAgo, gameData);

    let category: string = classified?.category || 'warm';
    let emoji = classified?.emoji || '🌡️';
    let description = '(Avg. Occurrence)';
    if (category === 'hot') description = '(High Occurrence)';
    else if (category === 'cold') description = '(Low Occurrence)';

    return { number: num, category, emoji, description, lastSeen };
  });

  // Pattern statements
  const previousDraw = getPreviousDraw(gameData, game);
  const patterns = generateHumanPatternStatements(
    winningNumbers,
    gameData,
    draw,
    previousDraw,
  );

  // Layout calculations
  const microStartY = 560;
  const microRowGap = 100;
  const microCircleLeft = [122, 632]; // 64+58, 574+58
  const microTextLeft = [222, 732]; // 164+58, 674+58
  const numMicroRows = Math.ceil(microItems.length / 2);

  const lastMicroBottom = microStartY + (numMicroRows - 1) * microRowGap + 76;
  const patternTitleY = lastMicroBottom + 45;
  const patternStartY = patternTitleY + 50;
  const patternLineHeight = 65;

  let svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, 1080, 1350, '#111E44');

  // Logo placeholder
  svg += svgCircle(132, 132, 68, 'rgba(255,255,255,0.10)', 'none', 0);
  svg += svgText(132, 125, 'LP', { size: 42, weight: '800', color: 'white' });
  svg += svgText(132, 148, '●', { size: 10, color: '#3B82F6' });

  // QR placeholder
  svg += svgRect(880, 64, 136, 136, 'rgba(255,255,255,0.90)', 12);
  svg += svgText(948, 138, 'QR', { size: 28, weight: '700', color: '#333' });

  // Brand Title
  svg += svgText(540, 160, 'Lottong', { size: 68, weight: '800', color: 'white' });
  svg += svgText(540 + 170, 160, 'Pinoy', { size: 68, weight: '800', color: '#3B82F6' });

  // Subtitle
  svg += svgText(540, 206, 'DRAW ANALYSIS', { size: 22, weight: '700', color: 'rgba(255,255,255,0.80)', letterSpacing: 5 });

  // Date
  svg += svgText(540, 248, date, { size: 20, weight: '600', color: 'white', letterSpacing: 2 });

  // Game Name
  svg += svgText(540, 320, gameName, { size: 40, weight: '800', color: 'white' });

  // Winning Balls
  for (let i = 0; i < numBalls; i++) {
    const cx = ballStartX + ballSize / 2 + i * ballSpacing;
    const cy = ballCenterY;
    svg += svgCircle(cx, cy, ballR, circleFill, 'rgba(255,255,255,0.20)', 6);
    svg += svgText(cx, cy + 14, String(winningNumbers[i]), { size: 44, weight: '700', color: 'white' });
  }

  // "Individual behavior" title
  svg += svgText(540, 520, 'Individual behavior of each number', { size: 22, weight: '700', color: 'white', letterSpacing: 1 });

  // Micro grid (2 columns)
  for (let i = 0; i < microItems.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const circleY = microStartY + row * microRowGap;
    const item = microItems[i];
    const microR = 38;
    const cx = microCircleLeft[col];
    const tx = microTextLeft[col];

    // Small circle
    const fill = col === 0 ? microFill : microFillAlt;
    svg += svgCircle(cx, circleY, microR, fill, 'rgba(255,255,255,0.20)', 3);

    // Number in circle
    svg += svgText(cx, circleY + 9, String(item.number), { size: 28, weight: '700', color: 'white' });

    // Category + description text
    const catColor = item.category === 'hot' ? '#FF6B6B' : item.category === 'cold' ? '#87CEEB' : '#FFD93D';
    const catUpper = item.category.toUpperCase();
    svg += svgText(tx, circleY - 8, `${item.emoji} ${catUpper}`, { size: 20, weight: '600', color: 'white', anchor: 'start' });
    svg += svgText(tx + 120, circleY - 8, item.description, { size: 18, weight: '500', color: 'rgba(255,255,255,0.50)', anchor: 'start' });
    svg += svgText(tx, circleY + 16, `Last seen ${item.lastSeen}`, { size: 17, weight: '400', color: 'rgba(255,255,255,0.70)', anchor: 'start' });
  }

  // "Patterns and Connections" title
  svg += svgText(540, patternTitleY, 'Patterns and Connections', { size: 22, weight: '700', color: 'white', letterSpacing: 1 });

  // Pattern items
  for (let i = 0; i < Math.min(patterns.length, 3); i++) {
    const py = patternStartY + i * patternLineHeight;
    // Clean HTML tags from pattern text for SVG
    const cleanPattern = patterns[i]
      .replace(/<b>/g, '')
      .replace(/<\/b>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ');
    // Split into lines if too long
    const text = `✅  ${cleanPattern}`;
    svg += svgText(540, py, text, { size: 19, weight: '400', color: 'white' });
  }

  // Disclaimer
  svg += svgText(540, 1210, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 18,
    weight: '500',
    color: 'rgba(255,255,255,0.50)',
  });
  svg += svgText(540, 1234, 'Lottong Pinoy does not facilitate betting.', {
    size: 18,
    weight: '500',
    color: 'rgba(255,255,255,0.50)',
  });

  // Website
  svg += svgText(540, 1290, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white' });

  svg += '</svg>';
  return svg;
}

// ==========================================
// DAILY WINNERS BANNER SVG (Exact Figma Layout)
// ==========================================

// Cache base64-encoded banner assets for embedding in SVG
let _logoB64: string | null = null;
let _qrB64: string | null = null;

function getLogoBase64(): string {
  if (!_logoB64) {
    const filePath = path.join(process.cwd(), 'public', 'banner-assets', 'logo.png');
    _logoB64 = fs.readFileSync(filePath).toString('base64');
  }
  return _logoB64;
}

function getQRBase64(): string {
  if (!_qrB64) {
    const filePath = path.join(process.cwd(), 'public', 'banner-assets', 'qrcode.png');
    _qrB64 = fs.readFileSync(filePath).toString('base64');
  }
  return _qrB64;
}

interface DailyDrawEntry {
  game: string;
  gameLabel: string;
  numbers: number[];
  timeSlot?: string; // '2PM', '5PM', '9PM' for digit games
}

// ==========================================
// Exact Figma-to-SVG position mapping
// All pixel positions extracted directly from
// the Figma HTML export. CSS top → SVG y uses:
//   svgY = cssTop + fontSize * 0.78
// Numbers inside circles: centered at ball center
//   numY = ballTop + 38 + 11 (for 32px font)
// ==========================================

function buildDailyWinnersSVG(
  dateStr: string,
  majorDraws: DailyDrawEntry[],
  dailyDraws: DailyDrawEntry[],
): string {
  const W = 1080;
  const H = 1350;

  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();

  // ---- FIGMA EXACT CONSTANTS ----
  const BALL_SIZE = 76;           // 76x76 circles
  const BALL_R = 38;              // radius
  const MAJOR_BALL_LEFT = 472;    // first major ball left edge (Figma)
  const MAJOR_BALL_GAP = 90;      // center-to-center for major balls
  const DAILY_2D_BALL_LEFTS = [265, 359];   // 2D ball left edges (Figma)
  const DAILY_3D_BALL_LEFTS = [709, 803, 897]; // 3D ball left edges (Figma)
  const DAILY_BALL_GAP = 94;      // center-to-center for daily balls
  const ROW_GAP = 94;             // major game row spacing (ball top to top)
  const GAME_NAME_CENTER_X = 268; // center x for game names (between margin and balls)

  // Fixed DAILY DRAWS section Y positions (CSS top values from Figma)
  const DAILY_LABEL_TOP = 759;
  const DAILY_COL_HEADER_TOP = 817;
  const DAILY_SLOT_TOPS = [877, 971, 1065]; // 2PM, 5PM, 9PM ball tops

  // ---- DYNAMIC MAJOR GAMES POSITIONING ----
  // Center major games section between header (~y=260) and DAILY DRAWS label (y=759)
  const N = majorDraws.length;
  const majorContentH = 66 + Math.max(0, N - 1) * ROW_GAP + BALL_SIZE; // gap + rows + last ball
  const spaceTop = 270;  // below date
  const majorLabelTopCSS = spaceTop + (DAILY_LABEL_TOP - spaceTop - majorContentH) / 2;
  const majorFirstRowTopCSS = majorLabelTopCSS + 66;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<defs>`;
  svg += `<clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath>`;
  svg += `</defs>`;

  // ---- BACKGROUND ----
  svg += svgRect(0, 0, W, H, '#111E44');

  // ==========================================
  // HEADER (standard — same as all banners)
  // ==========================================
  // Logo — circular clip with real image
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;

  // QR code — NO border, NO background (raw image as-is)
  svg += `<image x="880" y="64" width="136" height="136" href="data:image/png;base64,${qrB64}" />`;

  // Brand: "Lottong" (white) + " Pinoy" (blue)
  svg += `<text x="420" y="158" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800" fill="white">Lottong</text>`;
  svg += `<text x="612" y="158" text-anchor="start" font-family="${FONT}" font-size="68" font-weight="800" fill="#3B82F6"> Pinoy</text>`;

  // Subtitle: "LOTTO DRAW RESULTS" (standard position)
  svg += svgText(540, 206, 'LOTTO DRAW RESULTS', { size: 22, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3.25 });

  // Date (standard position)
  svg += svgText(540, 244, dateStr, { size: 22, weight: '600', color: 'white', letterSpacing: 2.80 });

  // NO "DAILY WINNERS" label — Figma goes straight to MAJOR GAMES

  // ==========================================
  // MAJOR GAMES SECTION (exact Figma positions)
  // ==========================================
  // "MAJOR GAMES" label — centered, light blue (#B3D0FF), size 32
  const majorLabelSVG_Y = Math.round(majorLabelTopCSS + 32 * 0.78);
  svg += svgText(540, majorLabelSVG_Y, 'MAJOR GAMES', { size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3.20 });

  // Game rows
  for (let i = 0; i < N; i++) {
    const entry = majorDraws[i];
    const nums = entry.numbers;
    const rowTopCSS = majorFirstRowTopCSS + i * ROW_GAP;
    const centerY = rowTopCSS + BALL_R;  // ball center Y
    const nameSVG_Y = Math.round(centerY + 12); // baseline for 34px text
    const numSVG_Y = Math.round(centerY + 11);  // baseline for 32px text

    // Game name — centered between left margin and ball area
    svg += svgText(GAME_NAME_CENTER_X, nameSVG_Y, entry.gameLabel, {
      size: 34, weight: '700', color: 'white',
      anchor: 'middle', letterSpacing: 3.40,
    });

    // Number balls — always start at x=472 (Figma), 90px center-to-center
    const ballColor = GAME_COLORS_HEX[entry.game] || 'rgba(37, 99, 235, 0.60)';
    for (let j = 0; j < nums.length; j++) {
      const cx = MAJOR_BALL_LEFT + BALL_R + j * MAJOR_BALL_GAP;
      svg += svgCircle(cx, centerY, BALL_R, ballColor, 'rgba(255,255,255,0.20)', 4);
      const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
      svg += svgText(cx, numSVG_Y, numStr, { size: 32, weight: '700', color: 'white' });
    }
  }

  // ==========================================
  // DAILY DRAWS SECTION (exact Figma positions)
  // ==========================================
  // "DAILY DRAWS" label — centered, light blue (#B3D0FF), size 32
  const dailyLabelSVG_Y = Math.round(DAILY_LABEL_TOP + 32 * 0.78);
  svg += svgText(540, dailyLabelSVG_Y, 'DAILY DRAWS', { size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3.20 });

  // Column headers: "2D EZ2 Lotto" at left=149, "3D Swertres" at left=584
  const colHeaderSVG_Y = Math.round(DAILY_COL_HEADER_TOP + 30 * 0.78);
  svg += svgText(149, colHeaderSVG_Y, '2D EZ2 Lotto', { size: 30, weight: '700', color: 'white', anchor: 'start', letterSpacing: 3 });
  svg += svgText(584, colHeaderSVG_Y, '3D Swertres', { size: 30, weight: '700', color: 'white', anchor: 'start', letterSpacing: 3 });

  // Separate 2D and 3D entries by time slot
  const daily2D = dailyDraws.filter(d => d.game === '2D');
  const daily3D = dailyDraws.filter(d => d.game === '3D');

  for (let slot = 0; slot < 3; slot++) {
    const ballTopY = DAILY_SLOT_TOPS[slot];
    const centerY = ballTopY + BALL_R;
    const numSVG_Y = Math.round(centerY + 11);

    // Time labels — 2D side (left=149, size=26) and 3D side (left=583, size=30)
    const time2D_Y = Math.round(ballTopY + 21 + 26 * 0.78);
    const time3D_Y = Math.round(ballTopY + 21 + 30 * 0.78);
    svg += svgText(149, time2D_Y, DAILY_DRAW_TIME_SLOTS[slot], { size: 26, weight: '700', color: 'white', anchor: 'start', letterSpacing: 2.60 });
    svg += svgText(583, time3D_Y, DAILY_DRAW_TIME_SLOTS[slot], { size: 30, weight: '700', color: 'white', anchor: 'start', letterSpacing: 3 });

    // 2D balls — circles at x=265, 359 (Figma)
    if (daily2D[slot]) {
      const nums = daily2D[slot].numbers;
      for (let j = 0; j < Math.min(nums.length, 2); j++) {
        const cx = DAILY_2D_BALL_LEFTS[j] + BALL_R;
        svg += svgCircle(cx, centerY, BALL_R, 'rgba(220, 38, 38, 0.60)', 'rgba(255,255,255,0.20)', 4);
        const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
        svg += svgText(cx, numSVG_Y, numStr, { size: 32, weight: '700', color: 'white' });
      }
    }

    // 3D balls — circles at x=709, 803, 897 (Figma)
    if (daily3D[slot]) {
      const nums = daily3D[slot].numbers;
      for (let j = 0; j < Math.min(nums.length, 3); j++) {
        const cx = DAILY_3D_BALL_LEFTS[j] + BALL_R;
        svg += svgCircle(cx, centerY, BALL_R, 'rgba(147, 51, 234, 0.60)', 'rgba(255,255,255,0.20)', 4);
        const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
        svg += svgText(cx, numSVG_Y, numStr, { size: 32, weight: '700', color: 'white' });
      }
    }
  }

  // ==========================================
  // FOOTER (standard — anchored at bottom)
  // ==========================================
  svg += svgText(540, 1169, '18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.', {
    size: 22,
    weight: '500',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 1.32,
  });
  svg += svgText(540, 1263, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white' });

  svg += '</svg>';
  return svg;
}

// ==========================================
// MAIN EXPORTS
// ==========================================

/**
 * Render a Blueprint banner to a PNG Buffer.
 */
export async function renderBlueprintToBuffer(
  game: string,
  numbers: BlueprintNumber[]
): Promise<Buffer> {
  const { GAME_NAMES } = await import('./config');
  const gameName = GAME_NAMES[game] || game;
  const svg = buildBlueprintSVG(game, gameName, numbers);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render an Analysis banner to a PNG Buffer.
 */
export async function renderAnalysisToBuffer(
  game: string,
  gameName: string,
  date: string,
  draw: LottoResult,
  classifiedNumbers: NumberData[],
  gameData: LottoResult[]
): Promise<Buffer> {
  const svg = buildAnalysisSVG(game, gameName, date, draw, classifiedNumbers, gameData);
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Render a Daily Winners banner to a PNG Buffer.
 * Shows all winning numbers from a specific date.
 */
export async function renderDailyWinnersToBuffer(
  dateStr: string,
  draws: LottoResult[],
): Promise<Buffer> {
  const majorDraws: DailyDrawEntry[] = [];
  const dailyDraws: DailyDrawEntry[] = [];

  // Collect major game draws
  for (const game of DAILY_WINNERS_MAJOR_GAMES) {
    const draw = draws.find(d => d.game === game);
    if (draw) {
      const nums = parseCombination(draw.combination);
      if (nums.length > 0) {
        majorDraws.push({
          game,
          gameLabel: DAILY_GAME_LABELS[game] || game,
          numbers: nums,
        });
      }
    }
  }

  // Collect daily digit game draws (3D and 2D with time slots)
  // The data has time-slot entries like "3D Lotto 2PM", "3D Lotto 5PM", "3D Lotto 9PM"
  for (const game of DAILY_WINNERS_DIGIT_GAMES) {
    for (const slot of DAILY_DRAW_TIME_SLOTS) {
      // Match by time slot suffix in the combination or original game name
      // The preprocessor maps time-slot names to base game codes
      // We need to find draws for each specific time slot
      // Since the preprocessor consolidates, we look at the raw combination
      const slotDraw = draws.find(d => {
        if (d.game !== game) return false;
        // Try to match by checking the original data's game name field
        // The preprocessor maps "3D Lotto 2PM" → "3D", so we lose slot info
        // Instead, we check if there are multiple entries for the same game
        return true;
      });
    }
  }

  // For digit games, we need to find all draws for 3D and 2D on that date
  // The preprocessor consolidates time slots, so we need to look at raw data
  // For now, collect all unique draws per game (up to 3)
  for (const game of DAILY_WINNERS_DIGIT_GAMES) {
    const gameDraws = draws.filter(d => d.game === game);
    // Typically there will be 3 entries (2PM, 5PM, 9PM)
    for (let i = 0; i < Math.min(gameDraws.length, 3); i++) {
      const nums = parseCombination(gameDraws[i].combination);
      if (nums.length > 0) {
        dailyDraws.push({
          game,
          gameLabel: DAILY_GAME_LABELS[game] || game,
          numbers: nums,
          timeSlot: DAILY_DRAW_TIME_SLOTS[i] || undefined,
        });
      }
    }
  }

  const svg = buildDailyWinnersSVG(dateStr, majorDraws, dailyDraws);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
