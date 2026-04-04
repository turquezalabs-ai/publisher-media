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

  // Layout constants
  const headerHeight = 310; // top area (brand + date)
  const footerHeight = 170; // bottom area (disclaimer + website)
  const contentTop = headerHeight;
  const contentBottom = H - footerHeight;
  const availableHeight = contentBottom - contentTop; // ~870px

  // Major games row height: depends on how many
  const majorRowHeight = 90; // each major game row
  const majorGap = 8;
  const majorSectionHeader = 50; // "MAJOR GAMES" label
  const majorTotalHeight = majorSectionHeader + (majorDraws.length * (majorRowHeight + majorGap));

  // Daily games: 2D (2 circles), 3D (3 circles), 3 time slots each
  const dailySectionHeader = 50; // "DAILY DRAWS" label
  const dailyTimeSlotHeight = 80;
  const dailyGap = 8;
  const dailyTotalHeight = dailySectionHeader + (3 * (dailyTimeSlotHeight + dailyGap));

  // Separator between major and daily
  const sectionGap = 30;

  // Total content height
  const totalContentHeight = majorTotalHeight + sectionGap + dailyTotalHeight;

  // Calculate start Y to center content vertically
  const contentStartY = contentTop + Math.max(0, (availableHeight - totalContentHeight) / 2);

  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Background
  svg += svgRect(0, 0, W, H, '#111E44');

  // ---- HEADER ----
  // Logo placeholder
  svg += svgCircle(132, 132, 68, 'rgba(255,255,255,0.10)', 'none', 0);
  svg += svgText(132, 125, 'LP', { size: 42, weight: '800', color: 'white' });

  // QR placeholder
  svg += svgRect(880, 64, 136, 136, 'rgba(255,255,255,0.90)', 12);
  svg += svgText(948, 138, 'QR', { size: 28, weight: '700', color: '#333' });

  // Brand
  svg += svgText(540, 130, 'Lottong Pinoy', { size: 68, weight: '800', color: 'white' });

  // Subtitle
  svg += svgText(540, 181, 'LOTTO DRAW RESULTS', { size: 25, weight: '700', color: 'rgba(255,255,255,0.50)', letterSpacing: 3 });

  // Date
  svg += svgText(540, 230, dateStr, { size: 28, weight: '700', color: 'white', letterSpacing: 2 });

  // ---- MAJOR GAMES ----
  let curY = contentStartY;

  // Section header
  svg += svgText(540, curY + 16, 'MAJOR GAMES', { size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3 });
  curY += majorSectionHeader;

  for (const entry of majorDraws) {
    const nums = entry.numbers;
    const gameName = entry.gameLabel;
    const ballR = 38;
    const ballSpacing = 88;
    const totalBallWidth = (nums.length - 1) * ballSpacing + ballR * 2;
    const ballStartX = W - 80 - totalBallWidth / 2; // right-aligned with padding
    const circleY = curY + majorRowHeight / 2;

    // Game name (left side, right-aligned to a fixed point)
    svg += svgText(300, circleY + 12, gameName, { size: 34, weight: '700', color: 'white', anchor: 'end', letterSpacing: 3 });

    // Number circles (right side)
    const fillColor = getCircleFill(entry.game, 0.6);
    for (let i = 0; i < nums.length; i++) {
      const cx = ballStartX - totalBallWidth / 2 + ballR + i * ballSpacing;
      svg += svgCircle(cx, circleY, ballR, fillColor, 'rgba(255,255,255,0.20)', 4);
      const numStr = nums[i] >= 10 ? String(nums[i]) : String(nums[i]).padStart(2, '0');
      svg += svgText(cx, circleY + 12, numStr, { size: 32, weight: '700', color: 'white' });
    }

    curY += majorRowHeight + majorGap;
  }

  // ---- SEPARATOR ----
  curY += sectionGap - majorGap; // adjust gap
 
  // ---- DAILY DRAWS ----
  // Section header
  svg += svgText(540, curY + 16, 'DAILY DRAWS', { size: 32, weight: '700', color: '#B3D0FF', letterSpacing: 3 });
  curY += dailySectionHeader;

  // 2D section (left half)
  const daily2D = dailyDraws.filter(d => d.game === '2D');
  // 3D section (right half)
  const daily3D = dailyDraws.filter(d => d.game === '3D');

  for (let slotIdx = 0; slotIdx < 3; slotIdx++) {
    const slotY = curY + slotIdx * (dailyTimeSlotHeight + dailyGap);
    const slotLabel = DAILY_DRAW_TIME_SLOTS[slotIdx];

    // Time slot labels
    svg += svgText(350, slotY + 24, slotLabel, { size: 26, weight: '700', color: 'white', anchor: 'end', letterSpacing: 3 });
    svg += svgText(750, slotY + 24, slotLabel, { size: 26, weight: '700', color: 'white', anchor: 'end', letterSpacing: 3 });

    // Game labels (above circles)
    svg += svgText(350, slotY + 2, '2D EZ2 Lotto', { size: 30, weight: '700', color: 'white', anchor: 'end', letterSpacing: 3 });
    svg += svgText(750, slotY + 2, '3D Swertres', { size: 30, weight: '700', color: 'white', anchor: 'end', letterSpacing: 3 });

    // 2D circles (2 circles)
    if (daily2D[slotIdx]) {
      const nums2d = daily2D[slotIdx].numbers;
      const r2d = 38;
      const spacing2d = 90;
      const startX2d = 370; // left of center

      // Determine center based on 2 circles
      const centerX2d = startX2d + r2d + spacing2d / 2;
      const actualX2d = 375; // fixed left position

      for (let j = 0; j < nums2d.length && j < 2; j++) {
        const cx = actualX2d + j * spacing2d;
        const cy = slotY + dailyTimeSlotHeight / 2 + 10;
        svg += svgCircle(cx, cy, r2d, getCircleFill('2D', 0.6), 'rgba(255,255,255,0.20)', 4);
        const numStr = nums2d[j] >= 10 ? String(nums2d[j]) : String(nums2d[j]).padStart(2, '0');
        svg += svgText(cx, cy + 12, numStr, { size: 32, weight: '700', color: 'white' });
      }
    } else {
      // No draw for this slot
      svg += svgText(420, slotY + dailyTimeSlotHeight / 2 + 12, 'No Draw', { size: 24, weight: '500', color: 'rgba(255,255,255,0.30)' });
    }

    // 3D circles (3 circles)
    if (daily3D[slotIdx]) {
      const nums3d = daily3D[slotIdx].numbers;
      const r3d = 38;
      const spacing3d = 88;
      const actualX3d = 660;

      for (let j = 0; j < nums3d.length && j < 3; j++) {
        const cx = actualX3d + j * spacing3d;
        const cy = slotY + dailyTimeSlotHeight / 2 + 10;
        svg += svgCircle(cx, cy, r3d, getCircleFill('3D', 0.6), 'rgba(255,255,255,0.20)', 4);
        const numStr = nums3d[j] >= 10 ? String(nums3d[j]) : String(nums3d[j]).padStart(2, '0');
        svg += svgText(cx, cy + 12, numStr, { size: 32, weight: '700', color: 'white' });
      }
    } else {
      svg += svgText(720, slotY + dailyTimeSlotHeight / 2 + 12, 'No Draw', { size: 24, weight: '500', color: 'rgba(255,255,255,0.30)' });
    }
  }

  // ---- FOOTER ----
  // Disclaimer
  svg += svgText(540, H - 170, '18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.', {
    size: 22,
    weight: '500',
    color: 'rgba(255,255,255,0.60)',
    letterSpacing: 1,
  });

  // Website
  svg += svgText(540, H - 110, 'lottong-pinoy.com', { size: 28, weight: '700', color: 'white' });

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
