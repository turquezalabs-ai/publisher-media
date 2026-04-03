// js/modules/insights.js

import { parseDateSafe } from '../utils.js';

// ==========================================
// 1. HOT TRENDING INSIGHT
// ==========================================
export function getHotTrendingInsight(gameData) {
    if (gameData.length < 10) return null;
    const recent10 = gameData.slice(0, 10);
    const historical100 = gameData.slice(0, 100);
    const freqRecent = {};
    const freqHistorical = {};

    const countFreq = (data, map) => {
        data.forEach(d => {
            String(d.combination).split(/[-\s]+/).forEach(n => {
                const num = parseInt(n);
                if (!isNaN(num)) map[num] = (map[num] || 0) + 1;
            });
        });
    };

    countFreq(recent10, freqRecent);
    countFreq(historical100, freqHistorical);

    let bestNum = null;
    let bestDiff = 0;

    Object.keys(freqRecent).forEach(num => {
        const recentRate = (freqRecent[num] / 10) * 100;
        const histRate = (freqHistorical[num] || 0) / (historical100.length || 1) * 100;
        const diff = recentRate - histRate;
        if (diff > bestDiff) {
            bestDiff = diff;
            bestNum = num;
        }
    });

    if (bestNum && bestDiff > 5) {
        return {
            icon: '🔥', label: 'Hot & Trending',
            text: `<strong class="text-orange-400">${bestNum}</strong> is trending! It's appearing <strong class="text-white">${bestDiff.toFixed(0)}% more</strong> often than usual.`,
            numbers: [parseInt(bestNum)],
            style: 'hot',
            // ADD RAW DATA FOR TRANSLATION
            raw: { num: bestNum, diff: bestDiff.toFixed(0) }
        };
    }
    return null;
}

// ==========================================
// 2. COLD OVERDUE INSIGHT
// ==========================================
export function getColdOverdueInsight(gameData) {
    if (gameData.length < 10) return null;
    const lastSeen = {};
    
    gameData.forEach((d, index) => {
        String(d.combination).split(/[-\s]+/).forEach(n => {
            const num = parseInt(n);
            if (!isNaN(num) && lastSeen[num] === undefined) lastSeen[num] = index;
        });
    });

    let coldestNum = null;
    let maxGap = 0;

    Object.entries(lastSeen).forEach(([num, index]) => {
        if (index > maxGap) { maxGap = index; coldestNum = num; }
    });

    if (coldestNum && maxGap >= 5) {
        return {
            icon: '❄️', label: 'Cold Number',
            text: `<strong class="text-cyan-400">${coldestNum}</strong> hasn't been seen in <strong class="text-white">${maxGap} draws</strong>.`,
            numbers: [parseInt(coldestNum)],
            style: 'cold',
            // ADD RAW DATA FOR TRANSLATION
            raw: { num: coldestNum, gap: maxGap }
        };
    }
    return null;
}

// ==========================================
// 3. SUKI PAIRS INSIGHT (Power Couple)
// ==========================================
export function getSukiPairsInsight(gameData) {
    if (gameData.length < 5) return null;
    
    const pairFreq = {};
    const recent30 = gameData.slice(0, 30);

    recent30.forEach(d => {
        const nums = String(d.combination).split(/[-\s]+/).map(Number).filter(n => !isNaN(n));
        for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
                const key = [nums[i], nums[j]].sort((a,b) => a-b).join('-');
                pairFreq[key] = (pairFreq[key] || 0) + 1;
            }
        }
    });

    let topPair = null; let topCount = 0;
    Object.entries(pairFreq).forEach(([pair, count]) => {
        if (count > topCount) { topCount = count; topPair = pair; }
    });

    if (topPair && topCount >= 2) {
        return {
            icon: '💕', label: 'Power Couple',
            text: `<strong class="text-pink-400">${topPair.replace('-', ' & ')}</strong> appeared together <strong class="text-white">${topCount} times</strong> in 30 days.`,
            numbers: topPair.split('-').map(Number),
            style: 'couple',
            // ADD RAW DATA FOR TRANSLATION
            raw: { pair: topPair.replace('-', ' & '), count: topCount }
        };
    }
    return null;
}

// ==========================================
// 4. DAY BIAS INSIGHT
// ==========================================
export function getDayBiasInsight(gameData) {
    if(gameData.length < 5) return null; 

    const dayBalls = {};
    
    gameData.slice(0, 100).forEach(d => {
        const day = new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' });
        if (!dayBalls[day]) dayBalls[day] = { even: 0, odd: 0 };

        String(d.combination).split(/[-\s]+/).forEach(n => {
            const num = parseInt(n);
            if (!isNaN(num)) {
                if (num % 2 === 0) dayBalls[day].even++;
                else dayBalls[day].odd++;
            }
        });
    });

    let biasedDay = null; let biasType = null; let biasPercent = 0;

    Object.entries(dayBalls).forEach(([day, counts]) => {
        const total = counts.even + counts.odd;
        if (total === 0) return;
        const evenPct = (counts.even / total) * 100;
        
        if (evenPct > 55) {
            if (evenPct > biasPercent) { biasPercent = evenPct; biasedDay = day; biasType = 'Even'; }
        } else if (evenPct < 45) {
            const oddPct = 100 - evenPct;
            if (oddPct > biasPercent) { biasPercent = oddPct; biasedDay = day; biasType = 'Odd'; }
        }
    });

    if (biasedDay) {
        return {
            icon: '📅', label: 'Day Pattern',
            text: `<strong class="text-yellow-400">${biasedDay}s</strong> favor <strong class="text-white">${biasType}</strong> numbers.`,
            numbers: [],
            style: 'default',
            // ADD RAW DATA FOR TRANSLATION
            raw: { day: biasedDay, type: biasType }
        };
    }
    return null;
}

// ==========================================
// 5. HELPER: RANDOM TEXT
// ==========================================
export function getRandomInsightText(game) {
    const insights = [
        `This number is considered a "Hot Number" in recent draws.`,
        `It appears frequently in ${game} results.`
    ];
    return insights[Math.floor(Math.random() * insights.length)];
}