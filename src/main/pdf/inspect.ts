import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createCanvas } from '@napi-rs/canvas'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs')

const require = createRequire(typeof __filename !== 'undefined' ? __filename : import.meta.url)
const pdfjsRoot = dirname(require.resolve('pdfjs-dist/package.json'))
const standardFontDataUrl = join(pdfjsRoot, 'standard_fonts') + '/'
const cMapUrl = join(pdfjsRoot, 'cmaps') + '/'

let pdfjsPromise: Promise<PdfjsModule> | null = null

export function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import('pdfjs-dist/legacy/build/pdf.mjs')
  return pdfjsPromise
}

export class PdfLockedError extends Error {
  constructor() {
    super('This PDF is password protected')
    this.name = 'PdfLockedError'
  }
}

export interface PdfMetadata {
  title: string | null
  author: string | null
  info: Record<string, string>
}

export interface PageText {
  page: number
  text: string
}

export interface PdfInspection {
  pageCount: number
  metadata: PdfMetadata
  cover: Buffer | null
  pages: PageText[]
}

export interface InspectOptions {
  password?: string
  renderCover?: boolean
  extractText?: boolean
  onPage?: (done: number, total: number) => void
}

export async function withPdfDocument<T>(
  path: string,
  password: string | undefined,
  work: (document: PDFDocumentProxy) => Promise<T>
): Promise<T> {
  const pdfjs = await loadPdfjs()
  const task = pdfjs.getDocument({
    data: new Uint8Array(await readFile(path)),
    password,
    standardFontDataUrl,
    cMapUrl,
    cMapPacked: true,
    useWorkerFetch: false,
    disableFontFace: false
  } as Parameters<typeof pdfjs.getDocument>[0])

  let document: PDFDocumentProxy
  try {
    document = await task.promise
  } catch (error) {
    await task.destroy().catch(() => undefined)
    if (error instanceof Error && error.name === 'PasswordException') {
      throw new PdfLockedError()
    }
    throw error
  }

  try {
    return await work(document)
  } finally {
    await task.destroy().catch(() => undefined)
  }
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function readMetadata(document: PDFDocumentProxy): Promise<PdfMetadata> {
  const info: Record<string, string> = {}
  let title: string | null = null
  let author: string | null = null

  try {
    const meta = await document.getMetadata()
    const raw = meta.info as Record<string, unknown>

    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === 'string' && value.trim().length > 0) info[key] = value.trim()
    }

    title = clean(raw.Title) ?? clean(raw.title)
    author = clean(raw.Author) ?? clean(raw.author)

    if (meta.metadata) {
      title ??= clean(meta.metadata.get('dc:title'))
      const creators = meta.metadata.get('dc:creator')
      if (!author && Array.isArray(creators)) author = clean(creators[0])
      else if (!author && typeof creators === 'string') author = clean(creators)
    }
  } catch {
    // Metadata is optional; fall back to the filename.
  }

  return { title, author, info }
}

async function renderPage(page: PDFPageProxy, targetWidth: number): Promise<Buffer> {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(targetWidth / base.width, 1.6)
  const viewport = page.getViewport({ scale })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const context = canvas.getContext('2d')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)

  await page.render({ canvasContext: context, viewport, canvas }).promise
  const buffer = canvas.toBuffer('image/png')
  canvas.width = 0
  canvas.height = 0
  return buffer
}

async function extractPageText(page: PDFPageProxy): Promise<string> {
  const content = await page.getTextContent()
  const parts: string[] = []

  for (const item of content.items) {
    if (!('str' in item)) continue
    parts.push(item.str)
    if (item.hasEOL) parts.push('\n')
    else parts.push(' ')
  }

  return parts.join('').replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').trim()
}

export async function inspectPdf(path: string, options: InspectOptions = {}): Promise<PdfInspection> {
  return withPdfDocument(path, options.password, async (document) => {
    const metadata = await readMetadata(document)
    const pageCount = document.numPages
    let cover: Buffer | null = null
    const pages: PageText[] = []

    if (options.renderCover !== false && pageCount > 0) {
      try {
        const first = await document.getPage(1)
        cover = await renderPage(first, 512)
        first.cleanup()
      } catch {
        cover = null
      }
    }

    if (options.extractText) {
      for (let index = 1; index <= pageCount; index += 1) {
        try {
          const page = await document.getPage(index)
          const text = await extractPageText(page)
          if (text.length > 0) pages.push({ page: index, text: text.slice(0, 120_000) })
          page.cleanup()
        } catch {
          // A single unreadable page should not fail the import.
        }
        options.onPage?.(index, pageCount)
      }
    }

    return { pageCount, metadata, cover, pages }
  })
}

export async function writeCover(path: string, cover: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, cover)
}

export async function renderThumbnail(
  path: string,
  pageNumber: number,
  password?: string
): Promise<Buffer> {
  return withPdfDocument(path, password, async (document) => {
    const page = await document.getPage(pageNumber)
    const buffer = await renderPage(page, 256)
    page.cleanup()
    return buffer
  })
}

export function pdfjsAssetUrl(relative: string): string {
  return pathToFileURL(join(pdfjsRoot, relative)).href
}
