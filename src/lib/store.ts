import { create } from 'zustand'
import type { Game, BannerTemplate, BlueprintEntry, Winner, PublishQueueItem, ActiveView, PulseActivity } from './types'

interface AppState {
  // Navigation
  activeView: ActiveView
  setActiveView: (view: ActiveView) => void

  // Data
  games: Game[]
  setGames: (games: Game[]) => void
  banners: BannerTemplate[]
  setBanners: (banners: BannerTemplate[]) => void
  blueprint: BlueprintEntry[]
  setBlueprint: (entries: BlueprintEntry[]) => void
  winners: Winner[]
  setWinners: (winners: Winner[]) => void
  publishQueue: PublishQueueItem[]
  setPublishQueue: (queue: PublishQueueItem[]) => void

  // Filters
  selectedGameId: string | null
  setSelectedGameId: (id: string | null) => void
  selectedDate: string
  setSelectedDate: (date: string) => void
  selectedPlatform: string
  setSelectedPlatform: (platform: string) => void

  // Banner Studio
  isBannerStudioOpen: boolean
  setIsBannerStudioOpen: (open: boolean) => void
  selectedBanner: BannerTemplate | null
  setSelectedBanner: (banner: BannerTemplate | null) => void

  // Publish
  isPublishDialogOpen: boolean
  setIsPublishDialogOpen: (open: boolean) => void
  publishItems: BlueprintEntry[]
  setPublishItems: (items: BlueprintEntry[]) => void

  // Pulse
  activities: PulseActivity[]
  addActivity: (activity: PulseActivity) => void
  clearActivities: () => void

  // Loading states
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  activeView: 'blueprint',
  setActiveView: (view) => set({ activeView: view }),

  // Data
  games: [],
  setGames: (games) => set({ games }),
  banners: [],
  setBanners: (banners) => set({ banners }),
  blueprint: [],
  setBlueprint: (entries) => set({ blueprint: entries }),
  winners: [],
  setWinners: (winners) => set({ winners }),
  publishQueue: [],
  setPublishQueue: (queue) => set({ publishQueue: queue }),

  // Filters
  selectedGameId: null,
  setSelectedGameId: (id) => set({ selectedGameId: id }),
  selectedDate: new Date().toISOString().split('T')[0],
  setSelectedDate: (date) => set({ selectedDate: date }),
  selectedPlatform: 'facebook',
  setSelectedPlatform: (platform) => set({ selectedPlatform: platform }),

  // Banner Studio
  isBannerStudioOpen: false,
  setIsBannerStudioOpen: (open) => set({ isBannerStudioOpen: open }),
  selectedBanner: null,
  setSelectedBanner: (banner) => set({ selectedBanner: banner }),

  // Publish
  isPublishDialogOpen: false,
  setIsPublishDialogOpen: (open) => set({ isPublishDialogOpen: open }),
  publishItems: [],
  setPublishItems: (items) => set({ publishItems: items }),

  // Pulse
  activities: [],
  addActivity: (activity) => set((state) => ({ activities: [activity, ...state.activities].slice(0, 100) })),
  clearActivities: () => set({ activities: [] }),

  // Loading
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}))
