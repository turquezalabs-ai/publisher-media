import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Game, BannerTemplate } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseScheduleDays(scheduleDaysJson: string): string[] {
  try {
    return JSON.parse(scheduleDaysJson)
  } catch {
    return []
  }
}

export function parseNumbers(numbersJson: string): number[] {
  try {
    return JSON.parse(numbersJson)
  } catch {
    return []
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':')
  const h = parseInt(hours)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const displayH = h % 12 || 12
  return `${displayH}:${minutes} ${ampm}`
}

export function getDayName(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function getWeekDates(): string[] {
  const today = new Date()
  const dates: string[] = []
  const day = today.getDay()
  const diff = today.getDate() - day

  for (let i = 0; i < 7; i++) {
    const date = new Date(today)
    date.setDate(diff + i)
    dates.push(date.toISOString().split('T')[0])
  }
  return dates
}

export function getGamesForDay(games: Game[], dayName: string): Game[] {
  return games.filter((game) => {
    const scheduleDays = parseScheduleDays(game.scheduleDays)
    return scheduleDays.includes(dayName)
  })
}

export function getBannersForGameDay(
  banners: BannerTemplate[],
  gameId: string,
  dayOfWeek: string
): BannerTemplate[] {
  return banners.filter(
    (b) => b.gameId === gameId && b.dayOfWeek === dayOfWeek && b.isActive
  )
}

export function getPreDrawCaption(
  game: Game,
  dayOfWeek: string,
  jackpot?: number
): string {
  const placeholders: Record<string, string> = {
    '{date}': new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
    '{day}': dayOfWeek,
    '{time}': '9:00 PM',
    '{jackpot}': formatCurrency(jackpot || game.jackpot),
  }

  // Return a generic pre-draw caption with game info
  return `${game.icon} ${game.name} Draw Coming Up!\n\n📅 ${dayOfWeek} Draw - 9:00 PM\nEstimated Jackpot: ${formatCurrency(jackpot || game.jackpot)}\n\nGet your tickets now! ${game.icon}\n\n#PCSO #${game.shortName.replace('/', '')} #LottoResults`
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  published: 'Published',
  failed: 'Failed',
}

export const PLATFORM_ICONS: Record<string, string> = {
  facebook: '📘',
  instagram: '📷',
  twitter: '🐦',
}

export const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  twitter: 'Twitter/X',
}

export const DAY_SHORTNAMES: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}
