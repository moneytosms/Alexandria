import type { MusicTrack } from '@shared/types'
import { usePlayerStore } from './ui-store'

const key = 'alexandria.player'

interface SavedPlayer {
  tracks: MusicTrack[]
  currentIndex: number
  volume: number
  collapsed: boolean
}

function isTrack(value: unknown): value is MusicTrack {
  if (!value || typeof value !== 'object') return false
  const track = value as Partial<MusicTrack>
  return typeof track.path === 'string' && typeof track.title === 'string'
}

export function restorePlayer(): void {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return
    const saved = JSON.parse(raw) as Partial<SavedPlayer>
    const tracks = Array.isArray(saved.tracks) ? saved.tracks.filter(isTrack) : []
    const index =
      typeof saved.currentIndex === 'number' &&
      saved.currentIndex >= 0 &&
      saved.currentIndex < tracks.length
        ? saved.currentIndex
        : -1
    const volume =
      typeof saved.volume === 'number' && Number.isFinite(saved.volume)
        ? Math.min(1, Math.max(0, saved.volume))
        : 0.7

    usePlayerStore.setState({
      tracks,
      currentIndex: index,
      volume,
      collapsed: Boolean(saved.collapsed)
    })
  } catch {
    // A corrupt or absent snapshot just means a fresh player.
  }
}

export function wirePlayerPersistence(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  return usePlayerStore.subscribe((state) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const saved: SavedPlayer = {
        tracks: state.tracks,
        currentIndex: state.currentIndex,
        volume: state.volume,
        collapsed: state.collapsed
      }
      try {
        localStorage.setItem(key, JSON.stringify(saved))
      } catch {
        // Persistence is a convenience; playback still works without it.
      }
    }, 400)
  })
}
