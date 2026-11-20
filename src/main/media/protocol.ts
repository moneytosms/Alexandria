import { net, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { renderThumbnail } from '../pdf/inspect'
import { getLibrary } from '../library/service'
import { isInsideMusicFolders, musicArtRoot } from '../music/scan'

export const MEDIA_SCHEME = 'alexandria'

/**
 * Must run before the app is ready: registers the scheme used for covers,
 * thumbnails, music artwork, and audio playback in the sandboxed renderer.
 */
export function registerMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true
      }
    }
  ])
}

function notFound(): Response {
  return new Response('Not found', { status: 404 })
}

function image(buffer: Buffer): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=86400'
    }
  })
}

function inside(root: string, candidate: string): boolean {
  const base = resolve(root)
  const target = resolve(candidate)
  return target === base || target.startsWith(`${base}${sep}`)
}

async function serveFile(path: string, request: Request): Promise<Response> {
  if (!existsSync(path)) return notFound()

  const response = await net.fetch(pathToFileURL(path).toString(), {
    headers: request.headers
  })

  return response
}

async function coverResponse(id: number): Promise<Response> {
  const book = getLibrary()
    .db.prepare('SELECT cover_path FROM books WHERE id = ?')
    .get(id) as { cover_path: string | null } | undefined

  if (!book?.cover_path) return notFound()

  const path = join(getLibrary().root, book.cover_path)
  if (!inside(getLibrary().root, path) || !existsSync(path)) return notFound()

  const data = await readFile(path)
  return new Response(new Uint8Array(data), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' }
  })
}

async function thumbResponse(id: number, page: number): Promise<Response> {
  if (!Number.isInteger(page) || page < 1) return notFound()

  const library = getLibrary()
  const cached = join(library.paths.thumbs, `${id}-${page}.png`)
  if (existsSync(cached)) return image(await readFile(cached))

  const book = library.db
    .prepare('SELECT file_path, encrypted, unlocked_at, page_count FROM books WHERE id = ?')
    .get(id) as
    | { file_path: string; encrypted: number; unlocked_at: string | null; page_count: number | null }
    | undefined

  if (!book || !existsSync(book.file_path)) return notFound()
  if (book.page_count !== null && page > book.page_count) return notFound()
  if (book.encrypted === 1 && !book.unlocked_at) return notFound()

  try {
    const buffer = await renderThumbnail(book.file_path, page)
    await mkdir(dirname(cached), { recursive: true })
    await writeFile(cached, buffer)
    return image(buffer)
  } catch {
    return notFound()
  }
}

function audioResponse(url: URL, request: Request): Promise<Response> {
  const encoded = url.pathname.replace(/^\//, '')
  let path: string
  try {
    path = Buffer.from(encoded, 'base64url').toString('utf8')
  } catch {
    return Promise.resolve(notFound())
  }

  if (!isInsideMusicFolders(path)) return Promise.resolve(notFound())
  return serveFile(path, request)
}

export function installMediaProtocol(): void {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    try {
      const url = new URL(request.url)

      switch (url.hostname) {
        case 'cover': {
          const id = Number(url.pathname.replace(/^\//, ''))
          return Number.isInteger(id) ? await coverResponse(id) : notFound()
        }
        case 'thumb': {
          const [rawId, rawPage] = url.pathname.replace(/^\//, '').split('/')
          const id = Number(rawId)
          const page = Number(rawPage)
          return Number.isInteger(id) && Number.isInteger(page)
            ? await thumbResponse(id, page)
            : notFound()
        }
        case 'asset': {
          const relative = decodeURIComponent(url.pathname.replace(/^\//, ''))
          const path = normalize(join(getLibrary().root, relative))
          if (!inside(getLibrary().root, path)) return notFound()
          return await serveFile(path, request)
        }
        case 'art': {
          const relative = decodeURIComponent(url.pathname.replace(/^\//, ''))
          const path = normalize(join(musicArtRoot(), relative))
          if (!inside(musicArtRoot(), path)) return notFound()
          return await serveFile(path, request)
        }
        case 'audio':
          return await audioResponse(url, request)
        default:
          return notFound()
      }
    } catch {
      return notFound()
    }
  })
}

export function coverUrl(bookId: number): string {
  return `${MEDIA_SCHEME}://cover/${bookId}`
}

export function thumbUrl(bookId: number, page: number): string {
  return `${MEDIA_SCHEME}://thumb/${bookId}/${page}`
}

export function assetUrl(relative: string): string {
  return `${MEDIA_SCHEME}://asset/${relative.split('/').map(encodeURIComponent).join('/')}`
}

export function artUrl(path: string): string {
  const root = musicArtRoot()
  const relative = path.startsWith(root) ? path.slice(root.length + 1) : path
  return `${MEDIA_SCHEME}://art/${encodeURIComponent(relative)}`
}

export function audioUrl(path: string): string {
  return `${MEDIA_SCHEME}://audio/${Buffer.from(path, 'utf8').toString('base64url')}`
}
