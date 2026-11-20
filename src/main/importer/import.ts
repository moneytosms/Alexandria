import { copyFile, mkdir, stat } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  Book,
  ImportBatchResult,
  ImportOutcome,
  StorageMode
} from '../../shared/types'
import { findBookBySha256, insertBook } from '../db/queries/books'
import { getLibrary } from '../library/service'
import { getSetting } from '../library/settings'
import { detectFormat } from './formats'
import { hashFile } from './hash'

function firstShelfWithRoom(db: DatabaseSync): number | null {
  const row = db
    .prepare(
      `SELECT s.id
       FROM shelves s
       WHERE (SELECT COUNT(*) FROM books b WHERE b.shelf_id = s.id) < s.capacity
       ORDER BY s.id
       LIMIT 1`
    )
    .get() as { id: number } | undefined

  return row?.id ?? null
}

function storageMode(db: DatabaseSync): StorageMode {
  return getSetting(db, 'import.storage') === 'link' ? 'link' : 'copy'
}

function safeFileName(name: string): string {
  // eslint-disable-next-line no-control-regex
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()
  return cleaned.length > 0 ? cleaned : 'document.pdf'
}

async function placeCopy(
  source: string,
  sha256: string,
  root: string,
  booksDir: string
): Promise<{ filePath: string; relPath: string }> {
  await mkdir(booksDir, { recursive: true })

  const destination = join(booksDir, `${sha256.slice(0, 12)}-${safeFileName(basename(source))}`)
  await copyFile(source, destination)

  return {
    filePath: destination,
    relPath: relative(root, destination).split('\\').join('/')
  }
}

function existingOutcome(book: Book, path: string): ImportOutcome {
  return {
    path,
    name: basename(path),
    status: 'duplicate',
    bookId: book.id,
    message: 'Already in the library'
  }
}

async function importOne(path: string): Promise<ImportOutcome> {
  const name = basename(path)
  const library = getLibrary()
  const db = library.db

  const format = detectFormat(path)
  if (!format) {
    return { path, name, status: 'failed', message: 'Unsupported file type' }
  }

  if (format !== 'pdf') {
    return {
      path,
      name,
      status: 'failed',
      message: `${format.toUpperCase()} conversion is not available yet`
    }
  }

  let fileStats
  try {
    fileStats = await stat(path)
  } catch {
    return { path, name, status: 'failed', message: 'File could not be read' }
  }

  if (!fileStats.isFile()) {
    return { path, name, status: 'failed', message: 'Not a file' }
  }

  const sha256 = await hashFile(path)
  const duplicate = findBookBySha256(db, sha256)
  if (duplicate) return existingOutcome(duplicate, path)

  const mode = storageMode(db)
  let filePath = resolve(path)
  let relPath: string | null = null

  if (mode === 'copy') {
    const placed = await placeCopy(path, sha256, library.root, library.paths.books)
    filePath = placed.filePath
    relPath = placed.relPath
  }

  const title = basename(path, extname(path)).trim() || name

  try {
    const book = insertBook(db, {
      title,
      filePath,
      relPath,
      storageMode: mode,
      sha256,
      fileSize: fileStats.size,
      format: 'pdf',
      shelfId: firstShelfWithRoom(db)
    })

    return { path, name, status: 'imported', bookId: book.id }
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      const raced = findBookBySha256(db, sha256)
      if (raced) return existingOutcome(raced, path)
    }

    return {
      path,
      name,
      status: 'failed',
      message: error instanceof Error ? error.message : 'Could not add the book'
    }
  }
}

export async function importBooks(paths: string[]): Promise<ImportBatchResult> {
  const outcomes: ImportOutcome[] = []

  for (const path of paths) {
    try {
      outcomes.push(await importOne(path))
    } catch (error) {
      outcomes.push({
        path,
        name: basename(path),
        status: 'failed',
        message: error instanceof Error ? error.message : 'Import failed'
      })
    }
  }

  return {
    outcomes,
    imported: outcomes.filter((outcome) => outcome.status === 'imported').length,
    duplicates: outcomes.filter((outcome) => outcome.status === 'duplicate').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length
  }
}
