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
  MusicScanResult,
  NewAnnotation,
  ReadingProgressInput,
  SearchHit,
  SearchResponse,
  Tag
} from './types'

export interface LibraryInfo {
  root: string
  name: string
  books: number
  floors: number
  sections: number
  shelves: number
  slots: number
}

export interface AppInfo {
  name: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface MissingScanResult {
  checked: number
  missing: number[]
}

export interface RelinkMissingResult {
  matched: number
  stillMissing: number
}

export interface LibraryHealth {
  database: string
  schemaVersion: number
  books: number
  pages: number
  annotations: number
  missing: number
  logFile: string
}

export interface ExportResult {
  path: string | null
  books: number
  annotations: number
}

export interface AlexandriaApi {
  ping: () => Promise<string>
  appInfo: () => Promise<AppInfo>
  libraryInfo: () => Promise<LibraryInfo>
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>
  log: (level: LogLevel, message: string, detail?: string) => Promise<void>
  openExternal: (url: string) => Promise<void>

  pickImportFiles: () => Promise<ImportScanResult>
  pickImportFolder: () => Promise<ImportScanResult>
  scanImportPaths: (paths: string[]) => Promise<ImportScanResult>
  importBooks: (paths: string[]) => Promise<ImportBatchResult>
  cancelImport: () => Promise<void>
  onImportProgress: (listener: (progress: ImportProgress) => void) => () => void

  listBooks: () => Promise<Book[]>
  getBook: (id: number) => Promise<Book | null>
  bookData: (id: number) => Promise<Uint8Array>
  updateBook: (id: number, patch: { title?: string; author?: string | null; readerJson?: string | null }) => Promise<Book>
  removeBook: (id: number, deleteFile: boolean) => Promise<void>
  relinkBook: (id: number) => Promise<Book>
  moveBook: (id: number, shelfId: number) => Promise<Book>
  unshelveBook: (id: number) => Promise<Book>
  setBookPinned: (id: number, pinned: boolean) => Promise<Book>
  setBookFinished: (id: number, finished: boolean) => Promise<Book>
  saveProgress: (input: ReadingProgressInput) => Promise<void>
  unlockBook: (id: number, password: string) => Promise<Book>
  bookDetails: (id: number) => Promise<BookDetails>
  setBookTags: (id: number, tags: string[]) => Promise<Tag[]>
  scanMissing: () => Promise<MissingScanResult>
  relinkMissing: () => Promise<RelinkMissingResult>
  exportLibrary: () => Promise<ExportResult>
  libraryHealth: () => Promise<LibraryHealth>
  reorderShelf: (shelfId: number, orderedIds: number[]) => Promise<void>
  deskBooks: () => Promise<DeskBooks>

  getLayout: () => Promise<Floor[]>
  createContainer: (input: ContainerCreateInput) => Promise<number>
  updateContainer: (input: ContainerUpdateInput) => Promise<void>
  deleteContainer: (input: ContainerDeleteInput) => Promise<void>
  undoGrowth: () => Promise<boolean>
  resortShelf: (shelfId: number) => Promise<void>

  listAnnotations: (bookId: number) => Promise<Annotation[]>
  createAnnotation: (input: NewAnnotation) => Promise<Annotation>
  updateAnnotation: (id: number, patch: AnnotationPatch) => Promise<Annotation>
  deleteAnnotation: (id: number) => Promise<void>

  listTags: () => Promise<Tag[]>
  createTag: (name: string) => Promise<Tag>
  deleteTag: (id: number) => Promise<void>

  search: (query: string) => Promise<SearchResponse>
  searchInBook: (bookId: number, query: string) => Promise<SearchHit[]>

  pickMusicFolders: () => Promise<string[]>
  scanMusic: () => Promise<MusicScanResult>
  musicFolders: () => Promise<string[]>

  pathForFile: (file: File) => string
}
