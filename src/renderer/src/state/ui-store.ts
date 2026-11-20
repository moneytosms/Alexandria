import type { Book, MusicTrack } from '@shared/types'
import { create } from 'zustand'

interface RoomSelection {
  floorId: number | null
  roomId: number | null
}

interface UiState {
  room: RoomSelection
  openShelfId: number | null
  searchOpen: boolean
  settingsOpen: boolean
  tipsOpen: boolean
  selectedBook: Book | null
  returningBookId: number | null
  setRoom: (selection: RoomSelection) => void
  openShelf: (shelfId: number | null) => void
  setSearchOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setTipsOpen: (open: boolean) => void
  setSelectedBook: (book: Book | null) => void
  returnBook: (bookId: number) => void
  clearReturningBook: () => void
}

export const useUiStore = create<UiState>((set) => ({
  room: { floorId: null, roomId: null },
  openShelfId: null,
  searchOpen: false,
  settingsOpen: false,
  tipsOpen: false,
  selectedBook: null,
  returningBookId: null,
  setRoom: (room) => set({ room }),
  openShelf: (openShelfId) => set({ openShelfId }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setTipsOpen: (tipsOpen) => set({ tipsOpen }),
  setSelectedBook: (selectedBook) => set({ selectedBook }),
  returnBook: (returningBookId) => set({ returningBookId }),
  clearReturningBook: () => set({ returningBookId: null })
}))

interface PlayerState {
  tracks: MusicTrack[]
  currentIndex: number
  playing: boolean
  volume: number
  progress: number
  duration: number
  collapsed: boolean
  shuffle: boolean
  setTracks: (tracks: MusicTrack[]) => void
  playIndex: (index: number) => void
  playAll: (startIndex?: number) => void
  toggleShuffle: () => void
  toggle: () => void
  setPlaying: (playing: boolean) => void
  setVolume: (volume: number) => void
  setProgress: (progress: number, duration: number) => void
  next: () => void
  previous: () => void
  setCollapsed: (collapsed: boolean) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  tracks: [],
  currentIndex: -1,
  playing: false,
  volume: 0.7,
  progress: 0,
  duration: 0,
  collapsed: false,
  shuffle: false,
  setTracks: (tracks) =>
    set((state) => ({
      tracks,
      currentIndex:
        state.currentIndex >= 0 && state.currentIndex < tracks.length ? state.currentIndex : -1
    })),
  playIndex: (index) => set({ currentIndex: index, playing: true, progress: 0 }),
  playAll: (startIndex = 0) => {
    const { tracks } = get()
    if (tracks.length === 0) return
    set({
      currentIndex: Math.min(Math.max(0, startIndex), tracks.length - 1),
      playing: true,
      progress: 0
    })
  },
  toggleShuffle: () => set((state) => ({ shuffle: !state.shuffle })),
  toggle: () => {
    if (get().currentIndex < 0 && get().tracks.length > 0) {
      set({ currentIndex: 0, playing: true })
      return
    }
    set((state) => ({ playing: !state.playing }))
  },
  setPlaying: (playing) => set({ playing }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress, duration) => set({ progress, duration }),
  next: () => {
    const { tracks, currentIndex, shuffle } = get()
    if (tracks.length === 0) return
    if (shuffle && tracks.length > 1) {
      const offset = 1 + Math.floor(Math.random() * (tracks.length - 1))
      set({ currentIndex: (currentIndex + offset) % tracks.length, progress: 0, playing: true })
      return
    }
    set({ currentIndex: (currentIndex + 1) % tracks.length, progress: 0, playing: true })
  },
  previous: () => {
    const { tracks, currentIndex, shuffle } = get()
    if (tracks.length === 0) return
    if (shuffle && tracks.length > 1) {
      const offset = 1 + Math.floor(Math.random() * (tracks.length - 1))
      set({
        currentIndex: (currentIndex - offset + tracks.length) % tracks.length,
        progress: 0,
        playing: true
      })
      return
    }
    set({
      currentIndex: currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1,
      progress: 0,
      playing: true
    })
  },
  setCollapsed: (collapsed) => set({ collapsed })
}))
