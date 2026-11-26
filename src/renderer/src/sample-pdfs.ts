/**
 * Standards-compliant PDF-1.4 generator for Alexandria's browser demo.
 * Uses pure WinAnsi-safe ASCII text inside Type1 Times-Roman / Times-Bold streams
 * with exact byte-offset xref tables so pdfjs-dist renders crisp pages, selectable
 * text layers, highlights, ink strokes, and full-text search offline with zero mojibake.
 */

export interface SampleFolioSpec {
  id: number
  title: string
  author: string
  accent: string
  spineColor: string
  tags: string[]
  shelfId: number
  readingState?: 'unread' | 'reading' | 'finished'
  deskPinned?: boolean
  isRareNookCodex?: boolean
  pages: Array<{
    chapter: string
    heading: string
    paragraphs: string[]
    footerNote: string
  }>
}

/**
 * Normalize Unicode punctuation to clean 7-bit ASCII for PDF Type1 standard encoding.
 */
export function sanitizePdfText(text: string): string {
  return text
    .replace(/[\u2014\u2013]/g, ' - ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00B7/g, ' | ')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function escapePdfText(text: string): string {
  return sanitizePdfText(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean)
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

  // Subtle parchment tint + architectural double border
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
  ops.push('BT /F2 21 Tf 0.12 0.10 0.08 rg')
  ops.push(`64 648 Td (${escapePdfText(page.heading)}) Tj ET`)

  // Subtle divider
  ops.push('0.78 0.65 0.40 RG 0.5 w 64 634 m 220 634 l S')

  // Body paragraphs
  let y = 602
  for (const para of page.paragraphs) {
    const lines = wrapLine(para, 74)
    for (const line of lines) {
      if (y < 115) break
      ops.push('BT /F1 11.5 Tf 0.16 0.14 0.12 rg')
      ops.push(`64 ${y} Td (${escapePdfText(line)}) Tj ET`)
      y -= 17
    }
    y -= 11
  }

  // Ornamental geometric diagram on page 1
  if (pageIndex === 0) {
    const cx = 306
    const cy = 200
    ops.push('0.72 0.58 0.32 RG 0.7 w')
    ops.push(`${cx} ${cy + 58} m ${cx + 58} ${cy} l ${cx} ${cy - 58} l ${cx - 58} ${cy} l h S`)
    ops.push(`${cx - 88} ${cy} m ${cx + 88} ${cy} l S`)
    ops.push(`${cx} ${cy - 76} m ${cx} ${cy + 76} l S`)
    ops.push(`${cx - 41} ${cy - 41} m ${cx + 41} ${cy + 41} l S`)
    ops.push(`${cx - 41} ${cy + 41} m ${cx + 41} ${cy - 41} l S`)
    ops.push('BT /F1 8.5 Tf 0.45 0.38 0.28 rg')
    ops.push(`208 110 Td (${escapePdfText('FIG. I - CELESTIAL MERIDIAN AND ARCHIVE AXIS')}) Tj ET`)
  }

  // Footer rule & colophon note
  ops.push('0.78 0.65 0.40 RG 0.4 w 64 82 m 548 82 l S')
  ops.push('BT /F1 8.5 Tf 0.42 0.36 0.28 rg')
  ops.push(`64 66 Td (${escapePdfText(page.footerNote)}) Tj ET`)
  ops.push('BT /F1 8.5 Tf 0.42 0.36 0.28 rg')
  ops.push(`420 66 Td (${escapePdfText(spec.author)}) Tj ET`)

  return ops.join('\n')
}

export function generateSamplePdf(spec: SampleFolioSpec): Uint8Array {
  const encoder = new TextEncoder()
  const totalPages = Math.max(1, spec.pages.length)

  const objects: string[] = []
  const pageRefs: string[] = []
  for (let i = 0; i < totalPages; i += 1) {
    pageRefs.push(`${5 + i * 2} 0 R`)
  }

  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`)
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${totalPages} >>\nendobj\n`)
  objects.push(`3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>\nendobj\n`)
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>\nendobj\n`)

  for (let i = 0; i < totalPages; i += 1) {
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
  for (let i = 1; i < offsets.length; i += 1) {
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

export function generateSampleCoverDataUrl(spec: {
  title: string
  author: string
  accent: string
  spineColor: string
}): string {
  const safeTitle = spec.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const safeAuthor = spec.author.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const words = safeTitle.split(' ')
  const mid = Math.ceil(words.length / 2)
  const line1 = words.slice(0, Math.max(2, mid)).join(' ')
  const line2 = words.slice(Math.max(2, mid)).join(' ')

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
  <circle cx="160" cy="242" r="54" fill="none" stroke="${spec.accent}" stroke-opacity="0.7" stroke-width="1.2"/>
  <ellipse cx="160" cy="242" rx="54" ry="20" fill="none" stroke="${spec.accent}" stroke-opacity="0.55" stroke-width="1"/>
  <ellipse cx="160" cy="242" rx="22" ry="54" fill="none" stroke="${spec.accent}" stroke-opacity="0.45" stroke-width="1"/>
  <line x1="94" y1="242" x2="226" y2="242" stroke="${spec.accent}" stroke-opacity="0.4" stroke-width="0.9"/>
  <text x="160" y="96" text-anchor="middle" fill="#f2ece1" font-family="Georgia, serif" font-size="20" letter-spacing="0.8">${line1}</text>
  <text x="160" y="126" text-anchor="middle" fill="#f2ece1" font-family="Georgia, serif" font-size="20" letter-spacing="0.8">${line2}</text>
  <text x="160" y="388" text-anchor="middle" fill="${spec.accent}" font-family="Georgia, serif" font-size="12" letter-spacing="2.2">${safeAuthor.toUpperCase()}</text>
  <text x="160" y="416" text-anchor="middle" fill="#a39a8c" font-family="monospace" font-size="10" letter-spacing="2">ALEXANDRIA ARCHIVE</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const RARE_NOOK_BOOK_ID = 8

export const SAMPLE_FOLIOS: SampleFolioSpec[] = [
  {
    id: 1,
    title: 'Elements of Celestial Geometry',
    author: 'Euclid of Alexandria',
    accent: '#C8A25B',
    spineColor: '#4c2420',
    tags: ['Astronomy', 'Geometry', 'Classics'],
    shelfId: 10001,
    readingState: 'reading',
    deskPinned: true,
    pages: [
      {
        chapter: 'Book I | Propositions on the Sphere',
        heading: 'The Armillary Meridian',
        paragraphs: [
          'A point is that which has no part; a meridian is the great circle passing through the zenith and both poles of the celestial sphere. Within the Grand Hall of Alexandria, brass rings preserve the exact inclinations of ecliptic, horizon, and solstitial colure.',
          'When a reader opens a folio inside Alexandria, every page renders at native device sharpness without visual flicker. Switch to the Highlight or Ink tool in the top reader bar and mark directly on this paragraph; every mark lands precisely beneath your cursor.'
        ],
        footerNote: 'Alexandria Interactive Edition | Local-First Archive'
      },
      {
        chapter: 'Book II | Spatial Memory and Architecture',
        heading: 'Walking the Wide Grand Gallery',
        paragraphs: [
          'Ancient librarians observed that ideas endure longest when anchored to physical coordinates. A volume placed along the upper mezzanine is remembered not merely by filename, but by light, elevation, and neighboring folios.',
          'Walk East along the South wall to ascend the flush corner staircase onto the wide upper gallery, or climb a rolling walnut bookshelf ladder to inspect the upper tiers.'
        ],
        footerNote: 'Press Esc in the Reader to return to the Grand Hall'
      },
      {
        chapter: 'Book III | Non-Destructive Marginalia',
        heading: 'Ink, Gold Leaf and Bookmarks',
        paragraphs: [
          'Your original PDF files are never mutated. All highlights, freehand ink annotations, margin notes, and bookmarks live in your local library database alongside full-text indices.',
          'Press Ctrl or Cmd + K from anywhere in Alexandria to search across titles, authors, page text, and personal annotations in milliseconds.'
        ],
        footerNote: 'Annotations persist automatically in your browser'
      },
      {
        chapter: 'Book IV | Permanence Without Cloud',
        heading: 'Plain Folders, Zero Telemetry',
        paragraphs: [
          'Every Alexandria desktop library is an ordinary folder on disk containing library.db, config.json, books, and covers. Back it up with rsync, Time Machine, or Syncthing with no proprietary lock-in.',
          'Drop any of your own PDF files straight onto this browser window to shelve, read, and annotate them permanently inside the browser vault.'
        ],
        footerNote: 'Native builds available for Linux, Windows, and macOS'
      }
    ]
  },
  {
    id: 2,
    title: 'On the Measurement of the Earth',
    author: 'Eratosthenes of Cyrene',
    accent: '#D5B572',
    spineColor: '#1d3242',
    tags: ['Geography', 'Mathematics', 'Astronomy'],
    shelfId: 10001,
    readingState: 'reading',
    deskPinned: true,
    pages: [
      {
        chapter: 'Treatise I | The Solstice at Syene',
        heading: 'Shadows at High Noon',
        paragraphs: [
          'At noon on the summer solstice in Syene, the sun stands directly overhead and illuminates the bottom of a deep vertical well without casting a shadow upon its stone walls. At the same hour in Alexandria, a bronze gnomon casts a shadow measuring one fiftieth of a full circle.',
          'From that solitary angle and the distance measured by royal pacers between the two cities, the circumference of the entire Earth emerges with startling precision.'
        ],
        footerNote: 'Folio II | Alexandria Celestial Wing'
      },
      {
        chapter: 'Treatise II | Indexing the Known World',
        heading: 'Full-Text Precision',
        paragraphs: [
          'As chief librarian of Alexandria, Eratosthenes united astronomy, poetry, and cartography under one roof. Modern digital archives often bury great essays inside nameless download folders.',
          'Alexandria restores tactile clarity: drag books directly between shelves in the 3D Grand Hall, tag them by discipline, and track your reading streak in the Scholar Ledger.'
        ],
        footerNote: 'Open the Reading Desk to inspect your Scholar Ledger'
      },
      {
        chapter: 'Treatise III | Verification and Integrity',
        heading: 'Cryptographic Deduplication',
        paragraphs: [
          'Importing a folder twice never creates duplicate clutter. Alexandria hashes every document via SHA-256 on import, ensuring each folio has a single canonical identity across shelves, desks, and annotations.',
          'Try uploading a PDF using the Import button in the Grand Hall dock: it persists right inside your browser IndexedDB vault across reloads.'
        ],
        footerNote: 'Drop PDFs anywhere in the window to import'
      }
    ]
  },
  {
    id: 3,
    title: 'Pinakes: On the Order of Shelves',
    author: 'Callimachus of Cyrene',
    accent: '#C99A5A',
    spineColor: '#243c2c',
    tags: ['Cataloging', 'Philosophy', 'Archive'],
    shelfId: 10002,
    readingState: 'finished',
    pages: [
      {
        chapter: 'Scroll I | The First Library Catalog',
        heading: 'Tables of Those Who Shone',
        paragraphs: [
          'Before Callimachus composed the Pinakes in one hundred and twenty scrolls, finding a treatise among half a million papyri required memory alone. By organizing every work by genre, author, incipit, and line count, the catalog transformed accumulation into knowledge.',
          'Switch to the Index or 2D Floor Map view at any time to inspect every bay, reorder shelves, or jump straight to a book across your personal wings.'
        ],
        footerNote: 'Folio III | Archival Scrolls'
      },
      {
        chapter: 'Scroll II | The Reading Desk',
        heading: 'Current Works at Hand',
        paragraphs: [
          'Pin active volumes to your Reading Desk so they remain one click away when you enter the hall. Golden woven bookmarks peek over currently-reading spines along the oak shelves.',
          'Complete daily reading quests and discover hall landmarks to advance from Initiate to Chief Librarian in your Scholar Ledger.'
        ],
        footerNote: 'Click any book spine in the Hall to inspect or open'
      },
      {
        chapter: 'Scroll III | Open Source Craft',
        heading: 'Built to Outlast Platforms',
        paragraphs: [
          'Alexandria is MIT-licensed open-source software built with Electron, React, Three.js, PDF.js, and SQLite. Contributions, themes, and improvements are always welcome.',
          'Press T in the Grand Hall to shift between Dark Academia, Sunlit Marble, and Starlight Observatory atmospheres.'
        ],
        footerNote: 'MIT Licensed | Local-First Forever'
      }
    ]
  },
  {
    id: 4,
    title: 'Pneumatica and Mechanical Wonders',
    author: 'Hero of Alexandria',
    accent: '#D2A663',
    spineColor: '#4c3422',
    tags: ['Engineering', 'Mechanics', 'Physics'],
    shelfId: 10002,
    pages: [
      {
        chapter: 'Book I | Steam, Brass and Balance',
        heading: 'The Aeolipile Sphere',
        paragraphs: [
          'By directing heated vapor through twin opposing nozzles on a pivoted bronze sphere, rotary motion arises purely from balanced reaction. Craftsmanship in brass and timber turns invisible natural laws into quiet, enduring instruments.',
          'Look upward beneath the dome of Alexandria to observe the counter-rotating celestial armillary orrery suspended over the central reading desk.'
        ],
        footerNote: 'Folio IV | Mechanics Reserve'
      },
      {
        chapter: 'Book II | Automatic Temple Doors',
        heading: 'Counterweights and Hinges',
        paragraphs: [
          'Hidden beneath the sanctuary hearth, expanding air displaces water into a suspended bucket whose descent rotates twin vertical spindles, parting great oak doors without a human hand.',
          'Click the Fireplace Hearth in the South-West nave to cycle between quiet Embers, Warm Hearth, and a Roaring Fire.'
        ],
        footerNote: 'Stoke the Fireplace Hearth in the South-West Nave'
      },
      {
        chapter: 'Book III | Optics and Mirrors',
        heading: 'Refracted Light Across Marble',
        paragraphs: [
          'Light follows the shortest path between reflection points. In a well-proportioned hall, arched clerestory windows guide daylight across limestone columns and parquet floors from morning until dusk.',
          'Try the Guided Hall Tour from the bottom dock for a smooth multi-stop architectural walkthrough.'
        ],
        footerNote: 'Press Esc anytime to exit the Guided Hall Tour'
      }
    ]
  },
  {
    id: 5,
    title: 'Almagest: Star Catalog of the South',
    author: 'Claudius Ptolemy',
    accent: '#E0C078',
    spineColor: '#272947',
    tags: ['Astronomy', 'Star Charts', 'Classics'],
    shelfId: 10003,
    pages: [
      {
        chapter: 'Book VII | Fixed Stars and Magnitudes',
        heading: 'Charting the Constellations',
        paragraphs: [
          'Forty-eight classical constellations anchor the nocturnal sky above the Mediterranean horizon. From Canopus gleaming low in the south to the bright belt of Orion and the circling Bears around the pole, every star carries an ecliptic longitude and magnitude.',
          'Ascend to the North-West upper gallery and click the brass Observatory Telescope to inspect the interactive star chart directly.'
        ],
        footerNote: 'Folio V | East Philosophy and Astronomy Bay'
      },
      {
        chapter: 'Book VIII | Precession of the Equinoxes',
        heading: 'The Great Turning Year',
        paragraphs: [
          'Comparing Hipparchus with records carved centuries earlier reveals that the sphere of fixed stars drifts steadily by one degree every hundred years. Patient records kept across generations disclose motions invisible in a single lifetime.',
          'Keep your own Scholar Ledger streak alive each day as you annotate and study across your personal archive.'
        ],
        footerNote: 'Visit the North-West Observatory Telescope'
      }
    ]
  },
  {
    id: 6,
    title: 'Treatise on Conic Sections',
    author: 'Hypatia of Alexandria',
    accent: '#CFA76E',
    spineColor: '#482838',
    tags: ['Mathematics', 'Geometry', 'Philosophy'],
    shelfId: 10004,
    pages: [
      {
        chapter: 'Commentary I | Ellipse, Parabola and Hyperbola',
        heading: 'Sections of the Double Cone',
        paragraphs: [
          'A single inclined plane slicing cleanly through a circular cone generates every curve governing planetary orbits, parabolic mirrors, and astrolabe projections. Clarity of proof turns complexity into beauty.',
          'Notice how the West Wall holds tall oak bays fitted with interactive rolling walnut ladders along gleaming brass rails.'
        ],
        footerNote: 'Folio VI | West Wing Mathematics'
      },
      {
        chapter: 'Commentary II | The Plane Astrolabe',
        heading: 'Stereographic Projection in Brass',
        paragraphs: [
          'Projecting the celestial sphere from the South Pole onto the equatorial plane maps circles onto circles and preserves every angle. In a single palm-sized brass disk, the sky of any latitude folds into harmony.',
          'Click the Atlas Globe in the East nave to spin its brass meridian and jump swiftly across any wing in the library.'
        ],
        footerNote: 'Click a Rolling Ladder to inspect upper shelves'
      }
    ]
  },
  {
    id: 7,
    title: 'On Harmony and Acoustic Strings',
    author: 'Aristoxenus of Tarentum',
    accent: '#C69E5E',
    spineColor: '#323d2a',
    tags: ['Music', 'Acoustics', 'Philosophy'],
    shelfId: 10005,
    pages: [
      {
        chapter: 'Elementa Harmonica I | Sound and Silence',
        heading: 'The Soundscape of Study',
        paragraphs: [
          'Deep attention thrives inside a gentle acoustic horizon: soft rain against arched glass, the warm low crackle of cedar embers, or a quiet chamber piece turning softly on brass and shellac.',
          'Click the Brass Gramophone on the West flank of the nave or open Atmosphere in the bottom dock to blend rain, hearth fire, and library hush.'
        ],
        footerNote: 'Folio VII | Upper Mezzanine Gallery'
      },
      {
        chapter: 'Elementa Harmonica II | Intervals of Focus',
        heading: 'Rhythm of Reading Sessions',
        paragraphs: [
          'Twenty-five minutes of unbroken attention followed by a brief pause lets memory consolidate what the eye has gathered. Use the Reading Desk timer or Reader Study Mode to log focused sessions.',
          'Every completed study session awards Scholar Points and extends your daily reading streak.'
        ],
        footerNote: 'Located on the Wide Upper Mezzanine Gallery'
      }
    ]
  },
  {
    id: RARE_NOOK_BOOK_ID,
    title: 'Codex Alexandrinus: Lost Star Maps',
    author: 'Keeper of the Upper Nook',
    accent: '#E7C877',
    spineColor: '#581f1b',
    tags: ['Rare Codex', 'Astronomy', 'Secret Nook'],
    shelfId: 10006,
    isRareNookCodex: true,
    pages: [
      {
        chapter: 'Secret Nook Manuscript I | Folio of the Hidden Alcove',
        heading: 'The Candlelit Sanctuary',
        paragraphs: [
          'You have discovered the Secret Upper Study Nook tucked behind the carved walnut screen at the far South-West gallery. Few visitors climb the corner staircase all the way around the promenade to find this quiet leather armchair and brass candlestick.',
          'Kept here apart from the main nave, this rare codex preserves star-maps drawn when the Pharos beacon still burned above the harbor.'
        ],
        footerNote: 'Secret Upper Study Nook | Exclusive Rare Codex'
      },
      {
        chapter: 'Secret Nook Manuscript II | The Seven Lamps of Memory',
        heading: 'Places That Hold Thought',
        paragraphs: [
          'First, an unbroken gallery where every shelf is within reach; second, warm light over honest timber; third, tools that leave the text untouched while capturing every insight in the margin.',
          'May your own library grow across wings, floors, and years, always owned solely by you.'
        ],
        footerNote: 'Scholar Discovery Unlocked | +75 XP'
      },
      {
        chapter: 'Secret Nook Manuscript III | Colophon',
        heading: 'Notes of the Chief Librarian',
        paragraphs: [
          'Try highlighting a passage on this page, adding a margin note, or uploading one of your own PDF manuscripts to place beside this codex on the upper mezzanine.',
          'Your notes, rank, quests, and uploaded PDFs stay preserved right in your browser.'
        ],
        footerNote: 'Alexandria Rare Vault | Folio VIII'
      }
    ]
  }
]
