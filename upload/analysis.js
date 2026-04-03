// js/modules/analysis.js

import { populateDateDropdowns, getMaxNum, linkDateDropdowns, formatCompactNumber, isDigitGame } from '../utils.js';

console.log("✅ Analysis Logic Loaded");

export function initAnalysis(allData) {
    console.log("✅ Analysis Init Running");
    populateDateDropdowns(['analysisFromMonth', 'analysisToMonth'], ['analysisFromYear', 'analysisToYear']);
    linkDateDropdowns('analysisFromYear', 'analysisToYear');

    var btn = document.getElementById('analyzeBtn');
    if (btn) {
        btn.addEventListener('click', function () { runAnalysis(allData); });
    }
}

function runAnalysis(allData) {
    var gameEl = document.getElementById('analysisGameSelect');
    var fMonthEl = document.getElementById('analysisFromMonth');
    var fYearEl = document.getElementById('analysisFromYear');
    var tMonthEl = document.getElementById('analysisToMonth');
    var tYearEl = document.getElementById('analysisToYear');

    var game = gameEl ? gameEl.value : '6/58';
    var fMonth = fMonthEl ? parseInt(fMonthEl.value) : 0;
    var fYear = fYearEl ? parseInt(fYearEl.value) : 2024;
    var tMonth = tMonthEl ? parseInt(tMonthEl.value) : 0;
    var tYear = tYearEl ? parseInt(tYearEl.value) : 2024;

    var start = new Date(fYear, fMonth, 1);
    var end = new Date(tYear, tMonth + 1, 0);

    var filtered = allData.filter(function (d) {
        var dDate = new Date(d.date);
        return d.game.includes(game) && dDate >= start && dDate <= end;
    });

    if (filtered.length === 0) { alert("No data found."); return; }

    calculateStats(filtered);
    var freqMap = calculateFrequency(filtered, game);
    renderCharts(freqMap);

    var patterns = calculatePatterns(filtered);
    renderPatterns(patterns);

    // PRIORITY 6: Scroll to stats on mobile
    var firstStat = document.getElementById('analysisStatDraws');
    if (firstStat && firstStat.parentElement) {
        firstStat.parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ==========================================
// FIX: CALCULATE FREQUENCY
// ==========================================
function calculateFrequency(data, game) {
    var maxNum = getMaxNum(game);
    var freq = {};

    // Determine start number
    // If Digit Game (2D, 3D, etc.), start at 0.
    // If Major Game (6/42, etc.), start at 1.
    var startNum = isDigitGame(game) ? 0 : 1;

    // Initialize map
    for (var i = startNum; i <= maxNum; i++) {
        freq[i] = 0;
    }

    // Count occurrences
    data.forEach(function (d) {
        String(d.combination).split(/[-\s]+/).forEach(function (n) {
            var num = parseInt(n);
            // Safety check: only count if it exists in our initialized map
            if (freq.hasOwnProperty(num)) {
                freq[num]++;
            }
        });
    });

    return freq;
}

// ==========================================
// STATS CALCULATOR
// ==========================================
function calculateStats(data) {
    var draws = data.length;
    var winners = data.reduce(function (a, c) { return a + (parseInt(String(c.winners).replace(/,/g, '')) || 0); }, 0);
    var prize = data.reduce(function (a, c) { return a + (parseFloat(String(c.prize).replace(/[^0-9.-]+/g, "")) || 0); }, 0);

    var totalSum = 0;
    data.forEach(function (d) {
        var nums = String(d.combination).split(/[-\s]+/).map(Number);
        totalSum += nums.reduce(function (a, b) { return a + b; }, 0);
    });
    var avgSum = (totalSum / draws).toFixed(1);

    var drawsEl = document.getElementById('analysisStatDraws');
    var winnersEl = document.getElementById('analysisStatWinners');
    var prizeEl = document.getElementById('analysisStatPrize');
    var sumEl = document.getElementById('analysisStatSum');

    if (drawsEl) drawsEl.textContent = draws;
    if (winnersEl) winnersEl.textContent = winners.toLocaleString();

    // Mobile Format
    if (prizeEl) {
        var isMobile = window.innerWidth < 768;
        if (isMobile) prizeEl.textContent = formatCompactNumber(prize);
        else prizeEl.textContent = "P " + prize.toLocaleString('en-US', { minimumFractionDigits: 2 });
    }

    if (sumEl) sumEl.textContent = avgSum;
}

// ==========================================
// PATTERN CALCULATOR (Pairs & Trios)
// ==========================================
function getCombinations(arr, k) {
    var result = [];
    function combine(start, combo) {
        if (combo.length === k) {
            result.push(combo.slice()); // copy
            return;
        }
        for (var i = start; i < arr.length; i++) {
            combo.push(arr[i]);
            combine(i + 1, combo);
            combo.pop();
        }
    }
    combine(0, []);
    return result;
}

function calculatePatterns(data) {
    var pairCounts = {};
    var trioCounts = {};

    data.forEach(function (d) {
        var nums = String(d.combination).split(/[-\s]+/).map(Number);

        // Get all pairs (2 numbers)
        var pairs = getCombinations(nums, 2);
        pairs.forEach(function (pair) {
            var key = pair.sort(function (a, b) { return a - b; }).join('-');
            pairCounts[key] = (pairCounts[key] || 0) + 1;
        });

        // Get all trios (3 numbers)
        var trios = getCombinations(nums, 3);
        trios.forEach(function (trio) {
            var key = trio.sort(function (a, b) { return a - b; }).join('-');
            trioCounts[key] = (trioCounts[key] || 0) + 1;
        });
    });

    // Sort by frequency
    var sortAndSlice = function (obj) {
        return Object.entries(obj)
            .map(function (entry) {
                return { combo: entry[0], count: entry[1] };
            })
            .sort(function (a, b) { return b.count - a.count; })
            .slice(0, 10);
    };

    return {
        pairs: sortAndSlice(pairCounts),
        trios: sortAndSlice(trioCounts)
    };
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderCharts(freqMap) {
    const hotGrid = document.getElementById('hotNumbersGrid');
    const coldGrid = document.getElementById('coldNumbersGrid');
    const chartDiv = document.getElementById('frequencyChart');
    const heatmapGrid = document.getElementById('heatmapGrid'); // NEW

    let sorted = Object.entries(freqMap).map(([num, count]) => ({ num, count }));
    sorted.sort((a, b) => b.count - a.count);

    // FIX: Removed optional chaining '?.' for compatibility
    var maxCount = (sorted[0] && sorted[0].count) ? sorted[0].count : 1;

    // Hot Numbers
    if (hotGrid) {
        const topHot = sorted.slice(0, 10);
        hotGrid.innerHTML = topHot.map((item, i) => {
            return '<div class="flex flex-col items-center gap-1">' +
                '<div class="relative">' +
                '<div class="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-red-400 to-red-600 rounded-full text-white text-lg font-black shadow-lg">' + item.num + '</div>' +
                '<span class="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 rounded-full text-[10px] flex items-center justify-center border border-red-400 text-red-400">' + (i + 1) + '</span>' +
                '</div>' +
                '<span class="text-[10px] text-slate-400 font-bold">' + item.count + 'x</span>' +
                '</div>';
        }).join('');
    }

    // Cold Numbers
    if (coldGrid) {
        const topCold = sorted.slice(-10).reverse();
        coldGrid.innerHTML = topCold.map((item, i) => {
            return '<div class="flex flex-col items-center gap-1">' +
                '<div class="relative">' +
                '<div class="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full text-white text-lg font-black shadow-lg">' + item.num + '</div>' +
                '<span class="absolute -top-1 -right-1 w-5 h-5 bg-slate-900 rounded-full text-[10px] flex items-center justify-center border border-cyan-400 text-cyan-400">' + (i + 1) + '</span>' +
                '</div>' +
                '<span class="text-[10px] text-slate-400 font-bold">' + item.count + 'x</span>' +
                '</div>';
        }).join('');
    }

    // Frequency Chart
    sorted.sort(function (a, b) { return parseInt(a.num) - parseInt(b.num); });

    if (chartDiv) {
        chartDiv.innerHTML = sorted.map(item => {
            var pct = (item.count / maxCount) * 100;
            return '<div class="flex items-center gap-3">' +
                '<div class="w-6 text-right text-xs font-bold text-slate-300">' + item.num + '</div>' +
                '<div class="flex-1 bg-slate-700 rounded-full h-4 overflow-hidden">' +
                '<div class="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500" style="width: ' + pct + '%"></div>' +
                '</div>' +
                '<div class="w-10 text-left text-xs font-bold text-slate-500">' + item.count + '</div>' +
                '</div>';
        }).join('');
    }

    // --- NEW: HEATMAP LOGIC ---
    // --- NEW: HEATMAP LOGIC ---
    if (heatmapGrid) {
        // Find Min/Max for color scaling
        const minCount = sorted[sorted.length - 1]?.count || 0;
        const range = maxCount - minCount;

        let heatmapHtml = '';

        // Sort keys numerically for the grid
        const allNums = Object.keys(freqMap).map(Number).sort((a, b) => a - b);

        allNums.forEach(num => {
            const count = freqMap[num] || 0;

            // Calculate Color Intensity (0 to 1)
            let intensity = 0;
            if (range > 0) {
                intensity = (count - minCount) / range;
            }

            // Determine Color Class
            let bgColor = '';
            let textColor = 'text-white';

            if (intensity > 0.7) {
                bgColor = 'bg-red-500'; // Hot
            } else if (intensity > 0.4) {
                bgColor = 'bg-orange-500'; // Warm
            } else if (intensity > 0.1) {
                bgColor = 'bg-slate-500'; // Neutral
            } else {
                bgColor = 'bg-blue-500'; // Cold
            }

            heatmapHtml += `
            <div class="flex flex-col items-center justify-center aspect-square rounded-md ${bgColor} ${textColor} relative group cursor-pointer hover:scale-110 transition-transform">
                <!-- CHANGED: text-lg makes it bigger -->
                <span class="text-lg font-bold">${num}</span>
                
                <!-- Tooltip on hover -->
                <div class="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-[10px] px-2 py-1 rounded z-10 whitespace-nowrap">
                    ${count} draws
                </div>
            </div>
        `;
        });

        heatmapGrid.innerHTML = heatmapHtml;
    }
}

function renderPatterns(patterns) {
    var pairContainer = document.getElementById('pairsContainer');
    var trioContainer = document.getElementById('triosContainer');

    // Render Pairs
    if (pairContainer && patterns.pairs.length > 0) {
        pairContainer.innerHTML = patterns.pairs.map(function (p) {
            var balls = p.combo.split('-').map(function (n) {
                return '<span class="w-7 h-7 flex items-center justify-center bg-blue-500/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30">' + n + '</span>';
            }).join('');

            return '<div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">' +
                '<div class="flex gap-2">' + balls + '</div>' +
                '<span class="text-sm font-bold text-white">' + p.count + 'x</span>' +
                '</div>';
        }).join('');
    }

    // Render Trios
    if (trioContainer && patterns.trios.length > 0) {
        trioContainer.innerHTML = patterns.trios.map(function (p) {
            var balls = p.combo.split('-').map(function (n) {
                return '<span class="w-7 h-7 flex items-center justify-center bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">' + n + '</span>';
            }).join('');

            return '<div class="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700">' +
                '<div class="flex gap-2">' + balls + '</div>' +
                '<span class="text-sm font-bold text-white">' + p.count + 'x</span>' +
                '</div>';
        }).join('');
    }
}