'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  GAME_NAMES,
  GAME_COLORS_HEX,
  BLUEPRINT_SCHEDULE,
  SCHEDULE_MAP,
} from '@/lib/banner/config';
import type { LottoResult, BlueprintNumber, NumberData } from '@/lib/banner/types';
import {
  generateBlueprintNumbers,
  calculateFrequency,
  classifyNumbers,
  filterByGame,
  getLatestDraw,
  getDrawByDate,
  getYesterdayPH,
  getTodayPH,
  getYesterdayDraws,
  getGameCodeFromResult,
  getDayOfWeekPH,
  getDayNamePH,
} from '@/lib/banner/analysis';
import BlueprintBanner from '@/components/banner/BlueprintBanner';
import AnalysisBanner from '@/components/banner/AnalysisBanner';
import {
  generateBlueprintCaptionV2,
  generateAnalysisCaption,
  generateDailyWinnersCaption,
  generatePulseCaption,
} from '@/lib/banner/captions';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import {
  Download,
  Copy,
  Check,
  FileJson,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
  Clock,
  Loader2,
  Archive,
  Zap,
  Calendar,
} from 'lucide-react';

// ==========================================
// CLIENT-SIDE DATE PARSER
// ==========================================
function parseLottoDateClient(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = String(dateStr).split(' ')[0];
  const parts = clean.split(/[\/\-T]/);
  if (parts.length >= 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2raw = parts[2].split(/[^0-9]/)[0];
    const p2 = parseInt(p2raw, 10);
    if (isNaN(p0) || isNaN(p1) || isNaN(p2)) return null;
    let year: number, month: number, day: number;
    if (p0 > 100) { year = p0; month = p1; day = p2; }
    else { month = p0; day = p1; year = p2 < 100 ? p2 + 2000 : p2; }
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ==========================================
// GAME OPTIONS (shared constant)
// ==========================================
const GAME_OPTIONS = [
  { value: '6/58', label: 'Ultra Lotto 6/58' },
  { value: '6/55', label: 'Grand Lotto 6/55' },
  { value: '6/49', label: 'Super Lotto 6/49' },
  { value: '6/45', label: 'Mega Lotto 6/45' },
  { value: '6/42', label: 'Lotto 6/42' },
  { value: '6D', label: '6D Lotto' },
  { value: '4D', label: '4D Lotto' },
  { value: '3D', label: '3D Swertres' },
  { value: '2D', label: '2D EZ2' },
];

// ==========================================
// MODE CONFIG
// ==========================================
type BannerMode = 'blueprint' | 'analysis' | 'winners' | 'pulse';

const MODE_CONFIG: Record<BannerMode, { label: string; icon: string; color: string; bgColor: string; desc: string }> = {
  blueprint: { label: 'Blueprint', icon: '📐', color: 'text-blue-400', bgColor: 'bg-blue-600', desc: 'Data-driven number combinations' },
  analysis:  { label: 'Analysis',  icon: '🔍', color: 'text-purple-400', bgColor: 'bg-purple-600', desc: "Yesterday's draw pattern breakdown — posted today for best reach" },
  winners:   { label: 'Winners',   icon: '🏆', color: 'text-amber-400', bgColor: 'bg-amber-600', desc: 'Daily draw results' },
  pulse:     { label: 'PULSE',     icon: '⚡', color: 'text-rose-400', bgColor: 'bg-rose-600', desc: '2D + 3D combo insights' },
};

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function BannerCreatorStudio() {
  // ---- Core state ----
  const [allData, setAllData] = useState<LottoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<BannerMode>('blueprint');

  // ---- Caption state ----
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  // ---- Blueprint ----
  const [blueprintGame, setBlueprintGame] = useState('6/58');
  const [blueprintDate, setBlueprintDate] = useState('');
  const [blueprintNumbers, setBlueprintNumbers] = useState<BlueprintNumber[]>([]);

  // ---- Analysis ----
  const [analysisGame, setAnalysisGame] = useState('6/58');
  const [analysisDraw, setAnalysisDraw] = useState<LottoResult | null>(null);
  const [analysisDate, setAnalysisDate] = useState('');
  const [analysisClassified, setAnalysisClassified] = useState<NumberData[]>([]);
  const [analysisGameData, setAnalysisGameData] = useState<LottoResult[]>([]);
  const [analysisTargetDate, setAnalysisTargetDate] = useState<string>(''); // YYYY-MM-DD of the draw being analyzed

  // ---- Winners ----
  const [winnersDate, setWinnersDate] = useState('');
  const [winnersImageUrl, setWinnersImageUrl] = useState<string | null>(null);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [winnersError, setWinnersError] = useState<string | null>(null);

  // ---- PULSE ----
  const [pulseSlot, setPulseSlot] = useState<'2PM' | '5PM' | '9PM'>('2PM');
  const [pulseImageUrl, setPulseImageUrl] = useState<string | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);
  const [pulseError, setPulseError] = useState<string | null>(null);

  // ---- Publish state ----
  const [publishPlatform, setPublishPlatform] = useState('facebook');
  const [publishTestMode, setPublishTestMode] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [publishScheduleType, setPublishScheduleType] = useState<'now' | 'scheduled'>('now');
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('09:00');

  // ---- Refs ----
  const captureBlueprintRef = useRef<HTMLDivElement>(null);
  const captureAnalysisRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // HELPERS
  // ==========================================
  const todayDayOfWeek = new Date().getDay();
  const todayScheduledGames = SCHEDULE_MAP[todayDayOfWeek] || [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const activeModeConfig = MODE_CONFIG[mode];

  // ==========================================
  // SCHEDULE-AWARE DEFAULTS
  // ==========================================
  useEffect(() => {
    const scheduledGames = SCHEDULE_MAP[new Date().getDay()] || [];
    if (scheduledGames.length > 0) {
      setBlueprintGame(scheduledGames[0]);
      setAnalysisGame(scheduledGames[0]);
    }
  }, []);

  // Set default dates
  useEffect(() => {
    const phTime = new Date(Date.now() + (new Date().getTimezoneOffset() * 60000) + 3600000 * 8);
    setBlueprintDate(phTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    const yesterday = new Date(phTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    setWinnersDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // ==========================================
  // LOAD DATA
  // ==========================================
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/results');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: LottoResult[] = await res.json();
        setAllData(data);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Auto-set Winners date to the latest available date if yesterday has no data.
  // This prevents showing "No draws found" when data hasn't been updated yet.
  useEffect(() => {
    if (allData.length > 0 && winnersDate) {
      const hasYesterdayData = allData.some(d => {
        const drawDate = d.date.split('T')[0].split(' ')[0];
        return drawDate === winnersDate;
      });
      if (!hasYesterdayData) {
        // Find the latest date in the data
        const allDates = [...new Set(allData.map(d => {
          const raw = d.date.split('T')[0].split(' ')[0];
          return raw;
        }))].sort().reverse();
        // Filter out obviously fake/future dates (like 2099)
        const validDates = allDates.filter(d => {
          const year = parseInt(d.split('-')[0], 10);
          return year <= new Date().getFullYear() + 1;
        });
        if (validDates.length > 0) {
          setWinnersDate(validDates[0]);
        }
      }
    }
  }, [allData, winnersDate]);

  // ==========================================
  // CAPTIONS (useMemo per mode)
  // ==========================================
  const blueprintCaption = useMemo(() => {
    return generateBlueprintCaptionV2(new Date().getDate(), blueprintGame);
  }, [blueprintGame]);

  const analysisCaption = useMemo(() => {
    if (!analysisDraw) return '';
    const nums = analysisDraw.combination.split(/[-,\s]+/).map(Number).filter(n => !isNaN(n));
    return generateAnalysisCaption(analysisGame, GAME_NAMES[analysisGame], analysisDraw.date, nums, analysisGameData);
  }, [analysisDraw, analysisGame, analysisGameData]);

  const winnersCaption = useMemo(() => {
    if (!winnersDate) return '';
    return generateDailyWinnersCaption(winnersDate, ['6/58', '6/55', '6/49', '6/45', '6/42']);
  }, [winnersDate]);

  const pulseCaption = useMemo(() => generatePulseCaption(pulseSlot), [pulseSlot]);

  const activeCaption = useMemo(() => {
    switch (mode) {
      case 'blueprint': return blueprintCaption;
      case 'analysis': return analysisCaption;
      case 'winners': return winnersCaption;
      case 'pulse': return pulseCaption;
    }
  }, [mode, blueprintCaption, analysisCaption, winnersCaption, pulseCaption]);

  // ==========================================
  // COPY CAPTION
  // ==========================================
  const handleCopyCaption = useCallback(async () => {
    if (!activeCaption) return;
    try {
      await navigator.clipboard.writeText(activeCaption);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = activeCaption;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  }, [activeCaption]);

  // ==========================================
  // BLUEPRINT
  // ==========================================
  const handleGenerateBlueprint = useCallback(() => {
    if (allData.length === 0) return;
    const gameData = filterByGame(allData, blueprintGame);
    setBlueprintNumbers(generateBlueprintNumbers(gameData, blueprintGame, 20));
  }, [allData, blueprintGame]);

  useEffect(() => {
    if (allData.length > 0 && blueprintNumbers.length === 0) handleGenerateBlueprint();
  }, [allData, blueprintNumbers.length, handleGenerateBlueprint]);

  // ==========================================
  // ANALYSIS — Always uses YESTERDAY's draw
  // Business rule: Last draw is at 9PM. Posting late hurts reach.
  // So analysis always targets yesterday's draws, published today.
  // Uses PCSO schedule (SCHEDULE_MAP) to know which games drew yesterday.
  // ==========================================
  const yesterdayPH = useMemo(() => getYesterdayPH(), []);
  const yesterdayDayName = useMemo(() => getDayNamePH(yesterdayPH), [yesterdayPH]);
  const yesterdayDow = useMemo(() => getDayOfWeekPH(yesterdayPH), [yesterdayPH]);
  const scheduledGames = useMemo(() => SCHEDULE_MAP[yesterdayDow] || [], [yesterdayDow]);
  const yesterdayDraws = useMemo(() => getYesterdayDraws(allData), [allData]);

  const handleSelectDraw = useCallback((draw: LottoResult) => {
    const gameCode = getGameCodeFromResult(draw);
    const gameData = filterByGame(allData, gameCode);
    const freqMap = calculateFrequency(gameData, gameCode);
    const classified = classifyNumbers(freqMap);
    const dateObj = parseLottoDateClient(draw.date);
    const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : draw.date;
    setAnalysisGame(gameCode);
    setAnalysisDraw(draw);
    setAnalysisDate(dateStr);
    setAnalysisTargetDate(getYesterdayPH());
    setAnalysisClassified(classified);
    setAnalysisGameData(gameData);
  }, [allData]);

  // Auto-select first draw when data loads
  useEffect(() => {
    if (allData.length > 0 && !analysisDraw && yesterdayDraws.length > 0) {
      handleSelectDraw(yesterdayDraws[0]);
    }
  }, [allData, analysisDraw, yesterdayDraws, handleSelectDraw]);

  // ==========================================
  // WINNERS
  // ==========================================
  const handleGenerateWinners = useCallback(async () => {
    if (!winnersDate) return;
    setWinnersLoading(true);
    setWinnersError(null);
    setWinnersImageUrl(null);
    try {
      const res = await fetch(`/api/daily-winners?date=${winnersDate}&t=${Date.now()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed' }));
        setWinnersError(errData.error || `Error ${res.status}`);
        return;
      }
      setWinnersImageUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      setWinnersError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setWinnersLoading(false);
    }
  }, [winnersDate]);

  const handleDownloadWinners = () => {
    if (!winnersDate) return;
    const link = document.createElement('a');
    link.href = `/api/daily-winners?date=${winnersDate}&download=true&t=${Date.now()}`;
    link.download = `DailyWinners_${winnersDate}.png`;
    link.click();
  };

  // ==========================================
  // PULSE
  // ==========================================
  const handleGeneratePulse = useCallback(async () => {
    setPulseLoading(true);
    setPulseError(null);
    setPulseImageUrl(null);
    try {
      const res = await fetch(`/api/pulse?slot=${pulseSlot}&t=${Date.now()}`);
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const json = await res.json();
        if (!json.data) { setPulseError('No draw data available yet.'); return; }
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed' }));
        setPulseError(errData.error || `Error ${res.status}`);
        return;
      }
      setPulseImageUrl(URL.createObjectURL(await res.blob()));
    } catch (err) {
      setPulseError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setPulseLoading(false);
    }
  }, [pulseSlot]);

  useEffect(() => {
    if (mode === 'pulse' && !pulseImageUrl && !pulseLoading) handleGeneratePulse();
  }, [mode]);

  useEffect(() => {
    if (mode === 'pulse') handleGeneratePulse();
  }, [pulseSlot]);

  const handleDownloadPulse = () => {
    if (!pulseImageUrl) return;
    const link = document.createElement('a');
    link.href = `/api/pulse?slot=${pulseSlot}&download=true&t=${Date.now()}`;
    link.download = `PULSE_${pulseSlot}_${new Date().toISOString().split('T')[0]}.png`;
    link.click();
  };

  // Cleanup blob URLs
  useEffect(() => () => { if (pulseImageUrl) URL.revokeObjectURL(pulseImageUrl); }, [pulseImageUrl]);
  useEffect(() => () => { if (winnersImageUrl) URL.revokeObjectURL(winnersImageUrl); }, [winnersImageUrl]);

  // ==========================================
  // CAPTURE & DOWNLOAD
  // ==========================================
  const handleDownloadSingle = async (ref: React.RefObject<HTMLDivElement | null>, filename: string) => {
    if (!ref.current) return;
    try {
      setGenerating(true);
      const dataUrl = await toPng(ref.current, { quality: 1.0, pixelRatio: 2, backgroundColor: '#111E44', cacheBust: true });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Capture failed:', err);
      alert('Capture failed. Check the console.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadBlueprint = () => {
    const name = GAME_NAMES[blueprintGame].replace(/[\s/]/g, '-');
    handleDownloadSingle(captureBlueprintRef, `Blueprint_${name}_${new Date().toISOString().split('T')[0]}.png`);
  };

  const handleDownloadAnalysis = () => {
    if (!analysisDraw) return;
    const d = parseLottoDateClient(analysisDraw.date);
    const dateStr = d ? d.toISOString().split('T')[0] : analysisDraw.date.replace(/\//g, '-');
    const name = GAME_NAMES[analysisGame].replace(/[\s/]/g, '-');
    handleDownloadSingle(captureAnalysisRef, `Analysis_${name}_${dateStr}.png`);
  };

  // ==========================================
  // BATCH BLUEPRINT (30-day ZIP)
  // ==========================================
  const handleBatchBlueprint = async () => {
    if (allData.length === 0 || generating) return;
    setGenerating(true);
    try {
      const zip = new JSZip();
      const startDate = new Date();
      const container = document.createElement('div');
      container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1';
      document.body.appendChild(container);

      for (let i = 0; i < 30; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const scheduledGames = BLUEPRINT_SCHEDULE[currentDate.getDay()] || [];

        for (const game of scheduledGames) {
          const gameData = filterByGame(allData, game);
          const numbers = generateBlueprintNumbers(gameData, game, 20);
          const gameName = GAME_NAMES[game] || game;
          const circleColor = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
          const colLefts = [201, 335, 469, 603, 737];

          const bannerDiv = document.createElement('div');
          bannerDiv.style.cssText = 'width:1080px;height:1350px;background:#111E44;font-family:Montserrat,sans-serif;position:relative';
          let html = '';
          html += `<div style="width:136px;height:136px;left:64px;top:64px;position:absolute;border-radius:9999px;overflow:hidden;background:rgba(255,255,255,0.10);"><img src="/banner-assets/logo.png" style="width:136px;height:136px;object-fit:cover;display:block;"/></div>`;
          html += `<div style="width:136px;height:136px;left:880px;top:64px;position:absolute;border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.90);display:flex;align-items:center;justify-content:center;"><img src="/banner-assets/qrcode.png" style="width:120px;height:120px;object-fit:contain;display:block;"/></div>`;
          html += `<div style="width:682px;height:83px;left:199px;top:90px;position:absolute;text-align:center;"><span style="color:white;font-size:68px;font-weight:800;">Lottong</span><span style="color:#3B82F6;font-size:68px;font-weight:800;"> Pinoy</span></div>`;
          html += `<div style="width:672px;left:209px;top:186px;position:absolute;text-align:center;color:rgba(255,255,255,0.40);font-size:22px;font-weight:700;letter-spacing:3.25px;">DATA-DRIVEN COMBINATIONS</div>`;
          html += `<div style="width:1080px;left:0px;top:225px;position:absolute;text-align:center;color:white;font-size:44px;font-weight:800;letter-spacing:3px;">WEEKLY BLUEPRINT</div>`;
          html += `<div style="width:1080px;left:0px;top:326px;position:absolute;text-align:center;color:white;font-size:38px;font-weight:800;letter-spacing:2px;">${gameName}</div>`;
          html += `<div style="position:absolute;top:422px;left:0;width:1080px;display:flex;justify-content:center;gap:90px;">`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">🔥 HOT</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(High occurrence)</span></div>`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">🌡️ WARM</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(Avg. occurrence)</span></div>`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">❄️ COLD</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(Low Occurrence)</span></div>`;
          html += `</div>`;
          const batchRowTops = [542, 685, 828, 971];
          numbers.forEach((item, index) => {
            const col = index % 5, row = Math.floor(index / 5);
            const left = colLefts[col], top = batchRowTops[row];
            html += `<div style="width:116px;height:116px;left:${left}px;top:${top}px;position:absolute;background:${circleColor};border-radius:9999px;border:4px solid rgba(255,255,255,0.20);"></div>`;
            html += `<div style="width:104px;height:116px;left:${left + 6}px;top:${top}px;position:absolute;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-size:35px;font-weight:700;line-height:20px;letter-spacing:1.75;">${String(item.number).padStart(2, '0')}</div>`;
            html += `<div style="left:${left + 70}px;top:${top - 8}px;position:absolute;font-size:42px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${item.emoji}</div>`;
          });
          html += `<div style="width:952px;left:64px;top:1169px;position:absolute;text-align:center;color:rgba(255,255,255,0.60);font-size:18px;font-weight:500;letter-spacing:1px;line-height:1.4;">18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.</div>`;
          html += `<div style="width:1080px;height:46px;left:0px;top:1240px;position:absolute;text-align:center;color:white;font-size:26px;font-weight:700;">lottong-pinoy.com</div>`;
          bannerDiv.innerHTML = html;
          container.appendChild(bannerDiv);
          await new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); });
          await new Promise<void>((r) => setTimeout(r, 100));
          const dataUrl = await toPng(bannerDiv, { quality: 1.0, pixelRatio: 2, backgroundColor: '#111E44', cacheBust: true });
          const m = String(currentDate.getMonth() + 1).padStart(2, '0');
          const d = String(currentDate.getDate()).padStart(2, '0');
          const y = currentDate.getFullYear();
          zip.file(`Blueprint_${m}${d}${y}_${gameName.replace(/[\s/]/g, '-')}.png`, dataUrl.split(',')[1], { base64: true });
          container.removeChild(bannerDiv);
        }
      }
      document.body.removeChild(container);
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Weekly_Blueprint_30Day.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error('Batch failed:', err);
      alert('Batch generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  // ==========================================
  // PUBLISH (inline)
  // ==========================================
  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: publishPlatform,
          caption: activeCaption,
          bannerType: mode,
          game: mode === 'blueprint' ? blueprintGame : mode === 'analysis' ? analysisGame : mode === 'pulse' ? `PULSE-${pulseSlot}` : 'all',
          testMode: publishTestMode,
          scheduledAt: publishScheduleType === 'scheduled' ? `${publishDate}T${publishTime}:00` : null,
        }),
      });
      const result = await res.json();
      if (publishTestMode) {
        alert(`Test mode: Would have published to ${publishPlatform}.\n\nResult: ${JSON.stringify(result, null, 2)}`);
      } else {
        alert(result.success ? 'Published successfully!' : `Publish failed: ${result.error}`);
      }
    } catch (err) {
      alert(`Connection error: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setPublishing(false);
    }
  };

  const handleExportQueue = () => {
    const now = new Date();
    const scheduledDate = now.toISOString().split('T')[0];
    const game = mode === 'blueprint' ? blueprintGame : mode === 'analysis' ? analysisGame : mode === 'pulse' ? `PULSE-${pulseSlot}` : 'all';
    const exportData = {
      items: [{
        type: mode,
        game,
        caption: activeCaption,
        scheduledDate,
        platform: publishPlatform,
        action: {
          type: 'post' as const,
          text: activeCaption,
          imagePath: `${mode}_${game.replace(/[/\s]/g, '-')}_${scheduledDate}.png`,
        },
      }],
      meta: { exportedAt: now.toISOString(), source: 'Lottong Pinoy', version: '2.0.0' },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `export-queue-${scheduledDate}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // ==========================================
  // RENDER: LOADING
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-pulse">🎰</div>
          <div className="text-white text-xl font-bold">Loading Lotto Data...</div>
          <div className="text-gray-400 mt-2 text-sm">Connecting to data source</div>
        </div>
      </div>
    );
  }

  // ==========================================
  // DERIVED STATE
  // ==========================================
  const currentGame = mode === 'blueprint' ? blueprintGame : mode === 'analysis' ? analysisGame : '';
  const currentGameName = GAME_NAMES[currentGame] || '';
  const isScheduledToday = mode !== 'winners' && mode !== 'pulse' && todayScheduledGames.includes(currentGame);
  const canDownload = mode === 'blueprint' ? blueprintNumbers.length > 0
    : mode === 'analysis' ? !!analysisDraw
    : mode === 'winners' ? !!winnersImageUrl
    : !!pulseImageUrl;

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="min-h-screen bg-gray-950">
      {/* ===== HEADER ===== */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-extrabold text-lg">LP</div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Lottong Pinoy</h1>
              <p className="text-gray-500 text-xs">Banner Creator Studio</p>
            </div>
          </div>
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">
            {allData.length.toLocaleString()} draws
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ===== 1. MODE SELECTOR ===== */}
        <div className="flex items-center gap-2">
          {(Object.entries(MODE_CONFIG) as [BannerMode, typeof MODE_CONFIG.blueprint][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                mode === key
                  ? `${cfg.bgColor} text-white shadow-lg`
                  : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800'
              }`}
            >
              <span className="text-base">{cfg.icon}</span>
              <span>{cfg.label}</span>
            </button>
          ))}
        </div>

        {/* Mode description */}
        <p className={`text-xs text-center ${activeModeConfig.color} -mt-2`}>
          {activeModeConfig.desc}
        </p>

        {/* ===== 2. CONTENT AREA ===== */}
        {mode === 'analysis' ? (
          /* ========== ANALYSIS: 2-COLUMN LAYOUT ========== */
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* LEFT COLUMN: Yesterday's Draw List */}
            <div className="lg:col-span-2 space-y-3">
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-white text-sm font-semibold">{yesterdayDayName}'s Draws</span>
                    </div>
                    <Badge variant="outline" className="text-purple-400 border-purple-400/30 bg-purple-400/10 text-xs">
                      {yesterdayDraws.length} draws
                    </Badge>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-snug">
                    {scheduledGames.map(g => GAME_NAMES[g] || g).join(', ')} + 3D &amp; 2D (daily)
                  </p>

                  {yesterdayDraws.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-6">No draws found for {yesterdayDayName}. Data may not be available yet.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[calc(100vh-240px)] overflow-y-auto pr-1">
                      {yesterdayDraws.map((draw, idx) => {
                        const gameCode = getGameCodeFromResult(draw);
                        const gameName = GAME_NAMES[gameCode] || gameCode;
                        const gameColor = GAME_COLORS_HEX[gameCode] || 'rgba(37, 99, 235, 0.60)';
                        const isSelected = analysisDraw && analysisDraw.combination === draw.combination && analysisDraw.date === draw.date;
                        return (
                          <button
                            key={`${draw.game}-${draw.date}-${idx}`}
                            onClick={() => handleSelectDraw(draw)}
                            className={`w-full text-left rounded-lg px-3 py-2.5 transition-all duration-150 border ${
                              isSelected
                                ? 'bg-purple-600/20 border-purple-500/50 ring-1 ring-purple-500/30'
                                : 'bg-gray-800/50 border-gray-700/50 hover:bg-gray-800 hover:border-gray-600'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-2 h-8 rounded-full shrink-0"
                                style={{ backgroundColor: gameColor }}
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-white text-xs font-semibold truncate">{gameName}</span>
                                  {isSelected && (
                                    <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  )}
                                </div>
                                <span className="text-gray-400 text-[11px] font-mono tracking-wide">{draw.combination}</span>
                                {draw.originalGame && (
                                  <span className="text-gray-600 text-[10px]">{draw.originalGame}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Preview + Caption */}
            <div className="lg:col-span-3 space-y-4">
              {/* Banner Preview */}
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Preview</span>
                    {analysisDraw && (
                      <span className="text-gray-600 text-xs">— {GAME_NAMES[analysisGame] || analysisGame}</span>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 shadow-xl">
                      <div style={{ width: 324, height: 405, overflow: 'hidden', borderRadius: 8, position: 'relative' }}>
                        <div style={{ transform: 'scale(0.3)', transformOrigin: 'top left', width: 1080, height: 1350 }}>
                          {analysisDraw ? (
                            <AnalysisBanner game={analysisGame} gameName={GAME_NAMES[analysisGame]} date={analysisDate} draw={analysisDraw} classifiedNumbers={analysisClassified} gameData={analysisGameData} />
                          ) : (
                            <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>Select a draw from the left</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs text-center mt-2">1080 x 1350px &middot; Scaled 30% &middot; Downloads at full resolution</p>
                </CardContent>
              </Card>

              {/* Download Button */}
              <Button
                onClick={handleDownloadAnalysis}
                disabled={!analysisDraw || generating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-6 w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                {generating ? 'Generating...' : 'Download PNG'}
              </Button>

              {/* Caption */}
              {analysisCaption && (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4 pb-4 px-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Caption</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 text-xs">{analysisCaption.length} chars</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopyCaption}
                          className="h-7 px-2.5 text-gray-400 hover:text-white hover:bg-gray-800 text-xs"
                        >
                          {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedCaption ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                    </div>
                    <div
                      className={`text-gray-300 text-sm leading-relaxed whitespace-pre-line font-mono bg-gray-800/50 rounded-lg p-3 ${
                        !captionExpanded ? 'max-h-24 overflow-hidden relative' : ''
                      }`}
                    >
                      {analysisCaption}
                      {!captionExpanded && (
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-800/80 to-transparent rounded-b-lg" />
                      )}
                    </div>
                    <button
                      onClick={() => setCaptionExpanded(!captionExpanded)}
                      className="text-gray-500 text-xs hover:text-gray-300 mt-2 flex items-center gap-1 transition-colors"
                    >
                      {captionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {captionExpanded ? 'Show less' : 'Show full caption'}
                    </button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          /* ========== NON-ANALYSIS MODES: ORIGINAL FLOW ========== */
          <>
            {/* CONTROLS STRIP */}
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-4 px-5">
                <div className="flex flex-wrap items-end gap-4">

                  {/* Game selector (Blueprint only — Analysis uses the list) */}
                  {mode === 'blueprint' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Game</Label>
                      <Select
                        value={blueprintGame}
                        onValueChange={(v) => { setBlueprintGame(v); setBlueprintNumbers([]); }}
                      >
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-52 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {GAME_OPTIONS.map(g => (
                            <SelectItem key={g.value} value={g.value} className="text-white focus:bg-gray-700 focus:text-white text-sm">
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date picker (Winners) */}
                  {mode === 'winners' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Draw Date</Label>
                      <div className="flex items-center gap-2">
                        <div className="bg-gray-800 border border-gray-700 rounded-md px-3 h-9 flex items-center">
                          <input
                            type="date"
                            value={winnersDate}
                            onChange={(e) => { setWinnersDate(e.target.value); setWinnersImageUrl(null); setWinnersError(null); }}
                            className="bg-transparent border-none outline-none text-white text-sm w-full [color-scheme:dark]"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Calendar className="w-3 h-3 text-amber-400" />
                          <span className="text-amber-400 text-[10px] font-medium whitespace-nowrap">Defaults to yesterday</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Time slot selector (PULSE) */}
                  {mode === 'pulse' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Draw Slot</Label>
                      <Select value={pulseSlot} onValueChange={(v) => { setPulseSlot(v as '2PM' | '5PM' | '9PM'); setPulseImageUrl(null); setPulseError(null); }}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-44 h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="2PM" className="text-white focus:bg-gray-700">2PM - Alas-Dos</SelectItem>
                          <SelectItem value="5PM" className="text-white focus:bg-gray-700">5PM - Alas-Singko</SelectItem>
                          <SelectItem value="9PM" className="text-white focus:bg-gray-700">9PM - Alas-Nwebe</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Blueprint date (read-only) */}
                  {mode === 'blueprint' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-gray-400">Date</Label>
                      <div className="bg-gray-800 border border-gray-700 rounded-md px-3 h-9 flex items-center text-white text-sm truncate max-w-48">
                        {blueprintDate}
                      </div>
                    </div>
                  )}

                  {/* Scheduled indicator */}
                  {isScheduledToday && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400 text-xs font-medium">Draw today ({dayNames[todayDayOfWeek]})</span>
                    </div>
                  )}

                  {/* Blueprint stats */}
                  {mode === 'blueprint' && blueprintNumbers.length > 0 && (
                    <div className="text-xs text-gray-400 flex gap-2">
                      <span className="text-white">{blueprintNumbers.filter(n => n.category === 'hot').length} hot</span>
                      <span className="text-white">{blueprintNumbers.filter(n => n.category === 'warm').length} warm</span>
                      <span className="text-white">{blueprintNumbers.filter(n => n.category === 'cold').length} cold</span>
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {mode === 'blueprint' && (
                      <Button onClick={handleGenerateBlueprint} variant="outline" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-9 text-xs">
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Regenerate
                      </Button>
                    )}

                    {mode === 'winners' && (
                      <Button onClick={handleGenerateWinners} disabled={!winnersDate || winnersLoading} className={`${activeModeConfig.bgColor} hover:opacity-90 text-white h-9 text-xs`}>
                        {winnersLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />} Generate
                      </Button>
                    )}

                    {mode === 'pulse' && (
                      <Button onClick={handleGeneratePulse} disabled={pulseLoading} className={`${activeModeConfig.bgColor} hover:opacity-90 text-white h-9 text-xs`}>
                        {pulseLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />} Generate
                      </Button>
                    )}
                  </div>
                </div>

                {/* Error display */}
                {(winnersError || pulseError) && (
                  <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                    <p className="text-red-400 text-xs">{winnersError || pulseError}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BANNER PREVIEW */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 w-full">
                <div className="h-px bg-gray-800 flex-1" />
                <span className="text-gray-500 text-xs font-medium uppercase tracking-widest px-3">Preview</span>
                <div className="h-px bg-gray-800 flex-1" />
              </div>

              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 shadow-2xl">
                <div style={{ width: 324, height: 405, overflow: 'hidden', borderRadius: 8, position: 'relative' }}>
                  <div style={{ transform: 'scale(0.3)', transformOrigin: 'top left', width: 1080, height: 1350 }}>
                    {mode === 'pulse' && pulseImageUrl ? (
                      <img src={pulseImageUrl} alt="PULSE" style={{ width: 1080, height: 1350 }} />
                    ) : mode === 'winners' && winnersImageUrl ? (
                      <img src={winnersImageUrl} alt="Winners" style={{ width: 1080, height: 1350 }} />
                    ) : mode === 'blueprint' && blueprintNumbers.length > 0 ? (
                      <BlueprintBanner game={blueprintGame} numbers={blueprintNumbers} />
                    ) : mode === 'winners' && winnersLoading ? (
                      <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>Generating...</span>
                      </div>
                    ) : mode === 'pulse' && pulseLoading ? (
                      <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>Generating PULSE...</span>
                      </div>
                    ) : mode === 'winners' ? (
                      <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 32 }}>🏆</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 24 }}>Pick a date and click Generate</span>
                      </div>
                    ) : (
                      <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>Generating...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 text-xs">1080 x 1350px &middot; Scaled 30% &middot; Downloads at full resolution</p>
            </div>

            {/* DOWNLOAD ACTIONS */}
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => {
                  if (mode === 'blueprint') handleDownloadBlueprint();
                  else if (mode === 'winners') handleDownloadWinners();
                  else handleDownloadPulse();
                }}
                disabled={!canDownload || generating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-6"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>

              {mode === 'blueprint' && (
                <Button onClick={handleBatchBlueprint} disabled={generating} variant="outline" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800 h-10 px-6">
                  <Archive className="w-4 h-4 mr-2" />
                  {generating ? 'Generating...' : '30-Day ZIP'}
                </Button>
              )}
            </div>

            {/* CAPTION */}
            {activeCaption && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="pt-4 pb-4 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">Caption</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs">{activeCaption.length} chars</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCaption}
                        className="h-7 px-2.5 text-gray-400 hover:text-white hover:bg-gray-800 text-xs"
                      >
                        {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedCaption ? 'Copied' : 'Copy'}
                      </Button>
                    </div>
                  </div>
                  <div
                    className={`text-gray-300 text-sm leading-relaxed whitespace-pre-line font-mono bg-gray-800/50 rounded-lg p-3 ${
                      !captionExpanded ? 'max-h-24 overflow-hidden relative' : ''
                    }`}
                  >
                    {activeCaption}
                    {!captionExpanded && (
                      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-800/80 to-transparent rounded-b-lg" />
                    )}
                  </div>
                  <button
                    onClick={() => setCaptionExpanded(!captionExpanded)}
                    className="text-gray-500 text-xs hover:text-gray-300 mt-2 flex items-center gap-1 transition-colors"
                  >
                    {captionExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {captionExpanded ? 'Show less' : 'Show full caption'}
                  </button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ===== 6. QUICK PUBLISH ===== */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="pt-4 pb-4 px-5 space-y-4">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-400" />
              <span className="text-white text-sm font-semibold">Quick Publish</span>
              <span className="text-gray-500 text-xs">Post this banner to social media</span>
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Platform selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Platform</Label>
                <div className="flex items-center gap-1.5">
                  {[
                    { value: 'facebook', icon: '📘', label: 'Facebook' },
                    { value: 'instagram', icon: '📸', label: 'Instagram' },
                    { value: 'twitter', icon: '𝕏', label: 'Twitter' },
                  ].map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPublishPlatform(p.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        publishPlatform === p.value
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                      }`}
                    >
                      <span>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Schedule</Label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPublishScheduleType('now')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      publishScheduleType === 'now'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    Post Now
                  </button>
                  <button
                    onClick={() => setPublishScheduleType('scheduled')}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      publishScheduleType === 'scheduled'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 border border-gray-700'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
              </div>

              {/* Schedule date/time (conditional) */}
              {publishScheduleType === 'scheduled' && (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={publishDate}
                    onChange={(e) => setPublishDate(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white text-xs h-9 w-36 [color-scheme:dark]"
                  />
                  <Input
                    type="time"
                    value={publishTime}
                    onChange={(e) => setPublishTime(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white text-xs h-9 w-28 [color-scheme:dark]"
                  />
                </div>
              )}

              {/* Spacer */}
              <div className="flex-1" />

              {/* Test mode toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="test-mode"
                  checked={publishTestMode}
                  onCheckedChange={setPublishTestMode}
                  className="data-[state=checked]:bg-amber-500"
                />
                <Label htmlFor="test-mode" className="text-xs text-gray-400 cursor-pointer">
                  Test Mode
                </Label>
              </div>
            </div>

            {/* Test mode warning */}
            {publishTestMode && (
              <p className="text-amber-400/70 text-xs">⚠️ Test Mode — simulates publishing without actually posting</p>
            )}

            {/* Publish + Export buttons */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handlePublish}
                disabled={publishing || !activeCaption}
                className={`font-semibold h-10 px-6 ${
                  publishTestMode
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {publishing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Publishing...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> {publishTestMode ? 'Test Publish' : 'Publish Now'}</>
                )}
              </Button>

              <Button
                onClick={handleExportQueue}
                variant="outline"
                className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 h-10 px-4"
              >
                <FileJson className="w-4 h-4 mr-2" />
                Export Queue JSON
              </Button>
            </div>
          </CardContent>
        </Card>

      </main>

      {/* ===== HIDDEN CAPTURE TARGETS (off-screen) ===== */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, opacity: 1, pointerEvents: 'none' }}>
        {blueprintNumbers.length > 0 && (
          <div ref={captureBlueprintRef}>
            <BlueprintBanner game={blueprintGame} numbers={blueprintNumbers} />
          </div>
        )}
        {analysisDraw && (
          <div ref={captureAnalysisRef}>
            <AnalysisBanner game={analysisGame} gameName={GAME_NAMES[analysisGame]} date={analysisDate} draw={analysisDraw} classifiedNumbers={analysisClassified} gameData={analysisGameData} />
          </div>
        )}
      </div>
    </div>
  );
}
