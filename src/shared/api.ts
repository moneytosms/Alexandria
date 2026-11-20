import type { ImportScanResult } from './types'

export interface LibraryInfo {
  root: string
  name: string
  books: number
  floors: number
  sections: number
  shelves: number
  slots: number
}

export type LogLevel = 'info' | 'warn' | 'error'

export interface AlexandriaApi {
  ping: () => Promise<string>
  libraryInfo: () => Promise<LibraryInfo>
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>
  log: (level: LogLevel, message: string, detail?: string) => Promise<void>
  pickImportFiles: () => Promise<ImportScanResult>
  pickImportFolder: () => Promise<ImportScanResult>
  scanImportPaths: (paths: string[]) => Promise<ImportScanResult>
  pathForFile: (file: File) => string
}
