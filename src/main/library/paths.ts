import { join } from 'node:path'

export interface LibraryPaths {
  root: string
  database: string
  config: string
  books: string
  covers: string
  thumbs: string
  cache: string
  logs: string
}

export function libraryPaths(root: string): LibraryPaths {
  return {
    root,
    database: join(root, 'library.db'),
    config: join(root, 'config.json'),
    books: join(root, 'books'),
    covers: join(root, 'covers'),
    thumbs: join(root, 'thumbs'),
    cache: join(root, 'cache'),
    logs: join(root, 'logs')
  }
}
