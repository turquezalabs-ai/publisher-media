import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('gameId')
  const dayOfWeek = searchParams.get('dayOfWeek')

  try {
    const where: Record<string, unknown> = { isActive: true }
    if (gameId) where.gameId = gameId
    if (dayOfWeek) where.dayOfWeek = dayOfWeek

    const banners = await db.bannerTemplate.findMany({
      where,
      include: { game: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(banners)
  } catch (error) {
    console.error('Error fetching banners:', error)
    return NextResponse.json({ error: 'Failed to fetch banners' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const banner = await db.bannerTemplate.create({
      data: {
        gameId: body.gameId,
        dayOfWeek: body.dayOfWeek,
        templateName: body.templateName || `Banner for ${body.dayOfWeek}`,
        caption: body.caption || '',
        hashtags: body.hashtags || '',
        imageData: body.imageData,
        bgColor: body.bgColor || '#1a1a2e',
        accentColor: body.accentColor || '#e94560',
      },
    })
    return NextResponse.json(banner)
  } catch (error) {
    console.error('Error creating banner:', error)
    return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const banner = await db.bannerTemplate.update({
      where: { id: body.id },
      data: {
        templateName: body.templateName,
        caption: body.caption,
        hashtags: body.hashtags,
        imageData: body.imageData,
        bgColor: body.bgColor,
        accentColor: body.accentColor,
        isActive: body.isActive,
      },
    })
    return NextResponse.json(banner)
  } catch (error) {
    console.error('Error updating banner:', error)
    return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  try {
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 })
    }
    await db.bannerTemplate.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting banner:', error)
    return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 })
  }
}
