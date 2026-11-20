import type { LibraryInfo } from '@shared/api'
import type { Book, Floor } from '@shared/types'
import { create } from 'zustand'

export type LibraryStatus = 'connecting' | 'ready' | 'offline'

interface LibraryState {
  info: LibraryInfo | null
  books: Book[]
  layout: Floor[]
  status: LibraryStatus
  error: string | null
  load: () => Promise<void>
  refresh: () => Promise<void>
  refreshBooks: () => Promise<void>
  setBooks: (books: Book[]) => void
  setLayout: (layout: Floor[]) => void
  patchBook: (book: Book) => void
}

async function fetchAll(): Promise<{
  info: LibraryInfo
  books: Book[]
  layout: Floor[]
}> {
  const [info, books, layout] = await Promise.all([
    window.alexandria.libraryInfo(),
    window.alexandria.listBooks(),
    window.alexandria.getLayout()
  ])
  return { info, books, layout }
}

export const useLibraryStore = create<LibraryState>((set) => ({
  info: null,
  books: [],
  layout: [],
  status: 'connecting',
  error: null,
  load: async () => {
    try {
      await window.alexandria.ping()
      const { info, books, layout } = await fetchAll()
      set({ info, books, layout, status: 'ready', error: null })
    } catch (error) {
      set({
        status: 'offline',
        error: error instanceof Error ? error.message : 'The main process did not answer.'
      })
    }
  },
  refresh: async () => {
    try {
      const { info, books, layout } = await fetchAll()
      set({ info, books, layout, status: 'ready', error: null })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not refresh the library.' })
    }
  },
  refreshBooks: async () => {
    try {
      const [books, info] = await Promise.all([
        window.alexandria.listBooks(),
        window.alexandria.libraryInfo()
      ])
      set({ books, info })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Could not refresh the catalogue.' })
    }
  },
  setBooks: (books) => set({ books }),
  setLayout: (layout) => set({ layout }),
  patchBook: (book) =>
    set((state) => ({
      books: state.books.map((entry) => (entry.id === book.id ? book : entry))
    }))
}))
