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
// DAILY WINNERS BANNER SVG
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

function buildDailyWinnersSVG(
  dateStr: string,
  majorDraws: DailyDrawEntry[],
  dailyDraws: DailyDrawEntry[],
): string {
  const W = 1080;
  const H = 1350;

  const logoB64 = getLogoBase64();
  const qrB64 = getQRBase64();

  // ---- HEADER (matches BannerHeader component exactly) ----
  // Logo: 136x136 circle at (64, 64) → center (132, 132)
  // Brand: "Lottong" white + " Pinoy" blue, size 68, centered at top ~90-173
  // Subtitle: size 22, at top 186
  // Date: size 22, at top 220
  // Label: size 44, at top 265 (when date shown)
  // QR: 136x136 rounded rect at (880, 64)
  const headerBottom = 300; // below the label

  // ---- FOOTER (matches BannerFooter component exactly) ----
  // Disclaimer: at top 1169, size 22
  // Website: at top 1240, size 28
  const footerTop = 1150; // above disclaimer

  // ---- CONTENT AREA ----
  const contentTop = headerBottom + 10;
  const contentBottom = footerTop - 10;
  const availableHeight = contentBottom - contentTop;

  // ---- DYNAMIC MAJOR GAMES SIZING ----
  const majorCount = majorDraws.length;
  const majorSectionLabelH = 44;
  let majorRowH: number;
  let majorRowGap: number;

  if (majorCount <= 3) {
    majorRowH = 88;
    majorRowGap = 10;
  } else if (majorCount <= 5) {
    majorRowH = 78;
    majorRowGap = 8;
  } else {
    majorRowH = 68;
    majorRowGap = 6;
  }

  const majorTotalH = majorSectionLabelH + majorCount * majorRowH + (majorCount - 1) * majorRowGap;

  // ---- SEPARATOR ----
  const separatorH = 36; // includes line + padding

  // ---- DAILY DRAWS SIZING ----
  const dailySectionLabelH = 44;
  const dailySlotH = 76;
  const dailySlotGap = 8;
  const dailySlots = 3;
  const dailyTotalH = dailySectionLabelH + dailySlots * dailySlotH + (dailySlots - 1) * dailySlotGap;

  // ---- VERTICAL CENTERING ----
  const totalContentH = majorTotalH + separatorH + dailyTotalH;
  const startY = contentTop + Math.max(0, (availableHeight - totalContentH) / 2);

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  // Add defs for clipping
  svg += `<defs>`;
  svg += `<clipPath id="logo-clip"><circle cx="132" cy="132" r="68" /></clipPath>`;
  svg += `<clipPath id="qr-clip"><rect x="880" y="64" width="136" height="136" rx="12" /></clipPath>`;
  svg += `</defs>`;

  // ---- BACKGROUND ----
  svg += svgRect(0, 0, W, H, '#111E44');

  // ---- HEADER ----
  // Logo (circular, with real image)
  svg += `<circle cx="132" cy="132" r="68" fill="rgba(255,255,255,0.10)" />`;
  svg += `<image x="64" y="64" width="136" height="136" href="data:image/png;base64,${logoB64}" clip-path="url(#logo-clip)" preserveAspectRatio="xMidYMid slice" />`;

  // QR Code (rounded rect, with real image)
  svg += `<rect x="880" y="64" width="136" height="136" rx="12" fill="rgba(255,255,255,0.90)" />`;
  svg += `<image x="892" y="76" width="112" height="112" href="data:image/png;base64,${qrB64}" clip-path="url(#qr-clip)" preserveAspectRatio="xMidYMid slice" />`;

  // Brand Title: "Lottong" (white) + " Pinoy" (blue)
  svg += `<text x="420" y="158" text-anchor="middle" font-family="${FONT}" font-size="68" font-weight="800" fill="white">Lottong</text>`;
  svg += `<text x="612" y="158" text-anchor="start" font-family="${FONT}" font-size="68" font-weight="800" fill="#3B82F6"> Pinoy</text>`;

  // Subtitle: "LOTTO DRAW RESULTS"
  svg += svgText(540, 210, 'LOTTO DRAW RESULTS', { size: 22, weight: '700', color: 'rgba(255,255,255,0.40)', letterSpacing: 3.25 });

  // Date
  svg += svgText(540, 244, dateStr, { size: 22, weight: '600', color: 'white', letterSpacing: 2.80 });

  // Label: "DAILY WINNERS"
  svg += svgText(540, 286, 'DAILY WINNERS', { size: 44, weight: '800', color: 'white', letterSpacing: 3 });

  // ---- THIN SEPARATOR LINE under header ----
  svg += `<line x1="64" y1="308" x2="1016" y2="308" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;

  // ---- MAJOR GAMES SECTION ----
  let curY = startY;

  // Section header
  svg += svgText(64, curY + 18, 'MAJOR GAMES', { size: 22, weight: '700', color: '#93C5FD', letterSpacing: 3, anchor: 'start' });

  // Thin underline
  svg += `<line x1="64" y1="${curY + 30}" x2="1016" y2="${curY + 30}" stroke="rgba(147,197,253,0.25)" stroke-width="1" />`;
  curY += majorSectionLabelH;

  for (let i = 0; i < majorDraws.length; i++) {
    const entry = majorDraws[i];
    const nums = entry.numbers;
    const rowCY = curY + majorRowH / 2;

    // Game name — left aligned
    svg += svgText(80, rowCY + 6, entry.gameLabel, { size: 28, weight: '700', color: 'white', anchor: 'start', letterSpacing: 1.5 });

    // Number circles — right side
    const ballR = Math.min(32, majorRowH / 2 - 6);
    const ballSpacing = ballR * 2 + 12;
    const totalBallW = (nums.length - 1) * ballSpacing + ballR * 2;
    // Right-align balls: end at x=1016
    const ballsEndX = 1016;
    const ballsStartX = ballsEndX - totalBallW;

    const fillColor = getCircleFill(entry.game, 0.6);
    for (let j = 0; j < nums.length; j++) {
      const cx = ballsStartX + ballR + j * ballSpacing;
      svg += svgCircle(cx, rowCY, ballR, fillColor, 'rgba(255,255,255,0.20)', 3);
      const numStr = nums[j] >= 10 ? String(nums[j]) : String(nums[j]).padStart(2, '0');
      svg += svgText(cx, rowCY + 10, numStr, { size: Math.min(28, ballR - 4), weight: '700', color: 'white' });
    }

    // Thin row separator (except last)
    if (i < majorDraws.length - 1) {
      const sepY = curY + majorRowH + majorRowGap / 2;
      svg += `<line x1="80" y1="${sepY}" x2="1016" y2="${sepY}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`;
    }

    curY += majorRowH + majorRowGap;
  }

  // ---- SEPARATOR between Major and Daily ----
  curY += 8;
  svg += `<line x1="64" y1="${curY}" x2="1016" y2="${curY}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;
  curY += separatorH - 8;

  // ---- DAILY DRAWS SECTION ----
  // Section header
  svg += svgText(64, curY + 18, 'DAILY DRAWS', { size: 22, weight: '700', color: '#93C5FD', letterSpacing: 3, anchor: 'start' });
  svg += `<line x1="64" y1="${curY + 30}" x2="1016" y2="${curY + 30}" stroke="rgba(147,197,253,0.25)" stroke-width="1" />`;
  curY += dailySectionLabelH;

  // Separate 2D and 3D entries
  const daily2D = dailyDraws.filter(d => d.game === '2D');
  const daily3D = dailyDraws.filter(d => d.game === '3D');

  // Column positions
  const leftColCenter = 300;   // 2D center area
  const rightColCenter = 780;  // 3D center area
  const dividerX = 540;        // vertical divider

  for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
    const slotY = curY + slotIdx * (dailySlotH + dailySlotGap);
    const slotLabel = DAILY_DRAW_TIME_SLOTS[slotIdx];
    const slotCY = slotY + dailySlotH / 2;

    // Time slot label
    svg += svgText(dividerX - 16, slotCY - 12, slotLabel, { size: 20, weight: '700', color: 'rgba(255,255,255,0.50)', anchor: 'end', letterSpacing: 2 });

    // ---- 2D (left side) ----
    // Game label
    svg += svgText(leftColCenter, slotCY - 20, '2D EZ2', { size: 18, weight: '600', color: 'rgba(255,255,255,0.50)', letterSpacing: 2 });
    if (daily2D[slotIdx]) {
      const nums2d = daily2D[slotIdx].numbers;
      const r2d = 30;
      const sp2d = r2d * 2 + 14;
      const totalW2d = (Math.min(nums2d.length, 2) - 1) * sp2d + r2d * 2;
      const startX2d = leftColCenter - totalW2d / 2 + r2d;

      for (let j = 0; j < Math.min(nums2d.length, 2); j++) {
        const cx = startX2d + j * sp2d;
        const cy = slotCY + 12;
        svg += svgCircle(cx, cy, r2d, getCircleFill('2D', 0.6), 'rgba(255,255,255,0.20)', 3);
        const numStr = nums2d[j] >= 10 ? String(nums2d[j]) : String(nums2d[j]).padStart(2, '0');
        svg += svgText(cx, cy + 9, numStr, { size: 26, weight: '700', color: 'white' });
      }
    } else {
      svg += svgText(leftColCenter, slotCY + 14, '—', { size: 24, weight: '400', color: 'rgba(255,255,255,0.20)' });
    }

    // ---- 3D (right side) ----
    svg += svgText(rightColCenter, slotCY - 20, '3D Swertres', { size: 18, weight: '600', color: 'rgba(255,255,255,0.50)', letterSpacing: 2 });
    if (daily3D[slotIdx]) {
      const nums3d = daily3D[slotIdx].numbers;
      const r3d = 30;
      const sp3d = r3d * 2 + 14;
      const totalW3d = (Math.min(nums3d.length, 3) - 1) * sp3d + r3d * 2;
      const startX3d = rightColCenter - totalW3d / 2 + r3d;

      for (let j = 0; j < Math.min(nums3d.length, 3); j++) {
        const cx = startX3d + j * sp3d;
        const cy = slotCY + 12;
        svg += svgCircle(cx, cy, r3d, getCircleFill('3D', 0.6), 'rgba(255,255,255,0.20)', 3);
        const numStr = nums3d[j] >= 10 ? String(nums3d[j]) : String(nums3d[j]).padStart(2, '0');
        svg += svgText(cx, cy + 9, numStr, { size: 26, weight: '700', color: 'white' });
      }
    } else {
      svg += svgText(rightColCenter, slotCY + 14, '—', { size: 24, weight: '400', color: 'rgba(255,255,255,0.20)' });
    }

    // Vertical divider between 2D and 3D (subtle)
    if (slotIdx < 2) {
      const sepY = slotY + dailySlotH + dailySlotGap / 2;
      svg += `<line x1="80" y1="${sepY}" x2="1016" y2="${sepY}" stroke="rgba(255,255,255,0.06)" stroke-width="1" />`;
    }
  }

  // Vertical divider between 2D and 3D columns
  const dailySectionTop = startY + majorTotalH + separatorH;
  const dailySectionBot = dailySectionTop + dailyTotalH;
  svg += `<line x1="${dividerX}" y1="${dailySectionTop}" x2="${dividerX}" y2="${dailySectionBot}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />`;

  // ---- THIN SEPARATOR LINE above footer ----
  svg += `<line x1="64" y1="${footerTop - 10}" x2="1016" y2="${footerTop - 10}" stroke="rgba(255,255,255,0.12)" stroke-width="1" />`;

  // ---- FOOTER (anchored at bottom, matches BannerFooter exactly) ----
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
