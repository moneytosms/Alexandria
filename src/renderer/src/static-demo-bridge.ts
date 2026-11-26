import type { AlexandriaApi, LibraryInfo } from '@shared/api'
import type {
  Annotation,
  AnnotationPatch,
  Book,
  BookDetails,
  ContainerCreateInput,
  ContainerDeleteInput,
  ContainerUpdateInput,
  DeskBooks,
  Floor,
  ImportBatchResult,
  ImportProgress,
  ImportScanResult,
  NewAnnotation,
  SearchHit,
  Tag
} from '@shared/types'
import {
  clearVault,
  deleteVaultEntry,
  listVaultPdfIds,
  loadAllVaultCovers,
  loadVaultPdf,
  saveVaultCover,
  saveVaultPdf
} from './demo-vault'
import {
  SAMPLE_FOLIOS,
  generateSampleCoverDataUrl,
  generateSamplePdf
} from './sample-pdfs'

const STORAGE_KEY = 'alexandria-static-demo-v2'

interface DemoState {
  settings: Record<string, string>
  floors: Floor[]
  books: Book[]
  annotations: Annotation[]
  tags: Tag[]
  nextBookId: number
  nextAnnotationId: number
  nextContainerId: number
  nextTagId: number
}

const pdfBuffers = new Map<number, Uint8Array>()
const coverDataUrls = new Map<number, string>()
const stagedFiles = new Map<string, File>()
let stagedCounter = 0
let demoBridgeActive = false

export function isDemoBridgeActive(): boolean {
  return demoBridgeActive
}

function estimatePdfPageCount(bytes: Uint8Array): number {
  try {
    const sample = new TextDecoder('latin1').decode(bytes)
    const matches = sample.match(/\/Type\s*\/Page\b(?!s)/g)
    if (matches && matches.length > 0) return matches.length
  } catch {
    // Fallback to null-safe 1
  }
  return 1
}

function seedInitialData(): DemoState {
  const now = new Date().toISOString()

  const floors: Floor[] = [
    {
      id: 1,
      name: 'Ground Floor',
      sortIndex: 0,
      rooms: [
        {
          id: 10,
          floorId: 1,
          name: 'Grand Hall',
          sortIndex: 0,
          sections: [
            {
              id: 100,
              roomId: 10,
              name: 'Astronomy & Geometry',
              wall: 'north',
              sortIndex: 0,
              bays: [
                {
                  id: 1000,
                  sectionId: 100,
                  sortIndex: 0,
                  autoCreated: false,
                  shelves: [
                    {
                      id: 10001,
                      bayId: 1000,
                      label: 'Celestial Treatises',
                      rowIndex: 0,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 2
                    },
                    {
                      id: 10002,
                      bayId: 1000,
                      label: 'Archival Scrolls',
                      rowIndex: 1,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 2
                    }
                  ]
                }
              ]
            },
            {
              id: 101,
              roomId: 10,
              name: 'Philosophy & Stars',
              wall: 'east',
              sortIndex: 1,
              bays: [
                {
                  id: 1001,
                  sectionId: 101,
                  sortIndex: 0,
                  autoCreated: false,
                  shelves: [
                    {
                      id: 10003,
                      bayId: 1001,
                      label: 'Star Catalogs',
                      rowIndex: 0,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 1
                    }
                  ]
                }
              ]
            },
            {
              id: 102,
              roomId: 10,
              name: 'Mathematics & Optics',
              wall: 'west',
              sortIndex: 2,
              bays: [
                {
                  id: 1002,
                  sectionId: 102,
                  sortIndex: 0,
                  autoCreated: false,
                  shelves: [
                    {
                      id: 10004,
                      bayId: 1002,
                      label: 'Conic Studies',
                      rowIndex: 0,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 1
                    }
                  ]
                }
              ]
            },
            {
              id: 103,
              roomId: 10,
              name: 'Upper Gallery Reserve',
              wall: 'south',
              sortIndex: 3,
              bays: [
                {
                  id: 1003,
                  sectionId: 103,
                  sortIndex: 0,
                  autoCreated: false,
                  shelves: [
                    {
                      id: 10005,
                      bayId: 1003,
                      label: 'Harmonics & Focus',
                      rowIndex: 0,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 1
                    },
                    {
                      id: 10006,
                      bayId: 1003,
                      label: 'Rare Nook Vault',
                      rowIndex: 1,
                      capacity: 18,
                      sortMode: 'manual',
                      sortDir: 'asc',
                      bookCount: 1
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]

  const slotCounters = new Map<number, number>()
  const books: Book[] = SAMPLE_FOLIOS.map((spec) => {
    const bytes = generateSamplePdf(spec)
    pdfBuffers.set(spec.id, bytes)
    coverDataUrls.set(spec.id, generateSampleCoverDataUrl(spec))
    const slot = slotCounters.get(spec.shelfId) ?? 0
    slotCounters.set(spec.shelfId, slot + 1)

    return {
      id: spec.id,
      title: spec.title,
      author: spec.author,
      format: 'pdf',
      originalFormat: 'pdf',
      filePath: `demo://${spec.id}.pdf`,
      relPath: `books/${spec.id}.pdf`,
      storageMode: 'copy',
      sha256: `demo-sha256-${spec.id}`,
      fileSize: bytes.byteLength,
      pageCount: spec.pages.length,
      coverPath: `demo-cover://${spec.id}`,
      encrypted: false,
      shelfId: spec.shelfId,
      slotIndex: slot,
      readingState: spec.readingState ?? 'unread',
      deskPinned: Boolean(spec.deskPinned),
      lastPage: 1,
      lastScroll: 0,
      finishedAt: spec.readingState === 'finished' ? now : null,
      addedAt: now,
      lastOpenedAt: spec.readingState === 'reading' ? now : null,
      metadataJson: null,
      readerJson: null,
      unlockedAt: null,
      missing: false,
      tags: [...spec.tags]
    }
  })

  const tagCounts = new Map<string, number>()
  for (const book of books) {
    for (const tag of book.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const tags: Tag[] = Array.from(tagCounts.entries()).map(([name, count], i) => ({
    id: i + 1,
    name,
    count
  }))

  const annotations: Annotation[] = [
    {
      id: 1,
      bookId: 1,
      page: 1,
      type: 'highlight',
      color: 'amber',
      rects: [{ x: 0.105, y: 0.23, w: 0.56, h: 0.025 }],
      strokes: [],
      note: 'Core principle of the celestial meridian inside the Grand Hall.',
      createdAt: now,
      updatedAt: null
    }
  ]

  return {
    settings: {
      'import.destination': 'shelf',
      'import.storage': 'copy',
      'ui.quality': 'auto',
      'ui.reducedMotion': 'false',
      'sound.enabled': 'true',
      'sound.volume': '0.3',
      'music.folders': '[]',
      'hall.theme': 'dark-academia',
      'hall.mood': 'dusk',
      'welcome.dismissed': '1'
    },
    floors,
    books,
    annotations,
    tags,
    nextBookId: 20,
    nextAnnotationId: 10,
    nextContainerId: 20000,
    nextTagId: tags.length + 1
  }
}

function hydrateDemoState(): DemoState {
  const fresh = seedInitialData()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as Partial<DemoState>
    for (const spec of SAMPLE_FOLIOS) {
      if (!pdfBuffers.has(spec.id)) pdfBuffers.set(spec.id, generateSamplePdf(spec))
      if (!coverDataUrls.has(spec.id)) coverDataUrls.set(spec.id, generateSampleCoverDataUrl(spec))
    }
    const books = Array.isArray(parsed.books) && parsed.books.length > 0 ? parsed.books : fresh.books
    // Guarantee generated cover URLs exist immediately for uploaded books before IndexedDB finishes
    for (const book of books) {
      if (!coverDataUrls.has(book.id)) {
        coverDataUrls.set(
          book.id,
          generateSampleCoverDataUrl({
            title: book.title,
            author: book.author ?? 'Imported Volume',
            accent: '#C8A25B',
            spineColor: '#2a221b'
          })
        )
      }
    }
    return {
      settings: { ...fresh.settings, ...(parsed.settings ?? {}) },
      floors: parsed.floors && parsed.floors.length > 0 ? parsed.floors : fresh.floors,
      books,
      annotations: parsed.annotations ?? fresh.annotations,
      tags: parsed.tags ?? fresh.tags,
      nextBookId: Math.max(parsed.nextBookId ?? 20, 20),
      nextAnnotationId: Math.max(parsed.nextAnnotationId ?? 10, 10),
      nextContainerId: Math.max(parsed.nextContainerId ?? 20000, 20000),
      nextTagId: Math.max(parsed.nextTagId ?? 20, 20)
    }
  } catch {
    return fresh
  }
}

function persistDemoState(state: DemoState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage quota errors in sandboxed iframes
  }
}

function recomputeShelfCounts(state: DemoState): void {
  const counts = new Map<number, number>()
  for (const book of state.books) {
    if (book.shelfId !== null) {
      counts.set(book.shelfId, (counts.get(book.shelfId) ?? 0) + 1)
    }
  }
  for (const floor of state.floors) {
    for (const room of floor.rooms) {
      for (const section of room.sections) {
        for (const bay of section.bays) {
          for (const shelf of bay.shelves) {
            shelf.bookCount = counts.get(shelf.id) ?? 0
          }
        }
      }
    }
  }
}

function recomputeTags(state: DemoState): void {
  const counts = new Map<string, number>()
  for (const book of state.books) {
    for (const tag of book.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  const existingByName = new Map(state.tags.map((t) => [t.name, t]))
  const next: Tag[] = []
  for (const [name, count] of counts.entries()) {
    const existing = existingByName.get(name)
    next.push({ id: existing?.id ?? state.nextTagId++, name, count })
  }
  state.tags = next
}

function getAllShelves(floors: Floor[]) {
  return floors
    .flatMap((f) => f.rooms)
    .flatMap((r) => r.sections)
    .flatMap((s) => s.bays)
    .flatMap((b) => b.shelves)
}

function promptBrowserFiles(options: { accept?: string; multiple?: boolean }): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (options.accept) input.accept = options.accept
    if (options.multiple) input.multiple = true
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    document.body.appendChild(input)

    let settled = false
    const finish = (files: File[]): void => {
      if (settled) return
      settled = true
      input.remove()
      resolve(files)
    }
    input.addEventListener('change', () => finish(Array.from(input.files ?? [])))
    input.addEventListener('cancel', () => finish([]))
    input.click()
  })
}

export function getDemoCoverUrl(bookId: number): string {
  const existing = coverDataUrls.get(bookId)
  if (existing) return existing
  const spec = SAMPLE_FOLIOS.find((s) => s.id === bookId)
  if (spec) {
    const url = generateSampleCoverDataUrl(spec)
    coverDataUrls.set(bookId, url)
    return url
  }
  return generateSampleCoverDataUrl({
    title: 'Alexandria Volume',
    author: 'Imported Folio',
    accent: '#C8A25B',
    spineColor: '#2a221b'
  })
}

export async function resetStaticDemoLibrary(): Promise<void> {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
  await clearVault()
  pdfBuffers.clear()
  coverDataUrls.clear()
  window.location.reload()
}

export function createStaticDemoApi(): AlexandriaApi {
  demoBridgeActive = true
  const state = hydrateDemoState()
  const progressListeners = new Set<(progress: ImportProgress) => void>()

  // Hydrate persistent uploaded PDFs and covers asynchronously from IndexedDB vault
  const vaultReady: Promise<void> = (async () => {
    try {
      const [vaultIds, vaultCovers] = await Promise.all([
        listVaultPdfIds(),
        loadAllVaultCovers()
      ])
      for (const [id, dataUrl] of vaultCovers.entries()) {
        coverDataUrls.set(id, dataUrl)
      }
      // Prune stale uploaded entries only if their binary truly does not exist in IndexedDB
      const sampleIds = new Set(SAMPLE_FOLIOS.map((s) => s.id))
      const filtered = state.books.filter(
        (b) => sampleIds.has(b.id) || pdfBuffers.has(b.id) || vaultIds.has(b.id)
      )
      if (filtered.length !== state.books.length) {
        state.books = filtered
        recomputeShelfCounts(state)
        recomputeTags(state)
        persistDemoState(state)
      }
    } catch {
      // Non-fatal if IndexedDB is disabled in private mode
    }
  })()

  const getBookOrThrow = (id: number): Book => {
    const found = state.books.find((b) => b.id === id)
    if (!found) throw new Error('Book not found')
    return found
  }

  const stageFilesToScan = (files: File[]): ImportScanResult => {
    const candidates: ImportScanResult['candidates'] = []
    const rejected: ImportScanResult['rejected'] = []
    for (const file of files) {
      const lower = file.name.toLowerCase()
      if (!lower.endsWith('.pdf')) {
        rejected.push({
          path: file.name,
          name: file.name,
          reason: 'unsupported'
        })
        continue
      }
      stagedCounter += 1
      const key = `demo-upload://${stagedCounter}/${file.name}`
      stagedFiles.set(key, file)
      candidates.push({
        path: key,
        name: file.name,
        format: 'pdf',
        size: file.size,
        modifiedAt: new Date(file.lastModified || Date.now()).toISOString()
      })
    }
    return { candidates, rejected }
  }

  const isNativeAndroid =
    import.meta.env.VITE_ANDROID_APP === 'true' ||
    (typeof window !== 'undefined' &&
      Boolean(
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()
      ))

  return {
    ping: async () => 'pong',
    appInfo: async () => ({
      name: 'Alexandria',
      version: isNativeAndroid ? '1.0.0' : '1.0.0-web',
      electron: isNativeAndroid ? 'android-capacitor' : 'browser-pwa',
      chrome: typeof navigator !== 'undefined' ? navigator.userAgent : 'browser',
      node: isNativeAndroid ? 'android-webview' : 'browser',
      platform: isNativeAndroid ? 'Android (Capacitor)' : 'Web & PWA Edition'
    }),
    libraryInfo: async (): Promise<LibraryInfo> => {
      await vaultReady
      const shelves = getAllShelves(state.floors)
      const sections = state.floors.reduce(
        (acc, f) => acc + f.rooms.reduce((rAcc, r) => rAcc + r.sections.length, 0),
        0
      )
      return {
        name: isNativeAndroid ? 'Alexandria Vault' : 'Alexandria Interactive Hall',
        root: isNativeAndroid ? 'android://alexandria-vault' : 'browser://alexandria-vault',
        books: state.books.length,
        floors: state.floors.length,
        sections,
        shelves: shelves.length,
        slots: shelves.reduce((acc, s) => acc + s.capacity, 0)
      }
    },
    getSettings: async () => ({ ...state.settings }),
    setSetting: async (key, value) => {
      state.settings[key] = value
      persistDemoState(state)
    },
    log: async () => undefined,
    openExternal: async (url) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.click()
      }
    },

    pickImportFiles: async () => {
      const files = await promptBrowserFiles({ accept: '.pdf,application/pdf', multiple: true })
      return stageFilesToScan(files)
    },
    pickImportFolder: async () => {
      const files = await promptBrowserFiles({ accept: '.pdf,application/pdf', multiple: true })
      return stageFilesToScan(files)
    },
    scanImportPaths: async (paths) => {
      const files: File[] = []
      for (const path of paths) {
        const file = stagedFiles.get(path)
        if (file) files.push(file)
      }
      return stageFilesToScan(files)
    },
    importBooks: async (paths): Promise<ImportBatchResult> => {
      await vaultReady
      const outcomes: ImportBatchResult['outcomes'] = []
      let imported = 0
      let failed = 0
      const shelves = getAllShelves(state.floors)
      const destinationPref = state.settings['import.destination'] ?? 'shelf'
      const openShelf = shelves.find((s) => s.bookCount < s.capacity) ?? shelves[0] ?? null
      const defaultShelfId = destinationPref === 'inbox' ? null : (openShelf?.id ?? null)

      for (let i = 0; i < paths.length; i += 1) {
        const path = paths[i]
        const file = stagedFiles.get(path)
        const name = file?.name ?? path.split('/').pop() ?? 'document.pdf'
        for (const listener of progressListeners) {
          listener({ index: i + 1, total: paths.length, name, phase: 'reading' })
        }
        if (!file) {
          failed += 1
          outcomes.push({ path, name, status: 'failed', message: 'File unavailable in demo session' })
          continue
        }
        try {
          const bytes = new Uint8Array(await file.arrayBuffer())
          if (bytes.byteLength < 8) {
            throw new Error('Selected file is empty or unreadable')
          }
          const id = state.nextBookId++
          const pageCount = estimatePdfPageCount(bytes)
          const title = name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled Folio'
          const coverUrl = generateSampleCoverDataUrl({
            title,
            author: 'Uploaded Folio',
            accent: '#C8A25B',
            spineColor: '#2a221b'
          })

          pdfBuffers.set(id, bytes)
          coverDataUrls.set(id, coverUrl)
          await Promise.all([saveVaultPdf(id, bytes), saveVaultCover(id, coverUrl)])

          const now = new Date().toISOString()
          const book: Book = {
            id,
            title,
            author: 'Local Upload',
            format: 'pdf',
            originalFormat: 'pdf',
            filePath: path,
            relPath: `books/${id}.pdf`,
            storageMode: 'copy',
            sha256: `demo-upload-${id}-${bytes.byteLength}`,
            fileSize: bytes.byteLength,
            pageCount,
            coverPath: `demo-cover://${id}`,
            encrypted: false,
            shelfId: defaultShelfId,
            slotIndex:
              defaultShelfId !== null
                ? state.books.filter((b) => b.shelfId === defaultShelfId).length
                : 0,
            readingState: 'unread',
            deskPinned: false,
            lastPage: 1,
            lastScroll: 0,
            finishedAt: null,
            addedAt: now,
            lastOpenedAt: null,
            metadataJson: null,
            readerJson: null,
            unlockedAt: null,
            missing: false,
            tags: ['Imported']
          }
          state.books.push(book)
          recomputeShelfCounts(state)
          recomputeTags(state)
          persistDemoState(state)
          imported += 1
          outcomes.push({ path, name, status: 'imported', bookId: id })
        } catch (err) {
          failed += 1
          outcomes.push({
            path,
            name,
            status: 'failed',
            message: err instanceof Error ? err.message : 'Import failed'
          })
        }
      }
      return { outcomes, imported, duplicates: 0, failed }
    },
    cancelImport: async () => undefined,
    onImportProgress: (listener) => {
      progressListeners.add(listener)
      return () => {
        progressListeners.delete(listener)
      }
    },

    listBooks: async () => {
      await vaultReady
      return state.books.map((b) => ({ ...b, tags: [...b.tags] }))
    },
    getBook: async (id) => {
      await vaultReady
      const found = state.books.find((b) => b.id === id)
      return found ? { ...found, tags: [...found.tags] } : null
    },
    bookData: async (id) => {
      await vaultReady
      const inMem = pdfBuffers.get(id)
      if (inMem) return inMem.slice()

      const spec = SAMPLE_FOLIOS.find((s) => s.id === id)
      if (spec) {
        const generated = generateSamplePdf(spec)
        pdfBuffers.set(id, generated)
        return generated.slice()
      }

      const fromVault = await loadVaultPdf(id)
      if (fromVault) {
        pdfBuffers.set(id, fromVault)
        return fromVault.slice()
      }

      throw new Error('Book PDF not found in browser vault. Re-import the PDF to keep reading.')
    },
    updateBook: async (id, patch) => {
      const book = getBookOrThrow(id)
      if (patch.title !== undefined) book.title = patch.title
      if (patch.author !== undefined) book.author = patch.author
      if (patch.readerJson !== undefined) book.readerJson = patch.readerJson
      persistDemoState(state)
      return { ...book, tags: [...book.tags] }
    },
    removeBook: async (id) => {
      state.books = state.books.filter((b) => b.id !== id)
      state.annotations = state.annotations.filter((a) => a.bookId !== id)
      pdfBuffers.delete(id)
      coverDataUrls.delete(id)
      await deleteVaultEntry(id)
      recomputeShelfCounts(state)
      recomputeTags(state)
      persistDemoState(state)
    },
    relinkBook: async (id) => ({ ...getBookOrThrow(id) }),
    moveBook: async (id, shelfId) => {
      const book = getBookOrThrow(id)
      book.shelfId = shelfId
      book.slotIndex = state.books.filter((b) => b.shelfId === shelfId && b.id !== id).length
      recomputeShelfCounts(state)
      persistDemoState(state)
      return { ...book, tags: [...book.tags] }
    },
    unshelveBook: async (id) => {
      const book = getBookOrThrow(id)
      book.shelfId = null
      book.slotIndex = 0
      recomputeShelfCounts(state)
      persistDemoState(state)
      return { ...book, tags: [...book.tags] }
    },
    setBookPinned: async (id, pinned) => {
      const book = getBookOrThrow(id)
      book.deskPinned = pinned
      persistDemoState(state)
      return { ...book, tags: [...book.tags] }
    },
    setBookFinished: async (id, finished) => {
      const book = getBookOrThrow(id)
      book.readingState = finished ? 'finished' : 'reading'
      book.finishedAt = finished ? new Date().toISOString() : null
      persistDemoState(state)
      return { ...book, tags: [...book.tags] }
    },
    saveProgress: async (input) => {
      const book = state.books.find((b) => b.id === input.bookId)
      if (!book) return
      book.lastPage = Math.max(1, Math.round(input.page))
      book.lastScroll = Math.max(0, input.scroll)
      book.lastOpenedAt = new Date().toISOString()
      if (book.readingState === 'unread') book.readingState = 'reading'
      persistDemoState(state)
    },
    unlockBook: async (id) => ({ ...getBookOrThrow(id) }),
    bookDetails: async (id): Promise<BookDetails> => {
      await vaultReady
      const book = getBookOrThrow(id)
      const hasFile = pdfBuffers.has(id) || (await loadVaultPdf(id)) !== null
      return {
        book: { ...book, tags: [...book.tags] },
        annotationCount: state.annotations.filter((a) => a.bookId === id).length,
        tags: state.tags.filter((t) => book.tags.includes(t.name)),
        fileExists: hasFile
      }
    },
    setBookTags: async (id, tags) => {
      const book = getBookOrThrow(id)
      book.tags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)))
      recomputeTags(state)
      persistDemoState(state)
      return state.tags.filter((t) => book.tags.includes(t.name))
    },
    scanMissing: async () => ({ checked: state.books.length, missing: [] }),
    relinkMissing: async () => ({ matched: 0, stillMissing: 0 }),
    exportLibrary: async () => {
      const manifest = {
        format: 'alexandria-manifest',
        version: 1,
        exportedAt: new Date().toISOString(),
        books: state.books,
        annotations: state.annotations,
        tags: state.tags
      }
      try {
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `alexandria-catalogue-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch {
        // Ignore download restriction in headless environments
      }
      return {
        path: 'alexandria-catalogue.json',
        books: state.books.length,
        annotations: state.annotations.length
      }
    },
    libraryHealth: async () => ({
      database: 'ok (browser vault)',
      schemaVersion: 3,
      books: state.books.length,
      pages: state.books.reduce((acc, b) => acc + (b.pageCount ?? 0), 0),
      annotations: state.annotations.length,
      missing: 0,
      logFile: 'browser-indexeddb'
    }),
    reorderShelf: async (shelfId, orderedIds) => {
      orderedIds.forEach((bookId, idx) => {
        const book = state.books.find((b) => b.id === bookId && b.shelfId === shelfId)
        if (book) book.slotIndex = idx
      })
      persistDemoState(state)
    },
    deskBooks: async (): Promise<DeskBooks> => {
      await vaultReady
      return {
        reading: state.books.filter((b) => b.readingState === 'reading'),
        pinned: state.books.filter((b) => b.deskPinned),
        finished: state.books.filter((b) => b.readingState === 'finished')
      }
    },

    getLayout: async () => {
      await vaultReady
      return structuredClone(state.floors)
    },
    createContainer: async (input: ContainerCreateInput) => {
      const id = state.nextContainerId++
      if (input.kind === 'section') {
        const room =
          state.floors.flatMap((f) => f.rooms).find((r) => r.id === input.parentId) ??
          state.floors[0]?.rooms[0]
        if (room) {
          const bayId = state.nextContainerId++
          const shelfId = state.nextContainerId++
          room.sections.push({
            id,
            roomId: room.id,
            name: input.name || 'New Wing',
            wall: input.wall || 'west',
            sortIndex: room.sections.length,
            bays: [
              {
                id: bayId,
                sectionId: id,
                sortIndex: 0,
                autoCreated: false,
                shelves: [
                  {
                    id: shelfId,
                    bayId,
                    label: 'Shelf I',
                    rowIndex: 0,
                    capacity: 18,
                    sortMode: 'manual',
                    sortDir: 'asc',
                    bookCount: 0
                  }
                ]
              }
            ]
          })
        }
      } else if (input.kind === 'bay') {
        const section = state.floors
          .flatMap((f) => f.rooms)
          .flatMap((r) => r.sections)
          .find((s) => s.id === input.parentId)
        if (section) {
          const shelfId = state.nextContainerId++
          section.bays.push({
            id,
            sectionId: section.id,
            sortIndex: section.bays.length,
            autoCreated: false,
            shelves: [
              {
                id: shelfId,
                bayId: id,
                label: 'Shelf I',
                rowIndex: 0,
                capacity: 18,
                sortMode: 'manual',
                sortDir: 'asc',
                bookCount: 0
              }
            ]
          })
        }
      } else if (input.kind === 'shelf') {
        const bay = state.floors
          .flatMap((f) => f.rooms)
          .flatMap((r) => r.sections)
          .flatMap((s) => s.bays)
          .find((b) => b.id === input.parentId)
        if (bay) {
          bay.shelves.push({
            id,
            bayId: bay.id,
            label: input.name || `Shelf ${bay.shelves.length + 1}`,
            rowIndex: bay.shelves.length,
            capacity: 18,
            sortMode: 'manual',
            sortDir: 'asc',
            bookCount: 0
          })
        }
      }
      persistDemoState(state)
      return id
    },
    updateContainer: async (input: ContainerUpdateInput) => {
      for (const floor of state.floors) {
        if (input.kind === 'floor' && floor.id === input.id && input.name) floor.name = input.name
        for (const room of floor.rooms) {
          if (input.kind === 'room' && room.id === input.id && input.name) room.name = input.name
          for (const section of room.sections) {
            if (input.kind === 'section' && section.id === input.id) {
              if (input.name) section.name = input.name
              if (input.wall) section.wall = input.wall
            }
            for (const bay of section.bays) {
              for (const shelf of bay.shelves) {
                if (input.kind === 'shelf' && shelf.id === input.id) {
                  if (input.label !== undefined) shelf.label = input.label
                  if (input.capacity !== undefined) shelf.capacity = input.capacity
                  if (input.sortMode !== undefined) shelf.sortMode = input.sortMode
                  if (input.sortDir !== undefined) shelf.sortDir = input.sortDir
                }
              }
            }
          }
        }
      }
      persistDemoState(state)
    },
    deleteContainer: async (input: ContainerDeleteInput) => {
      if (input.kind === 'shelf') {
        for (const book of state.books) {
          if (book.shelfId === input.id) book.shelfId = input.reassignShelfId ?? null
        }
        for (const floor of state.floors) {
          for (const room of floor.rooms) {
            for (const section of room.sections) {
              for (const bay of section.bays) {
                bay.shelves = bay.shelves.filter((s) => s.id !== input.id)
              }
            }
          }
        }
      }
      recomputeShelfCounts(state)
      persistDemoState(state)
    },
    undoGrowth: async () => false,
    resortShelf: async () => undefined,

    listAnnotations: async (bookId) =>
      state.annotations.filter((a) => a.bookId === bookId).map((a) => structuredClone(a)),
    createAnnotation: async (input: NewAnnotation) => {
      const created: Annotation = {
        id: state.nextAnnotationId++,
        bookId: input.bookId,
        page: input.page,
        type: input.type,
        color: input.color ?? null,
        rects: input.rects ? structuredClone(input.rects) : [],
        strokes: input.strokes ? structuredClone(input.strokes) : [],
        note: input.note ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: null
      }
      state.annotations.push(created)
      persistDemoState(state)
      return structuredClone(created)
    },
    updateAnnotation: async (id, patch: AnnotationPatch) => {
      const target = state.annotations.find((a) => a.id === id)
      if (!target) throw new Error('Annotation not found')
      if (patch.color !== undefined) target.color = patch.color
      if (patch.rects !== undefined) target.rects = structuredClone(patch.rects)
      if (patch.strokes !== undefined) target.strokes = structuredClone(patch.strokes)
      if (patch.note !== undefined) target.note = patch.note
      if (patch.page !== undefined) target.page = patch.page
      target.updatedAt = new Date().toISOString()
      persistDemoState(state)
      return structuredClone(target)
    },
    deleteAnnotation: async (id) => {
      state.annotations = state.annotations.filter((a) => a.id !== id)
      persistDemoState(state)
    },

    listTags: async () => state.tags.map((t) => ({ ...t })),
    createTag: async (name) => {
      const clean = name.trim()
      const existing = state.tags.find((t) => t.name.toLowerCase() === clean.toLowerCase())
      if (existing) return { ...existing }
      const tag: Tag = { id: state.nextTagId++, name: clean, count: 0 }
      state.tags.push(tag)
      persistDemoState(state)
      return { ...tag }
    },
    deleteTag: async (id) => {
      const target = state.tags.find((t) => t.id === id)
      if (target) {
        for (const book of state.books) {
          book.tags = book.tags.filter((t) => t !== target.name)
        }
      }
      state.tags = state.tags.filter((t) => t.id !== id)
      persistDemoState(state)
    },

    search: async (query) => {
      const started = performance.now()
      const q = query.trim().toLowerCase()
      const hits: SearchHit[] = []
      if (q) {
        for (const book of state.books) {
          if (
            book.title.toLowerCase().includes(q) ||
            (book.author ?? '').toLowerCase().includes(q)
          ) {
            hits.push({
              bookId: book.id,
              title: book.title,
              author: book.author,
              page: 1,
              snippet: `${book.title} · ${book.author ?? 'Unknown author'}`,
              kind: 'title'
            })
          }
          const spec = SAMPLE_FOLIOS.find((s) => s.id === book.id)
          if (spec) {
            spec.pages.forEach((page, idx) => {
              const haystack = `${page.heading} ${page.paragraphs.join(' ')}`
              const pos = haystack.toLowerCase().indexOf(q)
              if (pos !== -1) {
                const start = Math.max(0, pos - 40)
                const end = Math.min(haystack.length, pos + 90)
                hits.push({
                  bookId: book.id,
                  title: book.title,
                  author: book.author,
                  page: idx + 1,
                  snippet: haystack.slice(start, end),
                  kind: 'text'
                })
              }
            })
          }
        }
        for (const ann of state.annotations) {
          if (ann.note && ann.note.toLowerCase().includes(q)) {
            const book = state.books.find((b) => b.id === ann.bookId)
            if (book) {
              hits.push({
                bookId: book.id,
                title: book.title,
                author: book.author,
                page: ann.page,
                snippet: ann.note,
                kind: 'annotation'
              })
            }
          }
        }
      }
      return {
        query,
        hits: hits.slice(0, 60),
        total: hits.length,
        tookMs: Math.round(performance.now() - started),
        truncated: hits.length > 60
      }
    },
    searchInBook: async (bookId, query) => {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const book = state.books.find((b) => b.id === bookId)
      const spec = SAMPLE_FOLIOS.find((s) => s.id === bookId)
      if (!book || !spec) return []
      const hits: SearchHit[] = []
      spec.pages.forEach((page, idx) => {
        const text = `${page.heading} ${page.paragraphs.join(' ')}`
        const pos = text.toLowerCase().indexOf(q)
        if (pos !== -1) {
          hits.push({
            bookId,
            title: book.title,
            author: book.author,
            page: idx + 1,
            snippet: text.slice(Math.max(0, pos - 35), Math.min(text.length, pos + 85)),
            kind: 'text'
          })
        }
      })
      return hits
    },

    pickMusicFolders: async () => [],
    scanMusic: async () => ({
      tracks: [],
      unreadable: [],
      folders: [],
      scannedAt: new Date().toISOString()
    }),
    musicFolders: async () => [],

    pathForFile: (file) => {
      stagedCounter += 1
      const key = `demo-upload://${stagedCounter}/${file.name}`
      stagedFiles.set(key, file)
      return key
    }
  }
}
