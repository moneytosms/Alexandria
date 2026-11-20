import type { DatabaseSync } from 'node:sqlite'
import type { PageText } from '../../pdf/inspect'
import { withTransaction } from '../transaction'

export function replaceBookText(db: DatabaseSync, bookId: number, pages: PageText[]): void {
  withTransaction(db, () => {
    db.prepare('DELETE FROM pages WHERE book_id = ?').run(bookId)
    db.prepare('DELETE FROM pages_fts WHERE book_id = ?').run(bookId)

    const insertPage = db.prepare('INSERT INTO pages (book_id, page, text) VALUES (?, ?, ?)')
    const insertSearch = db.prepare('INSERT INTO pages_fts (text, book_id, page) VALUES (?, ?, ?)')

    for (const page of pages) {
      if (page.text.length === 0) continue
      insertPage.run(bookId, page.page, page.text)
      insertSearch.run(page.text, bookId, page.page)
    }
  })
}

export function countIndexedPages(db: DatabaseSync, bookId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM pages WHERE book_id = ?').get(bookId) as {
    n: number
  }
  return Number(row.n)
}
