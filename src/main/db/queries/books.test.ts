import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { openDatabase } from '../index'
import {
  countBooks,
  findBookBySha256,
  getBook,
  insertBook,
  listBooks,
  markBookFinished,
  moveBookToShelf,
  removeBook,
  reorderShelf,
  updateReadingProgress
} from './books'

let db: DatabaseSync

function seedHierarchy(): void {
  db.exec("INSERT INTO floors (name) VALUES ('Ground Floor')")
  db.exec("INSERT INTO rooms (floor_id, name) VALUES (1, 'Main Hall')")
  db.exec("INSERT INTO sections (room_id, name, wall) VALUES (1, 'North Wall', 'north')")
  db.exec('INSERT INTO bays (section_id) VALUES (1)')
  db.exec('INSERT INTO bays (section_id) VALUES (1)')
  db.exec('INSERT INTO shelves (bay_id, row_index) VALUES (1, 0)')
  db.exec('INSERT INTO shelves (bay_id, row_index) VALUES (2, 0)')
}

function addBook(overrides: Partial<Parameters<typeof insertBook>[1]> = {}) {
  return insertBook(db, {
    title: 'The Name of the Rose',
    author: 'Umberto Eco',
    filePath: '/library/books/rose.pdf',
    storageMode: 'copy',
    sha256: 'hash-rose',
    shelfId: 1,
    ...overrides
  })
}

beforeEach(() => {
  db = openDatabase(':memory:')
  seedHierarchy()
})

afterEach(() => {
  db.close()
})

describe('book queries', () => {
  it('inserts a book and finds it by id and hash', () => {
    const inserted = addBook()

    expect(inserted.id).toBe(1)
    expect(inserted.shelfId).toBe(1)
    expect(inserted.slotIndex).toBe(0)
    expect(inserted.readingState).toBe('unread')
    expect(inserted.encrypted).toBe(false)

    expect(getBook(db, inserted.id)).toEqual(inserted)
    expect(findBookBySha256(db, 'hash-rose')).toEqual(inserted)
    expect(findBookBySha256(db, 'missing')).toBeNull()
  })

  it('appends books on a shelf without reusing slots', () => {
    const first = addBook()
    const second = addBook({ title: "Foucault's Pendulum", sha256: 'hash-pendulum' })

    expect(first.slotIndex).toBe(0)
    expect(second.slotIndex).toBe(1)
  })

  it('rejects a duplicate hash', () => {
    addBook()

    expect(() => addBook({ title: 'Another copy' })).toThrow(/UNIQUE/)
  })

  it('lists newest books first and paginates', () => {
    addBook({ title: 'First', sha256: 'hash-1' })
    addBook({ title: 'Second', sha256: 'hash-2' })
    addBook({ title: 'Third', sha256: 'hash-3' })

    expect(listBooks(db).map((book) => book.title)).toEqual(['Third', 'Second', 'First'])
    expect(listBooks(db, 1, 1).map((book) => book.title)).toEqual(['Second'])
    expect(countBooks(db)).toBe(3)
  })

  it('tracks progress and finishes a book', () => {
    const book = addBook()

    updateReadingProgress(db, book.id, 42, 0.75)
    let updated = getBook(db, book.id)
    expect(updated?.lastPage).toBe(42)
    expect(updated?.lastScroll).toBe(0.75)
    expect(updated?.readingState).toBe('reading')
    expect(updated?.lastOpenedAt).not.toBeNull()

    markBookFinished(db, book.id, true)
    updated = getBook(db, book.id)
    expect(updated?.readingState).toBe('finished')
    expect(updated?.finishedAt).not.toBeNull()

    updateReadingProgress(db, book.id, 43, 0)
    expect(getBook(db, book.id)?.readingState).toBe('finished')

    markBookFinished(db, book.id, false)
    updated = getBook(db, book.id)
    expect(updated?.readingState).toBe('reading')
    expect(updated?.finishedAt).toBeNull()
  })

  it('moves a book to the end of another shelf', () => {
    const first = addBook()
    addBook({ title: 'Second', sha256: 'hash-2' })

    const moved = moveBookToShelf(db, first.id, 2)

    expect(moved.shelfId).toBe(2)
    expect(moved.slotIndex).toBe(0)
  })

  it('removes a book and its annotations', () => {
    const book = addBook()
    db.prepare(
      `INSERT INTO annotations (book_id, page, type) VALUES (?, 1, 'bookmark')`
    ).run(book.id)

    removeBook(db, book.id)

    expect(getBook(db, book.id)).toBeNull()
    expect(db.prepare('SELECT COUNT(*) AS n FROM annotations').get()).toEqual({ n: 0 })
  })

  it('aggregates tags via LEFT JOIN cleanly for books with zero, one, or multiple tags', () => {
    const untagged = addBook({ title: 'Untagged', sha256: 'hash-u' })
    const multi = addBook({ title: 'Tagged', sha256: 'hash-t' })

    db.exec("INSERT INTO tags (name) VALUES ('philosophy'), ('history')")
    db.prepare('INSERT INTO book_tags (book_id, tag_id) VALUES (?, 1), (?, 2)').run(
      multi.id,
      multi.id
    )

    const fetchedUntagged = getBook(db, untagged.id)
    const fetchedMulti = getBook(db, multi.id)
    expect(fetchedUntagged?.tags).toEqual([])
    expect(fetchedMulti?.tags?.slice().sort()).toEqual(['history', 'philosophy'])

    const all = listBooks(db)
    const byId = new Map(all.map((b) => [b.id, b]))
    expect(byId.get(untagged.id)?.tags).toEqual([])
    expect(byId.get(multi.id)?.tags?.slice().sort()).toEqual(['history', 'philosophy'])
  })

  it('reorders books on a shelf atomically inside a transaction', () => {
    const a = addBook({ title: 'Alpha', sha256: 'hash-a' })
    const b = addBook({ title: 'Beta', sha256: 'hash-b' })
    const c = addBook({ title: 'Gamma', sha256: 'hash-c' })

    reorderShelf(db, 1, [c.id, a.id, b.id])

    expect(getBook(db, c.id)?.slotIndex).toBe(0)
    expect(getBook(db, a.id)?.slotIndex).toBe(1)
    expect(getBook(db, b.id)?.slotIndex).toBe(2)
  })
})
