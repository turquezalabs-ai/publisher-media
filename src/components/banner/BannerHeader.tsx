import React from 'react';

interface BannerHeaderProps {
  game?: string;
  gameName?: string;
  date?: string;         // e.g. 'Tuesday, March 24, 2026' — omit or empty to hide
  subtitle?: string;     // e.g. 'DATA-DRIVEN COMBINATIONS' or 'DRAW ANALYSIS'
  label?: string;        // The line below subtitle, e.g. 'WEEKLY BLUEPRINT'
}

const BannerHeader: React.FC<BannerHeaderProps> = ({
  date = '',
  subtitle = 'DATA-DRIVEN COMBINATIONS',
  label = 'WEEKLY BLUEPRINT',
}) => {
  const showDate = date && date.trim().length > 0;

  return (
    <>
      {/* Logo left — 136x136 circle */}
      <div style={{
        width: 136,
        height: 136,
        left: 64,
        top: 64,
        position: 'absolute',
        borderRadius: 9999,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.10)',
      }}>
        <img
          src="/banner-assets/logo.png"
          alt="Lottong Pinoy"
          style={{
            width: 136,
            height: 136,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* QR right — 136x136 rounded */}
      <div style={{
        width: 136,
        height: 136,
        left: 880,
        top: 64,
        position: 'absolute',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.90)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <img
          src="/banner-assets/qrcode.png"
          alt="Scan QR"
          style={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            display: 'block',
          }}
        />
      </div>

      {/* Brand Title */}
      <div style={{
        width: 682,
        height: 83,
        left: 199,
        top: 90,
        position: 'absolute',
        textAlign: 'center',
      }}>
        <span style={{
          color: 'white',
          fontSize: 68,
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
        }}>Lottong</span>
        <span style={{
          color: '#3B82F6',
          fontSize: 68,
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 800,
        }}> Pinoy</span>
      </div>

      {/* Subtitle */}
      <div style={{
        width: 672,
        left: 209,
        top: 192,
        position: 'absolute',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.40)',
        fontSize: 22,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 700,
        letterSpacing: 3.25,
      }}>
        {subtitle}
      </div>

      {/* Date line — only shown when date is provided */}
      {showDate && (
        <div style={{
          width: 1080,
          left: 0,
          top: 228,
          position: 'absolute',
          textAlign: 'center',
          color: 'white',
          fontSize: 22,
          fontFamily: 'Montserrat, sans-serif',
          fontWeight: 600,
          letterSpacing: 2.80,
        }}>
          {date}
        </div>
      )}

      {/* Label / e.g. "WEEKLY BLUEPRINT" — tracking-wide */}
      <div style={{
        width: 1080,
        left: 0,
        top: showDate ? 265 : 225,
        position: 'absolute',
        textAlign: 'center',
        color: 'white',
        fontSize: 44,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 800,
        letterSpacing: 8,
      }}>
        {label}
      </div>
    </>
  );
};

export default BannerHeader;
