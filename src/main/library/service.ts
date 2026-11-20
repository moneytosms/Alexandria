import { mkdirSync } from 'node:fs'
import type { DatabaseSync } from 'node:sqlite'
import { closeDatabase, openDatabase } from '../db'
import { readLibraryConfig, writeLibraryConfig, type LibraryConfig } from './config'
import { libraryPaths, type LibraryPaths } from './paths'
import { seedLibraryLayout } from './seed'
import { seedDefaultSettings } from './settings'

export interface Library {
  root: string
  paths: LibraryPaths
  config: LibraryConfig
  db: DatabaseSync
}

let current: Library | null = null

export function openLibrary(root: string): Library {
  if (current) return current

  const paths = libraryPaths(root)

  for (const dir of [
    paths.root,
    paths.books,
    paths.covers,
    paths.thumbs,
    paths.cache,
    paths.logs
  ]) {
    mkdirSync(dir, { recursive: true })
  }

  let config = readLibraryConfig(paths.config)
  if (!config) {
    config = {
      version: 1,
      name: 'Alexandria',
      createdAt: new Date().toISOString()
    }
    writeLibraryConfig(paths.config, config)
  }

  const db = openDatabase(paths.database)
  seedLibraryLayout(db)
  seedDefaultSettings(db)

  current = { root, paths, config, db }
  return current
}

export function getLibrary(): Library {
  if (!current) throw new Error('Library is not open')
  return current
}

export function closeLibrary(): void {
  if (!current) return
  closeDatabase(current.db)
  current = null
}
