/**
 * Server-Side Banner Renderer
 *
 * Generates 1080x1350px banner images using SVG + sharp.
 * Used by the cron system for auto-publishing when no browser is available.
 *
 * Uses embedded Montserrat font (variable weight TTF) for brand consistency.
 * Emojis are rendered as embedded PNG <image> elements for crisp, consistent output.
 */

import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import type { LottoResult, BlueprintNumber, NumberData } from './types';
import { GAME_COLORS_HEX, GAME_BALL_COUNT, DAILY_DRAW_TIME_SLOTS, DAILY_GAME_LABELS } from './config';
import {
  parseCombination,
  calculateFrequency,
  classifyNumbers,
  getLastSeenForNumber,
  formatLastSeen,
  getPreviousDraw,
  generateHumanPatternStatements,
} from './analysis';
import { generatePulseAnalysis, getTimeSlotLabel } from './pulse-engine';
import type { PulseData } from './pulse-engine';

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
// EMBEDDED FONT (Montserrat)
// ==========================================

let _montserratB64: string | null = null;


// ==========================================
// SVG HELPERS
// ==========================================

const FONT = "'Montserrat', Arial, Helvetica, sans-serif";

function svgCircle(cx: number, cy: number, r: number, fill: string, stroke: string = 'rgba(255,255,255,0.20)', strokeWidth: number = 8): string {
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
// EMOJI IMAGE HELPERS (cached base64 PNGs)
// ==========================================

const emojiCache = new Map<string, string>();

function getEmojiBase64(filename: string): string {
  if (emojiCache.has(filename)) return emojiCache.get(filename)!;
  try {
    const filePath = path.join(process.cwd(), 'public', 'banner-assets', 'emoji', filename);
    const buffer = fs.readFileSync(filePath);
    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;
    emojiCache.set(filename, base64);
    return base64;
  } catch {
    return '';
  }
}

function getHotEmojiBase64(): string  { return getEmojiBase64('hot.png'); }
function getWarmEmojiBase64(): string { return getEmojiBase64('warm.png'); }
function getColdEmojiBase64(): string { return getEmojiBase64('cold.png'); }
function getTipEmojiBase64(): string  { return getEmojiBase64('tip.png'); }

function getCategoryEmojiHref(category: string): string {
  switch (category) {
    case 'hot':  return getHotEmojiBase64();
    case 'cold': return getColdEmojiBase64();
    default:     return getWarmEmojiBase64();
  }
}

// ==========================================
// BLUEPRINT BANNER SVG
// ==========================================

function buildBlueprintSVG(game: string, gameName: string, numbers: BlueprintNumber[]): string {
  const circleFill = getCircleFill(game, 0.6);
  const circleR = 58;

  const hotCount = numbers.filter(n => n.category === 'hot').length;
  const warmCount = numbers.filter(n => n.category === 'warm').length;
  const coldCount = numbers.filter(n => n.category === 'cold').length;

  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();

  let svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, 1080, 1350, '#111E44');

  // Header
  svg += `<defs><clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath></defs>`;
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;
  svg += `<image x="880" y="64" width="136" height="136" href="data:image/png;base64,${qrB64}" />`;

  // Title
  svg += `<text x="540" y="143" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800"><tspan fill="white">Lottong </tspan><tspan fill="#3B82F6">Pinoy</tspan></text>`;

  // Subtitle
  svg += svgText(540, 206, 'DATA-DRIVEN COMBINATIONS', { size: 28, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3.25 });

  // Label
  svg += svgText(540, 255, 'WEEKLY BLUEPRINT', { size: 28, weight: '700', color: 'white', letterSpacing: 2.8 });

  // Game Name
  svg += svgText(540, 353, gameName, { size: 61, weight: '800', color: 'white' });

  // Legend
  // Legend
  const legendY = 100;
  svg += svgImage(220, legendY -28, 30, 30, getHotEmojiBase64());
  svg += svgText(288, legendY, 'HOT', { size: 26, weight: '600', color: 'white' });
  svg += svgText(270, legendY + 30, '(High occurrence)', { size: 22, weight: '600', color: 'rgba(255,255,255,0.50)' });

  svg += svgImage(470, legendY -24, 28, 28, getWarmEmojiBase64());
  svg += svgText(556, legendY, 'WARM', { size: 26, weight: '600', color: 'white' });
  svg += svgText(540, legendY + 30, '(Avg. occurrence)', { size: 22, weight: '600', color: 'rgba(255,255,255,0.50)' });

  svg += svgImage(752, legendY -24, 28, 28, getColdEmojiBase64());
  svg += svgText(828, legendY, 'COLD', { size: 26, weight: '600', color: 'white' });
  svg += svgText(810, legendY + 30, '(Low Occurrence)', { size: 22, weight: '600', color: 'rgba(255,255,255,0.50)' });

   // Category summary
  svg += svgText(540, 510, `${hotCount} Hot  \u00B7  ${warmCount} Warm  \u00B7  ${coldCount} Cold`, {
    size: 28, weight: '600', color: 'rgba(255,255,255,0.60)',
  });

    // === ADJUSTABLE POSITIONS ===
  const gridStartX = 259;
  const gridStartY = 630;
  const colSpacing = 134;
  const rowSpacing = 143;
  const circleOffY = 12;
  const emojiOffX = 13;
  const emojiOffY = -64;
  const emojiSize = 46;
  // ===============================

  for (let i = 0; i < numbers.length; i++) {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const cx = gridStartX + col * colSpacing;
    const cy = gridStartY + row * rowSpacing;
    const num = numbers[i];
    const numStr = String(num.number).padStart(2, '0');

    svg += svgCircle(cx, cy, circleR, circleFill, 'rgba(255,255,255,0.20)', 4);
    svg += svgText(cx, cy + circleOffY, numStr, { size: 35, weight: '700', color: 'white' });
    svg += svgImage(cx + emojiOffX, cy + emojiOffY, emojiSize, emojiSize, getCategoryEmojiHref(num.category));
  }

 

  // Disclaimer
  svg += svgText(540, 1186, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1214, 'Lottong Pinoy does not facilitate betting. Always verify results', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });

  // Website
  svg += svgText(540, 1286, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

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
  const ballCenterY = 450;

  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();

  // Micro grid data
  const microItems = winningNumbers.map((num) => {
    const classified = classifiedNumbers.find(n => n.number === num);
    const drawsAgo = getLastSeenForNumber(gameData, num);
    const lastSeen = formatLastSeen(drawsAgo, gameData);
    let category: string = classified?.category || 'warm';
    let description = '(Avg. Occurrence)';
    if (category === 'hot') description = '(High Occurrence)';
    else if (category === 'cold') description = '(Low Occurrence)';
    return { number: num, category, description, lastSeen };
  });

  const previousDraw = getPreviousDraw(gameData, game);
  const patterns = generateHumanPatternStatements(winningNumbers, gameData, draw, previousDraw);

  // === ADJUSTABLE POSITIONS ===
  const microStartY = 670;
  const microRowGap = 100;
  const microCircleLeft = [144, 612];
  const microTextLeft = [210, 678];
  const microEmojiOffX = 0;
  const microEmojiOffY = -24;
  const microEmojiSize = 22;
  const patternTitleY = 980;
  const patternStartY = 1030;
  const patternLineHeight = 40;
  // ===============================

  const numMicroRows = Math.ceil(microItems.length / 2);

  let svg = `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, 1080, 1350, '#111E44');

  // Header (same as Blueprint)
  svg += `<defs><clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath></defs>`;
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;
  svg += `<image x="880" y="64" width="136" height="136" href="data:image/png;base64,${qrB64}" />`;

  // Title (same as Blueprint)
  svg += `<text x="540" y="143" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800"><tspan fill="white">Lottong </tspan><tspan fill="#3B82F6">Pinoy</tspan></text>`;

  // Subtitle
  svg += svgText(540, 206, 'DRAW ANALYSIS', { size: 28, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3.25 });

  // Date
  svg += svgText(540, 255, date, { size: 28, weight: '600', color: 'white', letterSpacing: 2.8 });


  // Game Name
  svg += svgText(540, 353, gameName, { size: 61, weight: '800', color: 'white' });

  // Winning Balls
  for (let i = 0; i < numBalls; i++) {
    const cx = ballStartX + ballSize / 2 + i * ballSpacing;
    const cy = ballCenterY;
    svg += svgCircle(cx, cy, ballR, circleFill, 'rgba(255,255,255,0.20)', 6);
    svg += svgText(cx, cy + 14, String(winningNumbers[i]), { size: 44, weight: '700', color: 'white' });
  }

  // Section Title
  svg += svgText(540, 590, 'Individual behavior of each number', { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

  // Micro grid (2 columns)
  for (let i = 0; i < microItems.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const circleY = microStartY + row * microRowGap;
    const item = microItems[i];
    const microR = 38;
    const cx = microCircleLeft[col];
    const tx = microTextLeft[col];

    const fill = col === 0 ? microFill : microFillAlt;
    svg += svgCircle(cx, circleY, microR, fill, 'rgba(255,255,255,0.20)', 3);
    svg += svgText(cx, circleY + 9, String(item.number), { size: 28, weight: '700', color: 'white' });

    const catUpper = item.category.toUpperCase();
    svg += svgImage(tx + microEmojiOffX, circleY + microEmojiOffY, microEmojiSize, microEmojiSize, getCategoryEmojiHref(item.category));
    svg += svgText(tx + 30, circleY - 8, catUpper, { size: 22, weight: '600', color: 'white', anchor: 'start' });
    svg += svgText(tx + 120, circleY - 8, item.description, { size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', anchor: 'start' });
    svg += `<text x="${tx}" y="${circleY + 24}" text-anchor="start" font-family="${FONT}" font-size="22" font-weight="500" fill="rgba(255,255,255,0.70)">Last seen <tspan font-weight="800" fill="white">${item.lastSeen}</tspan></text>`;
  }

    // Patterns Section Title
  svg += svgText(540, patternTitleY, 'Patterns and Connections', { size: 28, weight: '700', color: 'white', letterSpacing: 1 });

  // Patterns (left-aligned, bold variables)
  const boldFill = 'rgba(255, 255, 255, 0.95)';

  for (let i = 0; i < Math.min(patterns.length, 3); i++) {
    const py = patternStartY + i * patternLineHeight;
    const raw = patterns[i].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
    const parts = raw.split(/<b>|<\/b>/);
    let content = '';
    let isBold = false;
    for (const part of parts) {
      if (isBold) {
        content += `<tspan font-weight="700" fill="${boldFill}">${escapeXml(part)}</tspan>`;
      } else if (part) {
        content += escapeXml(part);
      }
      isBold = !isBold;
    }

    svg += svgImage(90, py - 22, 26, 26, getTipEmojiBase64());
    svg += `<text x="130" y="${py}" font-family="${FONT}" font-size="24" font-weight="500" fill="rgba(255,255,255,0.70)" text-anchor="start">${content}</text>`;
  }
  // Disclaimer
  svg += svgText(540, 1186, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1214, 'Lottong Pinoy does not facilitate betting. Always verify results', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });

  // Website
  svg += svgText(540, 1286, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

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
// Pixel-perfect Figma-to-SVG implementation
// Every position extracted from the Figma HTML export.
// CSS top → SVG baseline: svgY = cssTop + fontSize * 0.80
// ==========================================

// Figma-specified ball colors (overrides config where different)
const FIGMA_BALL_COLORS: Record<string, string> = {
  '6/58': 'rgba(37, 99, 235, 0.60)',     // blue
  '6/55': 'rgba(0, 176, 255, 0.60)',     // sky blue
  '6/49': 'rgba(255, 104, 0, 0.60)',     // orange
  '6/45': 'rgba(22, 163, 74, 0.60)',     // green
  '6/42': 'rgba(234, 179, 8, 0.60)',     // gold
  '6D':   'rgba(99, 102, 241, 0.60)',    // indigo
  '4D':   'rgba(0, 201, 179, 0.60)',     // teal (Figma override)
  '2D':   'rgba(220, 38, 38, 0.60)',     // red
  '3D':   'rgba(147, 51, 234, 0.60)',    // purple
};

function buildDailyWinnersSVG(
  dateStr: string,
  majorDraws: DailyDrawEntry[],
  dailyDraws: DailyDrawEntry[],
): string {
  const W = 1080;
  const H = 1350;

  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();

  // === ADJUSTABLE SETTINGS ===
 const BALL_R = 38;
const BALL_STROKE = 'rgba(255,255,255,0.30)';  // stroke color
const BALL_STROKE_W = 4;                         // stroke width (number, no quotes)
const MAJOR_BALL_LEFTS = [472, 562, 652, 742, 832, 922];
const D2D_BALL_LEFTS = [265, 359];
const D3D_BALL_LEFTS = [709, 803, 897];
const ROW_GAP = 94;
const SPACE_TOP = 300;
const DAILY_MARGIN_TOP = 20;
  // ===============================

  // Dynamic positioning
  const N = majorDraws.length;
  const majorLabelGap = 60;
  const majorLabelY = SPACE_TOP;
  const majorFirstRowY = majorLabelY + majorLabelGap;
  const lastMajorRowBottom = majorFirstRowY + (N - 1) * ROW_GAP + 76; // 76 = ball diameter

  // Daily draws starts right after last major row + margin
  const dailyLabelY = lastMajorRowBottom + DAILY_MARGIN_TOP;
  const dailyColHdrY = dailyLabelY + 70;
  const dailyBallTopY = dailyColHdrY + 70;
  const dailyRowGap = 94;
  const dailyTimeOffset = -14;

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, W, H, '#111E44');

  // Header
  svg += `<defs><clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath></defs>`;
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;
  svg += `<image x="880" y="64" width="136" height="136" href="data:image/png;base64,${qrB64}" />`;

  // Title
  svg += `<text x="540" y="144" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800"><tspan fill="white">Lottong </tspan><tspan fill="#3B82F6">Pinoy</tspan></text>`;

  // Subtitle
  svg += svgText(540, 206, 'LOTTO DRAW RESULTS', { size: 28, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3.25 });

  // Date
  svg += svgText(540, 255, dateStr, { size: 28, weight: '600', color: 'white', letterSpacing: 2.8 });

  // Major Games
  const majorLabelSVG_Y = Math.round(majorLabelY + 32 * 0.80);
  svg += svgText(540, majorLabelSVG_Y, 'MAJOR GAMES', {
    size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3.20
  });

  for (let i = 0; i < N; i++) {
    const entry = majorDraws[i];
    const nums = entry.numbers;
    const rowY = majorFirstRowY + i * ROW_GAP;
    const ballCY = rowY + BALL_R;
    const nameY = Math.round(ballCY + 12);
    const numY = Math.round(ballCY + 11);

    svg += svgText(430, nameY, entry.gameLabel, {
      size: 34, weight: '700', color: 'white', anchor: 'end', letterSpacing: 1.5,
    });

    const ballColor = FIGMA_BALL_COLORS[entry.game] || GAME_COLORS_HEX[entry.game] || 'rgba(37,99,235,0.60)';
    for (let j = 0; j < Math.min(nums.length, 6); j++) {
      const cx = MAJOR_BALL_LEFTS[j] + BALL_R;
      svg += svgCircle(cx, ballCY, BALL_R, ballColor, BALL_STROKE, BALL_STROKE_W);
      const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
      svg += svgText(cx, numY, numStr, { size: 32, weight: '700', color: 'white', letterSpacing: 1.60 });
    }
  }

  // Daily Draws (dynamic position)
  const dailyLabelSVG_Y = Math.round(dailyLabelY + 60 * 0.80);
  svg += svgText(540, dailyLabelSVG_Y, 'DAILY DRAWS', {
    size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3.20
  });

  const dailyColHdrSVG_Y = Math.round(dailyColHdrY + 50 * 0.80);
  svg += svgText(149, dailyColHdrSVG_Y, '2D EZ2 Lotto', {
    size: 30, weight: '700', color: 'white', anchor: 'start', letterSpacing: 2
  });
  svg += svgText(596, dailyColHdrSVG_Y, '3D Swertres', {
    size: 30, weight: '700', color: 'white', anchor: 'start', letterSpacing: 2
  });

  const daily2D = dailyDraws.filter(d => d.game.startsWith('2D'));
  const daily3D = dailyDraws.filter(d => d.game.startsWith('3D'));

  for (let slot = 0; slot < 3; slot++) {
    const ballCY = dailyBallTopY + slot * dailyRowGap + BALL_R;
    const numY = Math.round(ballCY + 11);
    const timeY = Math.round(ballCY + dailyTimeOffset + 30 * 0.80);

    svg += svgText(149, timeY, DAILY_DRAW_TIME_SLOTS[slot], {
      size: 26, weight: '700', color: 'white', anchor: 'start', letterSpacing: 2.60
    });
    svg += svgText(583, timeY, DAILY_DRAW_TIME_SLOTS[slot], {
      size: 26, weight: '700', color: 'white', anchor: 'start', letterSpacing: 3
    });

    if (daily2D[slot]) {
      const nums = daily2D[slot].numbers;
      for (let j = 0; j < Math.min(nums.length, 2); j++) {
        const cx = D2D_BALL_LEFTS[j] + BALL_R;
        svg += svgCircle(cx, ballCY, BALL_R, 'rgba(220, 38, 38, 0.60)', BALL_STROKE, BALL_STROKE_W);
        const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
        svg += svgText(cx, numY, numStr, { size: 32, weight: '700', color: 'white', letterSpacing: 1.60 });
      }
    }

    if (daily3D[slot]) {
      const nums = daily3D[slot].numbers;
      for (let j = 0; j < Math.min(nums.length, 3); j++) {
        const cx = D3D_BALL_LEFTS[j] + BALL_R;
        svg += svgCircle(cx, ballCY, BALL_R, 'rgba(147, 51, 234, 0.60)', BALL_STROKE, BALL_STROKE_W);
        const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
        svg += svgText(cx, numY, numStr, { size: 32, weight: '700', color: 'white', letterSpacing: 1.60 });
      }
    }
  }

  // Footer
  svg += svgText(540, 1186, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1214, 'Lottong Pinoy does not facilitate betting. Always verify results', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1286, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

  svg += '</svg>';
  return svg;
}
// ==========================================
// PULSE BANNER SVG (2D + 3D Analysis)
// ==========================================

export function buildPulseSVG(
  timeSlot: '2PM' | '5PM' | '9PM',
  dateStr: string,
  pulseData: PulseData,
): string {
  const W = 1080;
  const H = 1350;
  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();
  const d2 = pulseData['2d'];
  const d3 = pulseData['3d'];

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += svgRect(0, 0, W, H, '#111E44');

  // === HEADER (same as all banners) ===
  svg += `<defs><clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath></defs>`;
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;
  svg += `<image x="880" y="64" width="136" height="136" href="data:image/png;base64,${qrB64}" />`;
  svg += `<text x="540" y="143" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800"><tspan fill="white">Lottong </tspan><tspan fill="#3B82F6">Pinoy</tspan></text>`;
  svg += svgText(540, 206, 'PULSE ANALYSIS', { size: 28, weight: '700', color: 'rgba(255,255,255,0.80)', letterSpacing: 7 });
  const timeLabel = getTimeSlotLabel(timeSlot);
  svg += svgText(540, 255, `${timeLabel} - ${dateStr}`, { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

  // === 2D SECTION ===
  svg += svgText(540, 370, '2D EZ2 LOTTO', { size: 40, weight: '800', color: 'white' });

  // 2D Last Draw Circles (Blueprint style: radius 58, emoji 46px above)
  const d2Nums = d2.lastDraw;
  const d2R = 58;
  const d2BallSize = d2R * 2;
  const d2Spacing = 154;
  const d2TotalW = Math.max(1, d2Nums.length - 1) * d2Spacing + d2BallSize;
  const d2StartX = Math.round((W - d2TotalW) / 2);
  const d2CircleTop = 420;
  const d2EmojiOffX = 13;
  const d2EmojiOffY = -64;
  const d2EmojiSize = 46;

  for (let i = 0; i < d2Nums.length; i++) {
    const cx = d2StartX + d2R + i * d2Spacing;
    const cy = d2CircleTop + d2R;
    svg += svgCircle(cx, cy, d2R, 'rgba(220, 38, 38, 0.60)', 'rgba(255,255,255,0.20)', 4);
    svg += svgText(cx, cy + 12, String(d2Nums[i]).padStart(2, '0'), { size: 35, weight: '700', color: 'white' });
        const d2Cat = d2.numberCategories[d2Nums[i]] || 'warm';
    svg += svgImage(cx + d2EmojiOffX, cy + d2EmojiOffY, d2EmojiSize, d2EmojiSize, getCategoryEmojiHref(d2Cat));
  }

  // 2D Patterns (Analysis style: tip emoji, bold vars)
  const pattern2StartY = 590;
  const pattern2LineHeight = 40;
  for (let i = 0; i < d2.patterns.length; i++) {
    const py = pattern2StartY + i * pattern2LineHeight;
    const insight = d2.patterns[i];
    const boldFill = 'rgba(255, 255, 255, 0.95)';
    const raw = insight.text;
    const parts = raw.split(/(\d+)/);
    let content = '';
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (!isNaN(num) && insight.boldVars.includes(num)) {
        content += `<tspan font-weight="700" fill="${boldFill}">${escapeXml(part)}</tspan>`;
      } else if (part) {
        content += escapeXml(part);
      }
    }
    svg += svgImage(90, py - 22, 26, 26, getTipEmojiBase64());
    svg += `<text x="130" y="${py}" font-family="${FONT}" font-size="24" font-weight="500" fill="rgba(255,255,255,0.70)" text-anchor="start">${content}</text>`;
  }


  // === 3D SECTION ===
  svg += svgText(540, 770, '3D SWERTRES LOTTO', { size: 40, weight: '800', color: 'white' });

  // 3D Last Draw Circles (Blueprint style: radius 58, emoji 46px above)
  const d3Nums = d3.lastDraw;
  const d3R = 58;
  const d3BallSize = d3R * 2;
  const d3Spacing = 154;
  const d3TotalW = Math.max(1, d3Nums.length - 1) * d3Spacing + d3BallSize;
  const d3StartX = Math.round((W - d3TotalW) / 2);
  const d3CircleTop = 815;
  const d3EmojiOffX = 13;
  const d3EmojiOffY = -64;
  const d3EmojiSize = 46;

  for (let i = 0; i < d3Nums.length; i++) {
    const cx = d3StartX + d3R + i * d3Spacing;
    const cy = d3CircleTop + d3R;
    svg += svgCircle(cx, cy, d3R, 'rgba(147, 51, 234, 0.60)', 'rgba(255,255,255,0.20)', 4);
    svg += svgText(cx, cy + 12, String(d3Nums[i]).padStart(2, '0'), { size: 35, weight: '700', color: 'white' });
    const d3Cat = d3.numberCategories[d3Nums[i]] || 'warm';
    svg += svgImage(cx + d3EmojiOffX, cy + d3EmojiOffY, d3EmojiSize, d3EmojiSize, getCategoryEmojiHref(d3Cat));
  }

  // 3D Patterns (Analysis style: tip emoji, bold vars)
  const pattern3StartY = 990;
  const pattern3LineHeight = 40;
  for (let i = 0; i < d3.patterns.length; i++) {
    const py = pattern3StartY + i * pattern3LineHeight;
    const insight = d3.patterns[i];
    const boldFill = 'rgba(255, 255, 255, 0.95)';
    const raw = insight.text;
    const parts = raw.split(/(\d+)/);
    let content = '';
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (!isNaN(num) && insight.boldVars.includes(num)) {
        content += `<tspan font-weight="700" fill="${boldFill}">${escapeXml(part)}</tspan>`;
      } else if (part) {
        content += escapeXml(part);
      }
    }
    svg += svgImage(90, py - 22, 26, 26, getTipEmojiBase64());
    svg += `<text x="130" y="${py}" font-family="${FONT}" font-size="24" font-weight="500" fill="rgba(255,255,255,0.70)" text-anchor="start">${content}</text>`;
  }

  // === FOOTER (same as all banners) ===
  svg += svgText(540, 1186, '18+ only. For info/educational use. Not affiliated with PCSO;', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1214, 'Lottong Pinoy does not facilitate betting. Always verify results', {
    size: 22, weight: '500', color: 'rgba(255,255,255,0.50)', letterSpacing: 1.32,
  });
  svg += svgText(540, 1286, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

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
  return sharp(Buffer.from(svg)).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
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
  return sharp(Buffer.from(svg)).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
}

/**
 * Resolve a (possibly suffixed) game name to a canonical game code.
 * Handles both preprocessed data (game = "2D") and raw data (game = "2D Lotto 2PM").
 */
function resolveGameCode(gameName: string): string {
  // Digit games: strip suffix (e.g. "2D Lotto 2PM" → "2D")
  if (gameName.startsWith('2D')) return '2D';
  if (gameName.startsWith('3D')) return '3D';
  // Major games: try exact match first (already preprocessed)
  if (DAILY_GAME_LABELS[gameName]) return gameName;
  // Try to find a known game code within the name (e.g. "6/58" in "Ultra Lotto 6/58")
  for (const code of Object.keys(DAILY_GAME_LABELS)) {
    if (code !== '2D' && code !== '3D' && gameName.includes(code)) return code;
  }
  return gameName;
}

/**
 * Render a Daily Winners banner to a PNG Buffer.
 *
 * Dynamic approach: iterates all draws, classifies each entry by
 * startsWith('2D') / startsWith('3D') for digit games, everything
 * else is a major game. No hardcoded game lists — resilient to
 * suffixed game names like "2D Lotto 2PM".
 */
export async function renderDailyWinnersToBuffer(
  dateStr: string,
  draws: LottoResult[],
): Promise<Buffer> {
  const majorDraws: DailyDrawEntry[] = [];
  const dailyDraws: DailyDrawEntry[] = [];

  for (const draw of draws) {
    const gameCode = resolveGameCode(draw.game);
    const nums = parseCombination(draw.combination);
    if (nums.length === 0) continue;

    const entry: DailyDrawEntry = {
      game: gameCode,
      gameLabel: DAILY_GAME_LABELS[gameCode] || draw.game,
      numbers: nums,
    };

    if (gameCode === '2D' || gameCode === '3D') {
      // Digit game — assign time slot based on position (0=2PM, 1=5PM, 2=9PM)
      const existingForGame = dailyDraws.filter(d => d.game === gameCode);
      entry.timeSlot = DAILY_DRAW_TIME_SLOTS[Math.min(existingForGame.length, 2)];
      dailyDraws.push(entry);
    } else {
      // Major game
      majorDraws.push(entry);
    }
  }

  const svg = buildDailyWinnersSVG(dateStr, majorDraws, dailyDraws);
  return sharp(Buffer.from(svg)).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
}

/**
 * Render a PULSE banner (2D + 3D analysis) to a PNG Buffer.
 */

export async function renderPulseToBuffer(
  timeSlot: '2PM' | '5PM' | '9PM',
  dateStr: string,
  pulseData: PulseData,
): Promise<Buffer> {
  const svg = buildPulseSVG(timeSlot, dateStr, pulseData);
  return sharp(Buffer.from(svg)).resize(1080, 1350, { fit: 'fill' }).png().toBuffer();
}