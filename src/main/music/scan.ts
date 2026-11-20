import { createHash } from 'node:crypto'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
type ParseFile = typeof import('music-metadata')['parseFile']
import type { MusicScanResult, MusicTrack } from '../../shared/types'
import { getLibrary } from '../library/service'
import { getSetting } from '../library/settings'

let parserPromise: Promise<ParseFile> | null = null

function loadParser(): Promise<ParseFile> {
  parserPromise ??= import('music-metadata').then((module) => module.parseFile)
  return parserPromise
}

const audioExtensions = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.ogg',
  '.oga',
  '.opus',
  '.wav',
  '.webm'
])

export function musicFolders(): string[] {
  const raw = getSetting(getLibrary().db, 'music.folders') ?? '[]'
  try {
    const value = JSON.parse(raw) as unknown
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
      : []
  } catch {
    return []
  }
}

async function walk(root: string, found: string[], unreadable: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    unreadable.push(root)
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const path = join(root, entry.name)

    if (entry.isDirectory()) {
      await walk(path, found, unreadable)
    } else if (entry.isFile() && audioExtensions.has(extname(entry.name).toLowerCase())) {
      found.push(path)
    }
  }
}

function trackId(path: string): number {
  const digest = createHash('sha1').update(path).digest()
  return digest.readUInt32BE(0)
}

async function readTrack(path: string, artDir: string): Promise<MusicTrack> {
  const fallbackTitle = basename(path, extname(path))
  let title = fallbackTitle
  let artist: string | null = null
  let album: string | null = null
  let duration: number | null = null
  let artPath: string | null = null

  try {
    const parseFile = await loadParser()
    const parsed = await parseFile(path, { duration: true, skipCovers: false })
    title = parsed.common.title?.trim() || fallbackTitle
    artist = parsed.common.artist?.trim() || parsed.common.albumartist?.trim() || null
    album = parsed.common.album?.trim() || null
    duration = parsed.format.duration ?? null

    const picture = parsed.common.picture?.[0]
    if (picture && picture.data.length > 0) {
      const digest = createHash('sha1').update(path).digest('hex').slice(0, 16)
      const extension = picture.format.includes('png') ? 'png' : 'jpg'
      const file = join(artDir, `${digest}.${extension}`)
      await mkdir(artDir, { recursive: true })
      await writeFile(file, picture.data)
      artPath = file
    }
  } catch {
    const info = await stat(path).catch(() => null)
    if (!info) throw new Error('Unreadable track')
  }

  return {
    id: trackId(path),
    path,
    title,
    artist,
    album,
    duration,
    artPath,
    folder: dirname(path)
  }
}

export async function scanMusic(): Promise<MusicScanResult> {
  const folders = musicFolders()
  const files: string[] = []
  const unreadable: string[] = []

  for (const folder of folders) {
    await walk(folder, files, unreadable)
  }

  files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const library = getLibrary()
  const artDir = join(library.paths.cache, 'art')
  const tracks: MusicTrack[] = []

  // Parse a few files at a time so a large collection does not stall the main process.
  let cursor = 0
  const workers = Math.min(4, files.length)
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < files.length) {
        const index = cursor
        cursor += 1
        try {
          tracks[index] = await readTrack(files[index], artDir)
        } catch {
          unreadable.push(files[index])
        }
      }
    })
  )

  return {
    tracks: tracks.filter(Boolean),
    unreadable,
    folders,
    scannedAt: new Date().toISOString()
  }
}

export function isInsideMusicFolders(path: string): boolean {
  return musicFolders().some((folder) => path === folder || path.startsWith(`${folder}/`))
}

export function musicArtRoot(): string {
  return join(getLibrary().paths.cache, 'art')
}
