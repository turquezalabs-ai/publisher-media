import React from 'react';
import { GAME_COLORS_HEX } from '@/lib/banner/config';
import BannerFooter from './BannerFooter';
import type { LottoResult, NumberData } from '@/lib/banner/types';
import {
  parseCombination,
  getLastSeenForNumber,
  formatLastSeen,
  getPreviousDraw,
  generateHumanPatternStatements,
} from '@/lib/banner/analysis';

interface MicroItem {
  number: number;
  category: 'hot' | 'warm' | 'cold';
  emoji: string;
  description: string;
  lastSeen: string;
}

interface AnalysisBannerProps {
  game: string;
  gameName: string;
  date: string;
  draw: LottoResult;
  classifiedNumbers: NumberData[];
  gameData: LottoResult[];
}

const AnalysisBanner: React.FC<AnalysisBannerProps> = ({
  game,
  gameName,
  date,
  draw,
  classifiedNumbers,
  gameData,
}) => {
  const circleColor = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
  const microCircleColor = circleColor.replace('0.60', '0.30');
  const microCircleColorAlt = circleColor.replace('0.60', '0.40');
  const winningNumbers = parseCombination(draw.combination);
  const previousDraw = getPreviousDraw(gameData, game);

  // ---- Build micro grid data ----
  const microData: MicroItem[] = winningNumbers.map((num) => {
    const classified = classifiedNumbers.find(n => n.number === num);
    const drawsAgo = getLastSeenForNumber(gameData, num);
    const lastSeen = formatLastSeen(drawsAgo, gameData);

    let category: 'hot' | 'warm' | 'cold' = classified?.category || 'warm';
    let emoji = classified?.emoji || '🌡️';
    let description = '(Avg. Occurrence)';

    if (category === 'hot') description = '(High Occurrence)';
    else if (category === 'cold') description = '(Low Occurrence)';

    return { number: num, category, emoji, description, lastSeen };
  });

  // ---- Build 3 human-readable pattern statements (HTML with <b> tags) ----
  const patternStatements = generateHumanPatternStatements(
    winningNumbers,
    gameData,
    draw,
    previousDraw,
  );

  // ---- Dynamic ball centering based on count ----
  const ballSize = 113;
  const ballBorder = 6;
  const ballFont = 44;
  const ballSpacing = 137; // center-to-center (matches Figma: 278-141=137)
  const numBalls = winningNumbers.length;
  const totalBallWidth = (numBalls - 1) * ballSpacing + ballSize;
  const ballStartX = Math.round((1080 - totalBallWidth) / 2);
  const ballLefts = Array.from({ length: numBalls }, (_, i) => ballStartX + i * ballSpacing);
  const ballTop = 397;

  // ---- Behavior section ----
  const behaviorTitleTop = 555;
  const microCircleSize = 76;
  const microCircleLeft = [64, 574];
  const microTextLeft = [164, 674];
  const microRowStart = 591;
  const microRowGap = 102; // 76px circle + 26px gap
  const numMicroRows = Math.ceil(microData.length / 2);

  // ---- Patterns section — anchors to bottom of micro grid ----
  const lastMicroBottom = microRowStart + (numMicroRows - 1) * microRowGap + microCircleSize;
  const patternTitleTop = lastMicroBottom + 45;
  const patternStartTop = patternTitleTop + 50;
  const patternLineHeight = 70;

  // ---- Helper: display number without leading zeros ----
  const displayNum = (n: number) => String(n);

  return (
    <div
      id="analysis-banner"
      style={{
        width: 1080,
        height: 1350,
        position: 'relative',
        background: '#111E44',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* ===== HEADER ===== */}
      {/* Logo — uses real image */}
      <div style={{
        width: 136, height: 136, left: 64, top: 64, position: 'absolute',
        borderRadius: 9999, overflow: 'hidden', background: 'rgba(255,255,255,0.10)',
      }}>
        <img
          src="/banner-assets/logo.png"
          alt="Lottong Pinoy"
          style={{ width: 136, height: 136, objectFit: 'cover', display: 'block' }}
        />
      </div>
      {/* QR — uses real image */}
      <div style={{
        width: 136, height: 136, left: 880, top: 64, position: 'absolute',
        borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.90)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img
          src="/banner-assets/qrcode.png"
          alt="Scan QR"
          style={{ width: 120, height: 120, objectFit: 'contain', display: 'block' }}
        />
      </div>
      {/* Brand */}
      <div style={{ width: 682, height: 83, left: 199, top: 90, position: 'absolute', textAlign: 'center' }}>
        <span style={{ color: 'white', fontSize: 68, fontWeight: 800 }}>Lottong</span>
        <span style={{ color: 'black', fontSize: 68, fontWeight: 800 }}> </span>
        <span style={{ color: '#3B82F6', fontSize: 68, fontWeight: 800 }}>Pinoy</span>
      </div>
      {/* Subtitle */}
      <div style={{
        width: 672, left: 209, top: 186, position: 'absolute',
        textAlign: 'center', color: 'rgba(255, 255, 255, 0.80)',
        fontSize: 22, fontWeight: 700, letterSpacing: 5,
      }}>DRAW ANALYSIS</div>
      {/* Date */}
      <div style={{
        width: 1080, left: 0, top: 220, position: 'absolute',
        textAlign: 'center', color: 'white',
        fontSize: 20, fontWeight: 600, letterSpacing: 2,
      }}>{date}</div>

      {/* ===== GAME NAME — moved closer to balls ===== */}
      <div style={{
        width: 1080, left: 0, top: 310, position: 'absolute',
        textAlign: 'center', color: 'white',
        fontSize: 40, fontWeight: 800,
      }}>{gameName}</div>

      {/* ===== WINNING BALLS — 113px, 6px border, 44px font, centered ===== */}
      {winningNumbers.map((num, i) => (
        <React.Fragment key={`ball-${i}`}>
          {/* Circle */}
          <div style={{
            width: ballSize, height: ballSize,
            left: ballLefts[i], top: ballTop,
            position: 'absolute',
            background: circleColor,
            borderRadius: 9999,
            border: `${ballBorder}px solid rgba(255, 255, 255, 0.20)`,
          }} />
          {/* Number — centered in circle, no leading zeros */}
          <div style={{
            width: ballSize,
            height: ballSize,
            left: ballLefts[i], top: ballTop,
            position: 'absolute',
            textAlign: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
            fontSize: ballFont,
            fontWeight: 700,
            letterSpacing: 2,
          }}>
            {displayNum(num)}
          </div>
        </React.Fragment>
      ))}

      {/* ===== INDIVIDUAL BEHAVIOR ===== */}
      <div style={{
        width: 1080, left: 0, top: behaviorTitleTop, position: 'absolute',
        textAlign: 'center', justifyContent: 'center',
        display: 'flex', flexDirection: 'column',
        color: 'white', fontSize: 22, fontWeight: 700,
        lineHeight: '20px', letterSpacing: 1,
      }}>Individual behavior of each number</div>

      {/* ===== MICRO GRID (2 columns x N rows) ===== */}
      {microData.map((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const circleTop = microRowStart + row * microRowGap;

        return (
          <React.Fragment key={`micro-${i}`}>
            {/* Small circle */}
            <div style={{
              width: microCircleSize, height: microCircleSize,
              left: microCircleLeft[col], top: circleTop,
              position: 'absolute',
              background: col === 0 ? microCircleColor : microCircleColorAlt,
              borderRadius: 9999,
              border: '3px solid rgba(255, 255, 255, 0.20)',
            }} />
            {/* Circle number — perfectly centered, no leading zeros */}
            <div style={{
              width: microCircleSize,
              height: microCircleSize,
              left: microCircleLeft[col], top: circleTop,
              position: 'absolute',
              textAlign: 'center',
              alignItems: 'center',
              justifyContent: 'center',
              display: 'flex',
              flexDirection: 'column',
              color: 'white',
              fontSize: 28,
              fontWeight: 700,
              lineHeight: 1,
              letterSpacing: 1,
            }}>
              {displayNum(item.number)}
            </div>
            {/* Text block — same height as circle, vertically centered */}
            <div style={{
              width: 390,
              height: microCircleSize,
              left: microTextLeft[col],
              top: circleTop,
              position: 'absolute',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              {/* Category + description */}
              <span style={{
                color: 'white', fontSize: 20, fontWeight: 600,
                lineHeight: '28px', letterSpacing: 1,
              }}>
                {item.emoji} {item.category.toUpperCase()}{' '}
                <span style={{ color: 'rgba(255, 255, 255, 0.50)', fontWeight: 500, fontSize: 18 }}>
                  {item.description}
                </span>
              </span>
              {/* Last seen */}
              <span style={{
                color: 'rgba(255, 255, 255, 0.70)', fontSize: 17, fontWeight: 400,
                lineHeight: '26px', letterSpacing: 0.80,
              }}>
                Last seen{' '}
                <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.90)' }}>
                  {item.lastSeen}
                </span>
              </span>
            </div>
          </React.Fragment>
        );
      })}

      {/* ===== PATTERNS AND CONNECTIONS — anchors to content above ===== */}
      <div style={{
        width: 1080, left: 0, top: patternTitleTop, position: 'absolute',
        textAlign: 'center', justifyContent: 'center',
        display: 'flex', flexDirection: 'column',
        color: 'white', fontSize: 22, fontWeight: 700,
        lineHeight: '20px', letterSpacing: 1,
      }}>Patterns and Connections</div>

      {/* Pattern items — centered, bigger font for readability, with bold numbers/variables */}
      {patternStatements.map((statement, i) => (
        <div key={`pattern-${i}`} style={{
          width: 940, left: 70, top: patternStartTop + i * patternLineHeight,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          lineHeight: '32px',
          fontSize: 20,
          fontWeight: 400,
          color: 'white',
          letterSpacing: 0.50,
        }}>
          <span dangerouslySetInnerHTML={{ __html: `✅&nbsp;&nbsp;${statement}` }} />
        </div>
      ))}

      {/* ===== FOOTER — standard (matches Blueprint) ===== */}
      <BannerFooter />
    </div>
  );
};

export default AnalysisBanner;
