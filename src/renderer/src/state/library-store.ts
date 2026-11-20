import type { LibraryInfo } from '@shared/api'
import type { Book } from '@shared/types'
import { create } from 'zustand'

export type LibraryStatus = 'connecting' | 'ready' | 'offline'

interface LibraryState {
  info: LibraryInfo | null
  books: Book[]
  status: LibraryStatus
  load: () => Promise<void>
}

export const useLibraryStore = create<LibraryState>((set) => ({
  info: null,
  books: [],
  status: 'connecting',
  load: async () => {
    try {
      const [, info, books] = await Promise.all([
        window.alexandria.ping(),
        window.alexandria.libraryInfo(),
        window.alexandria.listBooks()
      ])
      set({ info, books, status: 'ready' })
    } catch {
      set({ status: 'offline' })
    }
  }
}))
