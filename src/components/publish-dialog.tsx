'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, Clock, Send, AlertCircle, X } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import type { BlueprintEntry } from '@/lib/types'
import {
  formatCurrency,
  formatDate,
  formatTime,
  STATUS_LABELS,
  PLATFORM_ICONS,
  PLATFORM_LABELS,
} from '@/lib/utils'

interface PublishDialogProps {
  items: BlueprintEntry[]
  isOpen: boolean
  onClose: () => void
}

export default function PublishDialog({ items, isOpen, onClose }: PublishDialogProps) {
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set())
  const [errorIds, setErroredIds] = useState<Set<string>>(new Set())
  const setBlueprint = useAppStore((s) => s.setBlueprint)
  const setPublishQueue = useAppStore((s) => s.setPublishQueue)

  const handlePublishAll = async () => {
    setIsPublishing(true)
    setPublishedIds(new Set())
    setErroredIds(new Set())

    for (const item of items) {
      try {
        // Queue the publish
        const payload = {
          caption: item.caption,
          bannerImage: null,
          hashtags: '',
          gameName: item.game?.name || 'Unknown',
          scheduledDate: item.scheduledDate,
          scheduledTime: item.scheduledTime,
        }

        const res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blueprintId: item.id,
            platform: item.platform,
            payload,
            scheduledAt: `${item.scheduledDate}T${item.scheduledTime}:00`,
          }),
        })

        if (res.ok) {
          setPublishedIds((prev) => new Set(prev).add(item.id))
        } else {
          setErroredIds((prev) => new Set(prev).add(item.id))
        }
      } catch {
        setErroredIds((prev) => new Set(prev).add(item.id))
      }
    }

    // Refresh blueprint data
    try {
      const [bpRes, pqRes] = await Promise.all([
        fetch('/api/blueprint'),
        fetch('/api/publish'),
      ])
      if (bpRes.ok) {
        const bpData = await bpRes.json()
        setBlueprint(bpData)
      }
      if (pqRes.ok) {
        const pqData = await pqRes.json()
        setPublishQueue(pqData)
      }
    } catch {
      // silent fail for refresh
    }

    setIsPublishing(false)
  }

  const allDone = publishedIds.size + errorIds.size === items.length

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-emerald-600" />
            Publish to Queue
          </DialogTitle>
          <DialogDescription>
            Review and queue {items.length} post{items.length !== 1 ? 's' : ''} for automated publishing via Playwright/Puppeteer.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-80 pr-4">
          <div className="space-y-3">
            {items.map((item) => {
              const isPublished = publishedIds.has(item.id)
              const hasError = errorIds.has(item.id)

              return (
                <div
                  key={item.id}
                  className="rounded-lg border p-3 space-y-2 transition-colors"
                  style={{
                    borderColor: isPublished
                      ? '#10B981'
                      : hasError
                      ? '#EF4444'
                      : item.game?.color || '#e2e8f0',
                  }}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.game?.icon}</span>
                      <span className="font-medium text-sm">{item.game?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {PLATFORM_ICONS[item.platform]} {PLATFORM_LABELS[item.platform]}
                      </Badge>
                      {isPublished && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" /> Queued
                        </Badge>
                      )}
                      {hasError && (
                        <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                          <AlertCircle className="h-3 w-3 mr-1" /> Failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(item.scheduledDate)} at {formatTime(item.scheduledTime)}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.dayOfWeek}
                    </Badge>
                  </div>

                  {/* Caption - displayed inline */}
                  <div className="bg-muted/50 rounded-md p-2">
                    <p className="text-xs whitespace-pre-wrap line-clamp-4">{item.caption}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!allDone ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={isPublishing}>
                Cancel
              </Button>
              <Button
                onClick={handlePublishAll}
                disabled={isPublishing}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isPublishing ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Queuing... ({publishedIds.size}/{items.length})
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Confirm &amp; Queue ({items.length})
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              onClick={onClose}
              className="bg-emerald-600 hover:bg-emerald-700 w-full"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Done — {publishedIds.size} Queued, {errorIds.size} Failed
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
