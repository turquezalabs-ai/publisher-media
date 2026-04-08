import { buildPulseSVG } from './src/lib/banner/server-render';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function main() {
  console.log('Building PULSE SVG with sample data...');

  const pulseData = {
    "2d": {
      lastDraw: [27, 12],
      patterns: [
        { emoji: "\uD83D\uDD25", text: "27 appeared 3 times in last 7 draws", boldVars: ["27"] },
        { emoji: "\uD83D\uDCCA", text: "Sum range 25-45 is trending", boldVars: [] },
        { emoji: "\uD83D\uDD04", text: "12 repeated from previous draw", boldVars: ["12"] }
      ],
      hotNumbers: [27, 12, 5, 18, 31]
    },
    "3d": {
      lastDraw: [0, 5, 4],
      patterns: [
        { emoji: "\uD83D\uDD25", text: "0 appeared 4 times in last 7 draws", boldVars: ["0"] },
        { emoji: "\uD83D\uDD04", text: "5 and 4 repeated from previous draw", boldVars: ["5", "4"] },
        { emoji: "\uD83D\uDCCA", text: "Consecutive pair 4-5 detected", boldVars: ["4", "5"] }
      ],
      hotNumbers: [0, 5, 4, 8, 3]
    }
  };

  const timeSlot = '2PM';
    const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const svgContent = buildPulseSVG(timeSlot, dateStr, pulseData);

  const svgPath = path.join(process.cwd(), 'pulse-output.svg');
  fs.writeFileSync(svgPath, svgContent);
  console.log('SVG saved to:', svgPath);

  const pngBuffer = await sharp(Buffer.from(svgContent))
    .png()
    .toBuffer();

  const pngPath = path.join(process.cwd(), 'pulse-output.png');
  fs.writeFileSync(pngPath, pngBuffer);
  console.log('PNG saved to:', pngPath);

  console.log('Done! Open pulse-output.png to see your banner.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});