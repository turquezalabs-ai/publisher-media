import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  try {
    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (dateFrom && dateTo) {
      where.scheduledDate = { gte: dateFrom, lte: dateTo }
    } else if (dateFrom) {
      where.scheduledDate = { gte: dateFrom }
    }

    const entries = await db.blueprintEntry.findMany({
      where,
      include: { game: true },
      orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    })
    return NextResponse.json(entries)
  } catch (error) {
    console.error('Error fetching blueprint:', error)
    return NextResponse.json({ error: 'Failed to fetch blueprint' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const entry = await db.blueprintEntry.create({
      data: {
        gameId: body.gameId,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime || '20:00',
        dayOfWeek: body.dayOfWeek,
        platform: body.platform || 'facebook',
        caption: body.caption || '',
        bannerId: body.bannerId,
        status: body.status || 'draft',
      },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error creating blueprint entry:', error)
    return NextResponse.json({ error: 'Failed to create blueprint entry' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const entry = await db.blueprintEntry.update({
      where: { id: body.id },
      data: {
        gameId: body.gameId,
        scheduledDate: body.scheduledDate,
        scheduledTime: body.scheduledTime,
        dayOfWeek: body.dayOfWeek,
        platform: body.platform,
        caption: body.caption,
        bannerId: body.bannerId,
        status: body.status,
        postedAt: body.postedAt ? new Date(body.postedAt) : undefined,
        publishLog: body.publishLog,
      },
    })
    return NextResponse.json(entry)
  } catch (error) {
    console.error('Error updating blueprint entry:', error)
    return NextResponse.json({ error: 'Failed to update blueprint entry' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }
    await db.blueprintEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blueprint entry:', error)
    return NextResponse.json({ error: 'Failed to delete blueprint entry' }, { status: 500 })
  }
}
