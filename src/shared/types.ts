export type StorageMode = 'copy' | 'link'

export type ReadingState = 'unread' | 'reading' | 'finished'

export type ImportFormat = 'pdf' | 'pptx' | 'ppt' | 'docx' | 'doc' | 'odp' | 'odt'

export interface ImportCandidate {
  path: string
  name: string
  format: ImportFormat
  size: number
  modifiedAt: string
}

export type ImportRejectionReason = 'unsupported' | 'unreadable'

export interface ImportRejection {
  path: string
  name: string
  reason: ImportRejectionReason
}

export interface ImportScanResult {
  candidates: ImportCandidate[]
  rejected: ImportRejection[]
}

export interface Book {
  id: number
  title: string
  author: string | null
  format: string
  originalFormat: string | null
  filePath: string
  relPath: string | null
  storageMode: StorageMode
  sha256: string
  fileSize: number | null
  pageCount: number | null
  coverPath: string | null
  encrypted: boolean
  shelfId: number | null
  slotIndex: number
  readingState: ReadingState
  deskPinned: boolean
  lastPage: number
  lastScroll: number
  finishedAt: string | null
  addedAt: string
  lastOpenedAt: string | null
  metadataJson: string | null
  readerJson: string | null
  unlockedAt: string | null
  missing: boolean
  tags: string[]
}

export type ImportOutcomeStatus = 'imported' | 'duplicate' | 'failed'

export interface ImportOutcome {
  path: string
  name: string
  status: ImportOutcomeStatus
  bookId?: number
  message?: string
}

export interface ImportBatchResult {
  outcomes: ImportOutcome[]
  imported: number
  duplicates: number
  failed: number
}

export type ImportPhase = 'queued' | 'converting' | 'reading' | 'indexing'

export interface ImportProgress {
  index: number
  total: number
  name: string
  phase: ImportPhase
  current?: number
  pages?: number
}

export interface NewBook {
  title: string
  author?: string | null
  format?: string
  originalFormat?: string | null
  filePath: string
  relPath?: string | null
  storageMode: StorageMode
  sha256: string
  fileSize?: number | null
  pageCount?: number | null
  coverPath?: string | null
  encrypted?: boolean
  shelfId?: number | null
  metadataJson?: string | null
}

/* Layout */

export type Wall = 'north' | 'east' | 'south' | 'west'

export type SortMode = 'manual' | 'title' | 'author' | 'added' | 'read' | 'format'

export type SortDirection = 'asc' | 'desc'

export interface Shelf {
  id: number
  bayId: number
  label: string | null
  rowIndex: number
  capacity: number
  sortMode: SortMode
  sortDir: SortDirection
  bookCount: number
}

export interface Bay {
  id: number
  sectionId: number
  sortIndex: number
  autoCreated: boolean
  shelves: Shelf[]
}

export interface Section {
  id: number
  roomId: number
  name: string
  wall: Wall
  sortIndex: number
  bays: Bay[]
}

export interface Room {
  id: number
  floorId: number
  name: string
  sortIndex: number
  sections: Section[]
}

export interface Floor {
  id: number
  name: string
  sortIndex: number
  rooms: Room[]
}

export interface LayoutTree {
  floors: Floor[]
}

export type ContainerKind = 'floor' | 'room' | 'section' | 'bay' | 'shelf'

export interface ContainerCreateInput {
  kind: ContainerKind
  parentId: number | null
  name?: string
  wall?: Wall
}

export interface ContainerUpdateInput {
  kind: ContainerKind
  id: number
  name?: string
  label?: string | null
  wall?: Wall
  capacity?: number
  sortMode?: SortMode
  sortDir?: SortDirection
}

export interface ContainerDeleteInput {
  kind: ContainerKind
  id: number
  reassignShelfId?: number | null
}

export interface GrowthResult {
  shelfId: number | null
  bayId: number | null
  sectionId: number | null
  roomId: number | null
  floorId: number | null
}

/* Annotations */

export type AnnotationType = 'highlight' | 'note' | 'ink' | 'bookmark'

export interface NormalizedRect {
  x: number
  y: number
  w: number
  h: number
}

export interface InkPoint {
  x: number
  y: number
  pressure: number
}

export interface Annotation {
  id: number
  bookId: number
  page: number
  type: AnnotationType
  color: string | null
  rects: NormalizedRect[]
  strokes: InkPoint[][]
  note: string | null
  createdAt: string
  updatedAt: string | null
}

export interface NewAnnotation {
  bookId: number
  page: number
  type: AnnotationType
  color?: string | null
  rects?: NormalizedRect[]
  strokes?: InkPoint[][]
  note?: string | null
}

export interface AnnotationPatch {
  color?: string | null
  rects?: NormalizedRect[]
  strokes?: InkPoint[][]
  note?: string | null
  page?: number
}

/* Search */

export type SearchHitKind = 'title' | 'text' | 'annotation'

export interface SearchHit {
  bookId: number
  title: string
  author: string | null
  page: number
  snippet: string
  kind: SearchHitKind
}

export interface SearchResponse {
  query: string
  hits: SearchHit[]
  total: number
  tookMs: number
  truncated: boolean
}

/* Details, tags, desk */

export interface BookDetails {
  book: Book
  annotationCount: number
  tags: Tag[]
  fileExists: boolean
}

export interface Tag {
  id: number
  name: string
  count: number
}

export interface DeskBooks {
  reading: Book[]
  pinned: Book[]
  finished: Book[]
}

/* Music */

export interface MusicTrack {
  id: number
  path: string
  title: string
  artist: string | null
  album: string | null
  duration: number | null
  artPath: string | null
  folder: string
}

export interface MusicScanResult {
  tracks: MusicTrack[]
  unreadable: string[]
  folders: string[]
  scannedAt: string
}

/* Reader */

export interface ReaderSettings {
  mode: 'page' | 'continuous'
  spread: boolean
  fit: 'width' | 'page' | 'custom'
  zoom: number
  rotation: 0 | 90 | 180 | 270
  theme: 'paper' | 'sepia' | 'charcoal'
  dim: number
  sidebar: boolean
  sidebarWidth: number
}

export interface ReadingProgressInput {
  bookId: number
  page: number
  scroll: number
}
