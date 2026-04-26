import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const limit = parseInt(searchParams.get('limit') || '20')

  try {
    const where: Record<string, unknown> = {}
    if (gameId) where.gameId = gameId

    const winners = await db.winner.findMany({
      where,
      include: { game: true },
      orderBy: { drawDate: 'desc' },
      take: limit,
    })
    return NextResponse.json(winners)
  } catch (error) {
    console.error('Error fetching winners:', error)
    return NextResponse.json({ error: 'Failed to fetch winners' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const winner = await db.winner.create({
      data: {
        gameId: body.gameId,
        drawDate: body.drawDate,
        numbers: JSON.stringify(body.numbers || []),
        jackpot: body.jackpot || 0,
        winners: body.winners || 0,
      },
    })
    return NextResponse.json(winner)
  } catch (error) {
    console.error('Error creating winner:', error)
    return NextResponse.json({ error: 'Failed to create winner' }, { status: 500 })
  }
}
