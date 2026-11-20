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
