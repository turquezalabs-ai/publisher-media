import React from 'react';

interface BannerFooterProps {
  website?: string;
  disclaimer?: string;
}

const BannerFooter: React.FC<BannerFooterProps> = ({
  website = 'lottong-pinoy.com',
  disclaimer = '18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.',
}) => {
  return (
    <>
      {/* Disclaimer */}
      <div style={{
        width: 952,
        left: 64,
        top: 1169,
        position: 'absolute',
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.60)',
        fontSize: 22,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 500,
        letterSpacing: 1.32,
        lineHeight: 1.4,
      }}>
        {disclaimer}
      </div>

      {/* Website URL */}
      <div style={{
        width: 1080,
        height: 46,
        left: 0,
        top: 1240,
        position: 'absolute',
        textAlign: 'center',
        color: 'white',
        fontSize: 28,
        fontFamily: 'Montserrat, sans-serif',
        fontWeight: 700,
      }}>
        {website}
      </div>
    </>
  );
};

export default BannerFooter;
