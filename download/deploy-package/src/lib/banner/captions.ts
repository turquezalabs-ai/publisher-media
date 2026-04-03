import type { LottoResult } from './types';
import {
  parseCombination,
  calculateFrequency,
  classifyNumbers,
  getLastSeenForNumber,
  getConsecutivePairs,
  getRepeatNumbers,
  getPreviousDraw,
} from './analysis';

// ==========================================
// GAME-SPECIFIC HASHTAGS
// ==========================================
export const GAME_HASHTAGS: Record<string, string> = {
  '6/58': '#UltraLotto #UltraLotto658 #PCSO #658Lotto #658Analytics #Lotto #LottongPinoy #DataAnalysis #NumberTrends',
  '6/55': '#GrandLotto #GrandLotto655 #PCSO #655Lotto #655Analytics #Lotto #LottongPinoy #DataAnalysis #NumberTrends',
  '6/49': '#SuperLotto #SuperLotto649 #PCSO #649Lotto #649Analytics #Lotto #LottongPinoy #DataAnalysis #NumberTrends',
  '6/45': '#MegaLotto #MegaLotto645 #PCSO #645Lotto #645Analytics #Lotto #LottongPinoy #DataAnalysis #NumberTrends',
  '6/42': '#Lotto #Lotto642 #PCSO #642Lotto #642Analytics #Lotto #LottongPinoy #DataAnalysis #NumberTrends',
  '6D': '#6D #6DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataAnalysis #NumberTrends',
  '4D': '#4D #4DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataAnalysis #NumberTrends',
  '3D': '#3D #3DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataAnalysis #NumberTrends',
  '2D': '#2D #2DLotto #PCSO #Lotto #LottoAnalytics #LottongPinoy #DataAnalysis #NumberTrends',
};

// ==========================================
// BLUEPRINT CAPTIONS (30-day rotation)
// ==========================================
interface BlueprintCaption {
  caption: string;
  hashtags: string;
}

const BLUEPRINT_CAPTIONS: BlueprintCaption[] = [
  { caption: '📊 Your Weekly Data Blueprint is here today! Analyze the [game.name] numbers by historical occurrence. Data is power. lottong-pinoy.com', hashtags: '#LottongPinoy #DataDriven #DataAnalysis #NumberTrends' },
  { caption: '🔥 Focusing on the numbers with HIGH OCCURRENCE today. See which ones made our HOT list this week. Use data, not guesswork. lottong-pinoy.com', hashtags: '#HotNumbers #DataAnalytics #LottongPinoy #NumberFrequencies' },
  { caption: '📌 Data Profile today: Our analysis shows it has high historical frequency. Add it to your data review. lottong-pinoy.com', hashtags: '#DataProfile #NumberAnalysis #StatisticalData #LottongPinoy' },
  { caption: '⚖️ Data Debate today: What\'s your analytical preference? Team Hot (High occurrence) or Team Cold (Low occurrence)? Comment below! lottong-pinoy.com', hashtags: '#DataDebate #AnalyticsCommunity #LottongPinoy #NumberStats' },
  { caption: '🌡️ Our Data Terms Explained today: Demystifying \'Average Occurrence\' (WARM). It\'s all in the stats. lottong-pinoy.com', hashtags: '#DataEducation #WarmNumbers #StatisticalAnalysis #LottongPinoy' },
  { caption: '❄️ Spotlight on the COLD numbers today. Which overdue data point are you watching? Review and analyze. lottong-pinoy.com', hashtags: '#ColdNumbers #DataReview #LottongPinoy #StatisticalTrends' },
  { caption: '📋 Data Overview today. Check results on official channels. Start your Week analysis right here. lottong-pinoy.com', hashtags: '#DataRecap #WeeklyAnalysis #LottongPinoy #NumberData' },
  { caption: '🛠️ Your weekly data tool is still active today. Keep analyzing the historical frequencies. Data is power. lottong-pinoy.com', hashtags: '#DataDriven #LottoStats #LottongPinoy #DataTools' },
  { caption: '🧮 Statistical Balance today: Have you analyzed which ratio of hot, warm, and cold numbers fits your analysis best? lottong-pinoy.com', hashtags: '#DataStrategy #NumberCombinations #LottongPinoy #Analytics' },
  { caption: '📉 Data Profile today: Understanding the historical status of low-occurrence. Let\'s analyze the stats together. lottong-pinoy.com', hashtags: '#DataDeepDive #NumberStats #LottongPinoy #HistoricalData' },
  { caption: '💡 Data Strategy Showcase today: Share how you create unique data groups using our analytical categories! lottong-pinoy.com', hashtags: '#DataCommunity #Analytics #LottongPinoy #DataGrouping' },
  { caption: '🧠 Data Fact today: The concept of hot and cold numbers is based entirely on historical draw frequencies. Understanding historical patterns is the core of our analysis. lottong-pinoy.com', hashtags: '#DataFacts #HistoricalTrends #LottongPinoy #DataScience' },
  { caption: '🎯 Highlight on the Average today: The Warm number category features consistent historical performance. Dive into the data. lottong-pinoy.com', hashtags: '#AverageOccurrence #DataInsights #LottongPinoy #NumberTrends' },
  { caption: '🗓️ Mid-month Data Review today: Checking in on the status of our Hot numbers at the midpoint. Review the frequencies. lottong-pinoy.com', hashtags: '#DataReview #MidMonthStats #LottongPinoy #DataAnalytics' },
  { caption: '🗺️ Your data guide is ready today. Analyze the historical blueprints and compare against past results. lottong-pinoy.com', hashtags: '#DataGuide #LottongPinoy #NumberAnalysis #StatisticalData' },
  { caption: '🛡️ A reminder today about our Commitment to Responsible and Informational Use. Lottong Pinoy does not facilitate betting. Educational data only. lottong-pinoy.com', hashtags: '#DataTransparency #EducationalUse #LottongPinoy #DataFirst' },
  { caption: '🔗 Data Profile today: Understanding their historical interaction in the data. lottong-pinoy.com', hashtags: '#DataInteraction #NumberStats #LottongPinoy #DataDriven' },
  { caption: '📈 Data Visualization today: Historical frequency trends over time. Which category dominates the stats in the long run? lottong-pinoy.com', hashtags: '#DataViz #HistoricalData #LottongPinoy #TrendAnalysis' },
  { caption: '📱 Scan the Code today for Instant Access. Go beyond the weekly blueprint with deep-dive data tools at lottong-pinoy.com.', hashtags: '#DataTools #LottongPinoy #ScanForData #AnalyticsApp' },
  { caption: '📐 Educational Byte today: How the Law of Large Numbers informs our data analysis for historical number frequency. lottong-pinoy.com', hashtags: '#MathFacts #LawOfLargeNumbers #LottongPinoy #DataEducation' },
  { caption: '❄️ A deep look at the Cold group today. Which combination of these low-occurrence numbers do you find mathematically intriguing? lottong-pinoy.com', hashtags: '#ColdNumbers #MathAnalysis #LottongPinoy #OverdueData' },
  { caption: '⏳ Final opportunities for analysis today on the Warm list. Use data, not luck, to build your strategies. lottong-pinoy.com', hashtags: '#WarmNumbers #DataStrategy #LottongPinoy #NumberTrends' },
  { caption: '🚀 Data-Driven Progress today. How has your analytical strategy evolved since using the tools at Lottong Pinoy? lottong-pinoy.com', hashtags: '#DataProgress #AnalyticsCommunity #LottongPinoy #DataTools' },
  { caption: '🏆 Hot Combination Challenge today! Based ONLY on the Hot numbers, which 6 stand out to your analysis mathematically? lottong-pinoy.com', hashtags: '#MathChallenge #DataAnalysis #LottongPinoy #HotNumbers' },
  { caption: '🗳️ Data Preference Poll today: Which combination ratio fits your historical analysis best? Vote your data logic below! lottong-pinoy.com', hashtags: '#DataPoll #CommunityStats #LottongPinoy #DataLogic' },
  { caption: '🔄 A Number\'s Journey today: Analyzing historical shifts from low to high frequency status. Data is always dynamic. lottong-pinoy.com', hashtags: '#NumberJourney #DataShifts #LottongPinoy #HistoricalTrends' },
  { caption: '👀 Next Week\'s Blueprint teaser today. The fresh data analysis is almost ready to drop. Get ready for new historical trends. lottong-pinoy.com', hashtags: '#DataTeaser #UpcomingStats #LottongPinoy #NewData' },
  { caption: '⏰ Final chance for this week\'s data today. Review the historical blueprint and plan your analysis. lottong-pinoy.com', hashtags: '#DataReview #LottongPinoy #FinalAnalysis #StatisticalData' },
  { caption: '🔒 The data is locked in today. Ready for the next set of historical data trends? Tomorrow is the day! lottong-pinoy.com', hashtags: '#DataDrop #NewStats #LottongPinoy #AnalyticsReady' },
  { caption: '🎉 30 days of data-driven insights wrap up today. Have you explored the exclusive data charts at lottong-pinoy.com?', hashtags: '#DataInsights #MonthlyReview #LottongPinoy #DataDriven' },
];

// ==========================================
// ANALYSIS CAPTIONS (31 templates)
// ==========================================
const ANALYSIS_CAPTIONS: string[] = [
  '📊 The latest draw data for [Game Name] is mapped out. Here is a look at the frequency and recent appearances of these numbers. 📉',
  '⚙️ Running the numbers for [Game Name]! 📊 Check out the structural behavior of the most recent draw from [Date].',
  '📋 Here is the statistical breakdown for the [Game Name] draw. Notice any interesting shifts in the recent data? 🧐',
  '🖥️ Fresh data scan complete for [Game Name]. Here are the frequency stats for the latest numbers drawn. 📈',
  '📉 Visualizing the recent [Game Name] results. The data shows some interesting spacing and frequency on the board for this cycle.',
  '🧮 Our draw analysis for [Game Name] highlights the recent behavioral trends of these specific numbers. 📌',
  '🌡️ Are the HOT numbers still showing high occurrence in [Game Name]? Here is the frequency temperature for the latest draw. 🔥',
  '⏳ Tracking the momentum! Here is a look at the High Occurrence and Average Occurrence numbers from the latest [Game Name] scan. 📊',
  '🔥 Number [Number] is classified as HOT right now in [Game Name], appearing again after just [X] draws! See the rest of the breakdown below. 👇',
  '🧊 Did the recent [Game Name] draw favor frequent or rare numbers? The data is mapped out right here. 🗺️',
  '📈 Here is the behavior chart for the latest [Game Name] numbers. Some of these have been extremely active recently! ⚡',
  '⏱️ Breaking down the individual frequency for [Game Name]. Check out the "Last seen" stats for the most recent draw. 🔍',
  '🔍 Spotting the pairs! In the latest [Game Name] draw, numbers [Number] and [Number] showed up together again in our recent data pull. 🤝',
  '⚖️ The Odd/Even split for the recent [Game Name] draw was exactly [Number] Odd / [Number] Even. Here is how that fits into the recent patterns. 🧩',
  '🕸️ Pattern mapping the latest [Game Name] draw: We noted [Number] and [Number] connecting multiple times recently. 🔗',
  '🏗️ Here are the underlying connections from the [Game Name] draw on [Date]. The structural patterns are quite distinct in this result. 📏',
  '🖇️ Look at the shared occurrences in this [Game Name] draw! Numbers [Number] and [Number] have a strong recent history together. 📊',
  '🔀 Analyzing the combinations for [Game Name]. The data highlights an interesting Odd/Even split and some recurring pairs. ⚖️',
  '📌 [Game Name] Data Review for [Date]. 📊',
  '📡 Latest frequency scan for [Game Name]. Check the stats! 📉',
  '📋 [Game Name] draw analysis: Hot, Warm, and patterns mapped. 🗺️',
  '🔍 A quick look at the number behaviors for the recent [Game Name] draw. ⚙️',
  '📊 Tracking the data for [Game Name]. 📈',
  '🧩 New pattern scan available for the latest [Game Name]. 🖥️',
  '🗣️ Focus: Engagement & Community',
  '🗺️ The [Game Name] data is mapped out. Which of these frequency patterns caught your eye? Let\'s discuss the math below! 👇',
  '📉 Here is the latest number behavior for [Game Name]. Who else tracks these specific frequency shifts? 🙋‍♂️🙋‍♀️',
  '🧐 Pattern check for [Game Name]! Do these frequency stats align with your own data tracking? 📝',
  '🖥️ Reviewing the latest [Game Name] grid. Drop a comment if you noticed the [Number] and [Number] pairing too! 💬',
  '📈 The stats for [Game Name] are showing some active combinations. What trends are you observing in the recent draws? 🗣️',
  '🧮 Let\'s look at the math behind the latest [Game Name] draw. Share your own data observations in the comments! ✍️',
];

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function pickRandom<T>(arr: T[], count: number = 1): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

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
 */
export function generateBlueprintCaption(dayIndex: number, gameName: string): string {
  const day = Math.max(1, Math.min(30, dayIndex));
  const entry = BLUEPRINT_CAPTIONS[day - 1];
  const caption = entry.caption.replace('[game.name]', gameName);
  return `${caption}\n\n${entry.hashtags}`;
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
  // game is the game code like '6/58', '4D', etc.
  // Pick a random template
  const templateIndex = Math.floor(Math.random() * ANALYSIS_CAPTIONS.length);
  let caption = ANALYSIS_CAPTIONS[templateIndex];

  // Format date
  const formattedDate = formatDrawDate(drawDate);

  // Replace [Game Name] placeholder
  caption = caption.replace(/\[Game Name\]/g, gameName);

  // Replace [Date] placeholder
  caption = caption.replace(/\[Date\]/g, formattedDate);

  // Pick random draw numbers for [Number] placeholders
  const shuffledNums = [...winningNumbers].sort(() => Math.random() - 0.5);
  let numberIndex = 0;

  // Replace [Number] placeholders with random draw numbers
  caption = caption.replace(/\[Number\]/g, () => {
    const num = shuffledNums[numberIndex % shuffledNums.length];
    numberIndex++;
    return String(num);
  });

  // Replace [X] placeholder (draws since last seen) — pick the most interesting one
  caption = caption.replace(/\[X\]/g, () => {
    if (winningNumbers.length === 0) return '?';
    // Find the number with the shortest last-seen gap (most recently active)
    let minGap = Infinity;
    for (const num of winningNumbers) {
      const gap = getLastSeenForNumber(gameData, num);
      if (gap < minGap) minGap = gap;
    }
    return String(minGap);
  });

  // ---- Generate Key Insights ----
  const insights = generateKeyInsights(game, gameName, winningNumbers, gameData);

  // Append game-specific hashtags
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

  // Count hot/warm/cold in the draw
  const hotInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'hot').length;
  const warmInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'warm').length;
  const coldInDraw = sorted.filter(n => classified.find(c => c.number === n)?.category === 'cold').length;

  // Odd/even split
  const oddCount = sorted.filter(n => n % 2 !== 0).length;
  const evenCount = sorted.length - oddCount;

  // Sum
  const sum = sorted.reduce((a, b) => a + b, 0);

  // Consecutive pairs
  const consPairs = getConsecutivePairs(numbers);

  // Find hottest number in the draw (highest frequency)
  let hottestNumber = 0;
  let hottestFreq = 0;
  for (const num of sorted) {
    const freq = actualFreqMap[num] || 0;
    if (freq > hottestFreq) {
      hottestFreq = freq;
      hottestNumber = num;
    }
  }

  // Previous draw for repeat check
  const currentDraw: LottoResult = { game: gameCode, combination: numbers.join('-'), date: new Date().toISOString() };
  const previousDraw = gameData.length > 1 ? gameData[1] : undefined;
  const repeatNums = previousDraw ? getRepeatNumbers(
    { ...currentDraw, combination: numbers.join('-') },
    previousDraw,
  ) : [];

  // Build insight lines
  const insightLines: string[] = [];

  insightLines.push(`📊 Key Insights:`);
  insightLines.push(`• Numbers analyzed for: ${gameName} from ${totalDraws} historical draws`);

  // Hot/warm/cold breakdown
  insightLines.push(`• Temperature breakdown: ${hotInDraw} Hot, ${warmInDraw} Warm, ${coldInDraw} Cold`);

  // Odd/even
  insightLines.push(`• Odd/Even split: ${oddCount} Odd / ${evenCount} Even`);

  // Sum
  insightLines.push(`• Sum of numbers: ${sum}`);

  // Consecutive pairs
  if (consPairs.length > 0) {
    const pairStr = consPairs.map(p => `${p[0]} & ${p[1]}`).join(', ');
    insightLines.push(`• Consecutive pairs detected: ${pairStr}`);
  }

  // Hottest number
  if (hottestNumber > 0) {
    insightLines.push(`• Most frequent in draw: #${hottestNumber} (${hottestFreq} appearances in ${totalDraws} draws)`);
  }

  // Repeat numbers
  if (repeatNums.length > 0) {
    insightLines.push(`• Repeat from previous draw: ${repeatNums.join(', ')}`);
  }

  // Prime count
  const primeCount = sorted.filter(isPrime).length;
  if (primeCount > 0) {
    insightLines.push(`• Prime numbers in draw: ${primeCount} (${sorted.filter(isPrime).join(', ')})`);
  }

  // Number range/spread
  if (sorted.length > 1) {
    const spread = sorted[sorted.length - 1] - sorted[0];
    insightLines.push(`• Number spread: ${spread} (from ${sorted[0]} to ${sorted[sorted.length - 1]})`);
  }

  insightLines.push('');
  insightLines.push(`18+ only. For educational use only. Not affiliated with PCSO. Always verify results via official PCSO channels.`);

  return insightLines.join('\n');
}

/**
 * Returns the total count of blueprint captions (30).
 */
export function getBlueprintCaptionCount(): number {
  return BLUEPRINT_CAPTIONS.length;
}

/**
 * Returns the total count of analysis captions (31).
 */
export function getAnalysisCaptionCount(): number {
  return ANALYSIS_CAPTIONS.length;
}
