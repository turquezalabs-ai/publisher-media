'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  GAME_NAMES,
  GAME_COLORS_HEX,
  BLUEPRINT_SCHEDULE,
} from '@/lib/banner/config';
import type { LottoResult, BlueprintNumber, NumberData } from '@/lib/banner/types';
import {
  generateBlueprintNumbers,
  calculateFrequency,
  classifyNumbers,
 filterByGame,
 getLatestDraw,
} from '@/lib/banner/analysis';
import BlueprintBanner from '@/components/banner/BlueprintBanner';
import AnalysisBanner from '@/components/banner/AnalysisBanner';
import PublishPanel from '@/components/publish/PublishPanel';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';

// ==========================================
// CLIENT-SIDE DATE PARSER (matches API route)
// Handles MM/DD/YYYY (scraper) and YYYY-MM-DD
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

export default function BannerStudio() {
  const [allData, setAllData] = useState<LottoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState('blueprint');

  // Blueprint state
  const [blueprintGame, setBlueprintGame] = useState('6/58');
  const [blueprintDate, setBlueprintDate] = useState('');
  const [blueprintNumbers, setBlueprintNumbers] = useState<BlueprintNumber[]>([]);

  // Analysis state
  const [analysisGame, setAnalysisGame] = useState('6/58');
  const [analysisDraw, setAnalysisDraw] = useState<LottoResult | null>(null);
  const [analysisDate, setAnalysisDate] = useState('');
  const [analysisClassified, setAnalysisClassified] = useState<NumberData[]>([]);
  const [analysisGameData, setAnalysisGameData] = useState<LottoResult[]>([]);

  // Daily Winners state
  const [winnersDate, setWinnersDate] = useState('');
  const [winnersImageUrl, setWinnersImageUrl] = useState<string | null>(null);
  const [winnersLoading, setWinnersLoading] = useState(false);
  const [winnersError, setWinnersError] = useState<string | null>(null);

  // Refs for hidden capture targets (full size, off-screen)
  const captureBlueprintRef = useRef<HTMLDivElement>(null);
  const captureAnalysisRef = useRef<HTMLDivElement>(null);

  // ==========================================
  // DAILY WINNERS
  // ==========================================
  const handleGenerateDailyWinners = useCallback(async () => {
    if (!winnersDate) return;
    setWinnersLoading(true);
    setWinnersError(null);
    setWinnersImageUrl(null);
    try {
      const res = await fetch(`/api/daily-winners?date=${winnersDate}&t=${Date.now()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to render banner' }));
        setWinnersError(errData.error || `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setWinnersImageUrl(url);
    } catch (err) {
      setWinnersError(err instanceof Error ? err.message : 'Failed to generate banner');
    } finally {
      setWinnersLoading(false);
    }
  }, [winnersDate]);

  // Set default winners date to yesterday
  useEffect(() => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const phTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 3600000 * 8);
    const yyyy = phTime.getFullYear();
    const mm = String(phTime.getMonth() + 1).padStart(2, '0');
    const dd = String(phTime.getDate()).padStart(2, '0');
    setWinnersDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  const handleDownloadDailyWinners = () => {
    if (!winnersDate) return;
    const link = document.createElement('a');
    link.href = `/api/daily-winners?date=${winnersDate}&download=true&t=${Date.now()}`;
    link.download = `DailyWinners_${winnersDate}.png`;
    link.click();
  };


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

  // Set default date
  useEffect(() => {
    const now = new Date();
    const phTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + 3600000 * 8);
    setBlueprintDate(
      phTime.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  // ==========================================
  // GENERATE BLUEPRINT
  // ==========================================
  const handleGenerateBlueprint = useCallback(() => {
    if (allData.length === 0) return;
    const gameData = filterByGame(allData, blueprintGame);
    const numbers = generateBlueprintNumbers(gameData, blueprintGame, 20);
    setBlueprintNumbers(numbers);
  }, [allData, blueprintGame]);

  useEffect(() => {
    if (allData.length > 0 && blueprintNumbers.length === 0) {
      handleGenerateBlueprint();
    }
  }, [allData, blueprintNumbers.length, handleGenerateBlueprint]);

  // ==========================================
  // GENERATE ANALYSIS
  // ==========================================
  const handleLoadAnalysis = useCallback(() => {
    if (allData.length === 0) return;
    const gameData = filterByGame(allData, analysisGame);
    const latest = getLatestDraw(allData, analysisGame);
    if (!latest) return;

    const freqMap = calculateFrequency(gameData, analysisGame);
    const classified = classifyNumbers(freqMap);
    const dateObj = parseLottoDateClient(latest.date);
    const dateStr = dateObj
      ? dateObj.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : latest.date;

    setAnalysisDraw(latest);
    setAnalysisDate(dateStr);
    setAnalysisClassified(classified);
    setAnalysisGameData(gameData);
  }, [allData, analysisGame]);

  useEffect(() => {
    if (allData.length > 0 && !analysisDraw) {
      handleLoadAnalysis();
    }
  }, [allData, analysisDraw, handleLoadAnalysis]);

  // ==========================================
  // CAPTURE & DOWNLOAD
  // ==========================================
  // Cleanup winners image URL on unmount
  useEffect(() => {
    return () => {
      if (winnersImageUrl) URL.revokeObjectURL(winnersImageUrl);
    };
  }, [winnersImageUrl]);
  const handleDownloadSingle = async (
    ref: React.RefObject<HTMLDivElement | null>,
    filename: string
  ) => {
    if (!ref.current) return;
    try {
      setGenerating(true);
      const dataUrl = await toPng(ref.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: '#111E44',
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Capture failed:', err);
      alert('Capture failed. Check the console for details.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadBlueprint = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const name = GAME_NAMES[blueprintGame].replace(/[\s/]/g, '-');
    handleDownloadSingle(captureBlueprintRef, `Blueprint_${name}_${dateStr}.png`);
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
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      for (let i = 0; i < 30; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        const dayOfWeek = currentDate.getDay();
        const scheduledGames = BLUEPRINT_SCHEDULE[dayOfWeek] || [];

        for (const game of scheduledGames) {
          const gameData = filterByGame(allData, game);
          const numbers = generateBlueprintNumbers(gameData, game, 20);
          const dateStr = currentDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const gameName = GAME_NAMES[game] || game;
          const circleColor = GAME_COLORS_HEX[game] || 'rgba(37, 99, 235, 0.60)';
          const colLefts = [201, 335, 469, 603, 737];

          const bannerDiv = document.createElement('div');
          bannerDiv.style.width = '1080px';
          bannerDiv.style.height = '1350px';
          bannerDiv.style.background = '#111E44';
          bannerDiv.style.fontFamily = 'Montserrat, sans-serif';
          bannerDiv.style.position = 'relative';

          let html = '';

          // Logo (real image)
          html += `<div style="width:136px;height:136px;left:64px;top:64px;position:absolute;border-radius:9999px;overflow:hidden;background:rgba(255,255,255,0.10);"><img src="/banner-assets/logo.png" style="width:136px;height:136px;object-fit:cover;display:block;"/></div>`;
          // QR (real image)
          html += `<div style="width:136px;height:136px;left:880px;top:64px;position:absolute;border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.90);display:flex;align-items:center;justify-content:center;"><img src="/banner-assets/qrcode.png" style="width:120px;height:120px;object-fit:contain;display:block;"/></div>`;
          // Brand
          html += `<div style="width:682px;height:83px;left:199px;top:90px;position:absolute;text-align:center;"><span style="color:white;font-size:68px;font-weight:800;">Lottong</span><span style="color:#3B82F6;font-size:68px;font-weight:800;"> Pinoy</span></div>`;
          // Subtitle
          html += `<div style="width:672px;left:209px;top:186px;position:absolute;text-align:center;color:rgba(255,255,255,0.40);font-size:22px;font-weight:700;letter-spacing:3.25px;">DATA-DRIVEN COMBINATIONS</div>`;
          // Label (no date — blueprint has no timestamp)
          html += `<div style="width:1080px;left:0px;top:225px;position:absolute;text-align:center;color:white;font-size:44px;font-weight:800;letter-spacing:3px;">WEEKLY BLUEPRINT</div>`;
          // Game Name (centered between label bottom ~275 and legend top 422)
          html += `<div style="width:1080px;left:0px;top:326px;position:absolute;text-align:center;color:white;font-size:38px;font-weight:800;letter-spacing:2px;">${gameName}</div>`;
          // Legend (Figma position top:422)
          html += `<div style="position:absolute;top:422px;left:0;width:1080px;display:flex;justify-content:center;gap:90px;">`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">🔥 HOT</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(High occurrence)</span></div>`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">🌡️ WARM</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(Avg. occurrence)</span></div>`;
          html += `<div style="text-align:center;"><span style="color:white;font-size:20px;font-weight:600;">❄️ COLD</span><br/><span style="color:rgba(255,255,255,0.50);font-size:16px;">(Low Occurrence)</span></div>`;
          html += `</div>`;
          // Grid (exact Figma positions: 116px circles)
          const batchRowTops = [542, 685, 828, 971];
          numbers.forEach((item, index) => {
            const col = index % 5;
            const row = Math.floor(index / 5);
            const left = colLefts[col];
            const top = batchRowTops[row];
            html += `<div style="width:116px;height:116px;left:${left}px;top:${top}px;position:absolute;background:${circleColor};border-radius:9999px;border:4px solid rgba(255,255,255,0.20);"></div>`;
            html += `<div style="width:104px;height:116px;left:${left + 6}px;top:${top}px;position:absolute;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;color:white;font-size:35px;font-weight:700;line-height:20px;letter-spacing:1.75;">${String(item.number).padStart(2, '0')}</div>`;
            html += `<div style="left:${left + 70}px;top:${top - 8}px;position:absolute;font-size:42px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));">${item.emoji}</div>`;
          });
          // Footer (compact)
          html += `<div style="width:952px;left:64px;top:1169px;position:absolute;text-align:center;color:rgba(255,255,255,0.60);font-size:18px;font-weight:500;letter-spacing:1px;line-height:1.4;">18+ only. For info/educational use. Not affiliated with PCSO; Lottong Pinoy does not facilitate betting. Always verify results via official PCSO channels.</div>`;
          html += `<div style="width:1080px;height:46px;left:0px;top:1240px;position:absolute;text-align:center;color:white;font-size:26px;font-weight:700;">lottong-pinoy.com</div>`;

          bannerDiv.innerHTML = html;
          container.appendChild(bannerDiv);

          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve());
            });
          });
          await new Promise<void>((r) => setTimeout(r, 100));

          const dataUrl = await toPng(bannerDiv, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: '#111E44',
            cacheBust: true,
          });

          const m = String(currentDate.getMonth() + 1).padStart(2, '0');
          const d = String(currentDate.getDate()).padStart(2, '0');
          const y = currentDate.getFullYear();
          const filename = `Blueprint_${m}${d}${y}_${gameName.replace(/[\s/]/g, '-')}.png`;

          zip.file(filename, dataUrl.split(',')[1], { base64: true });
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
      console.error('Batch generation failed:', err);
      alert('Batch generation failed. Check the console.');
    } finally {
      setGenerating(false);
    }
  };

  // ==========================================
  // RENDER
  // ==========================================
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950" suppressHydrationWarning>
        <div className="text-center" suppressHydrationWarning>
          <div className="text-5xl mb-4 animate-pulse" suppressHydrationWarning>🎰</div>
          <div className="text-white text-xl font-bold" suppressHydrationWarning>Loading Lotto Data...</div>
          <div className="text-gray-400 mt-2 text-sm" suppressHydrationWarning>Connecting to data source</div>
        </div>
      </div>
    );
  }

  const gameOptions = [
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

  return (
    <div className="min-h-screen bg-gray-950">
      {/* ===== TOP BAR ===== */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-extrabold text-lg">
              LP
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Lottong Pinoy</h1>
              <p className="text-gray-500 text-xs">Banner Creator Studio</p>
            </div>
          </div>
          <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">
            {allData.length.toLocaleString()} draws loaded
          </Badge>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ===== LEFT: TAB SELECTOR + CONTROLS (Blueprint & Analysis) ===== */}
          {activeTab !== 'publish' && (
          <div className="w-full lg:w-[340px] shrink-0 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full bg-gray-900 border border-gray-800">
                <TabsTrigger value="blueprint" className="flex-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  Blueprint
                </TabsTrigger>
                <TabsTrigger value="analysis" className="flex-1 data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                  Analysis
                </TabsTrigger>
                <TabsTrigger value="winners" className="flex-1 data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                  Winners
                </TabsTrigger>
                <TabsTrigger value="publish" className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                  🚀
                </TabsTrigger>
              </TabsList>

              {/* ---- BLUEPRINT TAB ---- */}
              <TabsContent value="blueprint" className="space-y-4 mt-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Weekly Blueprint</CardTitle>
                    <CardDescription className="text-gray-400 text-sm">
                      5x4 grid of hot/warm/cold numbers
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium block mb-1.5">Game</label>
                      <Select value={blueprintGame} onValueChange={(v) => { setBlueprintGame(v); setBlueprintNumbers([]); }}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {gameOptions.map(g => (
                            <SelectItem key={g.value} value={g.value} className="text-white focus:bg-gray-700 focus:text-white">
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-gray-400 text-sm font-medium block mb-1.5">Date</label>
                      <div className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm truncate">
                        {blueprintDate}
                      </div>
                    </div>

                    <Separator className="bg-gray-800" />

                    <div className="flex flex-col gap-2">
                      <Button onClick={handleGenerateBlueprint} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        Regenerate Numbers
                      </Button>
                      <Button onClick={handleDownloadBlueprint} disabled={blueprintNumbers.length === 0} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        Download PNG
                      </Button>
                      <Button onClick={handleBatchBlueprint} disabled={generating} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold">
                        {generating ? 'Generating 30-Day ZIP...' : 'Batch: 30-Day ZIP'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-gray-500 text-xs">Format: 1080 x 1350px</p>
                    <p className="text-gray-500 text-xs">Grid: 5 x 4 = 20 numbers</p>
                    <p className="text-gray-500 text-xs">Theme: {GAME_NAMES[blueprintGame]}</p>
                    <div className="flex gap-3 pt-1">
                      <span className="text-base" title="High occurrence">🔥 Hot</span>
                      <span className="text-base" title="Avg occurrence">🌡️ Warm</span>
                      <span className="text-base" title="Low Occurrence">❄️ Cold</span>
                    </div>
                    {blueprintNumbers.length > 0 && (
                      <div className="pt-2 border-t border-gray-800">
                        <p className="text-gray-500 text-xs mb-1">This generation:</p>
                        <p className="text-gray-400 text-xs">
                          {blueprintNumbers.filter(n => n.category === 'hot').length} hot, {' '}
                          {blueprintNumbers.filter(n => n.category === 'warm').length} warm, {' '}
                          {blueprintNumbers.filter(n => n.category === 'cold').length} cold
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---- WINNERS TAB ---- */}
              <TabsContent value="winners" className="space-y-4 mt-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Daily Winners</CardTitle>
                    <CardDescription className="text-gray-400 text-sm">
                      All winning numbers from a specific date
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium block mb-1.5">Date</label>
                      <div className="bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-white text-sm">
                        <input
                          type="date"
                          value={winnersDate}
                          onChange={(e) => { setWinnersDate(e.target.value); setWinnersImageUrl(null); setWinnersError(null); }}
                          className="bg-transparent border-none outline-none text-white w-full [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <Separator className="bg-gray-800" />

                    <div className="flex flex-col gap-2">
                      <Button
                        onClick={handleGenerateDailyWinners}
                        disabled={!winnersDate || winnersLoading}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      >
                        {winnersLoading ? 'Generating...' : 'Generate Banner'}
                      </Button>
                      <Button
                        onClick={handleDownloadDailyWinners}
                        disabled={!winnersImageUrl}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      >
                        Download PNG
                      </Button>
                    </div>

                    {winnersError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p className="text-red-400 text-xs">{winnersError}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="pt-4 space-y-2">
                    <p className="text-gray-500 text-xs">Format: 1080 x 1350px</p>
                    <p className="text-gray-500 text-xs">Shows all major games + daily draws</p>
                    <p className="text-gray-500 text-xs">Auto-posts at 6:30 AM PHT daily</p>
                    <p className="text-gray-500 text-xs">Skips on holidays (no draws)</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ---- ANALYSIS TAB ---- */}
              <TabsContent value="analysis" className="space-y-4 mt-4">
                <Card className="bg-gray-900 border-gray-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-white text-base">Draw Analysis</CardTitle>
                    <CardDescription className="text-gray-400 text-sm">
                      Draw numbers breakdown with patterns
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium block mb-1.5">Game</label>
                      <Select value={analysisGame} onValueChange={(v) => { setAnalysisGame(v); setAnalysisDraw(null); }}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {gameOptions.map(g => (
                            <SelectItem key={g.value} value={g.value} className="text-white focus:bg-gray-700 focus:text-white">
                              {g.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {analysisDraw && (
                      <div className="bg-gray-800/50 rounded-lg p-3 space-y-1">
                        <p className="text-gray-400 text-xs">Latest Draw</p>
                        <p className="text-white font-bold text-sm">{analysisDraw.combination}</p>
                        <p className="text-blue-400 text-xs font-semibold">
                          {analysisGameData.length.toLocaleString()} historical draws analyzed
                        </p>
                        <p className="text-gray-500 text-xs">{analysisDraw.date}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <Button onClick={handleLoadAnalysis} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold">
                        Refresh Analysis
                      </Button>
                      <Button onClick={handleDownloadAnalysis} disabled={!analysisDraw} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                        Download PNG
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          )}

          {/* ===== RIGHT: PREVIEW (Blueprint & Analysis only) ===== */}
          {activeTab !== 'publish' && (
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 w-full justify-center">
              <div className="h-px bg-gray-800 flex-1" />
              <span className="text-gray-500 text-xs font-medium uppercase tracking-widest px-4">
                Live Preview
              </span>
              <div className="h-px bg-gray-800 flex-1" />
            </div>

            {/* Preview container with scaled banner */}
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 shadow-2xl">
              <div
                style={{
                  width: 324,
                  height: 405,
                  overflow: 'hidden',
                  borderRadius: 8,
                  position: 'relative',
                }}
              >
                <div style={{ transform: 'scale(0.3)', transformOrigin: 'top left', width: 1080, height: 1350 }}>
                  {activeTab === 'winners' && winnersImageUrl ? (
                    <img src={winnersImageUrl} alt="Daily Winners" style={{ width: 1080, height: 1350 }} />
                  ) : activeTab === 'blueprint' && blueprintNumbers.length > 0 ? (
                    <BlueprintBanner game={blueprintGame} numbers={blueprintNumbers} />
                  ) : activeTab === 'analysis' && analysisDraw ? (
                    <AnalysisBanner
                      game={analysisGame}
                      gameName={GAME_NAMES[analysisGame]}
                      date={analysisDate}
                      draw={analysisDraw}
                      classifiedNumbers={analysisClassified}
                      gameData={analysisGameData}
                    />
                  ) : activeTab === 'winners' && winnersLoading ? (
                    <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>Generating banner...</span>
                    </div>
                  ) : activeTab === 'winners' ? (
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

            <p className="text-gray-600 text-xs">Preview scaled 30% — Downloads at full 1080x1350px</p>
          </div>
          )}
        </div>

        {/* ===== FULL WIDTH: PUBLISH TAB ===== */}
        {activeTab === 'publish' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Publish tab selector */}
            <div className="flex gap-2 lg:hidden">
              <Button
                variant={activeTab === 'blueprint' ? 'default' : 'outline'}
                onClick={() => setActiveTab('blueprint')}
                className={activeTab === 'blueprint' ? 'bg-blue-600' : 'border-gray-700 text-gray-400'}
              >Blueprint</Button>
              <Button
                variant={activeTab === 'analysis' ? 'default' : 'outline'}
                onClick={() => setActiveTab('analysis')}
                className={activeTab === 'analysis' ? 'bg-purple-600' : 'border-gray-700 text-gray-400'}
              >Analysis</Button>
              <Button
                variant={activeTab === 'winners' ? 'default' : 'outline'}
                onClick={() => setActiveTab('winners')}
                className={activeTab === 'winners' ? 'bg-amber-600' : 'border-gray-700 text-gray-400'}
              >Winners</Button>
            </div>
            <div className="hidden lg:flex gap-2">
              <Button
                variant="outline"
                onClick={() => setActiveTab('blueprint')}
                className="border-gray-700 text-gray-400 hover:text-white"
              >Blueprint</Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('analysis')}
                className="border-gray-700 text-gray-400 hover:text-white"
              >Analysis</Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('winners')}
                className="border-gray-700 text-gray-400 hover:text-white"
              >Winners</Button>
            </div>

            {/* Publish panel - full width two-column layout */}
            <div className="flex-1 max-w-[340px] lg:max-w-none space-y-4">
              <PublishPanel
                blueprintGame={blueprintGame}
                blueprintNumbers={blueprintNumbers}
                analysisGame={analysisGame}
                analysisDraw={analysisDraw}
                analysisClassified={analysisClassified}
                analysisGameData={analysisGameData}
                analysisDate={analysisDate}
                captureBlueprintRef={captureBlueprintRef}
                captureAnalysisRef={captureAnalysisRef}
                onBlueprintGameChange={(g) => { setBlueprintGame(g); setBlueprintNumbers([]); }}
                onAnalysisGameChange={(g) => { setAnalysisGame(g); setAnalysisDraw(null); }}
              />
            </div>
          </div>
        )}
      </main>

      {/* ===== HIDDEN CAPTURE TARGETS (off-screen, used by html-to-image) ===== */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, opacity: 1, pointerEvents: 'none' }}>
        {/* Blueprint capture target - always rendered when numbers exist */}
        {blueprintNumbers.length > 0 && (
          <div ref={captureBlueprintRef}>
            <BlueprintBanner game={blueprintGame} numbers={blueprintNumbers} />
          </div>
        )}

        {/* Analysis capture target - always rendered when draw exists */}
        {analysisDraw && (
          <div ref={captureAnalysisRef}>
            <AnalysisBanner
              game={analysisGame}
              gameName={GAME_NAMES[analysisGame]}
              date={analysisDate}
              draw={analysisDraw}
              classifiedNumbers={analysisClassified}
              gameData={analysisGameData}
            />
          </div>
        )}
      </div>
    </div>
  );
}
