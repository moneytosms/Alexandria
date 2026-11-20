import type { LibraryInfo } from '../../shared/api'
import { getLibrary } from './service'

function count(table: 'books' | 'floors' | 'shelves' | 'sections'): number {
  const { db } = getLibrary()
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return Number(row.n)
}

export function getLibraryInfo(): LibraryInfo {
  const library = getLibrary()
  const slots = library.db.prepare('SELECT COALESCE(SUM(capacity), 0) AS n FROM shelves').get() as {
    n: number
  }

  return {
    root: library.root,
    name: library.config.name,
    books: count('books'),
    floors: count('floors'),
    sections: count('sections'),
    shelves: count('shelves'),
    slots: Number(slots.n)
  }
}
