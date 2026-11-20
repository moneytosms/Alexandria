/**
 * Builds small, valid PDF files for tests. Producing PDFs in code keeps the
 * repository free of binary fixtures while still exercising the real PDF.js
 * pipeline (metadata, page count, cover rendering, and text extraction).
 */

import { writeFileSync } from 'node:fs'

export interface PdfOptions {
  title?: string | null
  author?: string | null
  pages?: string[]
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function hex(value: string): string {
  return `<${Buffer.from(value, 'utf8').toString('hex')}>`
}

export function buildPdf(options: PdfOptions = {}): Buffer {
  const pages = options.pages ?? ['The library at Alexandria held the known world.']
  const title = options.title === null ? null : hex(options.title ?? 'Test Document')
  const author = options.author === null ? null : hex(options.author ?? 'Test Author')

  const pageIds = pages.map((_, index) => 4 + index * 2)
  const fontId = 4 + pages.length * 2

  const bodies: string[] = []
  bodies.push('<< /Type /Catalog /Pages 2 0 R >>')
  bodies.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  )
  const infoParts = [
    title ? `/Title ${title}` : null,
    author ? `/Author ${author}` : null
  ].filter(Boolean)
  bodies.push(`<< ${infoParts.join(' ')} >>`)

  pages.forEach((text, index) => {
    const contentId = pageIds[index] + 1
    bodies.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    )
    const content = `BT /F1 18 Tf 72 720 Td (${escapeText(text)}) Tj ET`
    bodies.push(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)
  })

  bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  const chunks: Buffer[] = [Buffer.from('%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n', 'binary')]
  const offsets: number[] = []
  let position = chunks[0].length

  bodies.forEach((body, index) => {
    const object = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, 'binary')
    offsets.push(position)
    chunks.push(object)
    position += object.length
  })

  const xrefStart = position
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`

  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`
  }

  xref += `trailer\n<< /Size ${bodies.length + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  chunks.push(Buffer.from(xref, 'binary'))

  return Buffer.concat(chunks)
}

/** Writes a PDF fixture to disk. */
export function writePdf(path: string, options: PdfOptions = {}): void {
  writeFileSync(path, buildPdf(options))
}
