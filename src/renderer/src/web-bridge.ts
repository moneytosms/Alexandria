import type { AlexandriaApi } from '@shared/api'
import type { ImportProgress, ImportScanResult } from '@shared/types'
import { createStaticDemoApi } from './static-demo-bridge'

function isCapacitorNative(): boolean {
  if (import.meta.env.VITE_ANDROID_APP === 'true') return true
  if (typeof window === 'undefined') return false
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return Boolean(cap?.isNativePlatform?.())
}

const isStaticDemo =
  import.meta.env.VITE_STATIC_DEMO === 'true' ||
  isCapacitorNative() ||
  (typeof window !== 'undefined' && /^(\/[^/]+)?\/demo(\/|$)/.test(window.location.pathname))

const stagedFiles = new Map<string, File>()
let stagedCounter = 0

async function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
  const response = await fetch(`/api/rpc/${encodeURIComponent(method)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args })
  })
  const payload = (await response.json()) as { ok: boolean; result?: T; error?: string }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`)
  }
  return payload.result as T
}

async function uploadImportFile(file: File): Promise<string> {
  const response = await fetch('/api/import/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'x-filename': encodeURIComponent(file.name)
    },
    body: await file.arrayBuffer()
  })
  const payload = (await response.json()) as { ok: boolean; path?: string; error?: string }
  if (!response.ok || !payload.ok || !payload.path) {
    throw new Error(payload.error || 'Could not upload file for import')
  }
  return payload.path
}

function promptBrowserFiles(options: {
  accept?: string
  multiple?: boolean
  directory?: boolean
}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    if (options.accept) input.accept = options.accept
    if (options.multiple) input.multiple = true
    if (options.directory) {
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
    }
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

    input.addEventListener('change', () => {
      finish(Array.from(input.files ?? []))
    })
    input.addEventListener('cancel', () => finish([]))
    input.click()
  })
}

async function uploadAndScanFiles(files: File[]): Promise<ImportScanResult> {
  if (files.length === 0) return { candidates: [], rejected: [] }
  const uploadedPaths: string[] = []
  for (const file of files) {
    uploadedPaths.push(await uploadImportFile(file))
  }
  return rpc<ImportScanResult>('scanImportPaths', uploadedPaths)
}

export function installWebBridge(): void {
  if (typeof window === 'undefined' || window.alexandria) return

  if (isStaticDemo) {
    window.alexandria = createStaticDemoApi()
    return
  }

  const progressListeners = new Set<(progress: ImportProgress) => void>()

  const api: AlexandriaApi = {
    ping: () => rpc('ping'),
    appInfo: () => rpc('appInfo'),
    libraryInfo: () => rpc('libraryInfo'),
    getSettings: () => rpc('getSettings'),
    setSetting: (key, value) => rpc('setSetting', key, value),
    log: (level, message, detail) => rpc('log', level, message, detail),
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
      const files = await promptBrowserFiles({
        accept: '.pdf,.pptx,.ppt,.docx,.doc,.odp,.odt',
        multiple: true
      })
      return uploadAndScanFiles(files)
    },
    pickImportFolder: async () => {
      const files = await promptBrowserFiles({ multiple: true, directory: true })
      return uploadAndScanFiles(files)
    },
    scanImportPaths: async (paths) => {
      const resolved: string[] = []
      for (const path of paths) {
        const file = stagedFiles.get(path)
        if (file) {
          stagedFiles.delete(path)
          resolved.push(await uploadImportFile(file))
        } else {
          resolved.push(path)
        }
      }
      return rpc<ImportScanResult>('scanImportPaths', resolved)
    },
    importBooks: (paths) => rpc('importBooks', paths),
    cancelImport: () => rpc('cancelImport'),
    onImportProgress: (listener) => {
      progressListeners.add(listener)
      return () => {
        progressListeners.delete(listener)
      }
    },

    listBooks: () => rpc('listBooks'),
    getBook: (id) => rpc('getBook', id),
    bookData: async (id) => {
      const response = await fetch(`/api/books/${id}/data`)
      if (!response.ok) {
        throw new Error((await response.text()) || 'Could not load book data')
      }
      return new Uint8Array(await response.arrayBuffer())
    },
    updateBook: (id, patch) => rpc('updateBook', id, patch),
    removeBook: (id, deleteFile) => rpc('removeBook', id, deleteFile),
    relinkBook: (id) => rpc('relinkBook', id),
    moveBook: (id, shelfId) => rpc('moveBook', id, shelfId),
    unshelveBook: (id) => rpc('unshelveBook', id),
    setBookPinned: (id, pinned) => rpc('setBookPinned', id, pinned),
    setBookFinished: (id, finished) => rpc('setBookFinished', id, finished),
    saveProgress: (input) => rpc('saveProgress', input),
    unlockBook: (id, password) => rpc('unlockBook', id, password),
    bookDetails: (id) => rpc('bookDetails', id),
    setBookTags: (id, tags) => rpc('setBookTags', id, tags),
    scanMissing: () => rpc('scanMissing'),
    relinkMissing: () => rpc('relinkMissing'),
    exportLibrary: () => rpc('exportLibrary'),
    libraryHealth: () => rpc('libraryHealth'),
    reorderShelf: (shelfId, orderedIds) => rpc('reorderShelf', shelfId, orderedIds),
    deskBooks: () => rpc('deskBooks'),

    getLayout: () => rpc('getLayout'),
    createContainer: (input) => rpc('createContainer', input),
    updateContainer: (input) => rpc('updateContainer', input),
    deleteContainer: (input) => rpc('deleteContainer', input),
    undoGrowth: () => rpc('undoGrowth'),
    resortShelf: (shelfId) => rpc('resortShelf', shelfId),

    listAnnotations: (bookId) => rpc('listAnnotations', bookId),
    createAnnotation: (input) => rpc('createAnnotation', input),
    updateAnnotation: (id, patch) => rpc('updateAnnotation', id, patch),
    deleteAnnotation: (id) => rpc('deleteAnnotation', id),

    listTags: () => rpc('listTags'),
    createTag: (name) => rpc('createTag', name),
    deleteTag: (id) => rpc('deleteTag', id),

    search: (query) => rpc('search', query),
    searchInBook: (bookId, query) => rpc('searchInBook', bookId, query),

    pickMusicFolders: async () => {
      const files = await promptBrowserFiles({
        accept: '.mp3,.m4a,.aac,.flac,.ogg,.oga,.opus,.wav,.webm',
        multiple: true
      })
      let folders = await rpc<string[]>('musicFolders')
      for (const file of files) {
        const response = await fetch('/api/music/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-filename': encodeURIComponent(file.name)
          },
          body: await file.arrayBuffer()
        })
        const payload = (await response.json()) as { ok: boolean; folders?: string[] }
        if (payload.ok && payload.folders) folders = payload.folders
      }
      return folders
    },
    scanMusic: () => rpc('scanMusic'),
    musicFolders: () => rpc('musicFolders'),

    pathForFile: (file) => {
      stagedCounter += 1
      const key = `web-file://${stagedCounter}/${file.name}`
      stagedFiles.set(key, file)
      return key
    }
  }

  window.alexandria = api
}

installWebBridge()
