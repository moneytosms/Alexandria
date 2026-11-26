import type { DatabaseSync } from 'node:sqlite'
import type { Book, NewBook, ReadingState, StorageMode } from '../../../shared/types'
import { prepareCached } from '../stmt-cache'

interface RawBook {
  id: number
  title: string
  author: string | null
  format: string
  original_format: string | null
  file_path: string
  rel_path: string | null
  storage_mode: StorageMode
  sha256: string
  file_size: number | null
  page_count: number | null
  cover_path: string | null
  encrypted: number
  shelf_id: number | null
  slot_index: number
  reading_state: ReadingState
  desk_pinned: number
  last_page: number
  last_scroll: number
  finished_at: string | null
  added_at: string
  last_opened_at: string | null
  metadata_json: string | null
  reader_json: string | null
  unlocked_at: string | null
  missing: number
  tags?: string | null
}

/**
 * Single-pass LEFT JOIN tag aggregation instead of per-row correlated subqueries.
 * Always pair with GROUP BY b.id.
 */
const bookSelectFrom = `
  SELECT b.*,
    group_concat(t.name, char(31)) AS tags
  FROM books b
  LEFT JOIN book_tags bt ON bt.book_id = b.id
  LEFT JOIN tags t ON t.id = bt.tag_id
`

function toBook(row: RawBook): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    originalFormat: row.original_format,
    filePath: row.file_path,
    relPath: row.rel_path,
    storageMode: row.storage_mode,
    sha256: row.sha256,
    fileSize: row.file_size,
    pageCount: row.page_count,
    coverPath: row.cover_path,
    encrypted: row.encrypted === 1,
    shelfId: row.shelf_id,
    slotIndex: row.slot_index,
    readingState: row.reading_state,
    deskPinned: row.desk_pinned === 1,
    lastPage: row.last_page,
    lastScroll: row.last_scroll,
    finishedAt: row.finished_at,
    addedAt: row.added_at,
    lastOpenedAt: row.last_opened_at,
    metadataJson: row.metadata_json,
    readerJson: row.reader_json,
    unlockedAt: row.unlocked_at,
    missing: row.missing === 1,
    tags: row.tags ? row.tags.split('\u001f').filter((tag) => tag.length > 0) : []
  }
}

export function findBookBySha256(db: DatabaseSync, sha256: string): Book | null {
  const row = prepareCached(db, `${bookSelectFrom} WHERE b.sha256 = ? GROUP BY b.id`).get(
    sha256
  ) as RawBook | undefined
  return row ? toBook(row) : null
}

export function getBook(db: DatabaseSync, id: number): Book | null {
  const row = prepareCached(db, `${bookSelectFrom} WHERE b.id = ? GROUP BY b.id`).get(id) as
    | RawBook
    | undefined
  return row ? toBook(row) : null
}

export function listBooks(db: DatabaseSync, limit = 5000, offset = 0): Book[] {
  const rows = prepareCached(
    db,
    `${bookSelectFrom} GROUP BY b.id ORDER BY b.added_at DESC, b.id DESC LIMIT ? OFFSET ?`
  ).all(limit, offset) as unknown as RawBook[]
  return rows.map(toBook)
}

export function listBooksInShelf(db: DatabaseSync, shelfId: number, limit = 5000): Book[] {
  const rows = prepareCached(
    db,
    `${bookSelectFrom} WHERE b.shelf_id = ? GROUP BY b.id ORDER BY b.slot_index ASC, b.id ASC LIMIT ?`
  ).all(shelfId, limit) as unknown as RawBook[]
  return rows.map(toBook)
}

export function listInboxBooks(db: DatabaseSync): Book[] {
  const rows = prepareCached(
    db,
    `${bookSelectFrom} WHERE b.shelf_id IS NULL GROUP BY b.id ORDER BY b.added_at DESC`
  ).all() as unknown as RawBook[]
  return rows.map(toBook)
}

export function listDeskBooks(db: DatabaseSync): {
  reading: Book[]
  pinned: Book[]
  finished: Book[]
} {
  const pinned = (
    prepareCached(
      db,
      `${bookSelectFrom} WHERE b.desk_pinned = 1 GROUP BY b.id ORDER BY b.last_opened_at DESC NULLS LAST`
    ).all() as unknown as RawBook[]
  ).map(toBook)

  const pinnedIds = new Set(pinned.map((book) => book.id))

  const reading = (
    prepareCached(
      db,
      `${bookSelectFrom} WHERE b.reading_state = 'reading' GROUP BY b.id ORDER BY b.last_opened_at DESC NULLS LAST LIMIT 10`
    ).all() as unknown as RawBook[]
  )
    .map(toBook)
    .filter((book) => !pinnedIds.has(book.id))
    .slice(0, Math.max(0, 5 - pinned.length))

  const takenIds = new Set([...pinnedIds, ...reading.map((book) => book.id)])
  const finished = (
    prepareCached(
      db,
      `${bookSelectFrom}
       WHERE b.finished_at IS NOT NULL
         AND b.finished_at >= datetime('now', '-30 days')
       GROUP BY b.id
       ORDER BY b.finished_at DESC LIMIT 10`
    ).all() as unknown as RawBook[]
  )
    .map(toBook)
    .filter((book) => !takenIds.has(book.id))
    .slice(0, Math.max(0, 5 - pinned.length - reading.length))

  return { reading, pinned, finished }
}

export function countBooks(db: DatabaseSync): number {
  const row = prepareCached(db, 'SELECT COUNT(*) AS n FROM books').get() as { n: number }
  return Number(row.n)
}

export function insertBook(db: DatabaseSync, book: NewBook): Book {
  const slotIndex =
    book.shelfId == null
      ? 0
      : Number(
          (
            prepareCached(
              db,
              'SELECT COALESCE(MAX(slot_index), -1) + 1 AS next FROM books WHERE shelf_id = ?'
            ).get(book.shelfId) as { next: number }
          ).next
        )

  const row = prepareCached(
    db,
    `INSERT INTO books
      (title, author, format, original_format, file_path, rel_path, storage_mode,
       sha256, file_size, page_count, cover_path, encrypted, shelf_id, slot_index, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  ).get(
    book.title,
    book.author ?? null,
    book.format ?? 'pdf',
    book.originalFormat ?? null,
    book.filePath,
    book.relPath ?? null,
    book.storageMode,
    book.sha256,
    book.fileSize ?? null,
    book.pageCount ?? null,
    book.coverPath ?? null,
    book.encrypted ? 1 : 0,
    book.shelfId ?? null,
    slotIndex,
    book.metadataJson ?? null
  ) as unknown as RawBook

  return toBook(row)
}

export function updateReadingProgress(
  db: DatabaseSync,
  id: number,
  page: number,
  scroll: number
): void {
  prepareCached(
    db,
    `UPDATE books
     SET last_page = ?, last_scroll = ?, last_opened_at = datetime('now'),
         reading_state = CASE WHEN reading_state = 'finished' THEN 'finished' ELSE 'reading' END
     WHERE id = ?`
  ).run(page, scroll, id)
}

export function touchBookOpened(db: DatabaseSync, id: number): void {
  prepareCached(db, "UPDATE books SET last_opened_at = datetime('now') WHERE id = ?").run(id)
}

export function markBookFinished(db: DatabaseSync, id: number, finished: boolean): void {
  if (finished) {
    prepareCached(
      db,
      `UPDATE books
       SET reading_state = 'finished', finished_at = COALESCE(finished_at, datetime('now'))
       WHERE id = ?`
    ).run(id)
  } else {
    prepareCached(
      db,
      `UPDATE books
       SET reading_state = 'reading', finished_at = NULL
       WHERE id = ?`
    ).run(id)
  }
}

export function moveBookToShelf(db: DatabaseSync, id: number, shelfId: number): Book {
  const slot = (
    prepareCached(
      db,
      'SELECT COALESCE(MAX(slot_index), -1) + 1 AS next FROM books WHERE shelf_id = ?'
    ).get(shelfId) as { next: number }
  ).next

  prepareCached(db, 'UPDATE books SET shelf_id = ?, slot_index = ? WHERE id = ?').run(
    shelfId,
    Number(slot),
    id
  )

  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function unshelveBook(db: DatabaseSync, id: number): Book {
  prepareCached(db, 'UPDATE books SET shelf_id = NULL, slot_index = 0 WHERE id = ?').run(id)
  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function reorderShelf(db: DatabaseSync, shelfId: number, orderedIds: number[]): void {
  if (orderedIds.length === 0) return
  const update = prepareCached(
    db,
    'UPDATE books SET slot_index = ? WHERE id = ? AND shelf_id = ?'
  )
  db.exec('BEGIN IMMEDIATE')
  try {
    orderedIds.forEach((id, index) => update.run(index, id, shelfId))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export interface BookIndexPatch {
  title?: string
  author?: string | null
  pageCount?: number | null
  fileSize?: number | null
  coverPath?: string | null
  metadataJson?: string | null
  unlockedAt?: string | null
  encrypted?: boolean
  missing?: boolean
  filePath?: string
  relPath?: string | null
}

export function updateBookIndex(db: DatabaseSync, id: number, patch: BookIndexPatch): Book {
  const sets: string[] = []
  const values: Array<string | number | null> = []

  const push = (column: string, value: string | number | null): void => {
    sets.push(`${column} = ?`)
    values.push(value)
  }

  if (patch.title !== undefined) push('title', patch.title)
  if (patch.author !== undefined) push('author', patch.author)
  if (patch.pageCount !== undefined) push('page_count', patch.pageCount)
  if (patch.fileSize !== undefined) push('file_size', patch.fileSize)
  if (patch.coverPath !== undefined) push('cover_path', patch.coverPath)
  if (patch.metadataJson !== undefined) push('metadata_json', patch.metadataJson)
  if (patch.unlockedAt !== undefined) push('unlocked_at', patch.unlockedAt)
  if (patch.encrypted !== undefined) push('encrypted', patch.encrypted ? 1 : 0)
  if (patch.missing !== undefined) push('missing', patch.missing ? 1 : 0)
  if (patch.filePath !== undefined) push('file_path', patch.filePath)
  if (patch.relPath !== undefined) push('rel_path', patch.relPath)

  if (sets.length > 0) {
    db.prepare(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }

  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function updateBookMetadata(
  db: DatabaseSync,
  id: number,
  patch: { title?: string; author?: string | null; readerJson?: string | null }
): Book {
  const sets: string[] = []
  const values: Array<string | null> = []

  if (patch.title !== undefined) {
    sets.push('title = ?')
    values.push(patch.title)
  }
  if (patch.author !== undefined) {
    sets.push('author = ?')
    values.push(patch.author)
  }
  if (patch.readerJson !== undefined) {
    sets.push('reader_json = ?')
    values.push(patch.readerJson)
  }

  if (sets.length > 0) {
    db.prepare(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`).run(...values, id)
  }

  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function setBookPinned(db: DatabaseSync, id: number, pinned: boolean): Book {
  prepareCached(db, 'UPDATE books SET desk_pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id)
  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function removeBook(db: DatabaseSync, id: number): void {
  prepareCached(db, 'DELETE FROM books WHERE id = ?').run(id)
}

export function listBooksForShelfIds(db: DatabaseSync, shelfIds: number[]): Book[] {
  if (shelfIds.length === 0) return []
  const placeholders = shelfIds.map(() => '?').join(', ')
  const rows = db
    .prepare(
      `${bookSelectFrom} WHERE b.shelf_id IN (${placeholders}) GROUP BY b.id ORDER BY b.slot_index ASC`
    )
    .all(...shelfIds) as unknown as RawBook[]
  return rows.map(toBook)
}
