import { create } from 'zustand'

interface ReaderState {
  bookId: number | null
  page: number | null
  open: (bookId: number, page?: number | null) => void
  close: () => void
  setPage: (page: number | null) => void
}

const lastKey = 'alexandria.reader.lastBook'

export const useReaderStore = create<ReaderState>((set) => ({
  bookId: null,
  page: null,
  open: (bookId, page = null) => {
    try {
      localStorage.setItem(lastKey, String(bookId))
    } catch {
      // Storage is a convenience, not a requirement.
    }
    set({ bookId, page })
  },
  close: () => set({ bookId: null, page: null }),
  setPage: (page) => set({ page })
}))

export function recallLastBook(): number | null {
  try {
    const raw = localStorage.getItem(lastKey)
    const value = Number(raw)
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}
