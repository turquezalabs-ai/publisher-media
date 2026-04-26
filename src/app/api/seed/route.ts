import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const GAMES = [
  {
    name: 'Lotto 6/42',
    shortName: '6/42',
    color: '#10B981',
    icon: '🎯',
    scheduleDays: ['Tuesday', 'Thursday', 'Saturday'],
    jackpot: 24000000,
    sortOrder: 0,
  },
  {
    name: 'Mega Lotto 6/45',
    shortName: '6/45',
    color: '#F59E0B',
    icon: '⭐',
    scheduleDays: ['Monday', 'Wednesday', 'Friday'],
    jackpot: 35000000,
    sortOrder: 1,
  },
  {
    name: 'Super Lotto 6/49',
    shortName: '6/49',
    color: '#EF4444',
    icon: '🔥',
    scheduleDays: ['Tuesday', 'Thursday', 'Sunday'],
    jackpot: 50000000,
    sortOrder: 2,
  },
  {
    name: 'Grand Lotto 6/55',
    shortName: '6/55',
    color: '#8B5CF6',
    icon: '💎',
    scheduleDays: ['Monday', 'Wednesday', 'Saturday'],
    jackpot: 75000000,
    sortOrder: 3,
  },
  {
    name: 'Ultra Lotto 6/58',
    shortName: '6/58',
    color: '#EC4899',
    icon: '🏆',
    scheduleDays: ['Tuesday', 'Friday', 'Sunday'],
    jackpot: 100000000,
    sortOrder: 4,
  },
]

const CAPTIONS: Record<string, Record<string, string>> = {
  'Lotto 6/42': {
    default: '🎯 PCSO Lotto 6/42 Results & Jackpot Update!\n\nDraw Date: {date}\nJackpot Prize: ₱{jackpot}\n\nStay tuned for the winning numbers! 💚',
    pre: '🎯 PCSO Lotto 6/42 Draw Coming Up!\n\n📅 {day} Draw - {time}\nEstimated Jackpot: ₱{jackpot}\n\nGet your tickets now! Lucky numbers await! 💚\n\n#PCSO #Lotto642',
    post: '🎯 PCSO Lotto 6/42 Result!\n\nWinning Numbers: {numbers}\nJackpot Prize: ₱{jackpot}\nWinners: {winners}\n\nDid anyone win? Check your tickets! 💚\n\n#PCSO #Lotto642 #Results',
  },
  'Mega Lotto 6/45': {
    default: '⭐ PCSO Mega Lotto 6/45 Results & Jackpot Update!\n\nDraw Date: {date}\nJackpot Prize: ₱{jackpot}\n\nStay tuned for the winning numbers! ⭐',
    pre: '⭐ PCSO Mega Lotto 6/45 Draw Coming Up!\n\n📅 {day} Draw - {time}\nEstimated Jackpot: ₱{jackpot}\n\nWho will be the next millionaire? ⭐\n\n#PCSO #MegaLotto645',
    post: '⭐ PCSO Mega Lotto 6/45 Result!\n\nWinning Numbers: {numbers}\nJackpot Prize: ₱{jackpot}\nWinners: {winners}\n\nCheck your tickets now! ⭐\n\n#PCSO #MegaLotto645 #Results',
  },
  'Super Lotto 6/49': {
    default: '🔥 PCSO Super Lotto 6/49 Results & Jackpot Update!\n\nDraw Date: {date}\nJackpot Prize: ₱{jackpot}\n\nStay tuned for the winning numbers! 🔥',
    pre: '🔥 PCSO Super Lotto 6/49 Draw Coming Up!\n\n📅 {day} Draw - {time}\nEstimated Jackpot: ₱{jackpot}\n\nDream big, play big! 🔥\n\n#PCSO #SuperLotto649',
    post: '🔥 PCSO Super Lotto 6/49 Result!\n\nWinning Numbers: {numbers}\nJackpot Prize: ₱{jackpot}\nWinners: {winners}\n\nAre you the lucky winner? 🔥\n\n#PCSO #SuperLotto649 #Results',
  },
  'Grand Lotto 6/55': {
    default: '💎 PCSO Grand Lotto 6/55 Results & Jackpot Update!\n\nDraw Date: {date}\nJackpot Prize: ₱{jackpot}\n\nStay tuned for the winning numbers! 💎',
    pre: '💎 PCSO Grand Lotto 6/55 Draw Coming Up!\n\n📅 {day} Draw - {time}\nEstimated Jackpot: ₱{jackpot}\n\nThe grandest draw awaits! 💎\n\n#PCSO #GrandLotto655',
    post: '💎 PCSO Grand Lotto 6/55 Result!\n\nWinning Numbers: {numbers}\nJackpot Prize: ₱{jackpot}\nWinners: {winners}\n\nCheck those tickets! 💎\n\n#PCSO #GrandLotto655 #Results',
  },
  'Ultra Lotto 6/58': {
    default: '🏆 PCSO Ultra Lotto 6/58 Results & Jackpot Update!\n\nDraw Date: {date}\nJackpot Prize: ₱{jackpot}\n\nStay tuned for the winning numbers! 🏆',
    pre: '🏆 PCSO Ultra Lotto 6/58 Draw Coming Up!\n\n📅 {day} Draw - {time}\nEstimated Jackpot: ₱{jackpot}\n\nThe ULTIMATE jackpot is waiting! 🏆\n\n#PCSO #UltraLotto658',
    post: '🏆 PCSO Ultra Lotto 6/58 Result!\n\nWinning Numbers: {numbers}\nJackpot Prize: ₱{jackpot}\nWinners: {winners}\n\nCould this be your lucky day? 🏆\n\n#PCSO #UltraLotto658 #Results',
  },
}

const HASHTAGS = '#PCSO #PCSOLotto #LottoResults #PhilippineLottery #LuckyNumbers #Jackpot #LotteryDraw'

const BANNER_COLORS: Record<string, { bg: string; accent: string }> = {
  'Lotto 6/42': { bg: '#064E3B', accent: '#10B981' },
  'Mega Lotto 6/45': { bg: '#78350F', accent: '#F59E0B' },
  'Super Lotto 6/49': { bg: '#7F1D1D', accent: '#EF4444' },
  'Grand Lotto 6/55': { bg: '#4C1D95', accent: '#8B5CF6' },
  'Ultra Lotto 6/58': { bg: '#831843', accent: '#EC4899' },
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = body.mode || 'full' // 'full' resets everything, 'games-only' only seeds games

    if (mode === 'full') {
      // Clear existing data
      await db.publishQueue.deleteMany()
      await db.blueprintEntry.deleteMany()
      await db.winner.deleteMany()
      await db.bannerTemplate.deleteMany()
      await db.game.deleteMany()
    }

    // Create games
    const createdGames = []
    for (const game of GAMES) {
      const existing = await db.game.findFirst({ where: { name: game.name } })
      if (!existing) {
        const created = await db.game.create({
          data: {
            name: game.name,
            shortName: game.shortName,
            color: game.color,
            icon: game.icon,
            scheduleDays: JSON.stringify(game.scheduleDays),
            jackpot: game.jackpot,
            sortOrder: game.sortOrder,
          },
        })
        createdGames.push(created)
      } else {
        createdGames.push(existing)
      }
    }

    // Create banner templates for each game and each schedule day
    if (mode === 'full') {
      for (const game of createdGames) {
        const scheduleDays = JSON.parse(game.scheduleDays)
        const colors = BANNER_COLORS[game.name] || { bg: '#1a1a2e', accent: '#e94560' }
        const captions = CAPTIONS[game.name] || {}

        for (const day of scheduleDays) {
          // Create pre-draw banner
          await db.bannerTemplate.create({
            data: {
              gameId: game.id,
              dayOfWeek: day,
              templateName: `${game.shortName} ${day} Pre-Draw`,
              caption: captions.pre || captions.default || '',
              hashtags: HASHTAGS,
              bgColor: colors.bg,
              accentColor: colors.accent,
            },
          })
          // Create post-draw banner
          await db.bannerTemplate.create({
            data: {
              gameId: game.id,
              dayOfWeek: day,
              templateName: `${game.shortName} ${day} Post-Draw`,
              caption: captions.post || captions.default || '',
              hashtags: HASHTAGS,
              bgColor: colors.accent,
              accentColor: colors.bg,
            },
          })
        }
      }

      // Create sample blueprint entries for the current week
      const today = new Date()
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

      for (let i = 0; i < 7; i++) {
        const date = new Date(today)
        date.setDate(today.getDate() + i)
        const dayName = dayNames[date.getDay()]
        const dateStr = date.toISOString().split('T')[0]

        for (const game of createdGames) {
          const scheduleDays = JSON.parse(game.scheduleDays)
          if (scheduleDays.includes(dayName)) {
            await db.blueprintEntry.create({
              data: {
                gameId: game.id,
                scheduledDate: dateStr,
                scheduledTime: '20:00',
                dayOfWeek: dayName,
                platform: 'facebook',
                caption: CAPTIONS[game.name]?.pre || '',
                status: i === 0 ? 'draft' : 'scheduled',
              },
            })
          }
        }
      }

      // Create sample winners
      for (const game of createdGames) {
        const scheduleDays = JSON.parse(game.scheduleDays)
        const lastDrawDay = scheduleDays[scheduleDays.length - 1]

        // Generate random numbers
        const numbers = Array.from({ length: 6 }, () =>
          Math.floor(Math.random() * 42 + 1)
        ).sort((a, b) => a - b)

        const drawDate = new Date()
        // Find the last occurrence of this day
        const currentDay = dayNames[drawDate.getDay()]
        const daysBack = currentDay === lastDrawDay ? 7 : (dayNames.indexOf(lastDrawDay) + 7 - dayNames.indexOf(currentDay)) % 7
        drawDate.setDate(drawDate.getDate() - daysBack)

        await db.winner.create({
          data: {
            gameId: game.id,
            drawDate: drawDate.toISOString().split('T')[0],
            numbers: JSON.stringify(numbers),
            jackpot: game.jackpot * (0.5 + Math.random()),
            winners: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 1 : 0,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      gamesCount: createdGames.length,
      message: 'Database seeded successfully',
    })
  } catch (error) {
    console.error('Error seeding database:', error)
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 })
  }
}
