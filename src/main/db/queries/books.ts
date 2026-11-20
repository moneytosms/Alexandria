import type { DatabaseSync } from 'node:sqlite'
import type { Book, NewBook, ReadingState, StorageMode } from '../../../shared/types'

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
}

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
    readerJson: row.reader_json
  }
}

export function findBookBySha256(db: DatabaseSync, sha256: string): Book | null {
  const row = db.prepare('SELECT * FROM books WHERE sha256 = ?').get(sha256) as RawBook | undefined
  return row ? toBook(row) : null
}

export function getBook(db: DatabaseSync, id: number): Book | null {
  const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as RawBook | undefined
  return row ? toBook(row) : null
}

export function listBooks(db: DatabaseSync, limit = 100, offset = 0): Book[] {
  const rows = db
    .prepare('SELECT * FROM books ORDER BY added_at DESC, id DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as unknown as RawBook[]
  return rows.map(toBook)
}

export function countBooks(db: DatabaseSync): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM books').get() as { n: number }
  return Number(row.n)
}

export function insertBook(db: DatabaseSync, book: NewBook): Book {
  const slotIndex =
    book.shelfId == null
      ? 0
      : Number(
          (
            db
              .prepare(
                'SELECT COALESCE(MAX(slot_index), -1) + 1 AS next FROM books WHERE shelf_id = ?'
              )
              .get(book.shelfId) as { next: number }
          ).next
        )

  const row = db
    .prepare(
      `INSERT INTO books
        (title, author, format, original_format, file_path, rel_path, storage_mode,
         sha256, file_size, page_count, cover_path, encrypted, shelf_id, slot_index, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
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
  db.prepare(
    `UPDATE books
     SET last_page = ?, last_scroll = ?, last_opened_at = datetime('now'),
         reading_state = CASE WHEN reading_state = 'finished' THEN 'finished' ELSE 'reading' END
     WHERE id = ?`
  ).run(page, scroll, id)
}

export function markBookFinished(db: DatabaseSync, id: number, finished: boolean): void {
  if (finished) {
    db.prepare(
      `UPDATE books
       SET reading_state = 'finished', finished_at = COALESCE(finished_at, datetime('now'))
       WHERE id = ?`
    ).run(id)
  } else {
    db.prepare(
      `UPDATE books
       SET reading_state = 'reading', finished_at = NULL
       WHERE id = ?`
    ).run(id)
  }
}

export function moveBookToShelf(db: DatabaseSync, id: number, shelfId: number): Book {
  const slot = (
    db
      .prepare('SELECT COALESCE(MAX(slot_index), -1) + 1 AS next FROM books WHERE shelf_id = ?')
      .get(shelfId) as { next: number }
  ).next

  db.prepare('UPDATE books SET shelf_id = ?, slot_index = ? WHERE id = ?').run(
    shelfId,
    Number(slot),
    id
  )

  const book = getBook(db, id)
  if (!book) throw new Error(`Book ${id} not found`)
  return book
}

export function removeBook(db: DatabaseSync, id: number): void {
  db.prepare('DELETE FROM books WHERE id = ?').run(id)
}
