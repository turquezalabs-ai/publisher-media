'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Trophy,
  Calendar,
  Hash,
  DollarSign,
  Users,
  Plus,
  Filter,
  Search,
  ChevronDown,
  Star,
  Crown,
  Medal,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import { cn, formatCurrency, formatDate, parseNumbers } from '@/lib/utils'
import type { Winner, Game } from '@/lib/types'

// ---------------------------------------------------------------------------
// Lottery Ball Component
// ---------------------------------------------------------------------------
function LotteryBall({
  number,
  color,
  index,
}: {
  number: number
  color?: string
  index?: number
}) {
  const bgColor = color || '#e94560'
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white shadow-md transition-transform hover:scale-110 sm:size-12 sm:text-base"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${bgColor}dd, ${bgColor})`,
          boxShadow: `0 2px 8px ${bgColor}40, inset 0 -2px 4px rgba(0,0,0,0.15), inset 0 2px 4px rgba(255,255,255,0.2)`,
        }}
      >
        {String(number).padStart(2, '0')}
      </div>
      {typeof index === 'number' && index === 0 && (
        <Star className="size-3 text-yellow-500 fill-yellow-500" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Winner Card Component
// ---------------------------------------------------------------------------
function WinnerCard({
  winner,
  onShare,
}: {
  winner: Winner
  onShare: (winner: Winner) => void
}) {
  const game = winner.game
  const numbers = parseNumbers(winner.numbers)
  const accentColor = game?.color || '#e94560'

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      {/* Color strip */}
      <div className="h-1.5" style={{ backgroundColor: accentColor }} />

      <CardHeader className="pb-3 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex size-10 items-center justify-center rounded-lg text-xl shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              {game?.icon || '🎰'}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-bold truncate">
                {game?.name || 'Unknown Game'}
              </CardTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Calendar className="size-3 text-muted-foreground" />
                <CardDescription className="text-[11px]">
                  {formatDate(winner.drawDate)}
                </CardDescription>
              </div>
            </div>
          </div>

          {/* Winner count badge */}
          <Badge
            variant="outline"
            className="shrink-0 gap-1 text-[10px] font-medium px-2"
            style={{
              borderColor: `${accentColor}40`,
              color: accentColor,
              backgroundColor: `${accentColor}08`,
            }}
          >
            <Users className="size-3" />
            {winner.winners} {winner.winners === 1 ? 'winner' : 'winners'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 pb-4">
        {/* Winning numbers */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">
            Winning Numbers
          </p>
          <div className="flex flex-wrap gap-2">
            {numbers.length > 0 ? (
              numbers.map((num, idx) => (
                <LotteryBall key={idx} number={num} color={accentColor} index={idx} />
              ))
            ) : (
              <span className="text-xs text-muted-foreground italic">No numbers recorded</span>
            )}
          </div>
        </div>

        <Separator />

        {/* Jackpot */}
        {winner.jackpot != null && winner.jackpot > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-yellow-100">
                <DollarSign className="size-3.5 text-yellow-600" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Jackpot</span>
            </div>
            <span className="text-lg font-bold" style={{ color: accentColor }}>
              {formatCurrency(winner.jackpot)}
            </span>
          </div>
        )}

        {/* Share button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          onClick={() => onShare(winner)}
          style={{
            borderColor: `${accentColor}30`,
            color: accentColor,
          }}
        >
          <Trophy className="size-3.5" />
          Share Result
        </Button>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Stats Card (mini)
// ---------------------------------------------------------------------------
function StatsMiniCard({
  icon: Icon,
  label,
  value,
  sublabel,
  color = 'text-foreground',
  bg = 'bg-muted',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sublabel?: string
  color?: string
  bg?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-lg px-4 py-3', bg)}>
      <div className={cn('flex size-9 items-center justify-center rounded-lg', bg)}>
        <Icon className={cn('size-4', color)} />
      </div>
      <div className="min-w-0">
        <p className={cn('text-lg font-bold leading-tight', color)}>{value}</p>
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        {sublabel && (
          <p className="text-[9px] text-muted-foreground truncate">{sublabel}</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main WinnersView Component
// ---------------------------------------------------------------------------
export default function WinnersView() {
  const {
    games,
    setGames,
    winners,
    setWinners,
    isLoading,
    setIsLoading,
  } = useAppStore()

  // ---- Local state ----
  const [filterGameId, setFilterGameId] = useState<string>('all')
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [addForm, setAddForm] = useState({
    gameId: '',
    drawDate: new Date().toISOString().split('T')[0],
    num1: '',
    num2: '',
    num3: '',
    num4: '',
    num5: '',
    num6: '',
    jackpot: '',
    winners: '1',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ---- Game lookup map ----
  const gameMap = useMemo(() => {
    const map = new Map<string, Game>()
    for (const g of games) map.set(g.id, g)
    return map
  }, [games])

  // ---- Filtered winners ----
  const filteredWinners = useMemo(() => {
    if (filterGameId === 'all') return winners
    return winners.filter((w) => w.gameId === filterGameId)
  }, [winners, filterGameId])

  // ---- Stats summary ----
  const statsSummary = useMemo(() => {
    // Latest draw per game
    const latestByGame = new Map<string, Winner>()
    for (const w of winners) {
      if (!latestByGame.has(w.gameId)) {
        latestByGame.set(w.gameId, w)
      }
    }

    // Total jackpot awarded
    const totalJackpot = winners.reduce((sum, w) => sum + (w.jackpot || 0), 0)

    // Biggest jackpot
    const biggestJackpot = winners.reduce(
      (max, w) => (w.jackpot && w.jackpot > max ? w.jackpot : max),
      0
    )
    const biggestWinner = winners.find((w) => w.jackpot === biggestJackpot)

    // Total winners
    const totalWinners = winners.reduce((sum, w) => sum + w.winners, 0)

    return {
      latestByGame,
      totalJackpot,
      biggestJackpot,
      biggestWinner,
      totalWinners,
      latestDrawCount: latestByGame.size,
    }
  }, [winners])

  // ---- Fetch data on mount ----
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const [gamesRes, winnersRes] = await Promise.all([
          fetch('/api/games'),
          fetch('/api/winners?limit=50'),
        ])
        if (gamesRes.ok) setGames(await gamesRes.json())
        if (winnersRes.ok) setWinners(await winnersRes.json())
      } catch (err) {
        console.error('Failed to fetch winners data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [setGames, setWinners, setIsLoading])

  // ---- Refresh handler ----
  const refreshData = useCallback(async () => {
    setIsLoading(true)
    try {
      const winnersRes = await fetch('/api/winners?limit=50')
      if (winnersRes.ok) setWinners(await winnersRes.json())
    } catch (err) {
      console.error('Failed to refresh:', err)
    } finally {
      setIsLoading(false)
    }
  }, [setWinners, setIsLoading])

  // ---- Add result handler ----
  const handleAddResult = useCallback(async () => {
    const { gameId, drawDate, num1, num2, num3, num4, num5, num6, jackpot, winners: winnerCount } = addForm
    if (!gameId || !num1 || !num2 || !num3 || !num4 || !num5 || !num6) return

    const numbers = [
      parseInt(num1),
      parseInt(num2),
      parseInt(num3),
      parseInt(num4),
      parseInt(num5),
      parseInt(num6),
    ].filter((n) => !isNaN(n))

    if (numbers.length !== 6) return

    setIsSubmitting(true)
    try {
      await fetch('/api/winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          drawDate,
          numbers,
          jackpot: parseFloat(jackpot) || 0,
          winners: parseInt(winnerCount) || 1,
        }),
      })
      await refreshData()
      setIsAddDialogOpen(false)
      // Reset form
      setAddForm({
        gameId: '',
        drawDate: new Date().toISOString().split('T')[0],
        num1: '',
        num2: '',
        num3: '',
        num4: '',
        num5: '',
        num6: '',
        jackpot: '',
        winners: '1',
      })
    } catch (err) {
      console.error('Failed to add result:', err)
    } finally {
      setIsSubmitting(false)
    }
  }, [addForm, refreshData])

  // ---- Share result handler ----
  const handleShareResult = useCallback((winner: Winner) => {
    const game = winner.game
    const numbers = parseNumbers(winner.numbers)
    const caption = `${game?.icon || ''} ${game?.name || 'Game'} Draw Results\n\n📅 ${formatDate(winner.drawDate)}\n\n🎰 Winning Numbers: ${numbers.map((n) => String(n).padStart(2, '0')).join(' - ')}\n${winner.jackpot ? `💰 Jackpot: ${formatCurrency(winner.jackpot)}\n` : ''}${winner.winners > 0 ? `🏆 ${winner.winners} ${winner.winners === 1 ? 'Winner' : 'Winners'}\n` : ''}\n#PCSO #LottoResults`

    if (navigator.clipboard) {
      navigator.clipboard.writeText(caption).then(() => {
        alert('Result copied to clipboard! You can now paste it on your social media.')
      }).catch(() => {
        // Fallback
        console.log('Share caption:', caption)
      })
    }
  }, [])

  // ---- Validate form ----
  const isFormValid = useMemo(() => {
    return (
      addForm.gameId &&
      addForm.num1 && addForm.num2 && addForm.num3 &&
      addForm.num4 && addForm.num5 && addForm.num6
    )
  }, [addForm])

  // ---- Number input handler ----
  const handleNumberInput = useCallback(
    (field: string, value: string) => {
      const clamped = value.replace(/\D/g, '').slice(0, 2)
      setAddForm((prev) => ({ ...prev, [field]: clamped }))
    },
    []
  )

  // =========================================================================
  // RENDER
  // =========================================================================
  if (isLoading && winners.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading winners...</p>
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
            <div className="flex size-9 items-center justify-center rounded-lg bg-yellow-500/10">
              <Trophy className="size-5 text-yellow-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Winners</h1>
              <p className="text-xs text-muted-foreground">
                {winners.length} draw results &middot; {statsSummary.totalWinners} total winners
              </p>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add Result
            </Button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* Stats Summary                                                      */}
      {/* ================================================================= */}
      <div className="shrink-0 border-b bg-card px-4 py-2.5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatsMiniCard
            icon={Crown}
            label="Latest Draws"
            value={statsSummary.latestDrawCount}
            sublabel={`${games.length} games tracked`}
            color="text-yellow-600"
            bg="bg-yellow-50"
          />
          <StatsMiniCard
            icon={DollarSign}
            label="Total Jackpots Awarded"
            value={formatCurrency(statsSummary.totalJackpot)}
            color="text-emerald-600"
            bg="bg-emerald-50"
          />
          <StatsMiniCard
            icon={Star}
            label="Biggest Jackpot"
            value={statsSummary.biggestJackpot > 0 ? formatCurrency(statsSummary.biggestJackpot) : 'N/A'}
            sublabel={
              statsSummary.biggestWinner
                ? statsSummary.biggestWinner.game?.name
                : undefined
            }
            color="text-amber-600"
            bg="bg-amber-50"
          />
          <StatsMiniCard
            icon={Users}
            label="Total Winners"
            value={statsSummary.totalWinners}
            sublabel="Across all draws"
            color="text-blue-600"
            bg="bg-blue-50"
          />
        </div>
      </div>

      {/* ================================================================= */}
      {/* Filter Bar                                                         */}
      {/* ================================================================= */}
      <div className="shrink-0 border-b bg-card px-4 py-2">
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />
          <Select value={filterGameId} onValueChange={setFilterGameId}>
            <SelectTrigger className="h-8 w-full max-w-[200px] text-xs">
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

          <Badge variant="secondary" className="text-[10px] font-medium shrink-0">
            {filteredWinners.length} result{filteredWinners.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Winners Grid                                                       */}
      {/* ================================================================= */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {filteredWinners.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <Medal className="size-6 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground">No draw results yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add a draw result or wait for new lottery draws to be recorded.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredWinners.map((winner) => (
                <WinnerCard key={winner.id} winner={winner} onShare={handleShareResult} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* ================================================================= */}
      {/* Add Result Dialog                                                  */}
      {/* ================================================================= */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="size-4" />
              Add Draw Result
            </DialogTitle>
            <DialogDescription>
              Enter the winning numbers and draw details for a new lottery result.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Game selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Game</Label>
              <Select
                value={addForm.gameId}
                onValueChange={(v) => setAddForm((prev) => ({ ...prev, gameId: v }))}
              >
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

            {/* Draw date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Draw Date</Label>
              <Input
                type="date"
                value={addForm.drawDate}
                onChange={(e) => setAddForm((prev) => ({ ...prev, drawDate: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Winning numbers */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Winning Numbers</Label>
              <div className="grid grid-cols-6 gap-2">
                {(['num1', 'num2', 'num3', 'num4', 'num5', 'num6'] as const).map((field, idx) => (
                  <div key={field} className="space-y-1">
                    <p className="text-[10px] text-center text-muted-foreground">#{idx + 1}</p>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="--"
                      value={addForm[field]}
                      onChange={(e) => handleNumberInput(field, e.target.value)}
                      className="h-10 text-center text-sm font-bold"
                      maxLength={2}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Jackpot */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Jackpot Amount (PHP)</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 50000000"
                value={addForm.jackpot}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    jackpot: e.target.value.replace(/\D/g, ''),
                  }))
                }
                className="h-9 text-sm"
              />
            </div>

            {/* Number of winners */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Number of Winners</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={addForm.winners}
                onChange={(e) =>
                  setAddForm((prev) => ({
                    ...prev,
                    winners: e.target.value.replace(/\D/g, ''),
                  }))
                }
                className="h-9 text-sm w-24"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!isFormValid || isSubmitting}
              onClick={handleAddResult}
            >
              {isSubmitting ? (
                <>
                  <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Trophy className="mr-1.5 size-4" />
                  Add Result
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
