/**
 * IndexedDB binary vault for Alexandria's interactive web demo.
 * Stores user-uploaded PDF byte buffers and generated cover data URLs across
 * page reloads, falling back transparently to in-memory storage if IndexedDB is blocked.
 */

const DB_NAME = 'alexandria-demo-vault-v1'
const DB_VERSION = 1
const PDF_STORE = 'pdfs'
const COVER_STORE = 'covers'

const memoryPdfs = new Map<number, Uint8Array>()
const memoryCovers = new Map<number, string>()

let dbPromise: Promise<IDBDatabase | null> | null = null

function openVaultDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(PDF_STORE)) {
          db.createObjectStore(PDF_STORE)
        }
        if (!db.objectStoreNames.contains(COVER_STORE)) {
          db.createObjectStore(COVER_STORE)
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

export async function saveVaultPdf(bookId: number, bytes: Uint8Array): Promise<void> {
  const copy = bytes.slice()
  memoryPdfs.set(bookId, copy)
  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(PDF_STORE, 'readwrite')
      tx.objectStore(PDF_STORE).put(copy, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function loadVaultPdf(bookId: number): Promise<Uint8Array | null> {
  const cached = memoryPdfs.get(bookId)
  if (cached) return cached.slice()

  const db = await openVaultDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PDF_STORE, 'readonly')
      const req = tx.objectStore(PDF_STORE).get(bookId)
      req.onsuccess = () => {
        const result = req.result
        if (result instanceof Uint8Array) {
          memoryPdfs.set(bookId, result)
          resolve(result.slice())
        } else if (result instanceof ArrayBuffer) {
          const arr = new Uint8Array(result)
          memoryPdfs.set(bookId, arr)
          resolve(arr.slice())
        } else {
          resolve(null)
        }
      }
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function saveVaultCover(bookId: number, dataUrl: string): Promise<void> {
  memoryCovers.set(bookId, dataUrl)
  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(COVER_STORE, 'readwrite')
      tx.objectStore(COVER_STORE).put(dataUrl, bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function loadAllVaultCovers(): Promise<Map<number, string>> {
  const out = new Map<number, string>(memoryCovers)
  const db = await openVaultDb()
  if (!db) return out
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(COVER_STORE, 'readonly')
      const store = tx.objectStore(COVER_STORE)
      const cursorReq = store.openCursor()
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result
        if (cursor) {
          const id = Number(cursor.key)
          if (Number.isInteger(id) && typeof cursor.value === 'string') {
            memoryCovers.set(id, cursor.value)
            out.set(id, cursor.value)
          }
          cursor.continue()
        } else {
          resolve(out)
        }
      }
      cursorReq.onerror = () => resolve(out)
    } catch {
      resolve(out)
    }
  })
}

export async function listVaultPdfIds(): Promise<Set<number>> {
  const ids = new Set<number>(memoryPdfs.keys())
  const db = await openVaultDb()
  if (!db) return ids
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(PDF_STORE, 'readonly')
      const req = tx.objectStore(PDF_STORE).getAllKeys()
      req.onsuccess = () => {
        for (const key of req.result ?? []) {
          const id = Number(key)
          if (Number.isInteger(id)) ids.add(id)
        }
        resolve(ids)
      }
      req.onerror = () => resolve(ids)
    } catch {
      resolve(ids)
    }
  })
}

export async function deleteVaultEntry(bookId: number): Promise<void> {
  memoryPdfs.delete(bookId)
  memoryCovers.delete(bookId)
  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([PDF_STORE, COVER_STORE], 'readwrite')
      tx.objectStore(PDF_STORE).delete(bookId)
      tx.objectStore(COVER_STORE).delete(bookId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export async function clearVault(): Promise<void> {
  memoryPdfs.clear()
  memoryCovers.clear()
  const db = await openVaultDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([PDF_STORE, COVER_STORE], 'readwrite')
      tx.objectStore(PDF_STORE).clear()
      tx.objectStore(COVER_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
