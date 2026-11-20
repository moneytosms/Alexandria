import express, { type Request, type Response } from 'express'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, normalize, relative, resolve, sep } from 'node:path'
import { createServer as createViteServer } from 'vite'
import type {
  AnnotationPatch,
  Book,
  ContainerCreateInput,
  ContainerDeleteInput,
  ContainerUpdateInput,
  NewAnnotation,
  ReadingProgressInput
} from './src/shared/types'
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation
} from './src/main/db/queries/annotations'
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
} from './src/main/db/queries/books'
import {
  createContainer,
  deleteContainer,
  getLayout,
  sortShelfBooks,
  undoLastGrowth,
  updateContainer
} from './src/main/db/queries/containers'
import { currentSchemaVersion } from './src/main/db/migrations'
import { replaceBookText } from './src/main/db/queries/pages'
import { globalSearch, searchInBook } from './src/main/db/queries/search'
import { createTag, deleteTag, listTags, setBookTags } from './src/main/db/queries/tags'
import { importBooks } from './src/main/importer/import'
import { scanImportPaths } from './src/main/importer/scan'
import { getLibraryInfo } from './src/main/library/info'
import { getLibrary, openLibrary } from './src/main/library/service'
import { getAllSettings, setSetting } from './src/main/library/settings'
import { createLogger, getLogger, setLogger } from './src/main/logger'
import { isInsideMusicFolders, musicArtRoot, musicFolders, scanMusic } from './src/main/music/scan'
import { PdfLockedError, inspectPdf, renderThumbnail } from './src/main/pdf/inspect'

const PORT = Number(process.env.PORT) || 3000
const HOST = '0.0.0.0'
const ROOT_DIR = process.cwd()
const LIBRARY_ROOT = process.env.ALEXANDRIA_LIBRARY_PATH || join(ROOT_DIR, '.alexandria-library')

let activeImport: AbortController | null = null

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

function inside(root: string, candidate: string): boolean {
  const base = resolve(root)
  const target = resolve(candidate)
  return target === base || target.startsWith(`${base}${sep}`)
}

function assertPaths(paths: unknown, max: number): asserts paths is string[] {
  if (!Array.isArray(paths) || paths.length > max) {
    throw new Error('Invalid import paths')
  }
  if (!paths.every((path): path is string => typeof path === 'string' && path.length > 0)) {
    throw new Error('Invalid import paths')
  }
}

function webArtUrl(path: string): string {
  const root = musicArtRoot()
  const rel = path.startsWith(root) ? path.slice(root.length + 1) : path
  return `/api/media/art/${encodeURIComponent(rel)}`
}

async function handleRpc(method: string, args: unknown[]): Promise<unknown> {
  const library = getLibrary()

  switch (method) {
    case 'ping':
      return 'pong'
    case 'appInfo':
      return {
        name: 'Alexandria',
        version: '0.1.0',
        electron: 'web-preview',
        chrome: 'browser',
        node: process.versions.node,
        platform: `${process.platform} ${process.arch}`
      }
    case 'libraryInfo':
      return getLibraryInfo()
    case 'getSettings':
      return getAllSettings(library.db)
    case 'setSetting': {
      const [key, value] = args
      if (typeof key !== 'string' || typeof value !== 'string') {
        throw new Error('Invalid settings payload')
      }
      setSetting(library.db, key, value)
      return null
    }
    case 'log': {
      const [level, message, detail] = args
      if (level !== 'info' && level !== 'warn' && level !== 'error') {
        throw new Error('Invalid log level')
      }
      if (typeof message !== 'string') throw new Error('Invalid log message')
      getLogger().log(
        level,
        message.slice(0, 2_000),
        typeof detail === 'string' ? detail.slice(0, 16_000) : undefined
      )
      return null
    }
    case 'scanImportPaths': {
      const [paths] = args
      assertPaths(paths, 10_000)
      return scanImportPaths(paths)
    }
    case 'importBooks': {
      const [paths] = args
      assertPaths(paths, 500)
      if (activeImport) throw new Error('An import is already running')
      const controller = new AbortController()
      activeImport = controller
      try {
        return await importBooks(paths, { signal: controller.signal })
      } finally {
        activeImport = null
      }
    }
    case 'cancelImport':
      activeImport?.abort()
      return null
    case 'listBooks':
      return listBooks(library.db, 5000)
    case 'getBook':
      return getBook(library.db, bookId(args[0]))
    case 'updateBook': {
      const target = bookFile(bookId(args[0]))
      const patch = (args[1] ?? {}) as {
        title?: string
        author?: string | null
        readerJson?: string | null
      }
      return updateBookMetadata(library.db, target.id, patch)
    }
    case 'removeBook': {
      const target = bookFile(bookId(args[0]))
      const deleteFile = args[1] === true
      if (deleteFile && target.storageMode === 'copy' && target.relPath) {
        const path = join(library.root, target.relPath)
        if (relative(library.root, path).startsWith('..')) {
          throw new Error('Refusing to delete that path')
        }
        await rm(path, { force: true }).catch(() => undefined)
      }
      if (target.coverPath) {
        await rm(join(library.root, target.coverPath), { force: true }).catch(() => undefined)
      }
      removeBook(library.db, target.id)
      return null
    }
    case 'moveBook':
      return moveBookToShelf(library.db, bookId(args[0]), bookId(args[1]))
    case 'unshelveBook':
      return unshelveBook(library.db, bookId(args[0]))
    case 'setBookPinned':
      return setBookPinned(library.db, bookId(args[0]), args[1] === true)
    case 'setBookFinished':
      return markBookFinished(library.db, bookId(args[0]), args[1] === true)
    case 'saveProgress': {
      const input = args[0] as ReadingProgressInput
      const id = bookId(input?.bookId)
      const page = Math.max(1, Math.round(Number(input?.page) || 1))
      const scroll = Math.max(0, Number(input?.scroll) || 0)
      updateReadingProgress(library.db, id, page, scroll)
      return null
    }
    case 'unlockBook': {
      const id = bookId(args[0])
      const password = args[1]
      if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Enter the PDF password')
      }
      const book = bookFile(id)
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
        const fileName = `${book.sha256}.png`
        await mkdir(library.paths.covers, { recursive: true })
        await writeFile(join(library.paths.covers, fileName), inspection.cover)
        coverPath = `covers/${fileName}`
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
    }
    case 'bookDetails': {
      const book = bookFile(bookId(args[0]))
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
    }
    case 'setBookTags': {
      const tags = args[1]
      if (!Array.isArray(tags) || !tags.every((tag): tag is string => typeof tag === 'string')) {
        throw new Error('Invalid tags')
      }
      return setBookTags(library.db, bookId(args[0]), tags.slice(0, 40))
    }
    case 'scanMissing': {
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
    }
    case 'relinkMissing':
      return { matched: 0, stillMissing: 0 }
    case 'relinkBook':
      return bookFile(bookId(args[0]))
    case 'libraryHealth': {
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
          (
            library.db
              .prepare('SELECT COUNT(*) AS n FROM books WHERE missing = 1')
              .get() as { n: number }
          ).n
        ),
        logFile: join(library.paths.logs, 'main.log')
      }
    }
    case 'exportLibrary': {
      const books = listBooks(library.db, 100_000)
      const annotations = library.db
        .prepare('SELECT * FROM annotations ORDER BY book_id, page, id')
        .all()
      const tags = library.db.prepare('SELECT * FROM tags ORDER BY name').all()
      const fileName = `alexandria-manifest-${new Date().toISOString().slice(0, 10)}.json`
      const outPath = join(library.paths.cache, fileName)
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
      await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      return { path: outPath, books: books.length, annotations: annotations.length }
    }
    case 'reorderShelf': {
      const ids = args[1]
      if (!Array.isArray(ids) || !ids.every((id) => Number.isInteger(Number(id)))) {
        throw new Error('Invalid book order')
      }
      reorderShelf(library.db, bookId(args[0]), ids.map(Number))
      return null
    }
    case 'deskBooks':
      return listDeskBooks(library.db)
    case 'getLayout':
      return getLayout(library.db)
    case 'createContainer': {
      const input = args[0] as ContainerCreateInput
      if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
      return createContainer(library.db, input)
    }
    case 'updateContainer': {
      const input = args[0] as ContainerUpdateInput
      if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
      updateContainer(library.db, input)
      return null
    }
    case 'deleteContainer': {
      const input = args[0] as ContainerDeleteInput
      if (!input || typeof input.kind !== 'string') throw new Error('Invalid container')
      deleteContainer(library.db, input)
      return null
    }
    case 'undoGrowth':
      return undoLastGrowth(library.db)
    case 'resortShelf':
      sortShelfBooks(library.db, bookId(args[0]))
      return null
    case 'listAnnotations':
      return listAnnotations(library.db, bookId(args[0]))
    case 'createAnnotation': {
      const input = args[0] as NewAnnotation
      if (!input || typeof input !== 'object') throw new Error('Invalid annotation')
      return createAnnotation(library.db, { ...input, bookId: bookId(input.bookId) })
    }
    case 'updateAnnotation':
      return updateAnnotation(library.db, bookId(args[0]), (args[1] as AnnotationPatch) ?? {})
    case 'deleteAnnotation':
      deleteAnnotation(library.db, bookId(args[0]))
      return null
    case 'listTags':
      return listTags(library.db)
    case 'createTag': {
      if (typeof args[0] !== 'string') throw new Error('Invalid tag')
      return createTag(library.db, args[0])
    }
    case 'deleteTag':
      deleteTag(library.db, bookId(args[0]))
      return null
    case 'search': {
      if (typeof args[0] !== 'string') throw new Error('Invalid search')
      return globalSearch(library.db, args[0].slice(0, 400))
    }
    case 'searchInBook': {
      if (typeof args[1] !== 'string') throw new Error('Invalid search')
      return searchInBook(library.db, bookId(args[0]), args[1].slice(0, 400))
    }
    case 'musicFolders':
      return musicFolders()
    case 'scanMusic': {
      const result = await scanMusic()
      return {
        ...result,
        tracks: result.tracks.map((track) => ({
          ...track,
          artPath: track.artPath ? webArtUrl(track.artPath) : null
        }))
      }
    }
    default:
      throw new Error(`Unknown RPC method: ${method}`)
  }
}

async function startServer(): Promise<void> {
  openLibrary(LIBRARY_ROOT)
  setLogger(createLogger(join(getLibrary().paths.logs, 'main.log')))
  getLogger().info(`Opened web preview library at ${LIBRARY_ROOT}`)

  const app = express()
  app.use(express.json({ limit: '10mb' }))

  app.post('/api/rpc/:method', async (req: Request, res: Response) => {
    try {
      const method = String(req.params.method)
      const args = Array.isArray(req.body?.args) ? (req.body.args as unknown[]) : []
      const result = await handleRpc(method, args)
      res.json({ ok: true, result })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed'
      res.status(400).json({ ok: false, error: message })
    }
  })

  app.get('/api/books/:id/data', async (req: Request, res: Response) => {
    try {
      const book = bookFile(bookId(req.params.id))
      if (book.storageMode === 'link' && !existsSync(book.filePath)) {
        res.status(404).send('The linked file is missing')
        return
      }
      const data = await readFile(book.filePath)
      res.setHeader('Content-Type', 'application/pdf')
      res.send(data)
    } catch (error) {
      res.status(404).send(error instanceof Error ? error.message : 'Book not found')
    }
  })

  app.post(
    '/api/import/upload',
    express.raw({ type: '*/*', limit: '100mb' }),
    async (req: Request, res: Response) => {
      try {
        const rawName = String(req.header('x-filename') || 'document.pdf')
        const decodedName = decodeURIComponent(rawName)
        const safeName = basename(decodedName).replace(/[^a-zA-Z0-9._ -]/g, '_') || 'document.pdf'
        const uploadDir = join(getLibrary().paths.cache, 'uploads')
        await mkdir(uploadDir, { recursive: true })
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
        const hash = createHash('sha1').update(body).digest('hex').slice(0, 12)
        const filePath = join(uploadDir, `${hash}-${safeName}`)
        await writeFile(filePath, body)
        res.json({ ok: true, path: filePath })
      } catch (error) {
        res.status(400).json({
          ok: false,
          error: error instanceof Error ? error.message : 'Upload failed'
        })
      }
    }
  )

  app.post(
    '/api/music/upload',
    express.raw({ type: '*/*', limit: '100mb' }),
    async (req: Request, res: Response) => {
      try {
        const rawName = String(req.header('x-filename') || 'track.mp3')
        const decodedName = decodeURIComponent(rawName)
        const safeName = basename(decodedName).replace(/[^a-zA-Z0-9._ -]/g, '_') || 'track.mp3'
        const musicDir = join(getLibrary().paths.cache, 'music')
        await mkdir(musicDir, { recursive: true })
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
        const filePath = join(musicDir, safeName)
        await writeFile(filePath, body)
        const current = musicFolders()
        if (!current.includes(musicDir)) {
          setSetting(getLibrary().db, 'music.folders', JSON.stringify([...current, musicDir]))
        }
        res.json({ ok: true, folders: musicFolders() })
      } catch (error) {
        res.status(400).json({
          ok: false,
          error: error instanceof Error ? error.message : 'Music upload failed'
        })
      }
    }
  )

  app.get('/api/media/cover/:id', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isInteger(id)) {
        res.status(404).end()
        return
      }
      const book = getLibrary()
        .db.prepare('SELECT cover_path FROM books WHERE id = ?')
        .get(id) as { cover_path: string | null } | undefined
      if (!book?.cover_path) {
        res.status(404).end()
        return
      }
      const fullPath = join(getLibrary().root, book.cover_path)
      if (!inside(getLibrary().root, fullPath) || !existsSync(fullPath)) {
        res.status(404).end()
        return
      }
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(await readFile(fullPath))
    } catch {
      res.status(404).end()
    }
  })

  app.get('/api/media/thumb/:id/:page', async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id)
      const page = Number(req.params.page)
      if (!Number.isInteger(id) || !Number.isInteger(page) || page < 1) {
        res.status(404).end()
        return
      }
      const library = getLibrary()
      const cached = join(library.paths.thumbs, `${id}-${page}.png`)
      if (existsSync(cached)) {
        res.setHeader('Content-Type', 'image/png')
        res.setHeader('Cache-Control', 'public, max-age=86400')
        res.send(await readFile(cached))
        return
      }
      const book = library.db
        .prepare('SELECT file_path, encrypted, unlocked_at, page_count FROM books WHERE id = ?')
        .get(id) as
        | {
            file_path: string
            encrypted: number
            unlocked_at: string | null
            page_count: number | null
          }
        | undefined
      if (!book || !existsSync(book.file_path)) {
        res.status(404).end()
        return
      }
      if (book.page_count !== null && page > book.page_count) {
        res.status(404).end()
        return
      }
      if (book.encrypted === 1 && !book.unlocked_at) {
        res.status(404).end()
        return
      }
      const buffer = await renderThumbnail(book.file_path, page)
      await mkdir(dirname(cached), { recursive: true })
      await writeFile(cached, buffer)
      res.setHeader('Content-Type', 'image/png')
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(buffer)
    } catch {
      res.status(404).end()
    }
  })

  app.get('/api/media/art/:name', async (req: Request, res: Response) => {
    try {
      const rel = decodeURIComponent(String(req.params.name))
      const fullPath = normalize(join(musicArtRoot(), rel))
      if (!inside(musicArtRoot(), fullPath) || !existsSync(fullPath)) {
        res.status(404).end()
        return
      }
      res.sendFile(fullPath)
    } catch {
      res.status(404).end()
    }
  })

  app.get('/api/media/audio/:encoded', async (req: Request, res: Response) => {
    try {
      const decoded = Buffer.from(String(req.params.encoded), 'base64url').toString('utf8')
      if (!isInsideMusicFolders(decoded) || !existsSync(decoded)) {
        res.status(404).end()
        return
      }
      res.sendFile(decoded)
    } catch {
      res.status(404).end()
    }
  })

  const distDir = resolve(ROOT_DIR, 'dist')
  const isProd = process.env.NODE_ENV === 'production' && existsSync(join(distDir, 'index.html'))

  if (isProd) {
    app.use(express.static(distDir))
    app.get('*', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'))
    })
  } else {
    const vite = await createViteServer({
      configFile: resolve(ROOT_DIR, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa'
    })
    app.use(vite.middlewares)
  }

  app.listen(PORT, HOST, () => {
    console.log(`Alexandria server listening on http://${HOST}:${PORT}`)
  })
}

void startServer()
