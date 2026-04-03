// js/modules/cs.utils.js

import { GAME_NAMES } from './cs.config.js';

export function getValidData(data) {
    const valid = ['6/58', '6/55', '6/49', '6/45', '6/42', '6D', '4D', '3D', '2D'];
    return data.filter(d => d.game && valid.some(g => d.game.includes(g)));
}

export function safeParseCombination(c) {
    if (!c) return [];
    if (Array.isArray(c)) return c.map(n => String(n).trim()).filter(n => n);
    return String(c).split(/[-\s,]+/).map(n => n.trim()).filter(n => n);
}

export function safeWinners(w) { return (w && w !== '0' && w !== 0) ? w : null; }

// Added formatPrize (essential for Single Result)
export function formatPrize(val) {
    if (!val) return '—';
    return String(val).replace(/₱(\d)/, '₱ $1').replace(/P(\d)/, 'P $1');
}

export function detectGameCode(str) {
    if (!str) return null; const lower = str.toLowerCase();
    if (lower.includes('ultra')) return '6/58'; if (lower.includes('grand')) return '6/55';
    if (lower.includes('super')) return '6/49'; if (lower.includes('mega')) return '6/45';
    if (lower.includes('6/42')) return '6/42'; if (lower.includes('6d')) return '6D';
    if (lower.includes('4d')) return '4D'; if (lower.includes('3d')) return '3D'; if (lower.includes('2d')) return '2D';
    return null;
}

export function generateSmartNumbers(data, game) {
    const gameData = data.filter(d => d.game.includes(game));
    if (gameData.length === 0) return [];
    const freq = {};
    gameData.forEach(draw => {
        const nums = safeParseCombination(draw.combination);
        nums.forEach(n => { freq[n] = (freq[n] || 0) + 1; });
    });
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const neededMap = { '6D': 6, '4D': 4, '3D': 3, '2D': 2 };
    const count = neededMap[game] || 6;
    return sorted.slice(0, count).map(pair => pair[0]);
}

export function get14DayPeriod() {
    const start = new Date(); const end = new Date(); end.setDate(end.getDate() + 13); 
    const options = { month: 'short', day: 'numeric' };
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
}

export function formatDateFilename(date) {
    const m = String(date.getMonth() + 1).padStart(2, '0'); 
    const d = String(date.getDate()).padStart(2, '0'); 
    const y = date.getFullYear();
    return `${m}${d}${y}`;
}

export function cleanGameName(game) { 
    return GAME_NAMES[game].replace(/\s/g, '-').replace(/\//g, '-'); 
}

export const stripHTML = (html) => html ? html.replace(/<[^>]*>?/gm, '') : '';