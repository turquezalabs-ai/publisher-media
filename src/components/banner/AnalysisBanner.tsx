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

  const patternStatements = generateHumanPatternStatements(
    winningNumbers,
    gameData,
    draw,
    previousDraw,
  );

  // ---- POSITIONING CONSTANTS ----
  const ballSize = 113;
  const ballBorder = 6;
  const ballFont = 44;
  const ballSpacing = 137; 
  const numBalls = winningNumbers.length;
  const totalBallWidth = (numBalls - 1) * ballSpacing + ballSize;
  const ballStartX = Math.round((1080 - totalBallWidth) / 2);
  const ballLefts = Array.from({ length: numBalls }, (_, i) => ballStartX + i * ballSpacing);
  const ballTop = 397;

  const behaviorTitleTop = 555;
  const microCircleSize = 76;

  /**
   * RECOMPUTED MATH FOR 20PX CENTER GAP:
   * Left Column Circle: Starts at 40px
   * Left Column Text: Starts at 140px, Width 390px (Ends at 530px)
   * --- 20px GAP ---
   * Right Column Circle: Starts at 550px (530 + 20)
   * Right Column Text: Starts at 650px (550 + 100)
   */
  const microCircleLeft = [130, 550];
  const microTextLeft = [230, 650];
  
  const microRowStart = 591;
  const microRowGap = 102; 
  const numMicroRows = Math.ceil(microData.length / 2);

  const lastMicroBottom = microRowStart + (numMicroRows - 1) * microRowGap + microCircleSize;
  const patternTitleTop = lastMicroBottom + 45;

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
      <div style={{ width: 136, height: 136, left: 64, top: 64, position: 'absolute', borderRadius: 9999, overflow: 'hidden', background: 'rgba(255,255,255,0.10)' }}>
        <img src="/banner-assets/logo.png" alt="Logo" style={{ width: 136, height: 136, objectFit: 'cover' }} />
      </div>
      <div style={{ width: 136, height: 136, left: 880, top: 64, position: 'absolute', borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,0.90)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src="/banner-assets/qrcode.png" alt="QR" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      </div>
      <div style={{ width: 682, height: 83, left: 199, top: 90, position: 'absolute', textAlign: 'center' }}>
        <span style={{ color: 'white', fontSize: 68, fontWeight: 800 }}>Lottong</span>
        <span style={{ color: '#3B82F6', fontSize: 68, fontWeight: 800 }}> Pinoy</span>
      </div>
      <div style={{ width: 672, left: 209, top: 186, position: 'absolute', textAlign: 'center', color: 'rgba(255, 255, 255, 0.80)', fontSize: 22, fontWeight: 700, letterSpacing: 5 }}>DRAW ANALYSIS</div>
      <div style={{ width: 1080, left: 0, top: 220, position: 'absolute', textAlign: 'center', color: 'white', fontSize: 20, fontWeight: 600, letterSpacing: 2 }}>{date}</div>

      <div style={{ width: 1080, left: 0, top: 280, position: 'absolute', textAlign: 'center', color: 'white', fontSize: 40, fontWeight: 800 }}>{gameName}</div>

      {/* ===== WINNING BALLS ===== */}
      {winningNumbers.map((num, i) => (
        <React.Fragment key={`ball-${i}`}>
          <div style={{ width: ballSize, height: ballSize, left: ballLefts[i], top: ballTop - 30, position: 'absolute', background: circleColor, borderRadius: 9999, border: `${ballBorder}px solid rgba(255, 255, 255, 0.20)` }} />
          <div style={{ width: ballSize, height: ballSize, left: ballLefts[i], top: ballTop - 30, position: 'absolute', textAlign: 'center', alignItems: 'center', justifyContent: 'center', display: 'flex', color: 'white', fontSize: ballFont, fontWeight: 700, letterSpacing: 3 }}>
            {displayNum(num)}
          </div>
        </React.Fragment>
      ))}

      {/* ===== BEHAVIOR TITLE ===== */}
      <div style={{ width: 1080, left: 0, top: behaviorTitleTop - 28, position: 'absolute', textAlign: 'center', color: 'white', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
        Individual behavior of each number
      </div>

      {/* ===== MICRO GRID (20px Center Padding) ===== */}
      {microData.map((item, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const circleTop = microRowStart + row * microRowGap;
        return (
          <React.Fragment key={`micro-${i}`}>
            <div style={{ width: microCircleSize, height: microCircleSize, left: microCircleLeft[col], top: circleTop, position: 'absolute', background: col === 0 ? microCircleColor : microCircleColorAlt, borderRadius: 9999, border: '3px solid rgba(255, 255, 255, 0.20)' }} />
            <div style={{ width: microCircleSize, height: microCircleSize, left: microCircleLeft[col], top: circleTop, position: 'absolute', textAlign: 'center', alignItems: 'center', justifyContent: 'center', display: 'flex', color: 'white', fontSize: 28, fontWeight: 700 }}>
              {displayNum(item.number)}
            </div>
            <div style={{ width: 390, height: microCircleSize, left: microTextLeft[col], top: circleTop, position: 'absolute', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: 20, fontWeight: 600, lineHeight: '28px' }}>
                {item.emoji} {item.category.toUpperCase()}{' '}
                <span style={{ color: 'rgba(255, 255, 255, 0.50)', fontWeight: 500, fontSize: 18 }}>{item.description}</span>
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.70)', fontSize: 17 }}>
                Last seen <span style={{ fontWeight: 600, color: 'white' }}>{item.lastSeen}</span>
              </span>
            </div>
          </React.Fragment>
        );
      })}

      {/* ===== PATTERNS AND CONNECTIONS ===== */}
      <div style={{ width: 1080, left: 0, top: patternTitleTop, position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ color: 'white', fontSize: 26, fontWeight: 700, lineHeight: '32px', letterSpacing: 1, marginBottom: 20 }}>
          Patterns and Connections
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 15, width: 940 }}>
          {patternStatements.map((statement, i) => (
            <div key={`pattern-${i}`} style={{ textAlign: 'center', lineHeight: '32px', fontSize: 24, fontWeight: 400, color: 'white' }}>
              <span dangerouslySetInnerHTML={{ __html: `💡&nbsp;&nbsp;${statement}` }} />
            </div>
          ))}
        </div>
      </div>

      <BannerFooter />
    </div>
  );
};

export default AnalysisBanner;