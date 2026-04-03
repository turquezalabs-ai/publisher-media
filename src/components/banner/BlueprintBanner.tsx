import React from 'react';
import BannerHeader from './BannerHeader';
import BannerFooter from './BannerFooter';
import { GAME_NAMES, GAME_COLORS_HEX } from '@/lib/banner/config';
import type { BlueprintNumber } from '@/lib/banner/types';

interface BlueprintBannerProps {
  game: string;            // e.g. '6/58'
  date?: string;           // intentionally ignored — no timestamp on blueprint
  numbers: BlueprintNumber[];  // Array of 20 numbers with category + emoji
}

const BlueprintBanner: React.FC<BlueprintBannerProps> = ({
  game,
  numbers,
}) => {
  const gameName = GAME_NAMES[game] || game;
  const circleColor = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';

  // Exact Figma HTML positions
  const circleSize = 116;
  const colLefts = [201, 335, 469, 603, 737];
  const rowTops = [542, 685, 828, 971];

  return (
    <div
      id="blueprint-banner"
      style={{
        width: 1080,
        height: 1350,
        position: 'relative',
        background: '#111E44',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* Header — no date passed */}
      <BannerHeader
        subtitle="DATA-DRIVEN COMBINATIONS"
        label="WEEKLY BLUEPRINT"
      />

      {/* Game Name — centered between label bottom (~275) and legend top (422) */}
      <div style={{
        width: 1080,
        height: 50,
        left: 0,
        top: 326,
        position: 'absolute',
        textAlign: 'center',
        color: 'white',
        fontSize: 38,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 800,
        letterSpacing: 2,
      }}>
        {gameName}
      </div>

      {/* Legend — at Figma position top:422 */}
      <div style={{
        position: 'absolute',
        top: 422,
        left: 0,
        width: 1080,
        display: 'flex',
        justifyContent: 'center',
        gap: 90,
      }}>
        {/* HOT */}
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <span style={{
            color: 'white',
            fontSize: 20,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            lineHeight: '24px',
            letterSpacing: 1,
          }}>
            🔥 HOT
          </span>
          <span style={{
            color: 'rgba(255, 255, 255, 0.50)',
            fontSize: 16,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 500,
            lineHeight: '20px',
            letterSpacing: 0.80,
          }}>
            (High occurrence)
          </span>
        </div>

        {/* WARM */}
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <span style={{
            color: 'white',
            fontSize: 20,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            lineHeight: '24px',
            letterSpacing: 1,
          }}>
            🌡️ WARM
          </span>
          <span style={{
            color: 'rgba(255, 255, 255, 0.50)',
            fontSize: 16,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 500,
            lineHeight: '20px',
            letterSpacing: 0.80,
          }}>
            (Avg. occurrence)
          </span>
        </div>

        {/* COLD */}
        <div style={{
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <span style={{
            color: 'white',
            fontSize: 20,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 600,
            lineHeight: '24px',
            letterSpacing: 1,
          }}>
            ❄️ COLD
          </span>
          <span style={{
            color: 'rgba(255, 255, 255, 0.50)',
            fontSize: 16,
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 500,
            lineHeight: '20px',
            letterSpacing: 0.80,
          }}>
            (Low Occurrence)
          </span>
        </div>
      </div>

      {/* 5x4 Number Grid — exact Figma positions */}
      {numbers.map((item, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        const left = colLefts[col];
        const top = rowTops[row];

        return (
          <React.Fragment key={index}>
            {/* Circle */}
            <div style={{
              width: circleSize,
              height: circleSize,
              left: left,
              top: top,
              position: 'absolute',
              background: circleColor,
              borderRadius: 9999,
              border: '4px solid rgba(255, 255, 255, 0.20)',
            }} />
            {/* Number inside circle — vertically centered */}
            <div style={{
              width: 104,
              height: circleSize,
              left: left + 6,
              top: top,
              position: 'absolute',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: 'white',
              fontSize: 35,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              lineHeight: '20px',
              letterSpacing: 1.75,
            }}>
              {String(item.number).padStart(2, '0')}
            </div>
            {/* Emoji icon at top-right of circle */}
            <div style={{
              left: left + 70,
              top: top - 8,
              position: 'absolute',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              fontSize: 42,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              lineHeight: '30px',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}>
              {item.emoji}
            </div>
          </React.Fragment>
        );
      })}

      {/* Footer */}
      <BannerFooter />
    </div>
  );
};

export default BlueprintBanner;
