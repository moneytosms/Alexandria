import { dialog, ipcMain } from 'electron'
import { existsSync } from 'node:fs'
import { readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import { IPC } from '../../shared/ipc'
import { currentSchemaVersion } from '../db/migrations'
import type {
  AnnotationPatch,
  Book,
  ContainerCreateInput,
  ContainerDeleteInput,
  ContainerUpdateInput,
  NewAnnotation,
  ReadingProgressInput
} from '../../shared/types'
import {
  getBook,
  listBooks,
  listDeskBooks,
  markBookFinished,
  moveBookToShelf,
  removeBook,
  reorderShelf,
  setBookPinned,
  unshelveBook,
  updateBookIndex,
  updateBookMetadata,
  updateReadingProgress
} from '../db/queries/books'
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation
} from '../db/queries/annotations'
import {
  createContainer,
  deleteContainer,
  getLayout,
  sortShelfBooks,
  undoLastGrowth,
  updateContainer
} from '../db/queries/containers'
import { globalSearch, searchInBook } from '../db/queries/search'
import { createTag, deleteTag, listTags, setBookTags } from '../db/queries/tags'
import { getLibrary } from '../library/service'
import { PdfLockedError, inspectPdf } from '../pdf/inspect'
import { replaceBookText } from '../db/queries/pages'

function bookId(value: unknown): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid book id')
  return id
}

function bookFile(id: number): Book {
  const book = getBook(getLibrary().db, id)
  if (!book) throw new Error('Book not found')
  return book
}

async function walkFiles(root: string, found: Map<string, string>): Promise<void> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const path = join(root, entry.name)
    if (entry.isDirectory()) await walkFiles(path, found)
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      const key = entry.name.toLowerCase()
      if (!found.has(key)) found.set(key, path)
    }
  }
}

export function registerLibraryHandlers(): void {
  ipcMain.handle(IPC.booksGet, (_event, id: unknown) => getBook(getLibrary().db, bookId(id)))

  ipcMain.handle(IPC.booksData, async (_event, id: unknown) => {
    const book = bookFile(bookId(id))
    if (book.storageMode === 'link' && !existsSync(book.filePath)) {
      throw new Error('The linked file is missing')
    }
    const data = await readFile(book.filePath)
    return new Uint8Array(data)
  })

  ipcMain.handle(
    IPC.booksUpdate,
    (_event, id: unknown, patch: { title?: string; author?: string | null; readerJson?: string | null }) => {
      const target = bookFile(bookId(id))
      return updateBookMetadata(getLibrary().db, target.id, patch)
    }
  )

  ipcMain.handle(IPC.booksRemove, async (_event, id: unknown, deleteFile: unknown) => {
    const target = bookFile(bookId(id))
    const library = getLibrary()

    if (deleteFile === true && target.storageMode === 'copy' && target.relPath) {
      const path = join(library.root, target.relPath)
      if (relative(library.root, path).startsWith('..')) throw new Error('Refusing to delete that path')
      await rm(path, { force: true }).catch(() => undefined)
    }

    if (target.coverPath) {
      await rm(join(library.root, target.coverPath), { force: true }).catch(() => undefined)
    }

    removeBook(library.db, target.id)
  })

  ipcMain.handle(IPC.booksRelink, async (_event, id: unknown) => {
    const target = bookFile(bookId(id))
    const picked = await dialog.showOpenDialog({
      title: `Locate ${target.title}`,
      properties: ['openFile'],
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    })

    if (picked.canceled || !picked.filePaths[0]) return target

    const path = picked.filePaths[0]
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) throw new Error('That file could not be read')

    const library = getLibrary()
    const inside = relative(library.root, path)
    const relPath = inside.startsWith('..') ? null : inside.split('\\').join('/')

    const inspection = await inspectPdf(path, { renderCover: false, extractText: false })
    return updateBookIndex(library.db, target.id, {
      filePath: path,
      relPath,
      pageCount: inspection.pageCount,
      fileSize: info.size,
      missing: false
    })
  })

  ipcMain.handle(IPC.booksMove, (_event, id: unknown, shelfId: unknown) =>
    moveBookToShelf(getLibrary().db, bookId(id), bookId(shelfId))
  )

  ipcMain.handle(IPC.booksUnshelve, (_event, id: unknown) =>
    unshelveBook(getLibrary().db, bookId(id))
  )

  ipcMain.handle(IPC.booksSetPinned, (_event, id: unknown, pinned: unknown) =>
    setBookPinned(getLibrary().db, bookId(id), pinned === true)
  )

  ipcMain.handle(IPC.booksSetFinished, (_event, id: unknown, finished: unknown) =>
    markBookFinished(getLibrary().db, bookId(id), finished === true)
  )

  ipcMain.handle(IPC.booksProgress, (_event, input: ReadingProgressInput) => {
    const id = bookId(input?.bookId)
    const page = Math.max(1, Math.round(Number(input?.page) || 1))
    const scroll = Math.max(0, Number(input?.scroll) || 0)
    updateReadingProgress(getLibrary().db, id, page, scroll)
  })

  ipcMain.handle(IPC.booksUnlock, async (_event, id: unknown, password: unknown) => {
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('Enter the PDF password')
    }

    const book = bookFile(bookId(id))
    const library = getLibrary()

    let inspection
    try {
      inspection = await inspectPdf(book.filePath, {
        password,
        renderCover: true,
        extractText: true
      })
    } catch (error) {
      if (error instanceof PdfLockedError) {
        throw new Error('That password did not work', { cause: error })
      }
      throw error
    }

    let coverPath = book.coverPath
    if (inspection.cover) {
      const c = `${book.sha256}.png`
      await import('node:fs/promises').then(({ mkdir, writeFile }) =>
        mkdir(library.paths.covers, { recursive: true }).then(() =>
          writeFile(join(library.paths.covers, c), inspection.cover as Buffer)
        )
      )
      coverPath = `covers/${c}`
    }

    const updated = updateBookIndex(library.db, book.id, {
      pageCount: inspection.pageCount,
      coverPath,
      encrypted: false,
      unlockedAt: new Date().toISOString(),
      metadataJson:
        Object.keys(inspection.metadata.info).length > 0
          ? JSON.stringify(inspection.metadata.info)
          : null
    })

    replaceBookText(library.db, book.id, inspection.pages)
    return updated
  })

  ipcMain.handle(IPC.booksDetails, async (_event, id: unknown) => {
    const book = bookFile(bookId(id))
    const library = getLibrary()
    return {
      book,
      annotationCount: Number(
        (
          library.db
            .prepare('SELECT COUNT(*) AS n FROM annotations WHERE book_id = ?')
            .get(book.id) as { n: number }
        ).n
      ),
      tags: setBookTags(library.db, book.id, book.tags),
      fileExists: existsSync(book.filePath)
    }
  })

  ipcMain.handle(IPC.booksSetTags, (_event, id: unknown, tags: unknown) => {
    if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === 'string')) {
      throw new Error('Invalid tags')
    }
    return setBookTags(getLibrary().db, bookId(id), tags.slice(0, 40))
  })

  ipcMain.handle(IPC.booksScanMissing, async () => {
    const library = getLibrary()
    const books = listBooks(library.db, 100_000)
    const missing: number[] = []
    const update = library.db.prepare('UPDATE books SET missing = ? WHERE id = ?')

    for (const book of books) {
      const exists = await stat(book.filePath)
        .then((info) => info.isFile())
        .catch(() => false)

      if (!exists) {
        missing.push(book.id)
        update.run(1, book.id)
      } else if (book.missing) {
        update.run(0, book.id)
      }
    }

    return { checked: books.length, missing }
  })

  ipcMain.handle(IPC.booksRelinkMissing, async () => {
    const library = getLibrary()
    const missingBooks = (
      library.db.prepare('SELECT id, title, file_path FROM books WHERE missing = 1').all() as Array<{
        id: number
        title: string
        file_path: string
      }>
    )

    if (missingBooks.length === 0) return { matched: 0, stillMissing: 0 }

    const picked = await dialog.showOpenDialog({
      title: 'Choose the folder that now holds the missing files',
      properties: ['openDirectory']
    })

    if (picked.canceled || !picked.filePaths[0]) {
      return { matched: 0, stillMissing: missingBooks.length }
    }

    const files = new Map<string, string>()
    await walkFiles(picked.filePaths[0], files)

    let matched = 0
    const update = library.db.prepare(
      'UPDATE books SET file_path = ?, missing = 0, rel_path = ? WHERE id = ?'
    )

    for (const book of missingBooks) {
      const found = files.get(basename(book.file_path).toLowerCase())
      if (!found) continue

      const inside = relative(library.root, found)
      const relPath = inside.startsWith('..') ? null : inside.split('\\').join('/')
      update.run(found, relPath, book.id)
      matched += 1
    }

    return { matched, stillMissing: missingBooks.length - matched }
  })

  ipcMain.handle(IPC.libraryHealth, () => {
    const library = getLibrary()
    const quick = library.db.prepare('PRAGMA quick_check').all() as Array<Record<string, unknown>>
    const integrity = quick.map((row) => String(Object.values(row)[0])).join('; ')
    const count = (table: string): number =>
      Number((library.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n)

    return {
      database: integrity || 'ok',
      schemaVersion: currentSchemaVersion(),
      books: count('books'),
      pages: count('pages'),
      annotations: count('annotations'),
      missing: Number(
        (library.db.prepare('SELECT COUNT(*) AS n FROM books WHERE missing = 1').get() as {
          n: number
        }).n
      ),
      logFile: join(library.paths.logs, 'main.log')
    }
  })

  ipcMain.handle(IPC.libraryExport, async () => {
    const library = getLibrary()
    const books = listBooks(library.db, 100_000)
    const annotations = library.db
      .prepare('SELECT * FROM annotations ORDER BY book_id, page, id')
      .all()
    const tags = library.db.prepare('SELECT * FROM tags ORDER BY name').all()

    const picked = await dialog.showSaveDialog({
      title: 'Export a library manifest',
      defaultPath: `alexandria-manifest-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })

    if (picked.canceled || !picked.filePath) {
      return { path: null, books: books.length, annotations: annotations.length }
    }

    const manifest = {
      format: 'alexandria-manifest',
      version: 1,
      exportedAt: new Date().toISOString(),
      library: { name: library.config.name, root: library.root },
      books: books.map((book) => ({
        id: book.id,
        title: book.title,
        author: book.author,
        format: book.format,
        originalFormat: book.originalFormat,
        relPath: book.relPath,
        sha256: book.sha256,
        pageCount: book.pageCount,
        encrypted: book.encrypted,
        readingState: book.readingState,
        lastPage: book.lastPage,
        addedAt: book.addedAt,
        tags: book.tags
      })),
      annotations,
      tags
    }

    await writeFile(picked.filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    return { path: picked.filePath, books: books.length, annotations: annotations.length }
  })

  ipcMain.handle(IPC.booksReorderShelf, (_event, shelfId: unknown, ids: unknown) => {
    if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(Number(id)))) {
      throw new Error('Invalid book order')
    }
    reorderShelf(getLibrary().db, bookId(shelfId), ids.map(Number))
  })

  ipcMain.handle(IPC.deskList, () => listDeskBooks(getLibrary().db))

  ipcMain.handle(IPC.containersList, () => getLayout(getLibrary().db))

  ipcMain.handle(IPC.containersCreate, (_event, input: ContainerCreateInput) => {
    if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
    return createContainer(getLibrary().db, input)
  })

  ipcMain.handle(IPC.containersUpdate, (_event, input: ContainerUpdateInput) => {
    if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
    updateContainer(getLibrary().db, input)
  })

  ipcMain.handle(IPC.containersDelete, (_event, input: ContainerDeleteInput) => {
    if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
    deleteContainer(getLibrary().db, input)
  })

  ipcMain.handle(IPC.containersUndoGrowth, () => undoLastGrowth(getLibrary().db))

  ipcMain.handle(IPC.containersResort, (_event, shelfId: unknown) => {
    sortShelfBooks(getLibrary().db, bookId(shelfId))
  })

  ipcMain.handle(IPC.annotationsList, (_event, id: unknown) =>
    listAnnotations(getLibrary().db, bookId(id))
  )

  ipcMain.handle(IPC.annotationsCreate, (_event, input: NewAnnotation) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid annotation')
    return createAnnotation(getLibrary().db, { ...input, bookId: bookId(input.bookId) })
  })

  ipcMain.handle(IPC.annotationsUpdate, (_event, id: unknown, patch: AnnotationPatch) =>
    updateAnnotation(getLibrary().db, bookId(id), patch ?? {})
  )

  ipcMain.handle(IPC.annotationsDelete, (_event, id: unknown) => {
    deleteAnnotation(getLibrary().db, bookId(id))
  })

  ipcMain.handle(IPC.tagsList, () => listTags(getLibrary().db))

  ipcMain.handle(IPC.tagsCreate, (_event, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Invalid tag')
    return createTag(getLibrary().db, name)
  })

  ipcMain.handle(IPC.tagsDelete, (_event, id: unknown) => deleteTag(getLibrary().db, bookId(id)))

  ipcMain.handle(IPC.searchGlobal, (_event, query: unknown) => {
    if (typeof query !== 'string') throw new Error('Invalid search')
    return globalSearch(getLibrary().db, query.slice(0, 400))
  })

  ipcMain.handle(IPC.searchInBook, (_event, id: unknown, query: unknown) => {
    if (typeof query !== 'string') throw new Error('Invalid search')
    return searchInBook(getLibrary().db, bookId(id), query.slice(0, 400))
  })

}
