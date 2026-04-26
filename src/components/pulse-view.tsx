'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
  Trophy,
  Settings,
  RefreshCw,
  Zap,
  Edit,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAppStore } from '@/lib/store'
import { cn, formatDate, formatTime, STATUS_COLORS, STATUS_LABELS, PLATFORM_ICONS, PLATFORM_LABELS, getTodayStr, getDayName, parseScheduleDays } from '@/lib/utils'
import type { PulseActivity, BlueprintEntry, Game, Winner } from '@/lib/types'

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------
type ActivityType = PulseActivity['type']

type FilterTab = 'all' | ActivityType

const FILTER_TABS: { value: FilterTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'All', icon: Activity },
  { value: 'published', label: 'Published', icon: CheckCircle },
  { value: 'scheduled', label: 'Scheduled', icon: Clock },
  { value: 'failed', label: 'Failed', icon: XCircle },
  { value: 'winner', label: 'Winners', icon: Trophy },
]

const TYPE_CONFIG: Record<ActivityType, {
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  border: string
  avatarBg: string
  ring: string
}> = {
  published: {
    icon: CheckCircle,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-l-emerald-500',
    avatarBg: 'bg-emerald-100',
    ring: 'ring-emerald-500/20',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-l-red-500',
    avatarBg: 'bg-red-100',
    ring: 'ring-red-500/20',
  },
  scheduled: {
    icon: Clock,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-l-blue-500',
    avatarBg: 'bg-blue-100',
    ring: 'ring-blue-500/20',
  },
  draft: {
    icon: Edit,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-l-amber-500',
    avatarBg: 'bg-amber-100',
    ring: 'ring-amber-500/20',
  },
  winner: {
    icon: Trophy,
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    border: 'border-l-yellow-500',
    avatarBg: 'bg-yellow-100',
    ring: 'ring-yellow-500/20',
  },
  system: {
    icon: Settings,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
    border: 'border-l-slate-400',
    avatarBg: 'bg-slate-100',
    ring: 'ring-slate-500/20',
  },
}

// ---------------------------------------------------------------------------
// Helper: relative time
// ---------------------------------------------------------------------------
function relativeTime(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`
  return formatDate(timestamp.split('T')[0])
}

// ---------------------------------------------------------------------------
// Helper: generate activities from blueprint data
// ---------------------------------------------------------------------------
function generateBlueprintActivities(blueprint: BlueprintEntry[], gameMap: Map<string, Game>): PulseActivity[] {
  const activities: PulseActivity[] = []

  for (const entry of blueprint) {
    const game = gameMap.get(entry.gameId)
    const base = {
      id: `bp-${entry.id}`,
      gameName: game?.name,
      gameColor: game?.color,
      gameIcon: game?.icon,
    }

    switch (entry.status) {
      case 'published':
        activities.push({
          ...base,
          type: 'published',
          title: 'Post Published',
          description: `${game?.name || 'Game'} post published to ${PLATFORM_LABELS[entry.platform] || entry.platform}${entry.postedAt ? ` at ${formatTime(entry.postedAt.split('T')[1]?.slice(0, 5) || entry.postedAt.split('T')[1] || '')}` : ''}`,
          timestamp: entry.postedAt || entry.updatedAt,
        })
        break
      case 'scheduled':
        activities.push({
          ...base,
          type: 'scheduled',
          title: 'Post Scheduled',
          description: `${game?.name || 'Game'} post queued for ${PLATFORM_LABELS[entry.platform] || entry.platform} on ${formatDate(entry.scheduledDate)} at ${formatTime(entry.scheduledTime)}`,
          timestamp: entry.updatedAt,
        })
        break
      case 'failed':
        activities.push({
          ...base,
          type: 'failed',
          title: 'Post Failed',
          description: `${game?.name || 'Game'} post to ${PLATFORM_LABELS[entry.platform] || entry.platform} failed.${entry.publishLog ? ` ${entry.publishLog}` : ''}`,
          timestamp: entry.updatedAt,
        })
        break
      case 'draft':
        activities.push({
          ...base,
          type: 'draft',
          title: 'Draft Created',
          description: `${game?.name || 'Game'} draft created for ${formatDate(entry.scheduledDate)}`,
          timestamp: entry.updatedAt,
        })
        break
    }
  }

  return activities
}

// ---------------------------------------------------------------------------
// Helper: generate activities from winners data
// ---------------------------------------------------------------------------
function generateWinnerActivities(winners: Winner[], gameMap: Map<string, Game>): PulseActivity[] {
  return winners.map((w) => {
    const game = gameMap.get(w.gameId)
    return {
      id: `win-${w.id}`,
      type: 'winner' as const,
      title: 'Draw Result',
      description: `${game?.name || 'Game'} draw on ${formatDate(w.drawDate)} — ${w.winners} winner${w.winners !== 1 ? 's' : ''}${w.jackpot ? `, jackpot ${new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(w.jackpot)}` : ''}`,
      timestamp: w.createdAt,
      gameName: game?.name,
      gameColor: game?.color,
      gameIcon: game?.icon,
    }
  })
}

// ---------------------------------------------------------------------------
// Helper: generate system activities
// ---------------------------------------------------------------------------
function generateSystemActivities(
  games: Game[],
  blueprint: BlueprintEntry[],
  gameMap: Map<string, Game>
): PulseActivity[] {
  const activities: PulseActivity[] = []
  const todayStr = getTodayStr()
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Build a set of (gameId, date) that have published or scheduled entries
  const coveredSlots = new Set<string>()
  for (const entry of blueprint) {
    if (entry.status === 'published' || entry.status === 'scheduled') {
      coveredSlots.add(`${entry.gameId}__${entry.scheduledDate}`)
    }
  }

  for (const game of games) {
    if (!game.isActive) continue
    const scheduleDays = parseScheduleDays(game.scheduleDays)

    // Check today
    const todayDayName = today.toLocaleDateString('en-US', { weekday: 'long' })
    if (scheduleDays.includes(todayDayName) && !coveredSlots.has(`${game.id}__${todayStr}`)) {
      const hasDraft = blueprint.some(
        (e) => e.gameId === game.id && e.scheduledDate === todayStr
      )
      if (hasDraft) {
        activities.push({
          id: `sys-overdue-${game.id}-${todayStr}`,
          type: 'system',
          title: 'Overdue Draft',
          description: `${game.name} draw is today but only has draft posts — nothing scheduled or published.`,
          timestamp: new Date().toISOString(),
          gameName: game.name,
          gameColor: game.color,
          gameIcon: game.icon,
        })
      } else {
        activities.push({
          id: `sys-missing-${game.id}-${todayStr}`,
          type: 'system',
          title: 'Missing Scheduled Post',
          description: `${game.name} draw is today but no post has been created.`,
          timestamp: new Date().toISOString(),
          gameName: game.name,
          gameColor: game.color,
          gameIcon: game.icon,
        })
      }
    }

    // Check tomorrow (upcoming draw alert)
    const tomorrowDayName = tomorrow.toLocaleDateString('en-US', { weekday: 'long' })
    if (scheduleDays.includes(tomorrowDayName) && !coveredSlots.has(`${game.id}__${tomorrowStr}`)) {
      activities.push({
        id: `sys-upcoming-${game.id}-${tomorrowStr}`,
        type: 'system',
        title: 'Upcoming Draw',
        description: `${game.name} draw is tomorrow (${tomorrowDayName}). Consider preparing posts in advance.`,
        timestamp: new Date().toISOString(),
        gameName: game.name,
        gameColor: game.color,
        gameIcon: game.icon,
      })
    }
  }

  return activities
}

// ---------------------------------------------------------------------------
// Activity Icon Component
// ---------------------------------------------------------------------------
function ActivityIcon({ type, gameIcon }: { type: ActivityType; gameIcon?: string }) {
  const config = TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <Avatar className={cn('size-9 shrink-0', config.avatarBg, config.ring, 'ring-2')}>
      <AvatarFallback className={cn('bg-transparent text-base', config.color)}>
        <Icon className="size-4" />
      </AvatarFallback>
    </Avatar>
  )
}

// ---------------------------------------------------------------------------
// Activity Item Component
// ---------------------------------------------------------------------------
function ActivityItem({ activity }: { activity: PulseActivity }) {
  const config = TYPE_CONFIG[activity.type]

  return (
    <div
      className={cn(
        'relative flex gap-3 border-l-[3px] pl-4 pb-4 transition-colors hover:bg-accent/30 rounded-r-lg pr-2',
        config.border
      )}
    >
      {/* Connector dot on the timeline */}
      <div
        className={cn(
          'absolute -left-[7px] top-0 size-[11px] rounded-full border-2 border-background',
          activity.type === 'published' && 'bg-emerald-500',
          activity.type === 'failed' && 'bg-red-500',
          activity.type === 'scheduled' && 'bg-blue-500',
          activity.type === 'draft' && 'bg-amber-500',
          activity.type === 'winner' && 'bg-yellow-500',
          activity.type === 'system' && 'bg-slate-400'
        )}
      />

      {/* Icon */}
      <div className="pt-0.5">
        <ActivityIcon type={activity.type} gameIcon={activity.gameIcon} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{activity.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
          </div>
          <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
            {relativeTime(activity.timestamp)}
          </span>
        </div>

        {/* Game badge */}
        {activity.gameName && (
          <div className="mt-1.5">
            <Badge
              variant="outline"
              className="text-[10px] font-medium px-1.5 py-0 gap-1"
              style={{
                borderColor: activity.gameColor ? `${activity.gameColor}60` : undefined,
                color: activity.gameColor || undefined,
              }}
            >
              {activity.gameIcon && <span className="text-xs">{activity.gameIcon}</span>}
              {activity.gameName}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main PulseView Component
// ---------------------------------------------------------------------------
export default function PulseView() {
  const {
    games,
    setGames,
    blueprint,
    setBlueprint,
    winners,
    setWinners,
    isLoading,
    setIsLoading,
  } = useAppStore()

  // ---- Local state ----
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  // ---- Game lookup map ----
  const gameMap = useMemo(() => {
    const map = new Map<string, Game>()
    for (const g of games) map.set(g.id, g)
    return map
  }, [games])

  // ---- Generate all activities ----
  const allActivities = useMemo(() => {
    const bpActivities = generateBlueprintActivities(blueprint, gameMap)
    const winnerActivities = generateWinnerActivities(winners, gameMap)
    const systemActivities = generateSystemActivities(games, blueprint, gameMap)

    const combined = [...bpActivities, ...winnerActivities, ...systemActivities]

    // Sort by timestamp, newest first
    combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return combined
  }, [blueprint, winners, games, gameMap])

  // ---- Filtered activities ----
  const filteredActivities = useMemo(() => {
    if (activeFilter === 'all') return allActivities
    return allActivities.filter((a) => a.type === activeFilter)
  }, [allActivities, activeFilter])

  // ---- Quick stats ----
  const stats = useMemo(() => {
    const todayStr = getTodayStr()
    const publishedToday = allActivities.filter(
      (a) => a.type === 'published' && a.timestamp.startsWith(todayStr)
    ).length
    const failedToday = allActivities.filter(
      (a) => a.type === 'failed' && a.timestamp.startsWith(todayStr)
    ).length
    const pending = blueprint.filter((e) => e.status === 'draft' || e.status === 'scheduled').length

    return {
      total: allActivities.length,
      publishedToday,
      failedToday,
      pending,
    }
  }, [allActivities, blueprint])

  // ---- Fetch data on mount ----
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [gamesRes, blueprintRes, winnersRes] = await Promise.all([
          fetch('/api/games'),
          fetch('/api/blueprint'),
          fetch('/api/winners?limit=20'),
        ])
        if (gamesRes.ok) setGames(await gamesRes.json())
        if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
        if (winnersRes.ok) setWinners(await winnersRes.json())
      } catch (err) {
        console.error('Failed to fetch pulse data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [setGames, setBlueprint, setWinners, setIsLoading])

  // ---- Refresh handler ----
  const handleRefresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const [blueprintRes, winnersRes] = await Promise.all([
        fetch('/api/blueprint'),
        fetch('/api/winners?limit=20'),
      ])
      if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
      if (winnersRes.ok) setWinners(await winnersRes.json())
    } catch (err) {
      console.error('Failed to refresh:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setBlueprint, setWinners, setIsLoading])

  // =========================================================================
  // RENDER
  // =========================================================================
  if (isLoading && allActivities.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading activity feed...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ================================================================= */}
      {/* Header                                                             */}
      {/* ================================================================= */}
      <header className="shrink-0 border-b bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Pulse</h1>
              <p className="text-xs text-muted-foreground">
                Real-time activity feed &middot; {stats.total} events
              </p>
            </div>
          </div>

          {/* Right: Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={isLoading}
            onClick={handleRefresh}
          >
            <RefreshCw className={cn('mr-1.5 size-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Quick Stats Bar                                                    */}
      {/* ================================================================= */}
      <div className="shrink-0 border-b bg-card px-4 py-2.5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'Total Activities',
              value: stats.total,
              icon: Activity,
              color: 'text-foreground',
              bg: 'bg-muted',
            },
            {
              label: 'Published Today',
              value: stats.publishedToday,
              icon: CheckCircle,
              color: 'text-emerald-600',
              bg: 'bg-emerald-50',
            },
            {
              label: 'Failed Today',
              value: stats.failedToday,
              icon: XCircle,
              color: stats.failedToday > 0 ? 'text-red-600' : 'text-emerald-600',
              bg: stats.failedToday > 0 ? 'bg-red-50' : 'bg-emerald-50',
            },
            {
              label: 'Pending in Queue',
              value: stats.pending,
              icon: Clock,
              color: stats.pending > 0 ? 'text-blue-600' : 'text-muted-foreground',
              bg: stats.pending > 0 ? 'bg-blue-50' : 'bg-muted',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2',
                stat.bg
              )}
            >
              <stat.icon className={cn('size-4 shrink-0', stat.color)} />
              <div className="min-w-0">
                <p className={cn('text-lg font-bold leading-tight', stat.color)}>{stat.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Filter Tabs                                                        */}
      {/* ================================================================= */}
      <div className="shrink-0 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? allActivities.length
                : allActivities.filter((a) => a.type === tab.value).length
            const isActive = activeFilter === tab.value
            const Icon = tab.icon

            return (
              <button
                key={tab.value}
                onClick={() => setActiveFilter(tab.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center size-4 rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Activity Timeline                                                  */}
      {/* ================================================================= */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredActivities.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Zap className="size-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">No activities yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Activities will appear here as posts are created, scheduled, and published.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-0">
              {filteredActivities.map((activity, index) => (
                <ActivityItem key={`${activity.id}-${index}`} activity={activity} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
