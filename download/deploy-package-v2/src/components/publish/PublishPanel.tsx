'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  GAME_NAMES,
} from '@/lib/banner/config';
import type { LottoResult, BlueprintNumber, NumberData } from '@/lib/banner/types';
import {
  generateBlueprintCaptionV2,
  generateAnalysisCaption,
  getBlueprintCaptionCount,
  getAnalysisCaptionCount,
} from '@/lib/banner/captions';
import {
  parseCombination,
} from '@/lib/banner/analysis';
import BlueprintBanner from '@/components/banner/BlueprintBanner';
import AnalysisBanner from '@/components/banner/AnalysisBanner';
import { toPng } from 'html-to-image';

// ==========================================
// TYPES
// ==========================================
type Platform = 'facebook' | 'instagram' | 'twitter' | 'tiktok';

interface SocialAccount {
  id: string;
  platform: Platform;
  name: string;
  accountId: string;
  igUserId?: string;
  connected: boolean;
  isDemo: boolean;
}

interface PublishLogEntry {
  account: SocialAccount;
  status: 'pending' | 'success' | 'error';
  message: string;
  timestamp: string;
  postId?: string;
  postUrl?: string;
}

interface PublishPanelProps {
  blueprintGame: string;
  blueprintNumbers: BlueprintNumber[];
  analysisGame: string;
  analysisDraw: LottoResult | null;
  analysisClassified: NumberData[];
  analysisGameData: LottoResult[];
  analysisDate: string;
  captureBannerRef?: React.RefObject<HTMLDivElement | null>;
  captureAnalysisRef?: React.RefObject<HTMLDivElement | null>;
  onBlueprintGameChange?: (game: string) => void;
  onAnalysisGameChange?: (game: string) => void;
}

// ==========================================
// PLATFORM CONFIG
// ==========================================
const PLATFORM_CONFIG: Record<Platform, { icon: string; label: string; color: string; bgColor: string; borderColor: string }> = {
  facebook: { icon: '📘', label: 'Facebook', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30' },
  instagram: { icon: '📸', label: 'Instagram', color: 'text-pink-400', bgColor: 'bg-pink-500/10', borderColor: 'border-pink-500/30' },
  twitter: { icon: '𝕏', label: 'Twitter / X', color: 'text-gray-300', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/30' },
  tiktok: { icon: '🎵', label: 'TikTok', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10', borderColor: 'border-cyan-500/30' },
};

// ==========================================
// DEMO ACCOUNTS
// ==========================================
// No demo accounts — user adds their own real accounts
const DEMO_ACCOUNTS: SocialAccount[] = [];

// ==========================================
// CAPTION GENERATION
// ==========================================
function buildCaption(
  bannerType: 'blueprint' | 'analysis',
  game: string,
  gameName: string,
  blueprintDay: number,
  draw?: LottoResult | null,
  gameData?: LottoResult[],
): string {
  if (bannerType === 'blueprint') {
    return generateBlueprintCaptionV2(blueprintDay, game);
  }

  if (draw && gameData) {
    const nums = parseCombination(draw.combination);
    return generateAnalysisCaption(game, gameName, draw.date, nums, gameData);
  }

  return `${gameName} — Data Analysis

Loading draw data...`;
}

// ==========================================
// HELPER
// ==========================================
let nextId = 100;
const generateId = (platform: string) => `${platform}-${++nextId}`;

// ==========================================
// PUBLISH PANEL COMPONENT
// ==========================================
export default function PublishPanel({
  blueprintGame,
  blueprintNumbers,
  analysisGame,
  analysisDraw,
  analysisClassified,
  analysisGameData,
  analysisDate,
  captureBannerRef,
  captureAnalysisRef,
  onBlueprintGameChange,
  onAnalysisGameChange,
}: PublishPanelProps) {
  // ---- State ----
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bannerType, setBannerType] = useState<'blueprint' | 'analysis'>('analysis');
  const [caption, setCaption] = useState('');
  const [scheduleType, setScheduleType] = useState<'now' | 'scheduled'>('now');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [testMode, setTestMode] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [logs, setLogs] = useState<PublishLogEntry[]>([]);

  // Blueprint day selector
  const [blueprintDay, setBlueprintDay] = useState(1);

  // Add account dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addPlatform, setAddPlatform] = useState<Platform>('facebook');
  const [addName, setAddName] = useState('');
  const [addAccountId, setAddAccountId] = useState('');
  const [addIgUserId, setAddIgUserId] = useState('');

  // Ref for the preview's inner div (full 1080x1350 banner for capture)
  const publishPreviewRef = useRef<HTMLDivElement>(null);

  // Game options (mirrored from page.tsx)
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

  // ---- Load accounts from localStorage on mount ----
  useEffect(() => {
    const saved = localStorage.getItem('lp-social-accounts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SocialAccount[];
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount init from client localStorage
        setAccounts(parsed);
      } catch {
        setAccounts(DEMO_ACCOUNTS);
      }
    } else {
      setAccounts(DEMO_ACCOUNTS);
    }
  }, []);

  // ---- Save accounts to localStorage on change ----
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('lp-social-accounts', JSON.stringify(accounts));
    }
  }, [accounts]);

  // ---- Auto-generate caption when banner type or data changes ----
  useEffect(() => {
    const game = bannerType === 'blueprint' ? blueprintGame : analysisGame;
    const gameName = GAME_NAMES[game] || game;
    const draw = bannerType === 'analysis' ? analysisDraw : null;
    const gData = bannerType === 'analysis' ? analysisGameData : [];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived state synced from parent props
    setCaption(buildCaption(bannerType, game, gameName, blueprintDay, draw, gData));
  }, [bannerType, blueprintGame, analysisGame, analysisDraw, blueprintDay, analysisGameData]);

  // ---- Auto-select connected accounts ----
  useEffect(() => {
    const connectedIds = accounts
      .filter(a => a.connected)
      .map(a => a.id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived selection synced from accounts state
    setSelectedIds(new Set(connectedIds));
  }, [accounts]);

  // ---- Group accounts by platform ----
  const accountsByPlatform = accounts.reduce<Record<Platform, SocialAccount[]>>((acc, account) => {
    if (!acc[account.platform]) acc[account.platform] = [];
    acc[account.platform].push(account);
    return acc;
  }, {} as Record<Platform, SocialAccount[]>);

  const platformOrder: Platform[] = ['facebook', 'instagram', 'twitter', 'tiktok'];

  // ---- Toggle account selection ----
  const toggleAccount = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ---- Add account ----
  const handleAddAccount = () => {
    if (!addName.trim()) return;
    const newAccount: SocialAccount = {
      id: generateId(addPlatform),
      platform: addPlatform,
      name: addName.trim(),
      accountId: addAccountId.trim() || `manual-${Date.now()}`,
      igUserId: addIgUserId.trim() || undefined,
      connected: true,
      isDemo: false,
    };
    setAccounts(prev => [...prev, newAccount]);
    setAddName('');
    setAddAccountId('');
    setAddIgUserId('');
    setShowAddDialog(false);
  };

  // ---- Remove account ----
  const handleRemoveAccount = (id: string) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // ---- Toggle account connected status ----
  const handleToggleConnected = (id: string) => {
    setAccounts(prev =>
      prev.map(a => a.id === id ? { ...a, connected: !a.connected } : a)
    );
  };

  // ---- Select all / Deselect all for platform ----
  const handleSelectAll = (platform: Platform, select: boolean) => {
    const platformIds = accounts
      .filter(a => a.platform === platform && a.connected)
      .map(a => a.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      platformIds.forEach(id => {
        if (select) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  // ---- Handle game change from Publish panel ----
  const handlePublishGameChange = (newGame: string) => {
    if (bannerType === 'blueprint' && onBlueprintGameChange) {
      onBlueprintGameChange(newGame);
    } else if (bannerType === 'analysis' && onAnalysisGameChange) {
      onAnalysisGameChange(newGame);
    }
  };

  // ---- Capture the banner as base64 ----
  const captureBannerAsBase64 = useCallback(async (): Promise<string | null> => {
    const refToCapture = captureBannerRef?.current || captureAnalysisRef?.current || publishPreviewRef.current;
    if (!refToCapture) {
      return null;
    }

    try {
      const dataUrl = await toPng(refToCapture, {
        quality: 1.0,
        pixelRatio: 1,
        backgroundColor: '#111E44',
        cacheBust: true,
      });
      return dataUrl;
    } catch (err) {
      console.error('Banner capture failed:', err);
      return null;
    }
  }, [captureBannerRef, captureAnalysisRef]);

  // ---- Publish via API ----
  const handlePublish = async () => {
    const selectedAccounts = accounts.filter(a => selectedIds.has(a.id) && a.connected);
    if (selectedAccounts.length === 0) return;

    const platforms = [...new Set(selectedAccounts.map(a => a.platform))];
    const allLogs: PublishLogEntry[] = [];

    setPublishing(true);

    // Capture the banner image once (only in live mode)
    let imageBase64: string | null = null;
    if (!testMode) {
      imageBase64 = await captureBannerAsBase64();
    }

    for (const platform of platforms) {
      const platformAccounts = selectedAccounts.filter(a => a.platform === platform);

      try {
        const response = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            accounts: platformAccounts.map(a => ({
              id: a.id,
              pageId: a.accountId,
              igUserId: a.igUserId,
              name: a.name,
            })),
            caption,
            imageBase64: imageBase64 || '',
            fileName: `lottong-pinoy-${bannerType}-${Date.now()}.png`,
            testMode,
          }),
        });

        const result = await response.json();

        if (result.results && Array.isArray(result.results)) {
          const now = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          for (const r of result.results) {
            const account = platformAccounts.find(a => a.id === r.accountId);
            if (account) {
              allLogs.push({
                account,
                status: r.status,
                message: r.message,
                timestamp: now,
                postId: r.postId,
                postUrl: r.postUrl,
              });
            }
          }
        } else if (!result.success) {
          const now = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          for (const account of platformAccounts) {
            allLogs.push({
              account,
              status: 'error',
              message: result.error || `Failed to publish to ${platform}.`,
              timestamp: now,
            });
          }
        }
      } catch (err) {
        const now = new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        const message = err instanceof Error ? err.message : 'Network error';
        for (const account of platformAccounts) {
          allLogs.push({
            account,
            status: 'error',
            message: `Connection error: ${message}`,
            timestamp: now,
          });
        }
      }
    }

    setLogs(allLogs);
    setPublishing(false);
  };

  // ---- Selected account count per platform ----
  const getSelectedCount = (platform: Platform) =>
    accounts.filter(a => a.platform === platform && a.connected && selectedIds.has(a.id)).length;

  const getConnectedCount = (platform: Platform) =>
    accounts.filter(a => a.platform === platform && a.connected).length;

  const totalSelected = accounts.filter(a => selectedIds.has(a.id) && a.connected).length;

  // ---- Current banner data ----
  const currentGame = bannerType === 'blueprint' ? blueprintGame : analysisGame;
  const currentGameName = GAME_NAMES[currentGame] || currentGame;
  const gameSelectorValue = currentGame;

  return (
    <div className="space-y-4">
      {/* ===== LEFT: CONTROLS ===== */}
      <div className="space-y-4">

        {/* ---- Banner Type + Game Selector ---- */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Publish Banner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button
                variant={bannerType === 'blueprint' ? 'default' : 'outline'}
                onClick={() => setBannerType('blueprint')}
                disabled={blueprintNumbers.length === 0}
                className={bannerType === 'blueprint' ? 'bg-blue-600 hover:bg-blue-700' : 'border-gray-700 text-gray-400 hover:text-white'}
              >
                Blueprint
              </Button>
              <Button
                variant={bannerType === 'analysis' ? 'default' : 'outline'}
                onClick={() => setBannerType('analysis')}
                disabled={!analysisDraw}
                className={bannerType === 'analysis' ? 'bg-purple-600 hover:bg-purple-700' : 'border-gray-700 text-gray-400 hover:text-white'}
              >
                Analysis
              </Button>
            </div>
            {/* Game Selector — lets user pick game directly in Publish panel */}
            <div>
              <label className="text-gray-400 text-xs font-medium block mb-1.5">
                Game: <span className="text-white font-bold">{currentGameName}</span>
              </label>
              <Select
                value={gameSelectorValue}
                onValueChange={handlePublishGameChange}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {gameOptions.map(g => (
                    <SelectItem key={g.value} value={g.value} className="text-white focus:bg-gray-700 focus:text-white text-xs">
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-gray-500 text-xs">
              {bannerType === 'blueprint'
                ? `Blueprint: ${currentGameName} — ${blueprintNumbers.length} numbers`
                : `Analysis: ${currentGameName} — ${analysisDraw?.combination || 'No draw'}`
              }
            </p>
          </CardContent>
        </Card>

        {/* ---- Connected Accounts ---- */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">Connected Accounts</CardTitle>
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 bg-emerald-400/10 text-xs">
                {accounts.filter(a => a.connected).length} connected
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {platformOrder.map(platform => {
              const config = PLATFORM_CONFIG[platform];
              const platformAccounts = accountsByPlatform[platform] || [];
              if (platformAccounts.length === 0) return null;

              const connectedCount = getConnectedCount(platform);
              const selectedCount = getSelectedCount(platform);
              const allSelected = selectedCount === connectedCount && connectedCount > 0;

              return (
                <div key={platform} className={`rounded-lg border ${config.borderColor} p-3 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{config.icon}</span>
                      <span className={`text-sm font-bold ${config.color}`}>{config.label}</span>
                      <Badge variant="outline" className={`${config.bgColor} ${config.color} text-[10px] border-0 px-1.5`}>
                        {selectedCount}/{connectedCount}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSelectAll(platform, !allSelected)}
                        className="text-[10px] text-gray-400 hover:text-white px-1"
                      >
                        {allSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {platformAccounts.map(account => (
                      <div
                        key={account.id}
                        className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-white/5 group"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(account.id) && account.connected}
                          onChange={() => toggleAccount(account.id)}
                          disabled={!account.connected}
                          className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-xs font-medium truncate ${account.connected ? 'text-white' : 'text-gray-500'}`}>
                              {account.name}
                            </span>
                            {account.isDemo && (
                              <Badge variant="outline" className="text-[9px] text-gray-500 border-gray-700 px-1 py-0">
                                Demo
                              </Badge>
                            )}
                          </div>
                          {platform === 'instagram' && account.igUserId && (
                            <span className="text-[10px] text-gray-600 truncate block">IG ID: {account.igUserId}</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleConnected(account.id)}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                            account.connected
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                              : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                          }`}
                          title={account.connected ? 'Disconnect' : 'Connect'}
                        >
                          {account.connected ? '●' : '○'}
                        </button>
                        <button
                          onClick={() => handleRemoveAccount(account.id)}
                          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                          title="Remove account"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => { setAddPlatform(platform); setShowAddDialog(true); }}
                    className="w-full text-left text-xs text-gray-500 hover:text-gray-300 py-1 px-2 rounded hover:bg-white/5 transition-colors"
                  >
                    + Add {config.label} Account
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* ---- Caption ---- */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base">Post Caption</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (bannerType === 'blueprint') {
                      const randomDay = Math.floor(Math.random() * getBlueprintCaptionCount()) + 1;
                      setBlueprintDay(randomDay);
                    } else {
                      const game = analysisGame;
                      const gameName = GAME_NAMES[game] || game;
                      setCaption(buildCaption('analysis', game, gameName, 1, analysisDraw, analysisGameData));
                    }
                  }}
                  className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300 text-xs"
                >
                  🔄 Regenerate
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {bannerType === 'blueprint' && (
              <div className="flex items-center gap-2">
                <label className="text-gray-400 text-xs whitespace-nowrap">Blueprint Day:</label>
                <Select
                  value={String(blueprintDay)}
                  onValueChange={(v) => setBlueprintDay(Number(v))}
                >
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-xs h-8 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 max-h-48 overflow-y-auto">
                    {Array.from({ length: getBlueprintCaptionCount() }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)} className="text-white focus:bg-gray-700 focus:text-white text-xs">
                        Day {i + 1} of {getBlueprintCaptionCount()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="text-blue-400 border-blue-400/30 bg-blue-400/10 text-[10px] whitespace-nowrap">
                  {getAnalysisCaptionCount()} analysis templates available
                </Badge>
              </div>
            )}
            {bannerType === 'analysis' && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-purple-400 border-purple-400/30 bg-purple-400/10 text-[10px]">
                  Randomly picks from {getAnalysisCaptionCount()} caption templates + key insights
                </Badge>
              </div>
            )}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={12}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Write your post caption here..."
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-gray-600 text-[10px]">
                {caption.length} characters
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(caption)}
                  className="text-[10px] text-gray-500 hover:text-white transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---- Publish Settings ---- */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Publish Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">When to post</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleType === 'now'}
                    onChange={() => setScheduleType('now')}
                    className="w-3.5 h-3.5 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-white">Post Now</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="schedule"
                    checked={scheduleType === 'scheduled'}
                    onChange={() => setScheduleType('scheduled')}
                    className="w-3.5 h-3.5 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-white">Schedule</span>
                </label>
                {scheduleType === 'scheduled' && (
                  <div className="flex gap-2 ml-5">
                    <Input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8"
                    />
                    <Input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white text-xs h-8 w-28"
                    />
                  </div>
                )}
              </div>
            </div>

            <Separator className="bg-gray-800" />

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white text-sm">Test Mode (Dry Run)</Label>
                <p className="text-gray-500 text-[10px]">Simulates publishing without actually posting</p>
              </div>
              <Switch
                checked={testMode}
                onCheckedChange={setTestMode}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
            {testMode && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                <p className="text-amber-400 text-[11px]">
                  ⚠️ Test Mode is ON — no posts will be created. Use this to verify your setup before going live.
                </p>
              </div>
            )}
            {!testMode && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                <p className="text-emerald-400 text-[11px]">
                  🟢 Live Mode — your banner will be published to the selected accounts. Make sure your API keys are configured in .env.local.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- Publish Button ---- */}
        <Button
          onClick={handlePublish}
          disabled={totalSelected === 0 || publishing || !caption.trim()}
          className={`w-full font-bold text-base py-5 ${
            testMode
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {publishing ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">⏳</span> Publishing...
            </span>
          ) : (
            <span>
              {testMode ? '🧪' : '🚀'} Publish to {totalSelected} Account{totalSelected !== 1 ? 's' : ''}
              {testMode && ' (Test Mode)'}
            </span>
          )}
        </Button>
      </div>

      {/* ===== RIGHT: PREVIEW + LOGS ===== */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 w-full justify-center">
          <div className="h-px bg-gray-800 flex-1" />
          <span className="text-gray-500 text-xs font-medium uppercase tracking-widest px-4">
            {bannerType === 'blueprint' ? 'Blueprint Preview' : 'Analysis Preview'}
          </span>
          <div className="h-px bg-gray-800 flex-1" />
        </div>

        {/* Banner Preview */}
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
            <div
              ref={publishPreviewRef}
              style={{ transform: 'scale(0.3)', transformOrigin: 'top left', width: 1080, height: 1350 }}
            >
              {bannerType === 'blueprint' && blueprintNumbers.length > 0 ? (
                <BlueprintBanner game={blueprintGame} numbers={blueprintNumbers} />
              ) : bannerType === 'analysis' && analysisDraw ? (
                <AnalysisBanner
                  game={analysisGame}
                  gameName={GAME_NAMES[analysisGame]}
                  date={analysisDate}
                  draw={analysisDraw}
                  classifiedNumbers={analysisClassified}
                  gameData={analysisGameData}
                />
              ) : (
                <div style={{ width: 1080, height: 1350, background: '#111E44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 28 }}>No banner generated</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-xs">Preview scaled 30% — Captures at full 1080x1350px for publishing</p>

        {/* Publish Log */}
        {logs.length > 0 && (
          <Card className="w-full bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-sm">Publish Log</CardTitle>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    logs.every(l => l.status === 'success')
                      ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10'
                      : logs.every(l => l.status === 'error')
                        ? 'text-red-400 border-red-400/30 bg-red-400/10'
                        : 'text-amber-400 border-amber-400/30 bg-amber-400/10'
                  }`}
                >
                  {logs.filter(l => l.status === 'success').length}/{logs.length} succeeded
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {logs.map((log, i) => {
                const config = PLATFORM_CONFIG[log.account.platform];
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                      log.status === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'bg-red-500/10 border border-red-500/20'
                    }`}
                  >
                    <span>{log.status === 'success' ? '✅' : '❌'}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={config.color}>{config.icon}</span>
                        <span className="text-white font-medium">{log.account.name}</span>
                        <span className="text-gray-600">{log.timestamp}</span>
                      </div>
                      <p className={`mt-0.5 ${log.status === 'success' ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {log.message}
                      </p>
                      {log.postUrl && (
                        <a
                          href={log.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-[10px] mt-0.5 inline-block"
                        >
                          View post ↗
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="text-center pt-1">
                <button
                  onClick={() => setLogs([])}
                  className="text-gray-600 hover:text-gray-400 text-[10px]"
                >
                  Clear log
                </button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ===== ADD ACCOUNT DIALOG ===== */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="text-lg">Add {PLATFORM_CONFIG[addPlatform].label} Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Platform</Label>
              <Select value={addPlatform} onValueChange={(v) => setAddPlatform(v as Platform)}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {platformOrder.map(p => (
                    <SelectItem key={p} value={p} className="text-white focus:bg-gray-700 focus:text-white">
                      {PLATFORM_CONFIG[p].icon} {PLATFORM_CONFIG[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Account Name / Label</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g., Lottong Pinoy Main Page"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-400 text-xs">Page ID / Account ID</Label>
              <Input
                value={addAccountId}
                onChange={(e) => setAddAccountId(e.target.value)}
                placeholder="Facebook Page ID or Twitter username"
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            {addPlatform === 'instagram' && (
              <div className="space-y-2">
                <Label className="text-gray-400 text-xs">Instagram Business Account ID</Label>
                <Input
                  value={addIgUserId}
                  onChange={(e) => setAddIgUserId(e.target.value)}
                  placeholder="e.g., 17841400123456789"
                  className="bg-gray-800 border-gray-700 text-white"
                />
                <p className="text-gray-600 text-[10px]">
                  Find this in Meta Business Settings → Instagram → Account ID. Required for Instagram publishing.
                </p>
              </div>
            )}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-blue-400 text-xs">
                💡 To connect a real account, you&apos;ll need API credentials configured in .env.local. Accounts are stored locally in your browser.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-gray-700 text-gray-400">
              Cancel
            </Button>
            <Button onClick={handleAddAccount} disabled={!addName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              Add Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
