'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Gamepad2,
  Clock,
  Target,
  CheckCircle,
  Zap,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  AlertCircle,
  FileWarning,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { useAppStore } from '@/lib/store'
import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  getGamesForDay,
  parseScheduleDays,
  parseNumbers,
  getWeekDates,
  getTodayStr,
  getDayName,
  DAY_SHORTNAMES,
  STATUS_COLORS,
  STATUS_LABELS,
  PLATFORM_ICONS,
  PLATFORM_LABELS,
} from '@/lib/utils'
import type { Game, BlueprintEntry, Winner, BannerTemplate } from '@/lib/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const FULL_DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

type DayName = (typeof FULL_DAY_NAMES)[number]

const COMPLETION_COLOR = (pct: number) => {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-red-600'
}

const COMPLETION_BG = (pct: number) => {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-red-500'
}

const STATUS_ICON_MAP: Record<string, 'good' | 'warn' | 'bad'> = {
  published: 'good',
  scheduled: 'good',
  draft: 'warn',
  failed: 'bad',
}

// ---------------------------------------------------------------------------
// Helper: get Monday–Sunday week dates from a base date
// ---------------------------------------------------------------------------
function getWeekStartMonday(baseDate: Date): Date {
  const d = new Date(baseDate)
  const day = d.getDay()
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

function getMonthDates(baseDate: Date): Date[] {
  const year = baseDate.getFullYear()
  const month = baseDate.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  const dates: Date[] = []
  const current = new Date(start)
  while (current <= end) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }
  return dates
}

// ---------------------------------------------------------------------------
// Metric Card (reusable)
// ---------------------------------------------------------------------------
function MetricCard({
  label,
  value,
  icon: Icon,
  description,
  trend,
  color = 'text-foreground',
}: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}) {
  return (
    <Card className="flex flex-col gap-1">
      <CardHeader className="flex flex-row items-center justify-between pb-0 pt-4 px-4">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="pb-4 px-4 flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className={cn('text-2xl font-bold tracking-tight', color)}>
            {value}
          </span>
          {trend && trend !== 'neutral' && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-semibold',
                trend === 'up' && 'text-emerald-600',
                trend === 'down' && 'text-red-600'
              )}
            >
              {trend === 'up' ? (
                <ArrowUpRight className="size-3" />
              ) : (
                <ArrowDownRight className="size-3" />
              )}
            </span>
          )}
        </div>
        {description && (
          <p className="text-[11px] text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Schedule Overview Tab
// ---------------------------------------------------------------------------
function ScheduleOverviewTab({
  games,
  blueprint,
  weekDates,
  todayStr,
}: {
  games: Game[]
  blueprint: BlueprintEntry[]
  weekDates: Date[]
  todayStr: string
}) {
  const weekStartStr = dateToStr(weekDates[0])
  const weekEndStr = dateToStr(weekDates[6])

  // Group blueprint entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, BlueprintEntry[]>()
    for (const entry of blueprint) {
      if (entry.scheduledDate >= weekStartStr && entry.scheduledDate <= weekEndStr) {
        const existing = map.get(entry.scheduledDate) || []
        existing.push(entry)
        map.set(entry.scheduledDate, existing)
      }
    }
    return map
  }, [blueprint, weekStartStr, weekEndStr])

  // Stats for the week
  const weekStats = useMemo(() => {
    const weekEntries = blueprint.filter(
      (e) => e.scheduledDate >= weekStartStr && e.scheduledDate <= weekEndStr
    )

    // Expected posts: sum of (games that have draws on each day)
    let expectedPosts = 0
    let completedPosts = 0
    for (const date of weekDates) {
      const dateStr = dateToStr(date)
      const dayName = FULL_DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]
      const gamesOnDay = getGamesForDay(games, dayName)
      expectedPosts += gamesOnDay.length

      const dayEntries = entriesByDate.get(dateStr) || []
      completedPosts += dayEntries.filter(
        (e) => e.status === 'published' || e.status === 'scheduled'
      ).length
    }

    const published = weekEntries.filter((e) => e.status === 'published').length
    const scheduled = weekEntries.filter((e) => e.status === 'scheduled').length
    const draft = weekEntries.filter((e) => e.status === 'draft').length
    const failed = weekEntries.filter((e) => e.status === 'failed').length

    return {
      total: weekEntries.length,
      published,
      scheduled,
      draft,
      failed,
      expectedPosts,
      completedPosts,
      completionPct:
        expectedPosts > 0
          ? Math.round((completedPosts / expectedPosts) * 100)
          : 0,
    }
  }, [blueprint, weekDates, entriesByDate, games, weekStartStr, weekEndStr])

  // Sorted games by sort order
  const sortedGames = useMemo(
    () => [...games].sort((a, b) => a.sortOrder - b.sortOrder),
    [games]
  )

  return (
    <div className="space-y-4">
      {/* Top summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Expected Posts"
          value={weekStats.expectedPosts}
          icon={Target}
          description="Games scheduled this week"
        />
        <MetricCard
          label="Posts Created"
          value={weekStats.total}
          icon={Calendar}
          description={`${weekStats.published} published, ${weekStats.scheduled} queued`}
          trend={weekStats.total > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Completion"
          value={`${weekStats.completionPct}%`}
          icon={Zap}
          description={`${weekStats.completedPosts} of ${weekStats.expectedPosts} covered`}
          color={COMPLETION_COLOR(weekStats.completionPct)}
        />
        <MetricCard
          label="Drafts"
          value={weekStats.draft}
          icon={FileWarning}
          description={weekStats.failed > 0 ? `${weekStats.failed} failed` : 'Ready to publish'}
          color={weekStats.draft > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {/* Weekly schedule grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="size-4" />
            Weekly Schedule Grid
          </CardTitle>
          <CardDescription>
            Each cell shows if a game has a draw and how many posts are scheduled
          </CardDescription>
        </CardHeader>
        <CardContent className="px-2 pb-4">
          {/* Day headers */}
          <div className="grid grid-cols-8 gap-px overflow-hidden">
            <div className="px-2 py-2 text-[11px] font-medium text-muted-foreground flex items-center">
              Game
            </div>
            {weekDates.map((date) => {
              const dateStr = dateToStr(date)
              const dayName = FULL_DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]
              const isToday = dateStr === todayStr
              return (
                <div
                  key={dateStr}
                  className={cn(
                    'flex flex-col items-center gap-0.5 py-2 px-1 rounded-md text-center',
                    isToday && 'bg-primary/5'
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {DAY_SHORTNAMES[dayName]}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-bold',
                      isToday && 'text-primary'
                    )}
                  >
                    {date.getDate()}
                  </span>
                </div>
              )
            })}
          </div>

          <Separator className="my-2" />

          {/* Game rows */}
          <div className="space-y-px max-h-[360px] overflow-y-auto">
            {sortedGames.map((game) => {
              const scheduleDays = parseScheduleDays(game.scheduleDays)
              return (
                <div
                  key={game.id}
                  className="grid grid-cols-8 gap-px hover:bg-accent/30 transition-colors"
                >
                  {/* Game label */}
                  <div className="flex items-center gap-1.5 px-2 py-2 min-w-0">
                    <span className="shrink-0 text-base">{game.icon}</span>
                    <span className="text-xs font-medium truncate">
                      {game.shortName || game.name}
                    </span>
                  </div>

                  {/* Day cells */}
                  {weekDates.map((date) => {
                    const dateStr = dateToStr(date)
                    const dayName = FULL_DAY_NAMES[date.getDay() === 0 ? 6 : date.getDay() - 1]
                    const hasDraw = scheduleDays.includes(dayName)
                    const isToday = dateStr === todayStr
                    const dayEntries = (entriesByDate.get(dateStr) || []).filter(
                      (e) => e.gameId === game.id
                    )
                    const published = dayEntries.filter(
                      (e) => e.status === 'published'
                    ).length
                    const total = dayEntries.length

                    if (!hasDraw) {
                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            'flex items-center justify-center py-2',
                            isToday && 'bg-primary/[0.02]'
                          )}
                        >
                          <div className="size-2 rounded-full bg-muted" />
                        </div>
                      )
                    }

                    const isComplete = published > 0
                    const isPartial = total > 0 && published === 0

                    return (
                      <div
                        key={dateStr}
                        className={cn(
                          'flex flex-col items-center justify-center py-2 rounded-md gap-0.5',
                          isToday && 'bg-primary/5 ring-1 ring-primary/20',
                          isComplete && !isToday && 'bg-emerald-50/50',
                          isPartial && !isToday && 'bg-amber-50/50'
                        )}
                      >
                        <div
                          className={cn(
                            'size-3 rounded-full',
                            hasDraw && !total && 'bg-gray-300',
                            isComplete && 'bg-emerald-500',
                            isPartial && 'bg-amber-400'
                          )}
                          style={
                            !isComplete && !isPartial && hasDraw
                              ? { backgroundColor: game.color, opacity: 0.3 }
                              : undefined
                          }
                        />
                        {total > 0 && (
                          <span className="text-[9px] font-semibold text-muted-foreground">
                            {published}/{total}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 px-2">
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-muted-foreground">Published</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-amber-400" />
              <span className="text-[11px] text-muted-foreground">Scheduled/Draft</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-muted" />
              <span className="text-[11px] text-muted-foreground">No Draw</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-gray-300" />
              <span className="text-[11px] text-muted-foreground">Draw — Missing Posts</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Posting Stats Tab
// ---------------------------------------------------------------------------
function PostingStatsTab({
  blueprint,
  weekDates,
  todayStr,
  monthDates,
}: {
  blueprint: BlueprintEntry[]
  weekDates: Date[]
  todayStr: string
  monthDates: Date[]
}) {
  const weekStartStr = dateToStr(weekDates[0])
  const weekEndStr = dateToStr(weekDates[6])
  const monthStartStr = dateToStr(monthDates[0])
  const monthEndStr = dateToStr(monthDates[monthDates.length - 1])

  const stats = useMemo(() => {
    const all = blueprint
    const weekEntries = all.filter(
      (e) => e.scheduledDate >= weekStartStr && e.scheduledDate <= weekEndStr
    )
    const monthEntries = all.filter(
      (e) => e.scheduledDate >= monthStartStr && e.scheduledDate <= monthEndStr
    )

    const published = all.filter((e) => e.status === 'published')
    const scheduled = all.filter((e) => e.status === 'scheduled')
    const draft = all.filter((e) => e.status === 'draft')
    const failed = all.filter((e) => e.status === 'failed')

    const successRate =
      all.length > 0
        ? Math.round((published.length / all.length) * 100)
        : 0

    // Average time between scheduling and posting (in hours)
    const publishedWithTime = published.filter(
      (e) => e.postedAt && e.createdAt
    )
    let avgHours = 0
    if (publishedWithTime.length > 0) {
      const totalMs = publishedWithTime.reduce((sum, e) => {
        const created = new Date(e.createdAt).getTime()
        const posted = new Date(e.postedAt!).getTime()
        return sum + (posted - created)
      }, 0)
      avgHours = Math.round(totalMs / publishedWithTime.length / (1000 * 60 * 60))
    }

    // Platform distribution
    const platformCount: Record<string, number> = {}
    for (const e of all) {
      platformCount[e.platform] = (platformCount[e.platform] || 0) + 1
    }
    const totalPosts = all.length

    // Most active game (from week entries)
    const gamePostCount: Record<string, number> = {}
    for (const e of weekEntries) {
      gamePostCount[e.gameId] = (gamePostCount[e.gameId] || 0) + 1
    }
    const topGameId = Object.entries(gamePostCount).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0]

    return {
      totalPosts: all.length,
      weekPosts: weekEntries.length,
      monthPosts: monthEntries.length,
      published: published.length,
      scheduled: scheduled.length,
      draft: draft.length,
      failed: failed.length,
      successRate,
      avgHours,
      platformCount,
      totalPostsForPlatform: totalPosts,
      topGameId,
    }
  }, [blueprint, weekStartStr, weekEndStr, monthStartStr, monthEndStr])

  // Platform breakdown sorted by count
  const platformEntries = useMemo(
    () =>
      Object.entries(stats.platformCount).sort((a, b) => b[1] - a[1]),
    [stats.platformCount]
  )

  const maxPlatformCount = Math.max(
    ...platformEntries.map(([, c]) => c),
    1
  )

  return (
    <div className="space-y-4">
      {/* Key metrics row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <MetricCard
          label="Posts This Week"
          value={stats.weekPosts}
          icon={Calendar}
          description={`${dateToStr(weekDates[0])} — ${dateToStr(weekDates[6])}`}
        />
        <MetricCard
          label="Posts This Month"
          value={stats.monthPosts}
          icon={BarChart3}
          description={`${dateToStr(monthDates[0])} — ${dateToStr(monthDates[monthDates.length - 1])}`}
        />
        <MetricCard
          label="Success Rate"
          value={`${stats.successRate}%`}
          icon={Target}
          description={`${stats.published} of ${stats.totalPosts} posts published`}
          color={COMPLETION_COLOR(stats.successRate)}
          trend={stats.successRate >= 70 ? 'up' : stats.successRate < 40 ? 'down' : 'neutral'}
        />
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <PieChart className="size-4" />
            Status Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar for success rate */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Posting Success Rate</span>
              <span
                className={cn(
                  'text-sm font-bold',
                  COMPLETION_COLOR(stats.successRate)
                )}
              >
                {stats.successRate}%
              </span>
            </div>
            <Progress value={stats.successRate} className="h-2.5" />
          </div>

          <Separator />

          {/* Status counts */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Published',
                count: stats.published,
                icon: CheckCircle,
                color: 'text-emerald-600',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Scheduled',
                count: stats.scheduled,
                icon: Clock,
                color: 'text-blue-600',
                bg: 'bg-blue-50',
              },
              {
                label: 'Draft',
                count: stats.draft,
                icon: FileWarning,
                color: 'text-amber-600',
                bg: 'bg-amber-50',
              },
              {
                label: 'Failed',
                count: stats.failed,
                icon: AlertCircle,
                color: 'text-red-600',
                bg: 'bg-red-50',
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg p-3',
                  item.bg
                )}
              >
                <item.icon className={cn('size-5', item.color)} />
                <span className={cn('text-xl font-bold', item.color)}>
                  {item.count}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <Separator />

          {/* Average time between scheduling & posting */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium">Avg. Schedule → Publish</span>
            </div>
            <span className="text-sm font-semibold">
              {stats.avgHours > 0 ? `${stats.avgHours}h` : 'N/A'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Platform distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4" />
            Platform Distribution
          </CardTitle>
          <CardDescription>Posts per platform (all time)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {platformEntries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No posts yet
            </p>
          )}
          {platformEntries.map(([platform, count]) => {
            const pct =
              stats.totalPostsForPlatform > 0
                ? Math.round((count / stats.totalPostsForPlatform) * 100)
                : 0
            return (
              <div key={platform} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">
                    {PLATFORM_ICONS[platform]}{' '}
                    {PLATFORM_LABELS[platform] || platform}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {count} posts ({pct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      platform === 'facebook' && 'bg-blue-500',
                      platform === 'instagram' && 'bg-pink-500',
                      platform === 'twitter' && 'bg-sky-500',
                      !['facebook', 'instagram', 'twitter'].includes(platform) &&
                        'bg-gray-500'
                    )}
                    style={{
                      width: `${Math.max((count / maxPlatformCount) * 100, 2)}%`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Game Analysis Tab
// ---------------------------------------------------------------------------
function GameAnalysisTab({
  games,
  blueprint,
  winners,
  weekDates,
}: {
  games: Game[]
  blueprint: BlueprintEntry[]
  winners: Winner[]
  weekDates: Date[]
}) {
  const weekStartStr = dateToStr(weekDates[0])
  const weekEndStr = dateToStr(weekDates[6])

  const gameAnalytics = useMemo(() => {
    const sortedGames = [...games].sort((a, b) => a.sortOrder - b.sortOrder)

    return sortedGames.map((game) => {
      const gameBlueprint = blueprint.filter((e) => e.gameId === game.id)
      const weekBlueprint = gameBlueprint.filter(
        (e) => e.scheduledDate >= weekStartStr && e.scheduledDate <= weekEndStr
      )
      const gameWinners = winners
        .filter((w) => w.gameId === game.id)
        .sort(
          (a, b) =>
            new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime()
        )

      const published = gameBlueprint.filter(
        (e) => e.status === 'published'
      ).length
      const successRate =
        gameBlueprint.length > 0
          ? Math.round((published / gameBlueprint.length) * 100)
          : 0

      // Jackpot trend (last 3)
      const lastThreeJackpots = gameWinners
        .slice(0, 3)
        .map((w) => w.jackpot ?? 0)
        .reverse()

      // Next draw day
      const scheduleDays = parseScheduleDays(game.scheduleDays)
      const today = new Date()
      let nextDrawDay: string | null = null
      for (let i = 0; i < 7; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() + i)
        const dayName = checkDate.toLocaleDateString('en-US', {
          weekday: 'long',
        })
        if (scheduleDays.includes(dayName)) {
          nextDrawDay = formatDate(dateToStr(checkDate))
          break
        }
      }

      return {
        game,
        totalPosts: gameBlueprint.length,
        weekPosts: weekBlueprint.length,
        published,
        successRate,
        lastThreeJackpots,
        nextDrawDay,
        scheduleDays,
      }
    })
  }, [games, blueprint, winners, weekStartStr, weekEndStr])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {gameAnalytics.map(({ game, totalPosts, weekPosts, published, successRate, lastThreeJackpots, nextDrawDay, scheduleDays }) => {
          // Jackpot trend direction
          let jackpotTrend: 'up' | 'down' | 'neutral' = 'neutral'
          if (lastThreeJackpots.length >= 2) {
            const latest = lastThreeJackpots[lastThreeJackpots.length - 1]
            const prev = lastThreeJackpots[lastThreeJackpots.length - 2]
            if (latest > prev) jackpotTrend = 'up'
            else if (latest < prev) jackpotTrend = 'down'
          }

          return (
            <Card key={game.id} className="overflow-hidden">
              {/* Color strip at top */}
              <div
                className="h-1"
                style={{ backgroundColor: game.color }}
              />
              <CardHeader className="pb-3 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="flex size-9 items-center justify-center rounded-lg text-lg"
                      style={{ backgroundColor: `${game.color}15` }}
                    >
                      {game.icon}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">
                        {game.name}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        {game.shortName}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold"
                    style={{
                      borderColor: game.color,
                      color: game.color,
                    }}
                  >
                    {scheduleDays.length} draw
                    {scheduleDays.length !== 1 ? 's' : ''}/week
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-4 pb-4">
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-lg font-bold">{totalPosts}</p>
                    <p className="text-[10px] text-muted-foreground">All Time</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{weekPosts}</p>
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                  </div>
                  <div className="text-center">
                    <p
                      className={cn(
                        'text-lg font-bold',
                        COMPLETION_COLOR(successRate)
                      )}
                    >
                      {successRate}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">Success</p>
                  </div>
                </div>

                <Separator />

                {/* Jackpot trend */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Jackpot Trend
                    </span>
                    {jackpotTrend !== 'neutral' && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[10px] font-semibold',
                          jackpotTrend === 'up' && 'text-emerald-600',
                          jackpotTrend === 'down' && 'text-red-600'
                        )}
                      >
                        {jackpotTrend === 'up' ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {jackpotTrend === 'up' ? 'Rising' : 'Dropping'}
                      </span>
                    )}
                  </div>
                  {lastThreeJackpots.length > 0 ? (
                    <div className="flex items-end gap-2 h-12">
                      {lastThreeJackpots.map((jp, idx) => {
                        const maxJp = Math.max(...lastThreeJackpots, 1)
                        const heightPct = Math.max((jp / maxJp) * 100, 8)
                        return (
                          <div key={idx} className="flex flex-col items-center gap-1 flex-1">
                            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                              {formatCurrency(jp)}
                            </span>
                            <div
                              className="w-full rounded-t-sm transition-all"
                              style={{
                                height: `${heightPct}%`,
                                backgroundColor: game.color,
                                opacity: 0.3 + (idx / lastThreeJackpots.length) * 0.7,
                              }}
                            />
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      No jackpot data yet
                    </p>
                  )}
                </div>

                <Separator />

                {/* Next draw */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      Next Draw
                    </span>
                  </div>
                  <span className="text-xs font-medium">
                    {nextDrawDay || 'N/A'}
                  </span>
                </div>

                {/* Schedule days as badges */}
                <div className="flex flex-wrap gap-1.5">
                  {FULL_DAY_NAMES.map((day) => {
                    const isScheduled = scheduleDays.includes(day)
                    return (
                      <Badge
                        key={day}
                        variant={isScheduled ? 'default' : 'outline'}
                        className={cn(
                          'text-[10px] px-1.5 py-0 h-5 font-medium',
                          !isScheduled && 'text-muted-foreground opacity-40'
                        )}
                        style={
                          isScheduled
                            ? {
                                backgroundColor: `${game.color}18`,
                                color: game.color,
                                borderColor: `${game.color}40`,
                              }
                            : undefined
                        }
                      >
                        {DAY_SHORTNAMES[day]}
                      </Badge>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {gameAnalytics.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
            <Gamepad2 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No games configured yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Compliance Tab
// ---------------------------------------------------------------------------
function ScheduleComplianceTab({
  games,
  blueprint,
  todayStr,
}: {
  games: Game[]
  blueprint: BlueprintEntry[]
  todayStr: string
}) {
  // Build compliance data: for each game & each day this week, check if posts exist
  const complianceData = useMemo(() => {
    const today = new Date(todayStr + 'T00:00:00')
    const weekStart = getWeekStartMonday(today)
    const weekDates: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      weekDates.push(dateToStr(d))
    }

    // Group blueprint by (gameId, scheduledDate)
    const entryMap = new Map<string, BlueprintEntry[]>()
    for (const entry of blueprint) {
      const key = `${entry.gameId}__${entry.scheduledDate}`
      const existing = entryMap.get(key) || []
      existing.push(entry)
      entryMap.set(key, existing)
    }

    interface ComplianceIssue {
      game: Game
      dateStr: string
      dayName: string
      entries: BlueprintEntry[]
      status: 'missing' | 'draft-only' | 'ok' | 'overdue'
    }

    const issues: ComplianceIssue[] = []
    const sortedGames = [...games].sort((a, b) => a.sortOrder - b.sortOrder)

    for (const game of sortedGames) {
      const scheduleDays = parseScheduleDays(game.scheduleDays)

      for (const dateStr of weekDates) {
        const date = new Date(dateStr + 'T00:00:00')
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
        const isPast = dateStr < todayStr
        const isToday = dateStr === todayStr

        // Only check days where this game has draws
        if (!scheduleDays.includes(dayOfWeek)) continue

        const key = `${game.id}__${dateStr}`
        const entries = entryMap.get(key) || []
        const hasPublished = entries.some((e) => e.status === 'published')
        const hasScheduled = entries.some((e) => e.status === 'scheduled')
        const hasDraft = entries.some((e) => e.status === 'draft')
        const hasFailed = entries.some((e) => e.status === 'failed')

        if (entries.length === 0) {
          issues.push({
            game,
            dateStr,
            dayName: dayOfWeek,
            entries: [],
            status: isPast ? 'overdue' : 'missing',
          })
        } else if (!hasPublished && !hasScheduled && hasDraft) {
          issues.push({
            game,
            dateStr,
            dayName: dayOfWeek,
            entries,
            status: isPast ? 'overdue' : 'draft-only',
          })
        } else if (hasFailed && !hasPublished) {
          issues.push({
            game,
            dateStr,
            dayName: dayOfWeek,
            entries,
            status: 'overdue',
          })
        } else {
          issues.push({
            game,
            dateStr,
            dayName: dayOfWeek,
            entries,
            status: 'ok',
          })
        }
      }
    }

    // Separate into categories
    const overdue = issues.filter((i) => i.status === 'overdue')
    const missing = issues.filter((i) => i.status === 'missing')
    const draftOnly = issues.filter((i) => i.status === 'draft-only')
    const ok = issues.filter((i) => i.status === 'ok')

    return { issues, overdue, missing, draftOnly, ok }
  }, [games, blueprint, todayStr])

  const totalSlots = complianceData.issues.length
  const compliantCount = complianceData.ok.length
  const compliancePct =
    totalSlots > 0 ? Math.round((compliantCount / totalSlots) * 100) : 100

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Compliance Rate"
          value={`${compliancePct}%`}
          icon={Target}
          description={`${compliantCount} of ${totalSlots} slots covered`}
          color={COMPLETION_COLOR(compliancePct)}
          trend={compliancePct >= 80 ? 'up' : compliancePct < 50 ? 'down' : 'neutral'}
        />
        <MetricCard
          label="Overdue"
          value={complianceData.overdue.length}
          icon={AlertCircle}
          description="Past draws without published posts"
          color={complianceData.overdue.length > 0 ? 'text-red-600' : 'text-emerald-600'}
        />
        <MetricCard
          label="Missing Posts"
          value={complianceData.missing.length}
          icon={AlertTriangle}
          description="Upcoming draws without any posts"
          color={complianceData.missing.length > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
        <MetricCard
          label="Drafts Only"
          value={complianceData.draftOnly.length}
          icon={FileWarning}
          description="Has drafts but nothing published/queued"
          color={complianceData.draftOnly.length > 0 ? 'text-amber-600' : 'text-emerald-600'}
        />
      </div>

      {/* Progress bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">
              Schedule Compliance
            </span>
            <span
              className={cn('text-sm font-bold', COMPLETION_COLOR(compliancePct))}
            >
              {compliancePct}%
            </span>
          </div>
          <Progress value={compliancePct} className="h-3" />
          <p className="text-[11px] text-muted-foreground mt-2">
            {compliantCount} compliant &middot;{' '}
            {complianceData.overdue.length} overdue &middot;{' '}
            {complianceData.missing.length} missing &middot;{' '}
            {complianceData.draftOnly.length} drafts only
          </p>
        </CardContent>
      </Card>

      {/* Overdue items */}
      {complianceData.overdue.length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertCircle className="size-4" />
              Overdue — Action Required
            </CardTitle>
            <CardDescription className="text-red-500/80 text-xs">
              These draws have passed but don&apos;t have published posts
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {complianceData.overdue.map((item, idx) => (
                  <div
                    key={`${item.game.id}-${item.dateStr}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-red-100 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.game.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">
                          {item.game.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.dayName}, {formatDate(item.dateStr)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.entries.length > 0 ? (
                        item.entries.map((e) => (
                          <Badge
                            key={e.id}
                            variant="outline"
                            className={cn('text-[10px] h-5', STATUS_COLORS[e.status])}
                          >
                            {STATUS_LABELS[e.status]}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-5 text-red-600 border-red-200 bg-red-50">
                          No Posts
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Missing posts */}
      {complianceData.missing.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <AlertTriangle className="size-4" />
              Missing Posts
            </CardTitle>
            <CardDescription className="text-amber-600/80 text-xs">
              Upcoming draws that don&apos;t have any posts created yet
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {complianceData.missing.map((item, idx) => (
                  <div
                    key={`missing-${item.game.id}-${item.dateStr}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-amber-100 bg-white p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.game.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">
                          {item.game.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.dayName}, {formatDate(item.dateStr)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200 bg-amber-50">
                      No Posts
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Drafts only */}
      {complianceData.draftOnly.length > 0 && (
        <Card className="border-amber-200">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-700">
              <FileWarning className="size-4" />
              Drafts Only — Need Publishing
            </CardTitle>
            <CardDescription className="text-xs">
              These have drafts created but haven&apos;t been published or queued
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {complianceData.draftOnly.map((item, idx) => (
                  <div
                    key={`draft-${item.game.id}-${item.dateStr}-${idx}`}
                    className="flex items-center justify-between rounded-lg border p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.game.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">
                          {item.game.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.dayName}, {formatDate(item.dateStr)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.entries.map((e) => (
                        <Badge
                          key={e.id}
                          variant="outline"
                          className={cn('text-[10px] h-5', STATUS_COLORS[e.status])}
                        >
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* All items list (compliant) */}
      {complianceData.ok.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle className="size-4" />
              Compliant Slots
            </CardTitle>
            <CardDescription className="text-xs">
              These slots are properly set up with published or scheduled posts
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="max-h-56">
              <div className="space-y-1.5">
                {complianceData.ok.map((item, idx) => (
                  <div
                    key={`ok-${item.game.id}-${item.dateStr}-${idx}`}
                    className="flex items-center justify-between rounded-lg bg-emerald-50/50 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{item.game.icon}</span>
                      <div>
                        <p className="text-xs font-semibold">
                          {item.game.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.dayName}, {formatDate(item.dateStr)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {item.entries.map((e) => (
                        <Badge
                          key={e.id}
                          variant="outline"
                          className={cn('text-[10px] h-5', STATUS_COLORS[e.status])}
                        >
                          {STATUS_LABELS[e.status]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* All clear */}
      {complianceData.overdue.length === 0 &&
        complianceData.missing.length === 0 &&
        complianceData.draftOnly.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle className="size-7 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-emerald-700">
                  All Clear!
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  All scheduled draws have posts properly set up.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main AnalysisView Component
// ---------------------------------------------------------------------------
export default function AnalysisView() {
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

  const [weekBaseDate, setWeekBaseDate] = useState<Date>(new Date())
  const [activeTab, setActiveTab] = useState<string>('schedule')

  // Derived dates
  const weekDates = useMemo(
    () => getWeekDatesFromBase(weekBaseDate),
    [weekBaseDate]
  )
  const todayStr = useMemo(() => getTodayStr(), [])
  const monthDates = useMemo(() => getMonthDates(weekBaseDate), [weekBaseDate])

  // Week range label
  const weekRangeLabel = useMemo(() => {
    const start = weekDates[0]
    const end = weekDates[6]
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${fmt(start)} — ${fmt(end)}, ${end.getFullYear()}`
  }, [weekDates])

  // Fetch data on mount if empty
  useEffect(() => {
    if (games.length === 0 || blueprint.length === 0 || winners.length === 0) {
      async function fetchData() {
        setIsLoading(true)
        try {
          const [gamesRes, blueprintRes, winnersRes] = await Promise.all([
            fetch('/api/games'),
            fetch('/api/blueprint'),
            fetch('/api/winners'),
          ])
          if (gamesRes.ok) setGames(await gamesRes.json())
          if (blueprintRes.ok) setBlueprint(await blueprintRes.json())
          if (winnersRes.ok) setWinners(await winnersRes.json())
        } catch (err) {
          console.error('Failed to fetch analysis data:', err)
        } finally {
          setIsLoading(false)
        }
      }
      fetchData()
    }
  }, [games.length, blueprint.length, winners.length, setGames, setBlueprint, setWinners, setIsLoading])

  // =========================================================================
  // RENDER
  // =========================================================================
  if (isLoading && games.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading analysis...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ================================================================= */}
      {/* Top Header Bar                                                    */}
      {/* ================================================================= */}
      <header className="shrink-0 border-b bg-card">
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Title + subtitle */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Analysis</h1>
              <p className="text-xs text-muted-foreground">
                Analytics &amp; schedule compliance insights
              </p>
            </div>
          </div>

          {/* Right: Week selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setWeekBaseDate((prev) => {
                  const d = new Date(prev)
                  d.setDate(d.getDate() - 7)
                  return d
                })
              }}
            >
              <ArrowUpRight className="size-4 rotate-180" />
            </Button>

            <button
              onClick={() => setWeekBaseDate(new Date())}
              className="rounded-md px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              {weekRangeLabel}
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => {
                setWeekBaseDate((prev) => {
                  const d = new Date(prev)
                  d.setDate(d.getDate() + 7)
                  return d
                })
              }}
            >
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Tabs                                                              */}
      {/* ================================================================= */}
      <div className="shrink-0 border-b bg-card px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-10 w-full justify-start bg-transparent p-0 gap-0">
            <TabsTrigger
              value="schedule"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-xs font-medium"
            >
              <BarChart3 className="mr-1.5 size-3.5" />
              Schedule Overview
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-xs font-medium"
            >
              <PieChart className="mr-1.5 size-3.5" />
              Posting Stats
            </TabsTrigger>
            <TabsTrigger
              value="games"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-xs font-medium"
            >
              <Gamepad2 className="mr-1.5 size-3.5" />
              Game Analysis
            </TabsTrigger>
            <TabsTrigger
              value="compliance"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 text-xs font-medium"
            >
              <Target className="mr-1.5 size-3.5" />
              Compliance
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ================================================================= */}
      {/* Main Content Area                                                 */}
      {/* ================================================================= */}
      <ScrollArea className="flex-1">
        <div className="p-4 max-w-6xl mx-auto">
          {activeTab === 'schedule' && (
            <ScheduleOverviewTab
              games={games}
              blueprint={blueprint}
              weekDates={weekDates}
              todayStr={todayStr}
            />
          )}
          {activeTab === 'stats' && (
            <PostingStatsTab
              blueprint={blueprint}
              weekDates={weekDates}
              todayStr={todayStr}
              monthDates={monthDates}
            />
          )}
          {activeTab === 'games' && (
            <GameAnalysisTab
              games={games}
              blueprint={blueprint}
              winners={winners}
              weekDates={weekDates}
            />
          )}
          {activeTab === 'compliance' && (
            <ScheduleComplianceTab
              games={games}
              blueprint={blueprint}
              todayStr={todayStr}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
