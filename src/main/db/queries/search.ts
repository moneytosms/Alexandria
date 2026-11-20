import type { DatabaseSync } from 'node:sqlite'
import type { SearchHit, SearchResponse } from '../../../shared/types'

const MAX_HITS = 60

/** Turns user input into a safe FTS5 query. Returns null when there is nothing to match. */
export function toFtsQuery(input: string): string | null {
  const tokens = input.match(/[\p{L}\p{N}_]+/gu)
  if (!tokens || tokens.length === 0) return null
  return tokens
    .slice(0, 12)
    .map((token) => `"${token.replace(/"/g, '""')}"*`)
    .join(' AND ')
}

function plainSnippet(text: string, length = 220): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length > length ? `${collapsed.slice(0, length).trimEnd()}…` : collapsed
}

export function searchInBook(
  db: DatabaseSync,
  bookId: number,
  query: string,
  limit = MAX_HITS
): SearchHit[] {
  const fts = toFtsQuery(query)
  if (!fts) return []

  const rows = db
    .prepare(
      `SELECT p.book_id, p.page,
              snippet(pages_fts, 0, '', '', ' … ', 24) AS snippet
       FROM pages_fts p
       WHERE pages_fts MATCH ? AND p.book_id = ?
       ORDER BY p.page ASC
       LIMIT ?`
    )
    .all(fts, bookId, limit) as Array<{ book_id: number; page: number; snippet: string }>

  const book = db.prepare('SELECT title, author FROM books WHERE id = ?').get(bookId) as
    | { title: string; author: string | null }
    | undefined

  return rows.map((row) => ({
    bookId: row.book_id,
    title: book?.title ?? 'Untitled',
    author: book?.author ?? null,
    page: row.page,
    snippet: plainSnippet(row.snippet),
    kind: 'text'
  }))
}

export function globalSearch(db: DatabaseSync, query: string): SearchResponse {
  const started = performance.now()
  const trimmed = query.trim()

  if (trimmed.length === 0) {
    return { query, hits: [], total: 0, tookMs: 0, truncated: false }
  }

  const hits: SearchHit[] = []
  const seen = new Set<string>()
  const like = `%${trimmed.replace(/[%_]/g, (match) => `\\${match}`)}%`

  const add = (hit: SearchHit): void => {
    const key = `${hit.bookId}:${hit.page}:${hit.kind}`
    if (seen.has(key)) return
    seen.add(key)
    hits.push(hit)
  }

  const titleRows = db
    .prepare(
      `SELECT b.id, b.title, b.author, b.last_page
       FROM books b
       WHERE b.title LIKE ? ESCAPE '\\' OR COALESCE(b.author, '') LIKE ? ESCAPE '\\'
          OR b.file_path LIKE ? ESCAPE '\\' OR b.original_format LIKE ? ESCAPE '\\'
       ORDER BY
         CASE WHEN b.title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
         b.title COLLATE NOCASE
       LIMIT 20`
    )
    .all(like, like, like, like, like) as Array<{
    id: number
    title: string
    author: string | null
    last_page: number
  }>

  for (const row of titleRows) {
    add({
      bookId: row.id,
      title: row.title,
      author: row.author,
      page: row.last_page,
      snippet: row.author ? `${row.title} · ${row.author}` : row.title,
      kind: 'title'
    })
  }

  const fts = toFtsQuery(trimmed)
  if (fts) {
    const textRows = db
      .prepare(
        `SELECT p.book_id, p.page, b.title, b.author,
                snippet(pages_fts, 0, '', '', ' … ', 24) AS snippet
         FROM pages_fts p
         JOIN books b ON b.id = p.book_id
         WHERE pages_fts MATCH ?
         ORDER BY bm25(pages_fts)
         LIMIT 40`
      )
      .all(fts) as Array<{
      book_id: number
      page: number
      title: string
      author: string | null
      snippet: string
    }>

    for (const row of textRows) {
      add({
        bookId: row.book_id,
        title: row.title,
        author: row.author,
        page: row.page,
        snippet: plainSnippet(row.snippet),
        kind: 'text'
      })
    }
  }

  const noteRows = db
    .prepare(
      `SELECT a.book_id, a.page, b.title, b.author, COALESCE(a.note, '') AS note
       FROM annotations a
       JOIN books b ON b.id = a.book_id
       WHERE a.note LIKE ? ESCAPE '\\'
       ORDER BY a.updated_at DESC, a.created_at DESC
       LIMIT 20`
    )
    .all(like) as Array<{
    book_id: number
    page: number
    title: string
    author: string | null
    note: string
  }>

  for (const row of noteRows) {
    add({
      bookId: row.book_id,
      title: row.title,
      author: row.author,
      page: row.page,
      snippet: plainSnippet(row.note),
      kind: 'annotation'
    })
  }

  const limited = hits.slice(0, MAX_HITS)

  return {
    query,
    hits: limited,
    total: limited.length,
    tookMs: Math.round((performance.now() - started) * 100) / 100,
    truncated: hits.length > limited.length
  }
}
