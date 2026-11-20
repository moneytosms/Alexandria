import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { closeLibrary, openLibrary } from './service'
import { getSetting } from './settings'

let dirs: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'alexandria-library-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  closeLibrary()
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('library service', () => {
  it('creates the folder tree, config, schema, and default layout', () => {
    const root = tempDir()
    const library = openLibrary(root)

    expect(existsSync(library.paths.database)).toBe(true)
    expect(existsSync(library.paths.books)).toBe(true)
    expect(existsSync(library.paths.covers)).toBe(true)
    expect(existsSync(library.paths.thumbs)).toBe(true)
    expect(existsSync(library.paths.cache)).toBe(true)
    expect(existsSync(library.paths.logs)).toBe(true)
    expect(existsSync(library.paths.config)).toBe(true)

    const config = JSON.parse(readFileSync(library.paths.config, 'utf8')) as { name: string }
    expect(config.name).toBe('Alexandria')

    const floors = library.db.prepare('SELECT COUNT(*) AS n FROM floors').get() as { n: number }
    const bays = library.db.prepare('SELECT COUNT(*) AS n FROM bays').get() as { n: number }
    const shelves = library.db.prepare('SELECT COUNT(*) AS n FROM shelves').get() as { n: number }

    expect(floors.n).toBe(1)
    expect(bays.n).toBe(4)
    expect(shelves.n).toBe(20)
    expect(getSetting(library.db, 'import.storage')).toBe('copy')
  })

  it('does not duplicate the layout when reopened', () => {
    const root = tempDir()

    openLibrary(root)
    closeLibrary()

    const reopened = openLibrary(root)
    const floors = reopened.db.prepare('SELECT COUNT(*) AS n FROM floors').get() as { n: number }

    expect(floors.n).toBe(1)
  })
})
