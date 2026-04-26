import type { LottoResult } from './types';

function parseCombination(combo: string): number[] {
  return combo.split(/[-,]/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
}

export interface PulseInsight {
  emoji: string;
  text: string;
  boldVars: number[];
}

function areConsecutive(nums: number[]): boolean {
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return nums.length >= 2;
}

function findConsecutivePairs(nums: number[]): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i + 1] === nums[i] + 1) {
      pairs.push([nums[i], nums[i + 1]]);
    }
  }
  return pairs;
}

function findDuplicates(nums: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const n of nums) {
    counts.set(n, (counts.get(n) || 0) + 1);
  }
  return counts;
}

function findRepeatFromPrevious(
  currentNums: number[],
  previousDraw: LottoResult | null
): number[] {
  if (!previousDraw) return [];
  const prevNums = parseCombination(previousDraw.combination);
  const repeated: number[] = [];
  for (const n of currentNums) {
    if (prevNums.includes(n)) repeated.push(n);
  }
  return repeated;
}

function countCombinationInHistory(
  nums: number[],
  history: LottoResult[]
): number {
  let count = 0;
  const sorted = [...nums].sort((a, b) => a - b).join('-');
  for (const draw of history) {
    const drawNums = parseCombination(draw.combination).sort((a, b) => a - b).join('-');
    if (drawNums === sorted) count++;
  }
  return count;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'recent draws';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function consecutivePercentage(history: LottoResult[]): number {
  if (history.length < 10) return 0;
  let consecutive = 0;
  for (const draw of history) {
    const nums = parseCombination(draw.combination);
    if (findConsecutivePairs(nums).length > 0) consecutive++;
  }
  return Math.round((consecutive / history.length) * 100);
}

function duplicatePercentage(history: LottoResult[]): number {
  if (history.length < 10) return 0;
  let dups = 0;
  for (const draw of history) {
    const nums = parseCombination(draw.combination);
    const counts = findDuplicates(nums);
    for (const [, c] of counts) {
      if (c > 1) { dups++; break; }
    }
  }
  return Math.round((dups / history.length) * 100);
}

/**
 * Count how many times a single number appeared in history
 */
function numberFrequency(num: number, history: LottoResult[]): number {
  let count = 0;
  for (const draw of history) {
    const nums = parseCombination(draw.combination);
    if (nums.includes(num)) count++;
  }
  return count;
}

/**
 * Find the most common number in history
 */
function mostFrequentNumber(history: LottoResult[], exclude: number[]): { num: number; freq: number } | null {
  const freq = new Map<number, number>();
  for (const draw of history) {
    const nums = parseCombination(draw.combination);
    for (const n of nums) {
      if (!exclude.includes(n)) {
        freq.set(n, (freq.get(n) || 0) + 1);
      }
    }
  }
  let best: { num: number; freq: number } | null = null;
  for (const [num, f] of freq) {
    if (!best || f > best.freq) best = { num, freq: f };
  }
  return best;
}

/**
 * Odd/even analysis
 */
function oddEvenRatio(nums: number[]): { odd: number; even: number } {
  const odd = nums.filter(n => n % 2 !== 0).length;
  return { odd, even: nums.length - odd };
}

/**
 * Generate exactly 3 pattern insights for 2D draw
 */
export function generate2DPatterns(
  currentNums: number[],
  history: LottoResult[],
  previousDraw: LottoResult | null
): PulseInsight[] {
  const insights: PulseInsight[] = [];

  if (currentNums.length < 2) {
    return [
      { emoji: '\uD83D\uDCA1', text: 'Waiting for draw data to generate patterns.', boldVars: [] },
      { emoji: '\uD83D\uDCA1', text: 'Check back after the next 2D draw.', boldVars: [] },
      { emoji: '\uD83D\uDCA1', text: 'Historical analysis will appear here.', boldVars: [] },
    ];
  }

  const n1 = currentNums[0];
  const n2 = currentNums[1];
  const sum = n1 + n2;
  const oe = oddEvenRatio(currentNums);

  // 1. Duplicate (double number)
  if (n1 === n2) {
    const pct = duplicatePercentage(history);
    insights.push({
      emoji: '\uD83D\uDD25',
      text: `${n1} and ${n1} are the same number. Double hits happen in ~${pct}% of draws.`,
      boldVars: [n1],
    });
  }

  // 2. Consecutive numbers
  if (areConsecutive(currentNums)) {
    const pct = consecutivePercentage(history);
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `${n1} and ${n2} are consecutive. This happens in ~${pct}% of draws.`,
      boldVars: [n1, n2],
    });
  }

  // 3. Repeat from previous draw
  const repeated = findRepeatFromPrevious(currentNums, previousDraw);
  if (repeated.length > 0 && insights.length < 3) {
    const prevDate = previousDraw ? formatDate(previousDraw.date) : 'recent draws';
    const unique = [...new Set(repeated)];
    if (unique.length === 1) {
      insights.push({
        emoji: '\uD83D\uDD04',
        text: `${unique[0]} appeared in the previous draw ${prevDate}. It repeated tonight.`,
        boldVars: [unique[0]],
      });
    } else {
      insights.push({
        emoji: '\uD83D\uDD04',
        text: `${unique.join(' and ')} appeared in the previous draw ${prevDate}. They repeated tonight.`,
        boldVars: unique,
      });
    }
  }

  // 4. Pair frequency in history
  if (insights.length < 3) {
    const pairCount = countCombinationInHistory(currentNums, history);
    if (pairCount > 1) {
      insights.push({
        emoji: '\uD83D\uDCA1',
        text: `The pair ${n1} & ${n2} has appeared together ${pairCount}X in recent draws.`,
        boldVars: [n1, n2],
      });
    }
  }

  // 5. Sum range
  if (insights.length < 3) {
    const label = sum <= 20 ? 'low' : sum <= 40 ? 'mid-range' : 'high';
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `The sum is ${sum}, trending ${label} for 2D draws.`,
      boldVars: [sum],
    });
  }

  // 6. Odd/even split
  if (insights.length < 3) {
    const label = oe.odd === 2 ? 'both odd' : oe.even === 2 ? 'both even' : 'mixed';
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `Odd/Even split: ${oe.odd} odd and ${oe.even} even (${label}).`,
      boldVars: [],
    });
  }

  // 7. Number frequency (individual)
  if (insights.length < 3) {
    const freq1 = numberFrequency(n1, history);
    const freq2 = numberFrequency(n2, history);
    const hotNum = freq1 >= freq2 ? n1 : n2;
    const hotFreq = Math.max(freq1, freq2);
    insights.push({
      emoji: '\uD83D\uDD25',
      text: `${hotNum} has appeared ${hotFreq} times in recent draws, making it a frequent pick.`,
      boldVars: [hotNum, hotFreq],
    });
  }

  // 8. Most frequent overall
  if (insights.length < 3) {
    const best = mostFrequentNumber(history, currentNums);
    if (best) {
      insights.push({
        emoji: '\uD83D\uDCA1',
        text: `The most frequent 2D number recently is ${best.num}, appearing ${best.freq} times.`,
        boldVars: [best.num, best.freq],
      });
    }
  }

  // Always pad to exactly 3
  while (insights.length < 3) {
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `Pattern analysis data is being compiled for the next update.`,
      boldVars: [],
    });
  }

  return insights.slice(0, 3);
}

/**
 * Generate exactly 3 pattern insights for 3D draw
 */
export function generate3DPatterns(
  currentNums: number[],
  history: LottoResult[],
  previousDraw: LottoResult | null
): PulseInsight[] {
  const insights: PulseInsight[] = [];

  if (currentNums.length < 3) {
    return [
      { emoji: '\uD83D\uDCA1', text: 'Waiting for draw data to generate patterns.', boldVars: [] },
      { emoji: '\uD83D\uDCA1', text: 'Check back after the next 3D draw.', boldVars: [] },
      { emoji: '\uD83D\uDCA1', text: 'Historical analysis will appear here.', boldVars: [] },
    ];
  }

  const n1 = currentNums[0];
  const n2 = currentNums[1];
  const n3 = currentNums[2];
  const sum = n1 + n2 + n3;
  const oe = oddEvenRatio(currentNums);

  // 1. Triplicate (all same)
  if (n1 === n2 && n2 === n3) {
    insights.push({
      emoji: '\uD83D\uDD25',
      text: `Triple ${n1}! This is very rare and happens in less than 1% of draws.`,
      boldVars: [n1],
    });
  }

  // 2. Duplicate (two same)
  const counts = findDuplicates(currentNums);
  if (!insights.some(i => i.text.includes('Triple'))) {
    for (const [num, c] of counts) {
      if (c === 2 && insights.length < 3) {
        const pct = duplicatePercentage(history);
        insights.push({
          emoji: '\uD83D\uDD25',
          text: `${num} appeared twice in this draw. Double digits happen in ~${pct}% of draws.`,
          boldVars: [num],
        });
        break;
      }
    }
  }

  // 3. Consecutive
  if (areConsecutive(currentNums) && insights.length < 3) {
    const pct = consecutivePercentage(history);
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `${n1}, ${n2}, and ${n3} are consecutive. This happens in ~${pct}% of draws.`,
      boldVars: [n1, n2, n3],
    });
  } else if (insights.length < 3) {
    // Check partial consecutive
    const pairs = findConsecutivePairs(currentNums);
    if (pairs.length > 0) {
      const pct = consecutivePercentage(history);
      insights.push({
        emoji: '\uD83D\uDCA1',
        text: `${pairs[0][0]} and ${pairs[0][1]} are consecutive. This happens in ~${pct}% of draws.`,
        boldVars: [pairs[0][0], pairs[0][1]],
      });
    }
  }

  // 4. Repeat from previous
  if (insights.length < 3) {
    const repeated = findRepeatFromPrevious(currentNums, previousDraw);
    if (repeated.length > 0) {
      const prevDate = previousDraw ? formatDate(previousDraw.date) : 'recent draws';
      const unique = [...new Set(repeated)];
      if (unique.length === 1) {
        insights.push({
          emoji: '\uD83D\uDD04',
          text: `${unique[0]} appeared in the previous draw ${prevDate}. It repeated tonight.`,
          boldVars: [unique[0]],
        });
      } else {
        insights.push({
          emoji: '\uD83D\uDD04',
          text: `${unique.join(' and ')} appeared in the previous draw ${prevDate}. They repeated tonight.`,
          boldVars: unique,
        });
      }
    }
  }

  // 5. Combination frequency
  if (insights.length < 3) {
    const comboCount = countCombinationInHistory(currentNums, history);
    if (comboCount > 1) {
      insights.push({
        emoji: '\uD83D\uDCA1',
        text: `The combination ${n1}-${n2}-${n3} has appeared ${comboCount}X in recent draws.`,
        boldVars: [n1, n2, n3],
      });
    }
  }

  // 6. Sum range
  if (insights.length < 3) {
    const label = sum <= 10 ? 'low' : sum <= 18 ? 'mid-range' : 'high';
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `The sum is ${sum}, trending ${label} for 3D draws.`,
      boldVars: [sum],
    });
  }

  // 7. Odd/even split
  if (insights.length < 3) {
    const label = oe.odd === 3 ? 'all odd' : oe.even === 3 ? 'all even' : 'mixed';
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `Odd/Even split: ${oe.odd} odd and ${oe.even} even (${label}).`,
      boldVars: [],
    });
  }

  // 8. Individual number frequency
  if (insights.length < 3) {
    const freqs = currentNums.map(n => ({ num: n, freq: numberFrequency(n, history) }));
    freqs.sort((a, b) => b.freq - a.freq);
    const hot = freqs[0];
    if (hot) {
      insights.push({
        emoji: '\uD83D\uDD25',
        text: `${hot.num} is the hottest number in this draw, appearing ${hot.freq} times in recent draws.`,
        boldVars: [hot.num, hot.freq],
      });
    }
  }

  // 9. Most frequent overall
  if (insights.length < 3) {
    const best = mostFrequentNumber(history, currentNums);
    if (best) {
      insights.push({
        emoji: '\uD83D\uDCA1',
        text: `The most frequent 3D number recently is ${best.num}, appearing ${best.freq} times.`,
        boldVars: [best.num, best.freq],
      });
    }
  }

  // Always pad to exactly 3
  while (insights.length < 3) {
    insights.push({
      emoji: '\uD83D\uDCA1',
      text: `Pattern analysis data is being compiled for the next update.`,
      boldVars: [],
    });
  }

  return insights.slice(0, 3);
}