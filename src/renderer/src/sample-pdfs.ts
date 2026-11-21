/**
 * Minimal, standards-compliant PDF-1.4 generator for Alexandria's static browser demo.
 * Produces real selectable text streams with exact xref tables so pdfjs-dist renders
 * crisp pages, text layers, highlights, ink strokes, and full-text search offline.
 */

export interface SampleFolioSpec {
  id: number
  title: string
  author: string
  accent: string
  spineColor: string
  tags: string[]
  pages: Array<{
    chapter: string
    heading: string
    paragraphs: string[]
    footerNote: string
  }>
}

function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) {
      current = word
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ` ${word}`
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function buildPageStream(
  spec: SampleFolioSpec,
  pageIndex: number,
  totalPages: number
): string {
  const page = spec.pages[pageIndex]
  const ops: string[] = []

  // Subtle parchment tint + architectural frame border
  ops.push('0.985 0.972 0.945 rg 0 0 612 792 re f')
  ops.push('0.78 0.65 0.40 RG 0.65 w 42 42 528 708 re S')
  ops.push('0.78 0.65 0.40 RG 0.35 w 48 48 516 696 re S')

  // Running header
  ops.push('BT /F1 9 Tf 0.42 0.36 0.28 rg')
  ops.push(`64 726 Td (${escapePdfText(spec.title.toUpperCase())}) Tj ET`)
  ops.push('BT /F1 9 Tf 0.42 0.36 0.28 rg')
  ops.push(`476 726 Td (${escapePdfText(`FOLIO ${pageIndex + 1} / ${totalPages}`)}) Tj ET`)
  ops.push('0.78 0.65 0.40 RG 0.4 w 64 716 m 548 716 l S')

  // Chapter eyebrow
  ops.push('BT /F1 10 Tf 0.56 0.42 0.18 rg')
  ops.push(`64 680 Td (${escapePdfText(page.chapter.toUpperCase())}) Tj ET`)

  // Heading
  ops.push('BT /F2 22 Tf 0.12 0.10 0.08 rg')
  ops.push(`64 648 Td (${escapePdfText(page.heading)}) Tj ET`)

  // Subtle divider
  ops.push('0.78 0.65 0.40 RG 0.5 w 64 634 m 220 634 l S')

  // Body paragraphs
  let y = 602
  for (const para of page.paragraphs) {
    const lines = wrapLine(para, 74)
    for (const line of lines) {
      if (y < 110) break
      ops.push('BT /F1 11.5 Tf 0.16 0.14 0.12 rg')
      ops.push(`64 ${y} Td (${escapePdfText(line)}) Tj ET`)
      y -= 17
    }
    y -= 11
  }

  // Ornamental geometric diagram on page 1
  if (pageIndex === 0) {
    const cx = 306
    const cy = 205
    ops.push('0.72 0.58 0.32 RG 0.7 w')
    // Diamond & cross-hairs evoking an armillary projection
    ops.push(`${cx} ${cy + 58} m ${cx + 58} ${cy} l ${cx} ${cy - 58} l ${cx - 58} ${cy} l h S`)
    ops.push(`${cx - 88} ${cy} m ${cx + 88} ${cy} l S`)
    ops.push(`${cx} ${cy - 76} m ${cx} ${cy + 76} l S`)
    ops.push(`${cx - 41} ${cy - 41} m ${cx + 41} ${cy + 41} l S`)
    ops.push(`${cx - 41} ${cy + 41} m ${cx + 41} ${cy - 41} l S`)
    ops.push('BT /F1 8.5 Tf 0.45 0.38 0.28 rg')
    ops.push(`212 114 Td (${escapePdfText('FIG. I — CELESTIAL MERIDIAN & ARCHIVE AXIS')}) Tj ET`)
  }

  // Footer rule & colophon note
  ops.push('0.78 0.65 0.40 RG 0.4 w 64 82 m 548 82 l S')
  ops.push('BT /F1 8.5 Tf 0.42 0.36 0.28 rg')
  ops.push(`64 66 Td (${escapePdfText(page.footerNote)}) Tj ET`)
  ops.push('BT /F1 8.5 Tf 0.42 0.36 0.28 rg')
  ops.push(`462 66 Td (${escapePdfText(spec.author)}) Tj ET`)

  return ops.join('\n')
}

export function generateSamplePdf(spec: SampleFolioSpec): Uint8Array {
  const encoder = new TextEncoder()
  const totalPages = spec.pages.length

  // Object allocation:
  // 1: Catalog
  // 2: Pages
  // 3: Font F1 (Times-Roman)
  // 4: Font F2 (Times-Bold)
  // For each page i (0..N-1):
  //   pageObj = 5 + i * 2
  //   contentObj = 6 + i * 2
  const objects: string[] = []
  const pageRefs: string[] = []
  for (let i = 0; i < totalPages; i++) {
    pageRefs.push(`${5 + i * 2} 0 R`)
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${totalPages} >>\nendobj\n`)
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n`)
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>\nendobj\n`)

  for (let i = 0; i < totalPages; i++) {
    const pageObjId = 5 + i * 2
    const contentObjId = 6 + i * 2
    const stream = buildPageStream(spec, i, totalPages)
    const byteLength = encoder.encode(stream).length

    objects.push(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\nendobj\n`
    )
    objects.push(
      `${contentObjId} 0 obj\n<< /Length ${byteLength} >>\nstream\n${stream}\nendstream\nendobj\n`
    )
  }

  const chunks: Uint8Array[] = []
  const offsets: number[] = [0]
  let cursor = 0

  const pushStr = (value: string): void => {
    const bytes = encoder.encode(value)
    chunks.push(bytes)
    cursor += bytes.length
  }

  pushStr('%PDF-1.4\n')
  for (const obj of objects) {
    offsets.push(cursor)
    pushStr(obj)
  }

  const xrefOffset = cursor
  pushStr(`xref\n0 ${offsets.length}\n`)
  pushStr('0000000000 65535 f \n')
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`)
  }

  pushStr(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  )

  const totalBytes = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const output = new Uint8Array(totalBytes)
  let pos = 0
  for (const chunk of chunks) {
    output.set(chunk, pos)
    pos += chunk.length
  }
  return output
}

export function generateSampleCoverDataUrl(spec: SampleFolioSpec): string {
  const safeTitle = spec.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const safeAuthor = spec.author.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const words = safeTitle.split(' ')
  const line1 = words.slice(0, 2).join(' ')
  const line2 = words.slice(2).join(' ')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="460" viewBox="0 0 320 460">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.spineColor}"/>
      <stop offset="100%" stop-color="#0d0b09"/>
    </linearGradient>
  </defs>
  <rect width="320" height="460" fill="url(#bg)"/>
  <rect x="18" y="18" width="284" height="424" fill="none" stroke="${spec.accent}" stroke-opacity="0.65" stroke-width="1.5"/>
  <rect x="26" y="26" width="268" height="408" fill="none" stroke="${spec.accent}" stroke-opacity="0.3" stroke-width="1"/>
  <circle cx="160" cy="238" r="54" fill="none" stroke="${spec.accent}" stroke-opacity="0.7" stroke-width="1.2"/>
  <ellipse cx="160" cy="238" rx="54" ry="20" fill="none" stroke="${spec.accent}" stroke-opacity="0.55" stroke-width="1"/>
  <ellipse cx="160" cy="238" rx="22" ry="54" fill="none" stroke="${spec.accent}" stroke-opacity="0.45" stroke-width="1"/>
  <line x1="94" y1="238" x2="226" y2="238" stroke="${spec.accent}" stroke-opacity="0.4" stroke-width="0.9"/>
  <text x="160" y="96" text-anchor="middle" fill="#f2ece1" font-family="Georgia, serif" font-size="22" letter-spacing="1">${line1}</text>
  <text x="160" y="126" text-anchor="middle" fill="#f2ece1" font-family="Georgia, serif" font-size="22" letter-spacing="1">${line2}</text>
  <text x="160" y="388" text-anchor="middle" fill="${spec.accent}" font-family="Georgia, serif" font-size="13" letter-spacing="2.2">${safeAuthor.toUpperCase()}</text>
  <text x="160" y="416" text-anchor="middle" fill="#a39a8c" font-family="monospace" font-size="10" letter-spacing="2">ALEXANDRIA ARCHIVE</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const SAMPLE_FOLIOS: SampleFolioSpec[] = [
  {
    id: 1,
    title: 'Elements of Celestial Geometry',
    author: 'Euclid of Alexandria',
    accent: '#C8A25B',
    spineColor: '#3a1f1d',
    tags: ['Astronomy', 'Geometry', 'Classics'],
    pages: [
      {
        chapter: 'Book I · Propositions on the Sphere',
        heading: 'The Armillary Meridian',
        paragraphs: [
          'A point is that which has no part; a meridian is the great circle passing through the zenith and both poles of the celestial sphere. Within the Grand Hall of Alexandria, brass rings preserve the exact inclinations of ecliptic, horizon, and solstitial colure.',
          'When a reader opens a folio inside Alexandria, every page renders at native device sharpness without visual flicker. Try switching to the Highlight or Ink tool in the top reader bar and marking directly on this paragraph—every mark lands precisely beneath your cursor.'
        ],
        footerNote: 'Alexandria Interactive Web Demo · Local-First Edition'
      },
      {
        chapter: 'Book II · Spatial Memory & Architecture',
        heading: 'Walking the Mezzanine',
        paragraphs: [
          'Ancient librarians observed that ideas endure longest when anchored to physical coordinates. A volume placed on the North Wall of the upper mezzanine is remembered not merely by filename, but by light, height, and neighbors.',
          'Press W, A, S, D to traverse the marble floor and ascend the grand staircase to the balcony. Switch hall atmospheres between Dark Academia, Sunlit Marble, and Observatory, or enable gentle rain and hearth soundscapes.'
        ],
        footerNote: 'Press Esc in the Reader to return to the Grand Hall'
      },
      {
        chapter: 'Book III · Non-Destructive Marginalia',
        heading: 'Ink, Gold Leaf & Bookmarks',
        paragraphs: [
          'Your original PDF files are never mutated. All highlights, freehand ink annotations, margin notes, and bookmarks live in a single local SQLite database alongside full-text FTS5 indices.',
          'Press Ctrl/Cmd + K from anywhere in Alexandria to search across titles, authors, page text, and personal annotations in milliseconds.'
        ],
        footerNote: 'Annotations created in this demo persist in your browser'
      },
      {
        chapter: 'Book IV · Permanence Without Cloud',
        heading: 'Plain Folders, Zero Telemetry',
        paragraphs: [
          'Every Alexandria desktop library is an ordinary folder on your disk containing library.db, config.json, books/, and covers/. Back it up with rsync, Time Machine, or Syncthing—no proprietary lock-in and no account required.',
          'Drop any of your own PDF files straight onto this browser window to test shelving and reading them immediately inside the web sandbox.'
        ],
        footerNote: 'Desktop builds available for Linux, Windows, and macOS'
      }
    ]
  },
  {
    id: 2,
    title: 'On the Measurement of the Earth',
    author: 'Eratosthenes of Cyrene',
    accent: '#D5B572',
    spineColor: '#1d2d3b',
    tags: ['Geography', 'Mathematics', 'Astronomy'],
    pages: [
      {
        chapter: 'Treatise I · The Solstice at Syene',
        heading: 'Shadows at High Noon',
        paragraphs: [
          'At noon on the summer solstice in Syene, the sun stands directly overhead and illuminates the bottom of a deep vertical well without casting a shadow upon its stone walls. At the same hour in Alexandria, a bronze gnomon casts a shadow measuring one fiftieth of a full circle.',
          'From that solitary angle and the distance measured by royal pacers between the two cities, the circumference of the entire Earth emerges with startling precision.'
        ],
        footerNote: 'Sample Folio II · Alexandria Web Demo'
      },
      {
        chapter: 'Treatise II · Indexing the Known World',
        heading: 'Full-Text Precision',
        paragraphs: [
          'As chief librarian of Alexandria, Eratosthenes united astronomy, poetry, and cartography under one roof. Modern digital archives often bury great essays inside nameless download folders.',
          'Alexandria restores tactile clarity: drag books directly between shelves in the 3D Grand Hall, tag them by discipline, and track your study sessions with the built-in distraction-free Study Mode timer.'
        ],
        footerNote: 'Try Study Mode from the Reader toolbar'
      },
      {
        chapter: 'Treatise III · Verification & Integrity',
        heading: 'SHA-256 Deduplication',
        paragraphs: [
          'Importing a folder twice never creates duplicate clutter. Alexandria hashes every document via SHA-256 on import, ensuring each folio has a single canonical identity across shelves, desks, and annotations.',
          'Desktop releases published via GitHub Actions also include SHA256SUMS.txt so every Linux AppImage, Windows installer, and macOS disk image can be verified cryptographically.'
        ],
        footerNote: 'Verify installers with sha256sum -c SHA256SUMS.txt'
      }
    ]
  },
  {
    id: 3,
    title: 'Pinakes: On the Order of Shelves',
    author: 'Callimachus of Cyrene',
    accent: '#C99A5A',
    spineColor: '#253328',
    tags: ['Cataloging', 'Philosophy', 'Archive'],
    pages: [
      {
        chapter: 'Scroll I · The First Library Catalog',
        heading: 'Tables of Those Who Shone',
        paragraphs: [
          'Before Callimachus composed the Pinakes in one hundred and twenty scrolls, finding a treatise among half a million papyri required memory alone. By organizing every work by genre, author, incipit, and line count, the catalog transformed accumulation into knowledge.',
          'Switch to the Index or 2D Floor Map view at any time to inspect every bay, reorder shelves, or jump straight to a book across your personal wings.'
        ],
        footerNote: 'Sample Folio III · Alexandria Web Demo'
      },
      {
        chapter: 'Scroll II · The Reading Desk',
        heading: 'Current Works at Hand',
        paragraphs: [
          'Pin active volumes to your Reading Desk so they remain one click away when you enter the hall. Reading progress markers appear right on each 3D book spine along the oak shelves.',
          'When you finish a treatise, mark it Finished to preserve your reading history and keep your active desk serene and uncluttered.'
        ],
        footerNote: 'Click any book spine in the Hall to inspect or open'
      },
      {
        chapter: 'Scroll III · Open Source Craft',
        heading: 'Built to Outlast Platforms',
        paragraphs: [
          'Alexandria is MIT-licensed open-source software built with Electron, React, Three.js, PDF.js, and SQLite. Contributions, translations, themes, and bug reports are always welcome on GitHub.',
          'Download the native desktop app for full local folder scanning, LibreOffice document conversion, and system-wide offline storage.'
        ],
        footerNote: 'MIT Licensed · Local-First Forever'
      }
    ]
  }
]
