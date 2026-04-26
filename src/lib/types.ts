export interface Game {
  id: string
  name: string
  shortName: string
  color: string
  icon: string
  scheduleDays: string // JSON string
  jackpot: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
  banners?: BannerTemplate[]
}

export interface BannerTemplate {
  id: string
  gameId: string
  dayOfWeek: string
  templateName: string
  caption: string
  hashtags: string
  imageData?: string | null
  bgColor: string
  accentColor: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  game?: Game
}

export interface BlueprintEntry {
  id: string
  gameId: string
  scheduledDate: string
  scheduledTime: string
  dayOfWeek: string
  platform: string
  caption: string
  bannerId?: string | null
  status: 'draft' | 'scheduled' | 'published' | 'failed'
  postedAt?: string | null
  publishLog?: string | null
  createdAt: string
  updatedAt: string
  game?: Game
}

export interface Winner {
  id: string
  gameId: string
  drawDate: string
  numbers: string // JSON string
  jackpot?: number | null
  winners: number
  createdAt: string
  updatedAt: string
  game?: Game
}

export interface PublishQueueItem {
  id: string
  blueprintId: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  platform: string
  payload: string // JSON string
  result?: string | null
  attempts: number
  maxAttempts: number
  scheduledAt: string
  startedAt?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PublishExport {
  queueId: string
  platform: string
  scheduledAt: string
  gameName: string
  caption: string
  bannerImage: string | null
  hashtags: string
  blueprintId: string
  action: {
    type: string
    platform: string
    text: string
    imagePath: string | null
  }
}

export type ActiveView = 'blueprint' | 'analysis' | 'pulse' | 'winners' | 'banner-studio'

export interface PulseActivity {
  id: string
  type: 'published' | 'scheduled' | 'draft' | 'failed' | 'winner' | 'system'
  title: string
  description: string
  timestamp: string
  gameName?: string
  gameColor?: string
  gameIcon?: string
}
