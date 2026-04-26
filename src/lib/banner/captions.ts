import type { LottoResult } from './types';
import { GAME_NAMES } from './config';
import {
  parseCombination,
  calculateFrequency,
  classifyNumbers,
  getLastSeenForNumber,
  getConsecutivePairs,
  getRepeatNumbers,
} from './analysis';

// ==========================================
// GAME-SPECIFIC HASHTAGS (corrected from Excel)
// ==========================================
export const GAME_HASHTAGS: Record<string, string> = {
  '6/58': '#UltraLotto #UltraLotto658 #PCSO #658Lotto #658Analytics #Lotto #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '6/55': '#GrandLotto #GrandLotto655 #PCSO #655Lotto #655Analytics #Lotto #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '6/49': '#SuperLotto #SuperLotto649 #PCSO #649Lotto #649Analytics #Lotto #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '6/45': '#MegaLotto #MegaLotto645 #PCSO #645Lotto #645Analytics #Lotto #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '6/42': '#Lotto #Lotto642 #PCSO #642Lotto #642Analytics #Lotto #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '6D': '#6D #6DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '4D': '#4D #4DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '3D': '#3D #3DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
  '2D': '#2D #2DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataDriven #DataAnalysis #NumberTrends',
};

// ==========================================
// BLUEPRINT CAPTIONS (30-day rotation)
// Each day gets a specific caption template.
// The game and hashtags are determined by the 7-day rotation in config.ts
// ==========================================
const BLUEPRINT_CAPTIONS: string[] = [
  '📊 Your Weekly Data Blueprint is here today! Analyze the [Game] numbers by historical occurrence. Data is power. lottong-pinoy.com',
  '🔥 Focusing on the numbers with HIGH OCCURRENCE today. See which ones made our HOT list this week. Use data, not guesswork. lottong-pinoy.com',
  '📌 Data Profile today: Our analysis shows it has high historical frequency. Add it to your data review. lottong-pinoy.com',
  '⚖️ Data Debate today: What\'s your analytical preference? Team Hot (High occurrence) or Team Cold (Low occurrence)? Comment below! lottong-pinoy.com',
  '🌡️ Our Data Terms Explained today: Demystifying \'Average Occurrence\' (WARM). It\'s all in the stats. lottong-pinoy.com',
  '❄️ Spotlight on the COLD numbers today. Which overdue data point are you watching? Review and analyze. lottong-pinoy.com',
  '📋 Data Overview today. Check results on official channels. Start your Week analysis right here. lottong-pinoy.com',
  '🛠️ Your weekly data tool is still active today. Keep analyzing the historical frequencies. Data is power. lottong-pinoy.com',
  '🧮 Statistical Balance today: Have you analyzed which ratio of hot, warm, and cold numbers fits your analysis best? lottong-pinoy.com',
  '📉 Data Profile today: Understanding the historical status of low-occurrence. Let\'s analyze the stats together. lottong-pinoy.com',
  '💡 Data Strategy Showcase today: Share how you create unique data groups using our analytical categories! lottong-pinoy.com',
  '🧠 Data Fact today: The concept of hot and cold numbers is based entirely on historical draw frequencies. Understanding historical patterns is the core of our analysis. lottong-pinoy.com',
  '🎯 Highlight on the Average today: The Warm number category features consistent historical performance. Dive into the data. lottong-pinoy.com',
  '🗓️ Mid-month Data Review today: Checking in on the status of our Hot numbers at the midpoint. Review the frequencies. lottong-pinoy.com',
  '🗺️ Your data guide is ready today. Analyze the historical blueprints and compare against past results. lottong-pinoy.com',
  '🛡️ A reminder today about our Commitment to Responsible and Informational Use. Lottong Pinoy does not facilitate betting. Educational data only. lottong-pinoy.com',
  '🔗 Data Profile today: Understanding their historical interaction in the data. lottong-pinoy.com',
  '📈 Data Visualization today: Historical frequency trends over time. Which category dominates the stats in the long run? lottong-pinoy.com',
  '📱 Scan the Code today for Instant Access. Go beyond the weekly blueprint with deep-dive data tools at lottong-pinoy.com.',
  '📐 Educational Byte today: How the Law of Large Numbers informs our data analysis for historical number frequency. lottong-pinoy.com',
  '❄️ A deep look at the Cold group today. Which combination of these low-occurrence numbers do you find mathematically intriguing? lottong-pinoy.com',
  '⏳ Final opportunities for analysis today on the Warm list. Use data, not luck, to build your strategies. lottong-pinoy.com',
  '🚀 Data-Driven Progress today. How has your analytical strategy evolved since using the tools at Lottong Pinoy? lottong-pinoy.com',
  '🏆 Hot Combination Challenge today! Based ONLY on the Hot numbers, which 6 stand out to your analysis mathematically? lottong-pinoy.com',
  '🗳️ Data Preference Poll today: Which combination ratio fits your historical analysis best? Vote your data logic below! lottong-pinoy.com',
  '🔄 A Number\'s Journey today: Analyzing historical shifts from low to high frequency status. Data is always dynamic. lottong-pinoy.com',
  '👀 Next Week\'s Blueprint teaser today. The fresh data analysis is almost ready to drop. Get ready for new historical trends. lottong-pinoy.com',
  '⏰ Final chance for this week\'s data today. Review the historical blueprint and plan your analysis. lottong-pinoy.com',
  '🔒 The data is locked in today. Ready for the next set of historical data trends? Tomorrow is the day! lottong-pinoy.com',
  '🎉 30 days of data-driven insights wrap up today. Have you explored the exclusive data charts at lottong-pinoy.com?',
];

// ==========================================
// ANALYSIS CAPTIONS (31 templates)
// ==========================================
const ANALYSIS_CAPTIONS: string[] = [
  '📊 Yesterday\'s draw data for [Game Name] is mapped out. Here is a look at the frequency and recent appearances of these numbers. 📉',
  '⚙️ Running the numbers for [Game Name]! 📊 Check out the structural behavior of yesterday\'s draw from [Date].',
  '📋 Here is the statistical breakdown for yesterday\'s [Game Name] draw. Notice any interesting shifts in the data? 🧐',
  '🖥️ Fresh data scan complete for [Game Name]. Here are the frequency stats for yesterday\'s drawn numbers. 📈',
  '📉 Visualizing yesterday\'s [Game Name] results. The data shows some interesting spacing and frequency on the board for this cycle.',
  '🧮 Our draw analysis for [Game Name] highlights the behavioral trends of yesterday\'s specific numbers. 📌',
  '🌡️ Are the HOT numbers still showing high occurrence in [Game Name]? Here is the frequency temperature for yesterday\'s draw. 🔥',
  '⏳ Tracking the momentum! Here is a look at the High Occurrence and Average Occurrence numbers from yesterday\'s [Game Name] scan. 📊',
  '🔥 Number [Number] is classified as HOT right now in [Game Name], appearing again after just [X] draws! See the rest of yesterday\'s breakdown below. 👇',
  '🧊 Did yesterday\'s [Game Name] draw favor frequent or rare numbers? The data is mapped out right here. 🗺️',
  '📈 Here is the behavior chart for yesterday\'s [Game Name] numbers. Some of these have been extremely active recently! ⚡',
  '⏱️ Breaking down the individual frequency for [Game Name]. Check out the "Last seen" stats for yesterday\'s draw. 🔍',
  '🔍 Spotting the pairs! In yesterday\'s [Game Name] draw, numbers [Number] and [Number] showed up together again in our recent data pull. 🤝',
  '⚖️ The Odd/Even split for yesterday\'s [Game Name] draw was exactly [Number] Odd / [Number] Even. Here is how that fits into the recent patterns. 🧩',
  '🕸️ Pattern mapping yesterday\'s [Game Name] draw: We noted [Number] and [Number] connecting multiple times recently. 🔗',
  '🏗️ Here are the underlying connections from yesterday\'s [Game Name] draw on [Date]. The structural patterns are quite distinct in this result. 📏',
  '🖇️ Look at the shared occurrences in yesterday\'s [Game Name] draw! Numbers [Number] and [Number] have a strong recent history together. 📊',
  '🔀 Analyzing the combinations for [Game Name]. The data highlights an interesting Odd/Even split and some recurring pairs from yesterday. ⚖️',
  '📌 [Game Name] Data Review for [Date]. 📊',
  '📡 Yesterday\'s frequency scan for [Game Name]. Check the stats! 📉',
  '📋 [Game Name] draw analysis: Hot, Warm, and patterns mapped from yesterday. 🗺️',
  '🔍 A quick look at the number behaviors for yesterday\'s [Game Name] draw. ⚙️',
  '📊 Tracking yesterday\'s data for [Game Name]. 📈',
  '🧩 New pattern scan available for yesterday\'s [Game Name]. 🖥️',
  '🗣️ Focus: Engagement & Community',
  '🗺️ Yesterday\'s [Game Name] data is mapped out. Which of these frequency patterns caught your eye? Let\'s discuss the math below! 👇',
  '📉 Here is the latest number behavior for [Game Name]. Who else tracks these specific frequency shifts? 🙋‍♂️🙋‍♀️',
  '🧐 Pattern check for [Game Name]! Do these frequency stats align with your own data tracking? 📝',
  '🖥️ Reviewing yesterday\'s [Game Name] grid. Drop a comment if you noticed the [Number] and [Number] pairing too! 💬',
  '📈 The stats for [Game Name] are showing some active combinations. What trends are you observing in the recent draws? 🗣️',
  '🧮 Let\'s look at the math behind yesterday\'s [Game Name] draw. Share your own data observations in the comments! ✍️',
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatDrawDate(dateStr: string): string {
  try {
    const d = new Date(dateStr.split(' ')[0]);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i <= Math.sqrt(n); i++) {
    if (n % i === 0) return false;
  }
  return true;
}

// ==========================================
// EXPORTED FUNCTIONS
// ==========================================

/**
 * Generate a blueprint caption for a specific day (1-30) and game.
 * Legacy version — kept for backward compat.
 */
export function generateBlueprintCaption(dayIndex: number, gameName: string): string {
  const day = Math.max(1, Math.min(30, dayIndex));
  const template = BLUEPRINT_CAPTIONS[day - 1];
  const caption = template.replace('[Game]', gameName);
  const hashtags = '#LottongPinoy #DataDriven #DataAnalysis #NumberTrends';
  return `${caption}\n\n${hashtags}`;
}

/**
 * Generate a blueprint caption using the corrected 30-day rotation.
 * Takes a game code (e.g. '6/45'), resolves the game name and hashtags automatically.
 * dayIndex: 1-30 (which day in the 30-day cycle)
 */
export function generateBlueprintCaptionV2(dayIndex: number, gameCode: string): string {
  const day = Math.max(1, Math.min(30, dayIndex));
  const gameName = GAME_NAMES[gameCode] || gameCode;
  const hashtags = GAME_HASHTAGS[gameCode] || '#LottongPinoy #DataDriven #DataAnalysis #NumberTrends';

  const template = BLUEPRINT_CAPTIONS[day - 1];
  const caption = template.replace('[Game]', gameName);

  return `${caption}\n\n${hashtags}`;
}

/**
 * Generate an analysis caption for a draw with real data.
 * Randomly picks one of 31 templates, fills in placeholders, and appends key insights.
 */
export function generateAnalysisCaption(
  game: string,
  gameName: string,
  drawDate: string,
  winningNumbers: number[],
  gameData: LottoResult[],
): string {
  const templateIndex = Math.floor(Math.random() * ANALYSIS_CAPTIONS.length);
  let caption = ANALYSIS_CAPTIONS[templateIndex];

  const formattedDate = formatDrawDate(drawDate);

  caption = caption.replace(/\[Game Name\]/g, gameName);
  caption = caption.replace(/\[Date\]/g, formattedDate);

  const shuffledNums = [...winningNumbers].sort(() => Math.random() - 0.5);
  let numberIndex = 0;

  caption = caption.replace(/\[Number\]/g, () => {
    const num = shuffledNums[numberIndex % shuffledNums.length];
    numberIndex++;
    return String(num);
  });

  caption = caption.replace(/\[X\]/g, () => {
    if (winningNumbers.length === 0) return '?';
    let minGap = Infinity;
    for (const num of winningNumbers) {
      const gap = getLastSeenForNumber(gameData, num);
      if (gap < minGap) minGap = gap;
    }
    return String(minGap);
  });

  const insights = generateKeyInsights(game, gameName, winningNumbers, gameData);
  const hashtags = GAME_HASHTAGS[game] || '#LottongPinoy #DataAnalysis #NumberTrends';

  return `${caption}\n\n${insights}\n\n${hashtags}`;
}

/**
 * Generate the Key Insights section from draw data.
 */
function generateKeyInsights(
  gameCode: string,
  gameName: string,
  numbers: number[],
  gameData: LottoResult[],
): string {
  const totalDraws = gameData.length;
  const sorted = [...numbers].sort((a, b) => a - b);

  const actualFreqMap = calculateFrequency(gameData, gameCode);
  const classified = classifyNumbers(actualFreqMap);

  const hotInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'hot').length;
  const warmInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'warm').length;
  const coldInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'cold').length;

  const oddCount = sorted.filter(n => n % 2 !== 0).length;
  const evenCount = sorted.length - oddCount;

  const sum = sorted.reduce((a, b) => a + b, 0);

  const consPairs = getConsecutivePairs(numbers);

  let hottestNumber = 0;
  let hottestFreq = 0;
  for (const num of sorted) {
    const freq = actualFreqMap[num] || 0;
    if (freq > hottestFreq) {
      hottestFreq = freq;
      hottestNumber = num;
    }
  }

  const currentDraw: LottoResult = { game: gameCode, combination: numbers.join('-'), date: new Date().toISOString() };
  const previousDraw = gameData.length > 1 ? gameData[1] : undefined;
  const repeatNums = previousDraw ? getRepeatNumbers(
    { ...currentDraw, combination: numbers.join('-') },
    previousDraw,
  ) : [];

  const insightLines: string[] = [];

  insightLines.push(`📊 Key Insights — Yesterday's Analysis:`);
  insightLines.push(`• Numbers analyzed for: ${gameName} from ${totalDraws} historical draws`);
  insightLines.push(`• Temperature breakdown: ${hotInDraw} Hot, ${warmInDraw} Warm, ${coldInDraw} Cold`);
  insightLines.push(`• Odd/Even split: ${oddCount} Odd / ${evenCount} Even`);
  insightLines.push(`• Sum of numbers: ${sum}`);

  if (consPairs.length > 0) {
    const pairStr = consPairs.map(p => `${p[0]} & ${p[1]}`).join(', ');
    insightLines.push(`• Consecutive pairs detected: ${pairStr}`);
  }

  if (hottestNumber > 0) {
    insightLines.push(`• Most frequent in draw: #${hottestNumber} (${hottestFreq} appearances in ${totalDraws} draws)`);
  }

  if (repeatNums.length > 0) {
    insightLines.push(`• Repeat from previous draw: ${repeatNums.join(', ')}`);
  }

  const primeCount = sorted.filter(isPrime).length;
  if (primeCount > 0) {
    insightLines.push(`• Prime numbers in draw: ${primeCount} (${sorted.filter(isPrime).join(', ')})`);
  }

  if (sorted.length > 1) {
    const spread = sorted[sorted.length - 1] - sorted[0];
    insightLines.push(`• Number spread: ${spread} (from ${sorted[0]} to ${sorted[sorted.length - 1]})`);
  }

  insightLines.push('');
  insightLines.push(`18+ only. For educational use only. Not affiliated with PCSO. Always verify results via official PCSO channels.`);

  return insightLines.join('\n');
}

// ==========================================
// DAILY WINNERS CAPTIONS (14 templates)
// ==========================================
const DAILY_WINNERS_CAPTIONS: string[] = [
  'Here are yesterday\'s PCSO lotto draw results. All winning numbers from [Date] in one view. Always verify via official PCSO channels.',
  'All draw results from [Date] are in! Check the winning combinations across all PCSO games. Not affiliated with PCSO.',
  'Yesterday\'s complete PCSO draw recap for [Date]. Major games and daily digit results all in one post.',
  'The numbers from [Date] are official. Here\'s your complete PCSO draw results recap from Lottong Pinoy.',
  'All PCSO lotto results for [Date] — major games and digit games combined. Verify results via official PCSO channels.',
  'Your daily PCSO draw summary for [Date]. Every winning number from yesterday\'s draws in one banner.',
  'Complete PCSO draw results for [Date]. Major lotto and digit game numbers all mapped out for you.',
  '[Date] draw results are live! All PCSO winning numbers from yesterday\'s draws in one place.',
  'Yesterday\'s PCSO numbers for [Date] — your quick recap across all lotto and digit games.',
  'All winning combinations from [Date] PCSO draws. From Ultra Lotto to 2D EZ2 — everything in one view.',
  'PCSO draw results for [Date] are here. Check the winning numbers for all major and daily games.',
  'Your [Date] PCSO results roundup. Every lotto and digit game result from yesterday, verified and compiled.',
  'Here\'s what hit yesterday, [Date]. All PCSO draw results across major and daily games.',
  'The [Date] PCSO draw is complete. Here are all the winning numbers — major lotto and digit games included.',
];

/**
 * Generate a daily winners caption.
 * dateStr: ISO date like "2026-03-24"
 */
export function generateDailyWinnersCaption(dateStr: string, majorGames: string[]): string {
  const formattedDate = formatDrawDate(dateStr);
  const templateIndex = Math.floor(Math.random() * DAILY_WINNERS_CAPTIONS.length);
  const template = DAILY_WINNERS_CAPTIONS[templateIndex];
  let caption = template.replace(/\[Date\]/g, formattedDate);

  const hashtags = majorGames
    .map(g => GAME_HASHTAGS[g] || '')
    .filter(Boolean)
    .join(' ');
  const commonHashtags = '#PCSO #LottongPinoy #PCSOResults #LottoResults';

  return `${caption}\n\n${hashtags}\n${commonHashtags}`;
}

export function getBlueprintCaptionCount(): number {
  return BLUEPRINT_CAPTIONS.length;
}

export function getAnalysisCaptionCount(): number {
  return ANALYSIS_CAPTIONS.length;
}

// ==========================================
// PULSE CAPTIONS (8 templates)
// ==========================================
const PULSE_CAPTIONS: string[] = [
  'The latest 2D and 3D patterns are mapped out. Check the winning numbers and emerging trends from today\'s draw.',
  'Fresh PULSE analysis for today\'s 2D EZ2 and 3D Swertres draws. Which patterns are repeating?',
  'Today\'s digit game breakdown is here. 2D and 3D winning numbers with pattern insights.',
  'PULSE check complete! See the latest 2D and 3D results with pattern analysis and hot number tracking.',
  'The 2D and 3D draws just came in. Here are the numbers and the patterns behind them.',
  'Quick PULSE scan for today\'s digit games. 2D EZ2 and 3D Swertres results with trend analysis.',
  'Tracking the patterns in today\'s 2D and 3D draws. Hot numbers and connections mapped.',
  'Your PULSE analysis is ready. 2D and 3D winning numbers with behavioral insights.',
];

/**
 * Generate a PULSE caption for a specific time slot.
 */
export function generatePulseCaption(timeSlot: string): string {
  const templateIndex = Math.floor(Math.random() * PULSE_CAPTIONS.length);
  const template = PULSE_CAPTIONS[templateIndex];

  const timeLabels: Record<string, string> = {
    '2PM': 'Alas-Dos (2PM)',
    '5PM': 'Alas-Singko (5PM)',
    '9PM': 'Alas-Nwebe (9PM)',
  };
  const timeLabel = timeLabels[timeSlot] || timeSlot;

    const hashtags = '#2D #EZ2 #3D #Swertres #PCSO #LottongPinoy #PulseAnalysis #DigitGames #DataDriven #NumberTrends';

  return `${template}\n\nDraw Time: ${timeLabel}\n\n${hashtags}\n\n18+ only. For educational use only. Not affiliated with PCSO. Always verify results via official PCSO channels.`;
}