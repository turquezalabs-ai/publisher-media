import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const games = await db.game.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        banners: {
          where: { isActive: true },
          orderBy: { dayOfWeek: 'asc' },
        },
      },
    })
    return NextResponse.json(games)
  } catch (error) {
    console.error('Error fetching games:', error)
    return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const game = await db.game.create({
      data: {
        name: body.name,
        shortName: body.shortName,
        color: body.color || '#10B981',
        icon: body.icon || '🎯',
        scheduleDays: JSON.stringify(body.scheduleDays || []),
        jackpot: body.jackpot || 0,
        sortOrder: body.sortOrder || 0,
      },
    })
    return NextResponse.json(game)
  } catch (error) {
    console.error('Error creating game:', error)
    return NextResponse.json({ error: 'Failed to create game' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const game = await db.game.update({
      where: { id: body.id },
      data: {
        name: body.name,
        shortName: body.shortName,
        color: body.color,
        icon: body.icon,
        scheduleDays: JSON.stringify(body.scheduleDays || []),
        jackpot: body.jackpot,
        isActive: body.isActive,
        sortOrder: body.sortOrder,
      },
    })
    return NextResponse.json(game)
  } catch (error) {
    console.error('Error updating game:', error)
    return NextResponse.json({ error: 'Failed to update game' }, { status: 500 })
  }
}
