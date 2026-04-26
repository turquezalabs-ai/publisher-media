'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Image as ImageIcon,
  Palette,
  Type,
  Hash,
  Save,
  Check,
  X,
  ChevronRight,
  Sparkles,
  CalendarDays,
  Layers,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { cn, formatCurrency, parseScheduleDays, getDayName } from '@/lib/utils'
import type { BannerTemplate, ActiveView } from '@/lib/types'

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

const CAPTION_MAX_LENGTH = 2200
const HASHTAG_MAX_LENGTH = 500

// -------------------------------------------------------------------
// Banner Preview - Canvas-like visual banner with gradient & text
// -------------------------------------------------------------------
function BannerPreview({
  banner,
  game,
}: {
  banner: Partial<BannerTemplate>
  game: { name: string; icon: string; color: string; jackpot: number } | null
}) {
  const bgColor = banner.bgColor || '#1a1a2e'
  const accentColor = banner.accentColor || '#e94560'
  const caption = banner.caption || ''
  const hashtags = banner.hashtags || ''
  const templateName = banner.templateName || ''
  const dayOfWeek = banner.dayOfWeek || getDayName(new Date())

  // Create a subtle gradient from bgColor
  const gradientBg = `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}dd 50%, ${bgColor}aa 100%)`

  // Glow effect behind the icon
  const iconGlow = `${game?.color || accentColor}40`

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: '380px' }}>
      {/* Aspect ratio 1:1 container */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl shadow-2xl"
        style={{ background: gradientBg }}
      >
        {/* Decorative grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Radial glow behind icon */}
        <div
          className="absolute top-[12%] left-1/2 size-32 -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: iconGlow }}
        />

        {/* Bottom accent bar */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5"
          style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col items-center justify-between p-5 text-white">
          {/* Top section - Template name */}
          <div className="w-full">
            {templateName && (
              <div className="mb-2 inline-block rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-widest backdrop-blur-sm">
                {templateName}
              </div>
            )}

            {/* Day badge */}
            <div
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold"
              style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
            >
              <CalendarDays className="size-3" />
              {dayOfWeek}
            </div>
          </div>

          {/* Middle section - Game icon & name */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div
              className="flex size-20 items-center justify-center rounded-2xl text-5xl shadow-lg"
              style={{
                backgroundColor: `${game?.color || accentColor}20`,
                boxShadow: `0 8px 32px ${game?.color || accentColor}25`,
              }}
            >
              {game?.icon || '\u{1F3B0}'}
            </div>
            <h3
              className="text-xl font-extrabold tracking-tight leading-tight"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
            >
              {game?.name || 'Select a Game'}
            </h3>

            {/* Jackpot */}
            {game && (
              <div
                className="mt-1 rounded-lg px-4 py-2 text-center"
                style={{ backgroundColor: `${accentColor}18` }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest opacity-70">
                  Estimated Jackpot
                </div>
                <div
                  className="text-2xl font-extrabold leading-tight"
                  style={{ color: accentColor }}
                >
                  {formatCurrency(game.jackpot)}
                </div>
              </div>
            )}
          </div>

          {/* Bottom section - Caption & hashtags */}
          <div className="w-full space-y-2">
            {caption && (
              <div className="rounded-lg bg-black/25 p-3 backdrop-blur-sm">
                <p className="line-clamp-3 text-xs leading-relaxed opacity-90">
                  {caption}
                </p>
              </div>
            )}
            {hashtags && (
              <div className="flex flex-wrap gap-1">
                {hashtags
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 4)
                  .map((tag, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm"
                    >
                      {tag}
                    </span>
                  ))}
                {hashtags.split(/\s+/).filter(Boolean).length > 4 && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] backdrop-blur-sm">
                    +{hashtags.split(/\s+/).filter(Boolean).length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Corner accent shapes */}
        <div
          className="absolute top-0 right-0 size-24"
          style={{
            background: `linear-gradient(225deg, ${accentColor}15, transparent)`,
            borderRadius: '0 0 0 100%',
          }}
        />
      </div>

      {/* Size label below */}
      <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
        <Layers className="size-3" />
        1080 x 1080 px
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Mini banner card for the grid
// -------------------------------------------------------------------
function BannerGridCard({
  banner,
  game,
  isSelected,
  onSelect,
}: {
  banner: BannerTemplate
  game: { name: string; icon: string; color: string; jackpot: number } | undefined
  isSelected: boolean
  onSelect: () => void
}) {
  const bgColor = banner.bgColor || '#1a1a2e'
  const accentColor = banner.accentColor || '#e94560'
  const gradientBg = `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}cc 100%)`

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative aspect-square w-full overflow-hidden rounded-lg border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary ring-2 ring-primary/30 shadow-lg'
          : 'border-transparent hover:border-muted-foreground/20'
      )}
    >
      <div className="absolute inset-0" style={{ background: gradientBg }}>
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative flex h-full flex-col items-center justify-between p-2.5 text-white">
          {/* Day */}
          <div className="text-[8px] font-semibold uppercase tracking-wider opacity-60">
            {banner.dayOfWeek.slice(0, 3)}
          </div>

          {/* Icon + Name */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl">{game?.icon || '\u{1F3B0}'}</span>
            <span className="text-[9px] font-bold leading-tight text-center line-clamp-2">
              {game?.name || 'Unknown'}
            </span>
          </div>

          {/* Jackpot mini */}
          {game && (
            <span
              className="text-[8px] font-bold"
              style={{ color: accentColor }}
            >
              {formatCurrency(game.jackpot)}
            </span>
          )}
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-2.5" />
          </div>
        )}
      </div>
    </button>
  )
}

// -------------------------------------------------------------------
// Color picker field (input with color swatch)
// -------------------------------------------------------------------
function ColorPickerField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <div
          className="size-8 shrink-0 rounded-md border border-border/50 shadow-sm transition-colors"
          style={{ backgroundColor: value || '#1a1a2e' }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1a1a2e"
          className="h-8 flex-1 font-mono text-xs"
        />
      </div>
    </div>
  )
}

// -------------------------------------------------------------------
// Main BannerStudio component
// -------------------------------------------------------------------
export default function BannerStudio() {
  const {
    isBannerStudioOpen,
    setIsBannerStudioOpen,
    games,
    banners,
    selectedBanner,
    setSelectedBanner,
    selectedGameId,
    setSelectedGameId,
    selectedDate,
    activeView,
    setActiveView,
  } = useAppStore()

  // Local editor state
  const [editorTemplate, setEditorTemplate] = useState<Partial<BannerTemplate>>({
    templateName: '',
    caption: '',
    hashtags: '',
    bgColor: '#1a1a2e',
    accentColor: '#e94560',
    dayOfWeek: '',
    gameId: '',
  })
  const [selectedDay, setSelectedDay] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [showGrid, setShowGrid] = useState(true)

  // Get the currently selected game object
  const selectedGame = useMemo(
    () => games.find((g) => g.id === (editorTemplate.gameId || selectedGameId)),
    [games, editorTemplate.gameId, selectedGameId]
  )

  // Get current day from selectedDate
  const currentDayOfWeek = useMemo(() => {
    try {
      const date = new Date(selectedDate + 'T00:00:00')
      return getDayName(date)
    } catch {
      return getDayName(new Date())
    }
  }, [selectedDate])

  // Available days for the selected game
  const availableDays = useMemo(() => {
    if (!selectedGame) return DAYS_OF_WEEK as unknown as string[]
    return parseScheduleDays(selectedGame.scheduleDays)
  }, [selectedGame])

  // Filtered banners for the grid
  const filteredBanners = useMemo(() => {
    let result = banners.filter((b) => b.isActive)
    if (editorTemplate.gameId) {
      result = result.filter((b) => b.gameId === editorTemplate.gameId)
    }
    if (selectedDay) {
      result = result.filter((b) => b.dayOfWeek === selectedDay)
    }
    return result
  }, [banners, editorTemplate.gameId, selectedDay])

  // Sync editor state when a banner is selected from the grid
  const handleSelectBanner = useCallback(
    (banner: BannerTemplate) => {
      setSelectedBanner(banner)
      setEditorTemplate({
        id: banner.id,
        templateName: banner.templateName,
        caption: banner.caption,
        hashtags: banner.hashtags,
        bgColor: banner.bgColor,
        accentColor: banner.accentColor,
        dayOfWeek: banner.dayOfWeek,
        gameId: banner.gameId,
      })
      setSelectedDay(banner.dayOfWeek)
      setShowGrid(false) // Switch to editor view after selecting
    },
    [setSelectedBanner]
  )

  // Reset editor state when game changes
  const handleGameChange = useCallback(
    (gameId: string) => {
      setSelectedGameId(gameId)
      setSelectedBanner(null)
      setEditorTemplate((prev) => ({
        ...prev,
        gameId,
        templateName: '',
        caption: '',
        hashtags: '',
        bgColor: '#1a1a2e',
        accentColor: '#e94560',
        dayOfWeek: '',
      }))
      setSelectedDay('')
      setShowGrid(true)
    },
    [setSelectedGameId, setSelectedBanner]
  )

  // Reset editor state when day changes
  const handleDayChange = useCallback((day: string) => {
    setSelectedDay(day)
    setEditorTemplate((prev) => ({
      ...prev,
      dayOfWeek: day,
    }))
  }, [])

  // Initialize when studio opens
  useEffect(() => {
    if (isBannerStudioOpen) {
      if (selectedGameId) {
        setEditorTemplate((prev) => ({
          ...prev,
          gameId: selectedGameId,
        }))
      }
      if (selectedBanner) {
        setEditorTemplate({
          id: selectedBanner.id,
          templateName: selectedBanner.templateName,
          caption: selectedBanner.caption,
          hashtags: selectedBanner.hashtags,
          bgColor: selectedBanner.bgColor,
          accentColor: selectedBanner.accentColor,
          dayOfWeek: selectedBanner.dayOfWeek,
          gameId: selectedBanner.gameId,
        })
        setSelectedDay(selectedBanner.dayOfWeek)
        setShowGrid(false)
      } else {
        setSelectedDay(currentDayOfWeek)
        setEditorTemplate((prev) => ({
          ...prev,
          dayOfWeek: currentDayOfWeek,
        }))
        setShowGrid(true)
      }
    }
  }, [isBannerStudioOpen, selectedGameId, selectedBanner, currentDayOfWeek])

  // Update local editor fields
  const updateField = useCallback(
    <K extends keyof Partial<BannerTemplate>>(key: K, value: Partial<BannerTemplate>[K]) => {
      setEditorTemplate((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  // Save template handler
  const handleSaveTemplate = useCallback(async () => {
    setIsSaving(true)
    try {
      const payload = {
        templateName: editorTemplate.templateName || 'Untitled Template',
        caption: editorTemplate.caption || '',
        hashtags: editorTemplate.hashtags || '',
        bgColor: editorTemplate.bgColor || '#1a1a2e',
        accentColor: editorTemplate.accentColor || '#e94560',
        dayOfWeek: editorTemplate.dayOfWeek || currentDayOfWeek,
        gameId: editorTemplate.gameId || selectedGameId || '',
      }

      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const saved = await res.json()
        // Refresh banners from the server
        const bannersRes = await fetch('/api/banners')
        if (bannersRes.ok) {
          const allBanners = await bannersRes.json()
          useAppStore.getState().setBanners(allBanners)
        }
        setSelectedBanner(saved)
        setEditorTemplate((prev) => ({ ...prev, id: saved.id }))
      }
    } catch {
      // Silently handle save errors for now
    } finally {
      setIsSaving(false)
    }
  }, [editorTemplate, currentDayOfWeek, selectedGameId, setSelectedBanner])

  // Use Banner handler - close studio and return to previous view
  const handleUseBanner = useCallback(() => {
    setIsBannerStudioOpen(false)
    // Return to the previous active view (blueprint is the default)
    if (activeView === 'banner-studio') {
      setActiveView('blueprint')
    }
  }, [setIsBannerStudioOpen, activeView, setActiveView])

  // Close handler
  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        setIsBannerStudioOpen(false)
      }
    },
    [setIsBannerStudioOpen]
  )

  // Caption line count
  const captionLines = (editorTemplate.caption || '').split('\n').length

  // Whether we have a game selected to show the editor
  const hasGame = !!(editorTemplate.gameId || selectedGameId)

  return (
    <Sheet open={isBannerStudioOpen} onOpenChange={handleClose}>
      <SheetContent
        side="right"
        className="w-full overflow-hidden sm:max-w-xl md:max-w-2xl p-0"
      >
        {/* Header */}
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-center justify-between pr-8">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="size-5 text-primary" />
              </div>
              <div>
                <SheetTitle className="text-lg">Banner Studio</SheetTitle>
                <SheetDescription className="text-xs">
                  Design and preview social media banners
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 border-b px-5 py-3">
          <div className="flex-1 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Game</Label>
            <Select
              value={editorTemplate.gameId || selectedGameId || ''}
              onValueChange={handleGameChange}
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Select a game..." />
              </SelectTrigger>
              <SelectContent>
                {games.map((game) => (
                  <SelectItem key={game.id} value={game.id} className="text-xs">
                    <span className="mr-1.5">{game.icon}</span>
                    {game.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-36 space-y-1">
            <Label className="text-[11px] text-muted-foreground">Day</Label>
            <Select value={selectedDay} onValueChange={handleDayChange}>
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="Select day..." />
              </SelectTrigger>
              <SelectContent>
                {availableDays.map((day) => (
                  <SelectItem key={day} value={day} className="text-xs">
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toggle grid button */}
          {hasGame && (
            <Button
              variant={showGrid ? 'default' : 'outline'}
              size="sm"
              className="mt-4 h-8 text-xs"
              onClick={() => setShowGrid(!showGrid)}
            >
              <Layers className="size-3.5" />
              <span className="hidden sm:inline">
                {showGrid ? 'Hide Grid' : 'Show Grid'}
              </span>
            </Button>
          )}
        </div>

        {/* Scrollable content area */}
        <ScrollArea className="flex-1">
          <div className="p-5">
            {!hasGame ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
                  <ImageIcon className="size-8 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">Select a Game</h3>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Choose a lottery game from the filter above to start creating or browsing banner templates.
                </p>
              </div>
            ) : showGrid && filteredBanners.length > 0 ? (
              /* Banner Grid View */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Templates</h3>
                  <span className="text-xs text-muted-foreground">
                    {filteredBanners.length} template{filteredBanners.length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-4">
                  {filteredBanners.map((banner) => {
                    const bGame = games.find((g) => g.id === banner.gameId)
                    return (
                      <BannerGridCard
                        key={banner.id}
                        banner={banner}
                        game={bGame}
                        isSelected={selectedBanner?.id === banner.id}
                        onSelect={() => handleSelectBanner(banner)}
                      />
                    )
                  })}
                </div>

                {/* Create new from grid */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSelectedBanner(null)
                    setEditorTemplate((prev) => ({
                      ...prev,
                      templateName: '',
                      caption: '',
                      hashtags: '',
                      bgColor: selectedGame?.color || '#1a1a2e',
                      accentColor: '#e94560',
                    }))
                    setShowGrid(false)
                  }}
                >
                  <Sparkles className="size-4" />
                  Create New Template
                </Button>
              </div>
            ) : showGrid && filteredBanners.length === 0 ? (
              /* No templates found */
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-muted">
                  <ImageIcon className="size-7 text-muted-foreground" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">No Templates Found</h3>
                <p className="mb-4 max-w-xs text-xs text-muted-foreground">
                  No banner templates exist for this game and day combination. Create one below.
                </p>
                <Button
                  onClick={() => {
                    setEditorTemplate((prev) => ({
                      ...prev,
                      templateName: '',
                      caption: '',
                      hashtags: '',
                      bgColor: selectedGame?.color || '#1a1a2e',
                      accentColor: '#e94560',
                    }))
                    setShowGrid(false)
                  }}
                >
                  <Sparkles className="size-4" />
                  Create Template
                </Button>
              </div>
            ) : (
              /* Editor View - Two column layout */
              <div className="space-y-5">
                {/* Back to grid link */}
                <button
                  onClick={() => setShowGrid(true)}
                  className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="size-3 rotate-180 transition-transform group-hover:-translate-x-0.5" />
                  Back to Templates
                </button>

                {/* Two columns: Preview | Editor */}
                <div className="grid gap-5 lg:grid-cols-2">
                  {/* Left: Banner Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Preview</h3>
                    </div>
                    <BannerPreview
                      banner={editorTemplate}
                      game={
                        selectedGame
                          ? {
                              name: selectedGame.name,
                              icon: selectedGame.icon,
                              color: selectedGame.color,
                              jackpot: selectedGame.jackpot,
                            }
                          : null
                      }
                    />
                  </div>

                  {/* Right: Editor Controls */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Type className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Editor</h3>
                    </div>

                    {/* Game & Day badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {selectedGame && (
                        <Badge variant="secondary" className="gap-1.5 text-xs">
                          <span>{selectedGame.icon}</span>
                          {selectedGame.name}
                        </Badge>
                      )}
                      <Badge variant="outline" className="gap-1.5 text-xs">
                        <CalendarDays className="size-3" />
                        {editorTemplate.dayOfWeek || 'No day'}
                      </Badge>
                    </div>

                    <Separator />

                    {/* Template Name */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Template Name</Label>
                      <Input
                        value={editorTemplate.templateName || ''}
                        onChange={(e) => updateField('templateName', e.target.value)}
                        placeholder="e.g. Ultra 6/58 Pre-Draw Hype"
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* Caption */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Caption</Label>
                        <span className="text-[11px] text-muted-foreground">
                          {(editorTemplate.caption || '').length}/{CAPTION_MAX_LENGTH}{' '}
                          chars &middot; {captionLines} lines
                        </span>
                      </div>
                      <Textarea
                        value={editorTemplate.caption || ''}
                        onChange={(e) =>
                          updateField(
                            'caption',
                            e.target.value.slice(0, CAPTION_MAX_LENGTH)
                          )
                        }
                        placeholder="Write your banner caption here... Use line breaks for better readability."
                        className="min-h-[100px] resize-none text-xs leading-relaxed"
                        rows={5}
                      />
                    </div>

                    {/* Hashtags */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-xs">
                          <Hash className="size-3" />
                          Hashtags
                        </Label>
                        <span className="text-[11px] text-muted-foreground">
                          {(editorTemplate.hashtags || '').length}/{HASHTAG_MAX_LENGTH}
                        </span>
                      </div>
                      <Textarea
                        value={editorTemplate.hashtags || ''}
                        onChange={(e) =>
                          updateField(
                            'hashtags',
                            e.target.value.slice(0, HASHTAG_MAX_LENGTH)
                          )
                        }
                        placeholder="#PCSO #LottoResults #Jackpot"
                        className="min-h-[48px] resize-none text-xs"
                        rows={2}
                      />
                    </div>

                    <Separator />

                    {/* Colors */}
                    <div className="flex items-center gap-2">
                      <Palette className="size-4 text-muted-foreground" />
                      <span className="text-xs font-medium">Colors</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <ColorPickerField
                        label="Background"
                        value={editorTemplate.bgColor || '#1a1a2e'}
                        onChange={(val) => updateField('bgColor', val)}
                      />
                      <ColorPickerField
                        label="Accent"
                        value={editorTemplate.accentColor || '#e94560'}
                        onChange={(val) => updateField('accentColor', val)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with action buttons */}
        {hasGame && !showGrid && (
          <div className="flex items-center gap-3 border-t px-5 py-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleUseBanner}
            >
              <Check className="size-4" />
              Use Banner
            </Button>
            <Button
              className="flex-1"
              onClick={handleSaveTemplate}
              disabled={
                isSaving ||
                !editorTemplate.templateName?.trim() ||
                !editorTemplate.gameId
              }
            >
              <Save className="size-4" />
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
