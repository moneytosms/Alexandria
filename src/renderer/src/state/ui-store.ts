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
  selectedBook: Book | null
  setRoom: (selection: RoomSelection) => void
  openShelf: (shelfId: number | null) => void
  setSearchOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  setSelectedBook: (book: Book | null) => void
}

export const useUiStore = create<UiState>((set) => ({
  room: { floorId: null, roomId: null },
  openShelfId: null,
  searchOpen: false,
  settingsOpen: false,
  selectedBook: null,
  setRoom: (room) => set({ room }),
  openShelf: (openShelfId) => set({ openShelfId }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSelectedBook: (selectedBook) => set({ selectedBook })
}))

interface PlayerState {
  tracks: MusicTrack[]
  currentIndex: number
  playing: boolean
  volume: number
  progress: number
  duration: number
  collapsed: boolean
  setTracks: (tracks: MusicTrack[]) => void
  playIndex: (index: number) => void
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
  setTracks: (tracks) =>
    set((state) => ({
      tracks,
      currentIndex:
        state.currentIndex >= 0 && state.currentIndex < tracks.length ? state.currentIndex : -1
    })),
  playIndex: (index) => set({ currentIndex: index, playing: true, progress: 0 }),
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
    const { tracks, currentIndex } = get()
    if (tracks.length === 0) return
    set({ currentIndex: (currentIndex + 1) % tracks.length, progress: 0, playing: true })
  },
  previous: () => {
    const { tracks, currentIndex } = get()
    if (tracks.length === 0) return
    set({
      currentIndex: currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1,
      progress: 0,
      playing: true
    })
  },
  setCollapsed: (collapsed) => set({ collapsed })
}))
