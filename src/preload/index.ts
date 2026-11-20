import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AlexandriaApi } from '../shared/api'
import { EVENT, IPC } from '../shared/ipc'
import type { ImportProgress } from '../shared/types'

const api: AlexandriaApi = {
  ping: () => ipcRenderer.invoke(IPC.appPing),
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  libraryInfo: () => ipcRenderer.invoke(IPC.libraryInfo),
  getSettings: () => ipcRenderer.invoke(IPC.settingsGet),
  setSetting: (key, value) => ipcRenderer.invoke(IPC.settingsSet, key, value),
  log: (level, message, detail) => ipcRenderer.invoke(IPC.logWrite, level, message, detail),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),

  pickImportFiles: () => ipcRenderer.invoke(IPC.importPickFiles),
  pickImportFolder: () => ipcRenderer.invoke(IPC.importPickFolder),
  scanImportPaths: (paths) => ipcRenderer.invoke(IPC.importScanPaths, paths),
  importBooks: (paths) => ipcRenderer.invoke(IPC.importRun, paths),
  cancelImport: () => ipcRenderer.invoke(IPC.importCancel),
  onImportProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: ImportProgress): void => {
      listener(progress)
    }
    ipcRenderer.on(EVENT.importProgress, handler)
    return () => ipcRenderer.removeListener(EVENT.importProgress, handler)
  },

  listBooks: () => ipcRenderer.invoke(IPC.booksList),
  getBook: (id) => ipcRenderer.invoke(IPC.booksGet, id),
  bookData: (id) => ipcRenderer.invoke(IPC.booksData, id),
  updateBook: (id, patch) => ipcRenderer.invoke(IPC.booksUpdate, id, patch),
  removeBook: (id, deleteFile) => ipcRenderer.invoke(IPC.booksRemove, id, deleteFile),
  relinkBook: (id) => ipcRenderer.invoke(IPC.booksRelink, id),
  moveBook: (id, shelfId) => ipcRenderer.invoke(IPC.booksMove, id, shelfId),
  unshelveBook: (id) => ipcRenderer.invoke(IPC.booksUnshelve, id),
  setBookPinned: (id, pinned) => ipcRenderer.invoke(IPC.booksSetPinned, id, pinned),
  setBookFinished: (id, finished) => ipcRenderer.invoke(IPC.booksSetFinished, id, finished),
  saveProgress: (input) => ipcRenderer.invoke(IPC.booksProgress, input),
  unlockBook: (id, password) => ipcRenderer.invoke(IPC.booksUnlock, id, password),
  bookDetails: (id) => ipcRenderer.invoke(IPC.booksDetails, id),
  setBookTags: (id, tags) => ipcRenderer.invoke(IPC.booksSetTags, id, tags),
  scanMissing: () => ipcRenderer.invoke(IPC.booksScanMissing),
  relinkMissing: () => ipcRenderer.invoke(IPC.booksRelinkMissing),
  exportLibrary: () => ipcRenderer.invoke(IPC.libraryExport),
  libraryHealth: () => ipcRenderer.invoke(IPC.libraryHealth),
  reorderShelf: (shelfId, orderedIds) =>
    ipcRenderer.invoke(IPC.booksReorderShelf, shelfId, orderedIds),
  deskBooks: () => ipcRenderer.invoke(IPC.deskList),

  getLayout: () => ipcRenderer.invoke(IPC.containersList),
  createContainer: (input) => ipcRenderer.invoke(IPC.containersCreate, input),
  updateContainer: (input) => ipcRenderer.invoke(IPC.containersUpdate, input),
  deleteContainer: (input) => ipcRenderer.invoke(IPC.containersDelete, input),
  undoGrowth: () => ipcRenderer.invoke(IPC.containersUndoGrowth),
  resortShelf: (shelfId) => ipcRenderer.invoke(IPC.containersResort, shelfId),

  listAnnotations: (bookId) => ipcRenderer.invoke(IPC.annotationsList, bookId),
  createAnnotation: (input) => ipcRenderer.invoke(IPC.annotationsCreate, input),
  updateAnnotation: (id, patch) => ipcRenderer.invoke(IPC.annotationsUpdate, id, patch),
  deleteAnnotation: (id) => ipcRenderer.invoke(IPC.annotationsDelete, id),

  listTags: () => ipcRenderer.invoke(IPC.tagsList),
  createTag: (name) => ipcRenderer.invoke(IPC.tagsCreate, name),
  deleteTag: (id) => ipcRenderer.invoke(IPC.tagsDelete, id),

  search: (query) => ipcRenderer.invoke(IPC.searchGlobal, query),
  searchInBook: (bookId, query) => ipcRenderer.invoke(IPC.searchInBook, bookId, query),

  pickMusicFolders: () => ipcRenderer.invoke(IPC.musicPickFolders),
  scanMusic: () => ipcRenderer.invoke(IPC.musicScan),
  musicFolders: () => ipcRenderer.invoke(IPC.musicFolders),

  pathForFile: (file) => webUtils.getPathForFile(file)
}

contextBridge.exposeInMainWorld('alexandria', api)
