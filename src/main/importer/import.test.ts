import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { getBook, listBooks } from '../db/queries/books'
import { closeLibrary, openLibrary } from '../library/service'
import { setSetting } from '../library/settings'
import { importBooks } from './import'

let dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alexandria-import-'))
  dirs.push(dir)
  return dir
}

function sourceFile(dir: string, name: string, content = 'pdf-bytes'): string {
  const path = join(dir, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  return path
}

afterEach(() => {
  closeLibrary()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('importBooks', () => {
  it('copies a PDF into the library and shelves it', async () => {
    const root = tempDir()
    const source = tempDir()
    const library = openLibrary(root)
    const path = sourceFile(source, 'The Name of the Rose.pdf', 'rose')

    const result = await importBooks([path])

    expect(result.imported).toBe(1)
    expect(result.duplicates).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.outcomes[0]).toMatchObject({
      path,
      name: 'The Name of the Rose.pdf',
      status: 'imported'
    })

    const books = listBooks(library.db)
    expect(books).toHaveLength(1)

    const book = books[0]
    expect(book.title).toBe('The Name of the Rose')
    expect(book.storageMode).toBe('copy')
    expect(book.shelfId).toBe(1)
    expect(book.slotIndex).toBe(0)
    expect(book.relPath).toMatch(/^books\//)
    expect(book.filePath).toBe(join(root, book.relPath ?? ''))
    expect(existsSync(book.filePath)).toBe(true)
    expect(readFileSync(book.filePath, 'utf8')).toBe('rose')
  })

  it('deduplicates identical content across different files and names', async () => {
    const root = tempDir()
    const source = tempDir()
    const library = openLibrary(root)
    const first = sourceFile(source, 'first.pdf', 'same-content')
    const second = sourceFile(source, 'second.pdf', 'same-content')

    const firstRun = await importBooks([first])
    const secondRun = await importBooks([second])

    expect(firstRun.imported).toBe(1)
    expect(secondRun.imported).toBe(0)
    expect(secondRun.duplicates).toBe(1)
    expect(secondRun.outcomes[0]).toMatchObject({
      status: 'duplicate',
      bookId: firstRun.outcomes[0].bookId
    })

    expect(listBooks(library.db)).toHaveLength(1)
  })

  it('links a file without copying it', async () => {
    const root = tempDir()
    const source = tempDir()
    const library = openLibrary(root)
    setSetting(library.db, 'import.storage', 'link')
    const path = sourceFile(source, 'Linked.pdf', 'linked')

    const result = await importBooks([path])

    expect(result.imported).toBe(1)

    const book = listBooks(library.db)[0]
    expect(book.storageMode).toBe('link')
    expect(book.relPath).toBeNull()
    expect(book.filePath).toBe(path)
    expect(existsSync(join(root, 'books', `${book.sha256.slice(0, 12)}-Linked.pdf`))).toBe(false)

    closeLibrary()
    const reopened = openLibrary(root)
    expect(getBook(reopened.db, book.id)?.filePath).toBe(path)
  })

  it('rebuilds copied paths after the library folder moves', async () => {
    const root = tempDir()
    const source = tempDir()
    const library = openLibrary(root)
    const path = sourceFile(source, 'Portable.pdf', 'portable')

    const result = await importBooks([path])
    const bookId = result.outcomes[0].bookId
    const original = listBooks(library.db)[0]
    expect(bookId).toBeDefined()

    closeLibrary()

    const movedRoot = join(tempDir(), 'Moved Library')
    renameSync(root, movedRoot)

    const moved = openLibrary(movedRoot)
    const relocated = getBook(moved.db, Number(bookId))

    expect(relocated?.filePath).toBe(join(movedRoot, original.relPath ?? ''))
    expect(existsSync(relocated?.filePath ?? '')).toBe(true)
  })

  it('refuses office files until conversion exists and reports missing files', async () => {
    const root = tempDir()
    const source = tempDir()
    openLibrary(root)
    const office = sourceFile(source, 'deck.pptx', 'pptx')

    const result = await importBooks([office, join(source, 'missing.pdf')])

    expect(result.imported).toBe(0)
    expect(result.failed).toBe(2)
    expect(result.outcomes[0].message).toContain('conversion is not available')
    expect(result.outcomes[1].message).toBe('File could not be read')
  })
})
