'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Calendar,
  Clock,
  Globe,
  Palette,
  Send,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  MoreHorizontal,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/store'
import { cn, formatDate, formatTime, formatCurrency, STATUS_COLORS, STATUS_LABELS, PLATFORM_ICONS, PLATFORM_LABELS, DAY_SHORTNAMES, getGamesForDay, getBannersForGameDay, getWeekDates, getTodayStr, getDayName, parseScheduleDays } from '@/lib/utils'
import type { BlueprintEntry, Game, BannerTemplate } from '@/lib/types'
import BannerStudio from '@/components/banner-studio'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FULL_DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday',
] as const

const WEEK_START_OFFSETS: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

function getWeekStartMonday(baseDate: Date): Date {
  const d = new Date(baseDate)
  const day = d.getDay()
  // getDay(): 0=Sun, 1=Mon... we want Monday as start
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDatesFromBase(baseDate: Date): Date[] {
  const monday = getWeekStartMonday(baseDate)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function dateToStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Mini colored banner preview using game/banner colors */
function BannerThumbnail({
  banner,
  game,
}: {
  banner?: BannerTemplate | null
  game?: Game | null
}) {
  const bg = banner?.bgColor || game?.color || '#1a1a2e'
  const accent = banner?.accentColor || '#e94560'
  return (
    <div
      className="relative h-full w-full min-h-[56px] min-w-[56px] flex items-center justify-center rounded-lg overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
      }}
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }}
      />
      {/* Bottom accent line */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{ background: accent }}
      />
      {/* Game icon in center */}
      <span className="relative text-2xl drop-shadow-lg">
        {game?.icon || '\u{1F3B0}'}
      </span>
    </div>
  )
}

/** Status icon helper */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'published':
      return <CheckCircle className="size-3.5 text-emerald-500" />
    case 'scheduled':
      return <Clock className="size-3.5 text-blue-500" />
    case 'failed':
      return <XCircle className="size-3.5 text-red-500" />
    default:
      return <AlertCircle className="size-3.5 text-gray-400" />
  }
}

// ---------------------------------------------------------------------------
// Main BlueprintView component
// ---------------------------------------------------------------------------
export default function BlueprintView() {
  const {
    games,
    setGames,
    banners,
    setBanners,
    blueprint,
    setBlueprint,
    selectedGameId,
    setSelectedGameId,
    selectedDate,
    setSelectedDate,
    selectedPlatform,
    setSelectedPlatform,
    isBannerStudioOpen,
    setIsBannerStudioOpen,
    isLoading,
    setIsLoading,
  } = useAppStore()

  // ---- Local state ----
  const [weekBaseDate, setWeekBaseDate] = useState<Date>(new Date())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedDayDetail, setSelectedDayDetail] = useState<string | null>(null)
  const [editingEntry, setEditingEntry] = useState<BlueprintEntry | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editPlatform, setEditPlatform] = useState('')
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false)
  const [publishingEntry, setPublishingEntry] = useState<BlueprintEntry | null>(null)
  const [isAddingPost, setIsAddingPost] = useState(false)
  const [addPostGameId, setAddPostGameId] = useState<string>('')
  const [addPostDay, setAddPostDay] = useState<string>('')
  const [isExporting, setIsExporting] = useState(false)

  // ---- Derived data ----
  const weekDates = useMemo(
    () => getWeekDatesFromBase(weekBaseDate),
    [weekBaseDate]
  )

  const todayStr = useMemo(() => getTodayStr(), [])

  // Filtered blueprint entries
  const filteredBlueprint = useMemo(() => {
    let entries = blueprint

    // Filter by game
    if (selectedGameId) {
      entries = entries.filter((e) => e.gameId === selectedGameId)
    }

    // Filter by platform
    if (selectedPlatform && selectedPlatform !== 'all') {
      entries = entries.filter((e) => e.platform === selectedPlatform)
    }

    // Filter by status
    if (statusFilter && statusFilter !== 'all') {
      entries = entries.filter((e) => e.status === statusFilter)
    }

    // Filter by week
    const weekStartStr = dateToStr(weekDates[0])
    const weekEndStr = dateToStr(weekDates[6])
    entries = entries.filter(
      (e) => e.scheduledDate >= weekStartStr && e.scheduledDate <= weekEndStr
    )

    return entries
  }, [blueprint, selectedGameId, selectedPlatform, statusFilter, weekDates])

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, BlueprintEntry[]>()
    for (const entry of filteredBlueprint) {
      const existing = map.get(entry.scheduledDate) || []
      existing.push(entry)
      map.set(entry.scheduledDate, existing)
    }
    return map
  }, [filteredBlueprint])

  // For day detail view
  const dayDetailEntries = useMemo(() => {
    if (!selectedDayDetail) return []
    return filteredBlueprint
      .filter((e) => e.scheduledDate === selectedDayDetail)
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
  }, [filteredBlueprint, selectedDayDetail])

  // Game lookup map
  const gameMap = useMemo(() => {
    const map = new Map<string, Game>()
    for (const g of games) map.set(g.id, g)
    return map
  }, [games])

  // Banner lookup map
  const bannerMap = useMemo(() => {
    const map = new Map<string, BannerTemplate>()
    for (const b of banners) map.set(b.id, b)
    return map
  }, [banners])

  // Draft count for quick publish
  const draftCount = useMemo(
    () => blueprint.filter((e) => e.status === 'draft').length,
    [blueprint]
  )

  // ---- Fetch data on mount ----
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [gamesRes, bannersRes, blueprintRes] = await Promise.all([
          fetch('/api/games'),
          fetch('/api/banners'),
          fetch('/api/blueprint'),
        ])
        if (gamesRes.ok) setGames(await gamesRes.json())
        if (bannersRes.ok) setBanners(await bannersRes.json())
        if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
      } catch (err) {
        console.error('Failed to fetch blueprint data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [setGames, setBanners, setBlueprint, setIsLoading])

  // ---- Week navigation ----
  const goToPrevWeek = useCallback(() => {
    setWeekBaseDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
    setSelectedDayDetail(null)
  }, [])

  const goToNextWeek = useCallback(() => {
    setWeekBaseDate((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
    setSelectedDayDetail(null)
  }, [])

  const goToToday = useCallback(() => {
    setWeekBaseDate(new Date())
    setSelectedDayDetail(null)
  }, [])

  // ---- Publish flow ----
  const handlePublishClick = useCallback((entry: BlueprintEntry) => {
    setPublishingEntry(entry)
    setIsPublishConfirmOpen(true)
  }, [])

  const confirmPublish = useCallback(async () => {
    if (!publishingEntry) return

    try {
      const banner = publishingEntry.bannerId
        ? bannerMap.get(publishingEntry.bannerId)
        : null

      const payload = {
        caption: publishingEntry.caption,
        bannerImage: banner?.imageData || null,
        hashtags: banner?.hashtags || '',
      }

      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprintId: publishingEntry.id,
          platform: publishingEntry.platform,
          payload,
          scheduledAt: `${publishingEntry.scheduledDate}T${publishingEntry.scheduledTime}:00`,
        }),
      })

      if (res.ok) {
        // Refresh blueprint
        const blueprintRes = await fetch('/api/blueprint')
        if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
      }
    } catch (err) {
      console.error('Failed to publish:', err)
    }

    setIsPublishConfirmOpen(false)
    setPublishingEntry(null)
  }, [publishingEntry, bannerMap, setBlueprint])

  // ---- Delete entry ----
  const handleDelete = useCallback(
    async (entry: BlueprintEntry) => {
      try {
        await fetch(`/api/blueprint?id=${entry.id}`, { method: 'DELETE' })
        const blueprintRes = await fetch('/api/blueprint')
        if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
      } catch (err) {
        console.error('Failed to delete:', err)
      }
    },
    [setBlueprint]
  )

  // ---- Edit caption ----
  const handleEditClick = useCallback((entry: BlueprintEntry) => {
    setEditingEntry(entry)
    setEditCaption(entry.caption)
    setEditTime(entry.scheduledTime)
    setEditPlatform(entry.platform)
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingEntry) return
    try {
      await fetch('/api/blueprint', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingEntry,
          caption: editCaption,
          scheduledTime: editTime,
          platform: editPlatform,
        }),
      })
      const blueprintRes = await fetch('/api/blueprint')
      if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
    } catch (err) {
      console.error('Failed to save edit:', err)
    }
    setEditingEntry(null)
  }, [editingEntry, editCaption, editTime, editPlatform, setBlueprint])

  // ---- Update platform ----
  const handlePlatformChange = useCallback(
    async (entry: BlueprintEntry, newPlatform: string) => {
      try {
        await fetch('/api/blueprint', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entry, platform: newPlatform }),
        })
        const blueprintRes = await fetch('/api/blueprint')
        if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
      } catch (err) {
        console.error('Failed to update platform:', err)
      }
    },
    [setBlueprint]
  )

  // ---- Add new post ----
  const handleAddPost = useCallback(
    (gameId: string, dateStr: string) => {
      setAddPostGameId(gameId)
      setAddPostDay(dateStr)
      setIsAddingPost(true)
    },
    []
  )

  const handleCreatePost = useCallback(async () => {
    if (!addPostGameId || !addPostDay) return
    const game = gameMap.get(addPostGameId)
    const dayOfWeek = getDayName(new Date(addPostDay + 'T00:00:00'))

    // Get a default banner for this game/day
    const dayBanners = getBannersForGameDay(banners, addPostGameId, dayOfWeek)
    const defaultBanner = dayBanners[0]

    try {
      await fetch('/api/blueprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: addPostGameId,
          scheduledDate: addPostDay,
          scheduledTime: '20:00',
          dayOfWeek,
          platform: selectedPlatform === 'all' ? 'facebook' : selectedPlatform,
          caption: defaultBanner?.caption || `${game?.icon || ''} ${game?.name || ''} Draw - ${dayOfWeek}`,
          bannerId: defaultBanner?.id || null,
          status: 'draft',
        }),
      })
      const blueprintRes = await fetch('/api/blueprint')
      if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
    } catch (err) {
      console.error('Failed to create post:', err)
    }
    setIsAddingPost(false)
    setAddPostGameId('')
    setAddPostDay('')
  }, [addPostGameId, addPostDay, gameMap, banners, selectedPlatform, setBlueprint])

  // ---- Publish all drafts ----
  const handlePublishAllDrafts = useCallback(async () => {
    const drafts = blueprint.filter((e) => e.status === 'draft')
    for (const entry of drafts) {
      try {
        const banner = entry.bannerId ? bannerMap.get(entry.bannerId) : null
        await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blueprintId: entry.id,
            platform: entry.platform,
            payload: {
              caption: entry.caption,
              bannerImage: banner?.imageData || null,
              hashtags: banner?.hashtags || '',
            },
            scheduledAt: `${entry.scheduledDate}T${entry.scheduledTime}:00`,
          }),
        })
      } catch {
        // Continue with remaining
      }
    }
    const blueprintRes = await fetch('/api/blueprint')
    if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
  }, [blueprint, bannerMap, setBlueprint])

  // ---- Export queue ----
  const handleExportQueue = useCallback(async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/publish?action=export-pending', { method: 'DELETE' })
      if (res.ok) {
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `publish-queue-${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  // ---- Open Banner Studio ----
  const handleOpenBannerStudio = useCallback(
    (gameId: string, dateStr: string) => {
      setSelectedGameId(gameId)
      setSelectedDate(dateStr)
      setIsBannerStudioOpen(true)
    },
    [setSelectedGameId, setSelectedDate, setIsBannerStudioOpen]
  )

  // ---- Week range label ----
  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0]
    const end = weekDates[6]
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`
  }, [weekDates])

  // =========================================================================
  // RENDER
  // =========================================================================
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading blueprint...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen flex-col bg-background">
        {/* ================================================================= */}
        {/* Top Header Bar                                                    */}
        {/* ================================================================= */}
        <header className="shrink-0 border-b bg-card">
          <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Left: Title + stats */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Blueprint</h1>
                <p className="text-xs text-muted-foreground">
                  {blueprint.length} posts &middot; {draftCount} drafts &middot;{' '}
                  {blueprint.filter((e) => e.status === 'scheduled').length} queued
                </p>
              </div>
            </div>

            {/* Right: Filter row */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Game filter */}
              <Select
                value={selectedGameId || 'all'}
                onValueChange={(v) => setSelectedGameId(v === 'all' ? null : v)}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <Filter className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Games
                  </SelectItem>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id} className="text-xs">
                      <span className="mr-1.5">{g.icon}</span>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Platform filter */}
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <Globe className="mr-1.5 size-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Platforms
                  </SelectItem>
                  <SelectItem value="facebook" className="text-xs">
                    {PLATFORM_ICONS.facebook} Facebook
                  </SelectItem>
                  <SelectItem value="instagram" className="text-xs">
                    {PLATFORM_ICONS.instagram} Instagram
                  </SelectItem>
                  <SelectItem value="twitter" className="text-xs">
                    {PLATFORM_ICONS.twitter} Twitter/X
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Status
                  </SelectItem>
                  <SelectItem value="draft" className="text-xs">
                    Draft
                  </SelectItem>
                  <SelectItem value="scheduled" className="text-xs">
                    Scheduled
                  </SelectItem>
                  <SelectItem value="published" className="text-xs">
                    Published
                  </SelectItem>
                  <SelectItem value="failed" className="text-xs">
                    Failed
                  </SelectItem>
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

              {/* Action buttons */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                      setAddPostGameId(selectedGameId || games[0]?.id || '')
                      setAddPostDay(todayStr)
                      setIsAddingPost(true)
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add Post
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Create a new scheduled post</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={draftCount === 0}
                    onClick={handlePublishAllDrafts}
                  >
                    <Send className="mr-1.5 size-3.5" />
                    Publish All
                    {draftCount > 0 && (
                      <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                        {draftCount}
                      </Badge>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Queue all drafts for publishing</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={isExporting}
                    onClick={handleExportQueue}
                  >
                    <Eye className="mr-1.5 size-3.5" />
                    {isExporting ? 'Exporting...' : 'Export Queue'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Export publish queue as JSON for Playwright/Puppeteer
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </header>

        {/* ================================================================= */}
        {/* Week Calendar Strip                                               */}
        {/* ================================================================= */}
        <div className="shrink-0 border-b bg-card px-4 py-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={goToPrevWeek}>
              <ChevronLeft className="size-4" />
            </Button>

            <div className="flex items-center gap-2">
              <button
                onClick={goToToday}
                className="text-sm font-semibold hover:underline underline-offset-2"
              >
                {weekRangeLabel}
              </button>
            </div>

            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={goToNextWeek}>
              <ChevronRight className="size-4" />
            </Button>
          </div>

          {/* Day columns */}
          <div className="mt-2 grid grid-cols-7 gap-1">
            {weekDates.map((date, idx) => {
              const dateStr = dateToStr(date)
              const dayName = FULL_DAY_NAMES[date.getDay()]
              const dayShort = DAY_SHORTNAMES[dayName]
              const isToday = dateStr === todayStr
              const isSelected = selectedDayDetail === dateStr
              const gamesForDay = getGamesForDay(games, dayName)
              const entryCount = entriesByDate.get(dateStr)?.length || 0

              return (
                <button
                  key={dateStr}
                  onClick={() =>
                    setSelectedDayDetail(isSelected ? null : dateStr)
                  }
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg py-2 px-1 transition-all hover:bg-accent',
                    isSelected && 'bg-accent ring-2 ring-primary/30',
                    isToday && !isSelected && 'bg-primary/5',
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {dayShort}
                  </span>
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-sm font-bold',
                      isToday && 'bg-primary text-primary-foreground',
                      !isToday && 'text-foreground',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {/* Game dots */}
                  <div className="flex gap-0.5">
                    {gamesForDay.slice(0, 4).map((g) => (
                      <Tooltip key={g.id}>
                        <TooltipTrigger asChild>
                          <div
                            className="size-2 rounded-full"
                            style={{ backgroundColor: g.color }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[11px]">
                          {g.icon} {g.name}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {gamesForDay.length > 4 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{gamesForDay.length - 4}
                      </span>
                    )}
                  </div>
                  {/* Entry count */}
                  {entryCount > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {entryCount} post{entryCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* Main Content Area                                                 */}
        {/* ================================================================= */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Day detail view */}
            {selectedDayDetail ? (
              <DayDetailView
                dateStr={selectedDayDetail}
                entries={dayDetailEntries}
                games={games}
                banners={banners}
                bannerMap={bannerMap}
                gameMap={gameMap}
                onPublishClick={handlePublishClick}
                onEditClick={handleEditClick}
                onDelete={handleDelete}
                onPlatformChange={handlePlatformChange}
                onOpenBannerStudio={handleOpenBannerStudio}
                onAddPost={handleAddPost}
                onBack={() => setSelectedDayDetail(null)}
              />
            ) : (
              /* Week overview - grouped by day */
              <WeekOverview
                weekDates={weekDates}
                todayStr={todayStr}
                entriesByDate={entriesByDate}
                games={games}
                banners={banners}
                bannerMap={bannerMap}
                gameMap={gameMap}
                onDayClick={(dateStr) => setSelectedDayDetail(dateStr)}
                onPublishClick={handlePublishClick}
                onEditClick={handleEditClick}
                onDelete={handleDelete}
                onPlatformChange={handlePlatformChange}
                onOpenBannerStudio={handleOpenBannerStudio}
                onAddPost={handleAddPost}
              />
            )}
          </div>
        </ScrollArea>

        {/* ================================================================= */}
        {/* Dialogs                                                           */}
        {/* ================================================================= */}

        {/* Edit Caption Dialog */}
        <Dialog open={!!editingEntry} onOpenChange={(open) => !open && setEditingEntry(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="size-4" />
                Edit Post
              </DialogTitle>
              <DialogDescription>
                Modify the caption, time, or platform for this scheduled post.
              </DialogDescription>
            </DialogHeader>

            {editingEntry && (
              <div className="space-y-4">
                {/* Game info */}
                <div className="flex items-center gap-2">
                  {(() => {
                    const game = gameMap.get(editingEntry.gameId)
                    return game ? (
                      <Badge
                        variant="secondary"
                        className="gap-1.5"
                        style={{ borderColor: game.color, color: game.color }}
                      >
                        <span>{game.icon}</span>
                        {game.name}
                      </Badge>
                    ) : null
                  })()}
                  <Badge variant="outline" className="gap-1.5 text-xs">
                    <Calendar className="size-3" />
                    {formatDate(editingEntry.scheduledDate)}
                  </Badge>
                </div>

                {/* Caption */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Caption
                  </label>
                  <Textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    className="min-h-[120px] resize-none text-sm leading-relaxed"
                    placeholder="Write your caption..."
                  />
                  <p className="text-[11px] text-muted-foreground text-right">
                    {editCaption.length} / 2200 characters
                  </p>
                </div>

                {/* Time */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Scheduled Time
                  </label>
                  <Input
                    type="time"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="h-9 w-full text-sm"
                  />
                </div>

                {/* Platform */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Platform
                  </label>
                  <Select value={editPlatform} onValueChange={setEditPlatform}>
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="facebook">
                        {PLATFORM_ICONS.facebook} Facebook
                      </SelectItem>
                      <SelectItem value="instagram">
                        {PLATFORM_ICONS.instagram} Instagram
                      </SelectItem>
                      <SelectItem value="twitter">
                        {PLATFORM_ICONS.twitter} Twitter/X
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEntry(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>
                <CheckCircle className="mr-1.5 size-4" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Publish Confirmation Dialog */}
        <Dialog open={isPublishConfirmOpen} onOpenChange={setIsPublishConfirmOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="size-4" />
                Confirm & Queue
              </DialogTitle>
              <DialogDescription>
                This post will be added to the publish queue and processed at the scheduled time.
              </DialogDescription>
            </DialogHeader>

            {publishingEntry && (() => {
              const game = gameMap.get(publishingEntry.gameId)
              const banner = publishingEntry.bannerId
                ? bannerMap.get(publishingEntry.bannerId)
                : null
              return (
                <div className="space-y-3">
                  {/* Banner preview */}
                  <div className="flex gap-3 rounded-lg border p-3">
                    <div className="w-16 shrink-0">
                      <BannerThumbnail banner={banner} game={game} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">{game?.icon}</span>
                        <span className="text-sm font-semibold">{game?.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
                        {publishingEntry.caption}
                      </p>
                    </div>
                  </div>

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Calendar className="size-3" />
                      {formatDate(publishingEntry.scheduledDate)}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Clock className="size-3" />
                      {formatTime(publishingEntry.scheduledTime)}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-xs">
                      {PLATFORM_ICONS[publishingEntry.platform]}{' '}
                      {PLATFORM_LABELS[publishingEntry.platform]}
                    </Badge>
                  </div>
                </div>
              )
            })()}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPublishConfirmOpen(false)}>
                Cancel
              </Button>
              <Button onClick={confirmPublish}>
                <Send className="mr-1.5 size-4" />
                Confirm & Queue
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add New Post Dialog */}
        <Dialog open={isAddingPost} onOpenChange={setIsAddingPost}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="size-4" />
                Add New Post
              </DialogTitle>
              <DialogDescription>
                Choose a game and date to create a new scheduled post.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Game</label>
                <Select value={addPostGameId} onValueChange={setAddPostGameId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select a game..." />
                  </SelectTrigger>
                  <SelectContent>
                    {games.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="mr-1.5">{g.icon}</span>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Scheduled Date
                </label>
                <Input
                  type="date"
                  value={addPostDay}
                  onChange={(e) => setAddPostDay(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddingPost(false)}>
                Cancel
              </Button>
              <Button
                disabled={!addPostGameId || !addPostDay}
                onClick={handleCreatePost}
              >
                <Plus className="mr-1.5 size-4" />
                Create Post
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Banner Studio Sheet */}
      <BannerStudio />
    </TooltipProvider>
  )
}

// ===========================================================================
// Day Detail View
// ===========================================================================
function DayDetailView({
  dateStr,
  entries,
  games,
  banners,
  bannerMap,
  gameMap,
  onPublishClick,
  onEditClick,
  onDelete,
  onPlatformChange,
  onOpenBannerStudio,
  onAddPost,
  onBack,
}: {
  dateStr: string
  entries: BlueprintEntry[]
  games: Game[]
  banners: BannerTemplate[]
  bannerMap: Map<string, BannerTemplate>
  gameMap: Map<string, Game>
  onPublishClick: (entry: BlueprintEntry) => void
  onEditClick: (entry: BlueprintEntry) => void
  onDelete: (entry: BlueprintEntry) => void
  onPlatformChange: (entry: BlueprintEntry, platform: string) => void
  onOpenBannerStudio: (gameId: string, dateStr: string) => void
  onAddPost: (gameId: string, dateStr: string) => void
  onBack: () => void
}) {
  const date = new Date(dateStr + 'T00:00:00')
  const dayName = FULL_DAY_NAMES[date.getDay()]
  const todayStr = getTodayStr()
  const isToday = dateStr === todayStr
  const gamesForDay = getGamesForDay(games, dayName)

  return (
    <div className="space-y-4">
      {/* Day header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onBack}>
            <ChevronLeft className="size-4" />
            <span className="text-xs">Back</span>
          </Button>
          <div>
            <h2 className="text-xl font-bold">
              {dayName}
              {isToday && (
                <Badge className="ml-2 text-xs bg-primary text-primary-foreground">
                  Today
                </Badge>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">{formatDate(dateStr)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Games for this day */}
          {gamesForDay.map((g) => (
            <Tooltip key={g.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="gap-1 cursor-pointer hover:bg-accent"
                  style={{ borderColor: g.color }}
                  onClick={() => onAddPost(g.id, dateStr)}
                >
                  <span>{g.icon}</span>
                  <span className="hidden sm:inline text-xs">{g.shortName}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{g.name} &mdash; Click to add post</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <Separator />

      {/* Posts list */}
      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-muted">
              <Calendar className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">No Posts Scheduled</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              No posts are scheduled for {dayName}. Click a game above to add one.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <PostCard
              key={entry.id}
              entry={entry}
              game={gameMap.get(entry.gameId)}
              banner={entry.bannerId ? bannerMap.get(entry.bannerId) : null}
              onPublishClick={onPublishClick}
              onEditClick={onEditClick}
              onDelete={onDelete}
              onPlatformChange={onPlatformChange}
              onOpenBannerStudio={onOpenBannerStudio}
              showFullCaption
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ===========================================================================
// Week Overview
// ===========================================================================
function WeekOverview({
  weekDates,
  todayStr,
  entriesByDate,
  games,
  banners,
  bannerMap,
  gameMap,
  onDayClick,
  onPublishClick,
  onEditClick,
  onDelete,
  onPlatformChange,
  onOpenBannerStudio,
  onAddPost,
}: {
  weekDates: Date[]
  todayStr: string
  entriesByDate: Map<string, BlueprintEntry[]>
  games: Game[]
  banners: BannerTemplate[]
  bannerMap: Map<string, BannerTemplate>
  gameMap: Map<string, Game>
  onDayClick: (dateStr: string) => void
  onPublishClick: (entry: BlueprintEntry) => void
  onEditClick: (entry: BlueprintEntry) => void
  onDelete: (entry: BlueprintEntry) => void
  onPlatformChange: (entry: BlueprintEntry, platform: string) => void
  onOpenBannerStudio: (gameId: string, dateStr: string) => void
  onAddPost: (gameId: string, dateStr: string) => void
}) {
  // Check if week has any content
  const hasContent = weekDates.some(
    (d) => (entriesByDate.get(dateToStr(d))?.length || 0) > 0
  )

  if (!hasContent) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-muted">
            <Calendar className="size-7 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold">No Posts This Week</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            Click on a day in the calendar strip above to view details, or use &quot;Add Post&quot; to
            create a new scheduled post.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {weekDates.map((date) => {
        const dateStr = dateToStr(date)
        const dayName = FULL_DAY_NAMES[date.getDay()]
        const dayShort = DAY_SHORTNAMES[dayName]
        const isToday = dateStr === todayStr
        const dayEntries = entriesByDate.get(dateStr) || []
        const gamesForDay = getGamesForDay(games, dayName)

        if (dayEntries.length === 0 && gamesForDay.length === 0) return null

        return (
          <div key={dateStr} className="space-y-2">
            {/* Day section header */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => onDayClick(dateStr)}
                className="flex items-center gap-2 hover:underline underline-offset-2"
              >
                <span
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-bold',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && 'bg-muted text-muted-foreground',
                  )}
                >
                  {date.getDate()}
                </span>
                <span className="text-sm font-semibold">
                  {dayName}
                  {isToday && (
                    <span className="ml-1.5 text-xs font-medium text-primary">
                      (Today)
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(dateStr)}
                </span>
                {dayEntries.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {dayEntries.length}
                  </Badge>
                )}
              </button>

              {/* Quick add buttons for games this day */}
              <div className="hidden md:flex items-center gap-1">
                {gamesForDay.map((g) => (
                  <Tooltip key={g.id}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-1"
                        onClick={() => onAddPost(g.id, dateStr)}
                      >
                        <span>{g.icon}</span>
                        {g.shortName}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Add {g.name} post for {dayShort}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Posts for this day */}
            <div className="space-y-2">
              {dayEntries
                .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
                .slice(0, 3)
                .map((entry) => (
                  <PostCard
                    key={entry.id}
                    entry={entry}
                    game={gameMap.get(entry.gameId)}
                    banner={entry.bannerId ? bannerMap.get(entry.bannerId) : null}
                    onPublishClick={onPublishClick}
                    onEditClick={onEditClick}
                    onDelete={onDelete}
                    onPlatformChange={onPlatformChange}
                    onOpenBannerStudio={onOpenBannerStudio}
                    showFullCaption={false}
                  />
                ))}

              {dayEntries.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs text-muted-foreground"
                  onClick={() => onDayClick(dateStr)}
                >
                  View all {dayEntries.length} posts for {dayShort}
                  <ChevronRight className="ml-1 size-3" />
                </Button>
              )}

              {dayEntries.length === 0 && gamesForDay.length > 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">
                  No posts yet. Click a game above to add one.
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ===========================================================================
// Post Card
// ===========================================================================
function PostCard({
  entry,
  game,
  banner,
  onPublishClick,
  onEditClick,
  onDelete,
  onPlatformChange,
  onOpenBannerStudio,
  showFullCaption,
}: {
  entry: BlueprintEntry
  game?: Game
  banner?: BannerTemplate | undefined
  onPublishClick: (entry: BlueprintEntry) => void
  onEditClick: (entry: BlueprintEntry) => void
  onDelete: (entry: BlueprintEntry) => void
  onPlatformChange: (entry: BlueprintEntry, platform: string) => void
  onOpenBannerStudio: (gameId: string, dateStr: string) => void
  showFullCaption: boolean
}) {
  return (
    <Card
      className="overflow-hidden transition-all hover:shadow-md"
      style={{
        borderLeftWidth: '4px',
        borderLeftColor: game?.color || 'hsl(var(--border))',
      }}
    >
      <CardContent className="p-0">
        <div className="flex gap-3 p-3 sm:p-4">
          {/* Banner thumbnail */}
          <div className="hidden sm:block w-16 h-16 shrink-0 rounded-lg overflow-hidden">
            <BannerThumbnail banner={banner} game={game} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Top row: Game + Meta + Actions */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                {/* Game icon + name */}
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{game?.icon}</span>
                  <span className="text-sm font-semibold truncate">
                    {game?.name || 'Unknown Game'}
                  </span>
                </div>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className={cn('text-[10px] gap-1', STATUS_COLORS[entry.status])}
                >
                  <StatusIcon status={entry.status} />
                  {STATUS_LABELS[entry.status]}
                </Badge>

                {/* Platform selector (compact dropdown) */}
                <Select
                  value={entry.platform}
                  onValueChange={(v) => onPlatformChange(entry, v)}
                >
                  <SelectTrigger className="h-6 w-[90px] text-[11px] px-1.5 border-dashed">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook" className="text-xs">
                      {PLATFORM_ICONS.facebook} Facebook
                    </SelectItem>
                    <SelectItem value="instagram" className="text-xs">
                      {PLATFORM_ICONS.instagram} Instagram
                    </SelectItem>
                    <SelectItem value="twitter" className="text-xs">
                      {PLATFORM_ICONS.twitter} Twitter/X
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Time */}
                <Badge variant="outline" className="hidden sm:flex text-[10px] gap-1 text-muted-foreground">
                  <Clock className="size-2.5" />
                  {formatTime(entry.scheduledTime)}
                </Badge>
              </div>

              {/* Action dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onEditClick(entry)}>
                    <Edit className="size-3.5" />
                    Edit Caption
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onOpenBannerStudio(entry.gameId, entry.scheduledDate)}
                  >
                    <Palette className="size-3.5" />
                    Open Banner Studio
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {entry.status === 'draft' && (
                    <DropdownMenuItem onClick={() => onPublishClick(entry)}>
                      <Send className="size-3.5" />
                      Publish / Queue
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onDelete(entry)}
                  >
                    <Trash2 className="size-3.5" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Caption - always shown inline */}
            <p
              className={cn(
                'text-sm text-muted-foreground whitespace-pre-line leading-relaxed',
                showFullCaption ? '' : 'line-clamp-2',
              )}
            >
              {entry.caption || (
                <span className="italic">No caption yet &mdash; click Edit to add one</span>
              )}
            </p>

            {/* Bottom row: time (mobile) + quick publish */}
            <div className="flex items-center justify-between mt-2 gap-2">
              <div className="flex items-center gap-2">
                {/* Mobile time */}
                <Badge variant="outline" className="sm:hidden text-[10px] gap-1 text-muted-foreground">
                  <Clock className="size-2.5" />
                  {formatTime(entry.scheduledTime)}
                </Badge>
                {/* Platform badge (mobile) */}
                <Badge variant="secondary" className="text-[10px] gap-1">
                  {PLATFORM_ICONS[entry.platform]}
                  {PLATFORM_LABELS[entry.platform]}
                </Badge>
                {banner && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    Banner
                  </Badge>
                )}
              </div>

              {/* Quick publish button for drafts */}
              {entry.status === 'draft' && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => onPublishClick(entry)}
                >
                  <Send className="size-3" />
                  Publish
                </Button>
              )}

              {entry.status === 'scheduled' && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="size-3" />
                  In publish queue
                </span>
              )}

              {entry.status === 'published' && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCircle className="size-3" />
                  Published
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
