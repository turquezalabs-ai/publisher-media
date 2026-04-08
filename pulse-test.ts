const { fetchAndProcessData } = require('./src/lib/banner/data-preprocessor');
const { fetchPulseData } = require('./src/lib/banner/pulse-engine');
const { buildPulseSVG } = require('./src/lib/banner/server-render');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('Fetching historical data...');
  const data = await fetchAndProcessData();
  console.log('Historical records:', data.all.length);

  console.log('Generating PULSE for 9PM...');
  const pulse = await fetchPulseData(data.all, '9PM');
  if (!pulse) { console.log('No pulse data'); return; }

  const dateStr = 'Tuesday, April 8, 2026';
  const svg = buildPulseSVG('9PM', dateStr, pulse);
  const svgPath = path.join(__dirname, 'pulse-test.svg');
  fs.writeFileSync(svgPath, svg);
  console.log('DONE! Open pulse-test.svg in browser');
})();