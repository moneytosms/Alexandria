import { copyFile, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  Book,
  ImportBatchResult,
  ImportOutcome,
  ImportProgress,
  StorageMode
} from '../../shared/types'
import { findBookBySha256, insertBook, updateBookIndex } from '../db/queries/books'
import { sortShelfBooks } from '../db/queries/containers'
import { replaceBookText } from '../db/queries/pages'
import { nextImportShelf } from '../library/layout'
import { getLibrary } from '../library/service'
import { getSetting } from '../library/settings'
import { PdfLockedError, inspectPdf, type PdfInspection } from '../pdf/inspect'
import { convertToPdf } from './convert'
import { detectFormat } from './formats'
import { hashFile } from './hash'

export interface ImportOptions {
  signal?: AbortSignal
  onProgress?: (progress: ImportProgress) => void
  onOutcome?: (outcome: ImportOutcome, done: number, total: number) => void
}

function storageMode(db: DatabaseSync): StorageMode {
  return getSetting(db, 'import.storage') === 'link' ? 'link' : 'copy'
}

// eslint-disable-next-line no-control-regex
const unsafeName = /[<>:"/\\|?*\u0000-\u001f]/g

function safeFileName(name: string): string {
  const cleaned = name.replace(unsafeName, '_').trim()
  return cleaned.length > 0 ? cleaned : 'document.pdf'
}

function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : ''
  const code = (error as NodeJS.ErrnoException | null)?.code

  if (code === 'ENOSPC' || code === 'EDQUOT' || /no space left/i.test(message)) {
    return 'The disk is full; the import was rolled back'
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return 'The library folder is not writable'
  }
  return message || fallback
}

function displayTitle(path: string): string {
  const raw = basename(path, extname(path)).replace(/[_]+/g, ' ').trim()
  return raw.length > 0 ? raw : basename(path)
}

function cleanTitle(title: string | null, path: string): string {
  const fallback = displayTitle(path)
  if (!title) return fallback

  const stripped = title
    .replace(/^Microsoft (Word|PowerPoint|Excel)\s*-\s*/i, '')
    .replace(/^(untitled|document|presentation|slides)\s*$/i, '')
    .trim()

  return stripped.length > 0 ? stripped : fallback
}

async function placeCopy(
  source: string,
  sha256: string,
  name: string,
  root: string,
  booksDir: string
): Promise<{ filePath: string; relPath: string }> {
  await mkdir(booksDir, { recursive: true })

  const destination = join(booksDir, `${sha256.slice(0, 12)}-${safeFileName(name)}`)
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

interface Inspected {
  inspection: PdfInspection | null
  locked: boolean
}

async function inspect(
  path: string,
  options: ImportOptions,
  index: number,
  total: number,
  name: string,
  phase: 'reading' | 'indexing'
): Promise<Inspected> {
  try {
    const inspection = await inspectPdf(path, {
      renderCover: true,
      extractText: true,
      onPage: (done, pages) => {
        options.onProgress?.({
          index,
          total,
          name,
          phase,
          current: done,
          pages
        })
      }
    })
    return { inspection, locked: false }
  } catch (error) {
    if (error instanceof PdfLockedError) return { inspection: null, locked: true }
    throw error
  }
}

async function importOne(
  db: DatabaseSync,
  path: string,
  options: ImportOptions,
  index: number,
  total: number
): Promise<ImportOutcome> {
  const name = basename(path)
  const library = getLibrary()

  if (options.signal?.aborted) {
    return { path, name, status: 'failed', message: 'Import cancelled' }
  }

  const format = detectFormat(path)
  if (!format) return { path, name, status: 'failed', message: 'Unsupported file type' }

  let fileStats
  try {
    fileStats = await stat(path)
  } catch {
    return { path, name, status: 'failed', message: 'File could not be read' }
  }

  if (!fileStats.isFile()) return { path, name, status: 'failed', message: 'Not a file' }

  const sha256 = await hashFile(path)
  const duplicate = findBookBySha256(db, sha256)
  if (duplicate) return existingOutcome(duplicate, path)

  let pdfPath = path
  let converted = false

  if (format !== 'pdf') {
    options.onProgress?.({ index, total, name, phase: 'converting' })
    try {
      pdfPath = await convertToPdf(path, library.paths.cache)
      converted = true
    } catch (error) {
      return {
        path,
        name,
        status: 'failed',
        message: friendlyError(error, 'Conversion failed')
      }
    }
  }

  let result: Inspected
  try {
    result = await inspect(
      pdfPath,
      options,
      index,
      total,
      name,
      converted ? 'reading' : 'indexing'
    )
  } catch (error) {
    if (converted) await rm(pdfPath, { recursive: true, force: true }).catch(() => undefined)
    return {
      path,
      name,
      status: 'failed',
      message: friendlyError(error, 'PDF could not be read')
    }
  }

  if (!result.inspection && converted) {
    await rm(pdfPath, { recursive: true, force: true }).catch(() => undefined)
    return { path, name, status: 'failed', message: 'The converted PDF is locked' }
  }

  if (result.inspection && options.signal?.aborted) {
    await rm(pdfPath, { recursive: true, force: true }).catch(() => undefined)
    return { path, name, status: 'failed', message: 'Import cancelled' }
  }

  const mode = storageMode(db)
  let filePath = resolve(pdfPath)
  let relPath: string | null = null
  let storage: StorageMode = mode
  let copied = false
  let coverPath: string | null = null

  const inspected = result.inspection
  const coverName = `${sha256}.png`

  if (inspected?.cover) {
    await mkdir(library.paths.covers, { recursive: true })
    await writeFile(join(library.paths.covers, coverName), inspected.cover)
    coverPath = `covers/${coverName}`
  }

  if (format !== 'pdf' || mode === 'copy') {
    const targetName =
      format === 'pdf' ? basename(pdfPath) : `${basename(path, extname(path))}.pdf`
    const placed = await placeCopy(pdfPath, sha256, targetName, library.root, library.paths.books)
    filePath = placed.filePath
    relPath = placed.relPath
    storage = 'copy'
    copied = true
  }

  const title = inspected
    ? cleanTitle(inspected.metadata.title, path)
    : cleanTitle(null, path)
  const author = inspected?.metadata.author ?? null
  const shelf = nextImportShelf(db)

  try {
    const book = insertBook(db, {
      title,
      author,
      format: 'pdf',
      originalFormat: format === 'pdf' ? null : format,
      filePath,
      relPath,
      storageMode: storage,
      sha256,
      fileSize: fileStats.size,
      pageCount: inspected?.pageCount ?? null,
      coverPath,
      encrypted: Boolean(result.locked),
      shelfId: shelf.shelfId,
      metadataJson:
        inspected && Object.keys(inspected.metadata.info).length > 0
          ? JSON.stringify(inspected.metadata.info)
          : null
    })

    if (inspected && inspected.pages.length > 0) {
      replaceBookText(db, book.id, inspected.pages)
    }

    if (shelf.shelfId !== null) sortShelfBooks(db, shelf.shelfId)

    if (converted) await rm(pdfPath, { recursive: true, force: true }).catch(() => undefined)

    return {
      path,
      name,
      status: 'imported',
      bookId: book.id,
      message: result.locked ? 'Imported locked; unlock it to index the text' : undefined
    }
  } catch (error) {
    if (copied) await rm(filePath, { force: true }).catch(() => undefined)
    if (converted) await rm(pdfPath, { recursive: true, force: true }).catch(() => undefined)

    if (error instanceof Error && error.message.includes('UNIQUE')) {
      const raced = findBookBySha256(db, sha256)
      if (raced) return existingOutcome(raced, path)
    }
    return {
      path,
      name,
      status: 'failed',
      message: friendlyError(error, 'Could not add the book')
    }
  }
}

export async function importBooks(
  paths: string[],
  options: ImportOptions = {}
): Promise<ImportBatchResult> {
  const outcomes: ImportOutcome[] = []
  let completed = 0

  for (const path of paths) {
    if (options.signal?.aborted) break

    options.onProgress?.({
      index: completed + 1,
      total: paths.length,
      name: basename(path),
      phase: 'queued'
    })

    let outcome: ImportOutcome
    try {
      outcome = await importOne(getLibrary().db, path, options, completed + 1, paths.length)
    } catch (error) {
      outcome = {
        path,
        name: basename(path),
        status: 'failed',
        message: friendlyError(error, 'Import failed')
      }
    }

    outcomes.push(outcome)
    completed += 1
    options.onOutcome?.(outcome, completed, paths.length)
  }

  return {
    outcomes,
    imported: outcomes.filter((outcome) => outcome.status === 'imported').length,
    duplicates: outcomes.filter((outcome) => outcome.status === 'duplicate').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length
  }
}

export async function unlockBook(bookId: number, password: string): Promise<Book> {
  const library = getLibrary()
  const db = library.db
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId) as
    | {
        id: number
        file_path: string
        title: string
        author: string | null
        cover_path: string | null
      }
    | undefined

  if (!book) throw new Error('Book not found')

  const inspection = await inspectPdf(book.file_path, {
    password,
    renderCover: true,
    extractText: true
  })

  let coverPath = book.cover_path
  if (inspection.cover) {
    const name = `${book.id}-${Date.now()}.png`
    await mkdir(library.paths.covers, { recursive: true })
    await writeFile(join(library.paths.covers, name), inspection.cover)
    coverPath = `covers/${name}`
  }

  const updated = updateBookIndex(db, book.id, {
    title: cleanTitle(inspection.metadata.title, book.file_path),
    author: inspection.metadata.author ?? book.author,
    pageCount: inspection.pageCount,
    coverPath,
    metadataJson:
      Object.keys(inspection.metadata.info).length > 0
        ? JSON.stringify(inspection.metadata.info)
        : null,
    unlockedAt: new Date().toISOString()
  })

  replaceBookText(db, book.id, inspection.pages)
  return updated
}
