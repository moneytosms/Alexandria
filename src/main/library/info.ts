import type { LibraryInfo } from '../../shared/api'
import { getLibrary } from './service'

function count(table: 'books' | 'floors' | 'shelves'): number {
  const { db } = getLibrary()
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  return Number(row.n)
}

export function getLibraryInfo(): LibraryInfo {
  const library = getLibrary()

  return {
    root: library.root,
    name: library.config.name,
    books: count('books'),
    floors: count('floors'),
    shelves: count('shelves')
  }
}
