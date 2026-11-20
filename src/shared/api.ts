export interface LibraryInfo {
  root: string
  name: string
  books: number
  floors: number
  shelves: number
}

export interface AlexandriaApi {
  ping: () => Promise<string>
  libraryInfo: () => Promise<LibraryInfo>
  getSettings: () => Promise<Record<string, string>>
  setSetting: (key: string, value: string) => Promise<void>
}
