import * as THREE from 'three'

export interface ProceduralTextureBundle {
  brassEngraving: THREE.CanvasTexture
  brassBump: THREE.CanvasTexture
  leatherCover: THREE.CanvasTexture
  leatherBump: THREE.CanvasTexture
  parchmentLeft: THREE.CanvasTexture
  parchmentRight: THREE.CanvasTexture
  pageEdge: THREE.CanvasTexture
  dustMote: THREE.CanvasTexture
  dispose: () => void
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Could not acquire 2D canvas context for procedural texture')
  }
  return [canvas, ctx]
}

function createBrassBandTextures(): {
  albedo: THREE.CanvasTexture
  bump: THREE.CanvasTexture
} {
  const width = 1024
  const height = 160
  const [albedoCanvas, aCtx] = makeCanvas(width, height)
  const [bumpCanvas, bCtx] = makeCanvas(width, height)

  // Brushed warm brass base gradient
  const grad = aCtx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, '#a67f3d')
  grad.addColorStop(0.18, '#d4af64')
  grad.addColorStop(0.5, '#c49b52')
  grad.addColorStop(0.82, '#d8b670')
  grad.addColorStop(1, '#8c6930')
  aCtx.fillStyle = grad
  aCtx.fillRect(0, 0, width, height)

  bCtx.fillStyle = '#808080'
  bCtx.fillRect(0, 0, width, height)

  // Horizontal brushed metallic micro-grain
  for (let i = 0; i < 420; i++) {
    const y = (i * 37) % height
    const alpha = 0.04 + ((i * 19) % 10) * 0.008
    aCtx.fillStyle = i % 2 === 0 ? `rgba(255, 238, 198, ${alpha})` : `rgba(42, 28, 10, ${alpha})`
    aCtx.fillRect(0, y, width, 1)

    bCtx.fillStyle = i % 2 === 0 ? 'rgba(165, 165, 165, 0.25)' : 'rgba(95, 95, 95, 0.25)'
    bCtx.fillRect(0, y, width, 1)
  }

  // Engraved border grooves
  const drawGroove = (y: number, lineWidth: number): void => {
    aCtx.strokeStyle = 'rgba(34, 22, 8, 0.72)'
    aCtx.lineWidth = lineWidth
    aCtx.beginPath()
    aCtx.moveTo(0, y)
    aCtx.lineTo(width, y)
    aCtx.stroke()

    bCtx.strokeStyle = '#303030'
    bCtx.lineWidth = lineWidth + 1
    bCtx.beginPath()
    bCtx.moveTo(0, y)
    bCtx.lineTo(width, y)
    bCtx.stroke()
  }

  drawGroove(18, 2)
  drawGroove(26, 1)
  drawGroove(height - 26, 1)
  drawGroove(height - 18, 2)

  // Fine degree ticks & Roman numerals
  const numerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
  const totalTicks = 144
  for (let i = 0; i < totalTicks; i++) {
    const x = (i / totalTicks) * width
    const isMajor = i % 12 === 0
    const isMid = i % 6 === 0
    const tickH = isMajor ? 22 : isMid ? 14 : 8

    aCtx.strokeStyle = isMajor ? 'rgba(26, 16, 6, 0.85)' : 'rgba(42, 28, 12, 0.58)'
    aCtx.lineWidth = isMajor ? 2 : 1
    aCtx.beginPath()
    aCtx.moveTo(x, 26)
    aCtx.lineTo(x, 26 + tickH)
    aCtx.moveTo(x, height - 26)
    aCtx.lineTo(x, height - 26 - tickH)
    aCtx.stroke()

    bCtx.strokeStyle = '#242424'
    bCtx.lineWidth = isMajor ? 2.5 : 1
    bCtx.beginPath()
    bCtx.moveTo(x, 26)
    bCtx.lineTo(x, 26 + tickH)
    bCtx.moveTo(x, height - 26)
    bCtx.lineTo(x, height - 26 - tickH)
    bCtx.stroke()
  }

  aCtx.font = '600 32px Georgia, serif'
  aCtx.textAlign = 'center'
  aCtx.textBaseline = 'middle'
  bCtx.font = '600 32px Georgia, serif'
  bCtx.textAlign = 'center'
  bCtx.textBaseline = 'middle'

  numerals.forEach((num, idx) => {
    const x = ((idx + 0.5) / numerals.length) * width
    aCtx.fillStyle = 'rgba(28, 18, 8, 0.82)'
    aCtx.fillText(num, x, height / 2 + 1)
    aCtx.fillStyle = 'rgba(255, 232, 182, 0.28)'
    aCtx.fillText(num, x + 0.8, height / 2 - 0.6)

    bCtx.fillStyle = '#222222'
    bCtx.fillText(num, x, height / 2 + 1)
  })

  const albedo = new THREE.CanvasTexture(albedoCanvas)
  albedo.wrapS = THREE.RepeatWrapping
  albedo.wrapT = THREE.ClampToEdgeWrapping
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 4

  const bump = new THREE.CanvasTexture(bumpCanvas)
  bump.wrapS = THREE.RepeatWrapping
  bump.wrapT = THREE.ClampToEdgeWrapping
  bump.anisotropy = 4

  return { albedo, bump }
}

function createLeatherTextures(): {
  albedo: THREE.CanvasTexture
  bump: THREE.CanvasTexture
} {
  const width = 512
  const height = 680
  const [canvas, ctx] = makeCanvas(width, height)
  const [bumpCanvas, bCtx] = makeCanvas(width, height)

  // Deep oxblood-walnut leather gradient
  const grad = ctx.createLinearGradient(0, 0, width, height)
  grad.addColorStop(0, '#2d1614')
  grad.addColorStop(0.45, '#21100f')
  grad.addColorStop(1, '#150a09')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  bCtx.fillStyle = '#7e7e7e'
  bCtx.fillRect(0, 0, width, height)

  // Deterministic leather pebble grain
  let seed = 419
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  for (let i = 0; i < 6500; i++) {
    const x = rand() * width
    const y = rand() * height
    const r = 0.8 + rand() * 1.9
    const light = rand() > 0.5
    ctx.fillStyle = light ? 'rgba(94, 48, 40, 0.14)' : 'rgba(8, 3, 3, 0.22)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    bCtx.fillStyle = light ? 'rgba(155, 155, 155, 0.28)' : 'rgba(90, 90, 90, 0.28)'
    bCtx.beginPath()
    bCtx.arc(x, y, r, 0, Math.PI * 2)
    bCtx.fill()
  }

  // Gold-tooled border frames
  ctx.strokeStyle = '#caa259'
  ctx.lineWidth = 2.6
  ctx.strokeRect(32, 32, width - 64, height - 64)

  ctx.strokeStyle = 'rgba(214, 178, 108, 0.65)'
  ctx.lineWidth = 1.2
  ctx.strokeRect(44, 44, width - 88, height - 88)

  bCtx.strokeStyle = '#383838'
  bCtx.lineWidth = 3.5
  bCtx.strokeRect(32, 32, width - 64, height - 64)
  bCtx.strokeRect(44, 44, width - 88, height - 88)

  // Corner diamonds
  const corners: Array<[number, number]> = [
    [60, 60],
    [width - 60, 60],
    [60, height - 60],
    [width - 60, height - 60]
  ]
  ctx.strokeStyle = '#d4b068'
  ctx.lineWidth = 1.4
  for (const [cx, cy] of corners) {
    ctx.beginPath()
    ctx.moveTo(cx, cy - 10)
    ctx.lineTo(cx + 10, cy)
    ctx.lineTo(cx, cy + 10)
    ctx.lineTo(cx - 10, cy)
    ctx.closePath()
    ctx.stroke()
  }

  // Central gilded armillary emblem
  const cx = width / 2
  const cy = height * 0.52
  ctx.strokeStyle = '#d9b56c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, 82, 0, Math.PI * 2)
  ctx.stroke()

  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(cx, cy, 82, 28, -0.35, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(cx, cy, 30, 82, 0.25, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx - 104, cy)
  ctx.lineTo(cx + 104, cy)
  ctx.moveTo(cx, cy - 104)
  ctx.lineTo(cx, cy + 104)
  ctx.stroke()

  ctx.fillStyle = '#e3c27f'
  ctx.beginPath()
  ctx.arc(cx, cy, 5.5, 0, Math.PI * 2)
  ctx.fill()

  // Gold-stamped title
  ctx.fillStyle = '#dfbd74'
  ctx.font = '600 34px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('ALEXANDRIA', cx, 134)

  ctx.fillStyle = 'rgba(218, 184, 114, 0.72)'
  ctx.font = '500 13px Georgia, serif'
  ctx.fillText('BIBLIOTHECA · CODEX I', cx, height - 88)

  const albedo = new THREE.CanvasTexture(canvas)
  albedo.colorSpace = THREE.SRGBColorSpace
  albedo.anisotropy = 4

  const bump = new THREE.CanvasTexture(bumpCanvas)
  bump.anisotropy = 4

  return { albedo, bump }
}

function createParchmentLeafTexture(side: 'left' | 'right'): THREE.CanvasTexture {
  const width = 512
  const height = 680
  const [canvas, ctx] = makeCanvas(width, height)

  // Archival warm parchment tone with subtle gutter shadow
  const grad = ctx.createLinearGradient(side === 'left' ? width : 0, 0, side === 'left' ? 0 : width, 0)
  grad.addColorStop(0, '#d8ccb4')
  grad.addColorStop(0.14, '#eee4cf')
  grad.addColorStop(0.85, '#f5eedf')
  grad.addColorStop(1, '#e6dac3')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, height)

  // Hairline parchment frame
  ctx.strokeStyle = 'rgba(156, 122, 66, 0.45)'
  ctx.lineWidth = 1.2
  ctx.strokeRect(38, 42, width - 76, height - 84)

  // Running folio header
  ctx.fillStyle = '#6c5a42'
  ctx.font = '600 11px Georgia, serif'
  ctx.textAlign = side === 'left' ? 'left' : 'right'
  ctx.fillText(
    side === 'left' ? 'DE SPHERA CELESTI · FOLIO IV' : 'MARGINALIA & ANNOTATIONES · FOLIO V',
    side === 'left' ? 54 : width - 54,
    70
  )

  ctx.strokeStyle = 'rgba(156, 122, 66, 0.35)'
  ctx.beginPath()
  ctx.moveTo(54, 82)
  ctx.lineTo(width - 54, 82)
  ctx.stroke()

  if (side === 'left') {
    // Classical chapter heading & geometric diagram
    ctx.fillStyle = '#251d14'
    ctx.font = '600 22px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('On the Celestial Meridian', 54, 122)

    // Illuminated drop-cap box
    ctx.fillStyle = '#231610'
    ctx.fillRect(54, 146, 52, 52)
    ctx.strokeStyle = '#c8a25b'
    ctx.lineWidth = 1.5
    ctx.strokeRect(54, 146, 52, 52)
    ctx.fillStyle = '#e3c27f'
    ctx.font = '700 36px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('A', 80, 184)

    // Crisp classical text lines
    ctx.fillStyle = '#33281d'
    ctx.font = '13px Georgia, serif'
    ctx.textAlign = 'left'
    const introLines = [
      'great circle passing through both',
      'celestial poles divides the hall into',
      'measured wings of memory and light.'
    ]
    introLines.forEach((line, i) => ctx.fillText(line, 118, 160 + i * 19))

    const bodyLines = [
      'Every treatise housed within the Grand Hall keeps its',
      'exact place upon the oak bays. Neither time nor cloud',
      'intervenes between the scholar and the original leaf.'
    ]
    bodyLines.forEach((line, i) => ctx.fillText(line, 54, 226 + i * 20))

    // Engraved astronomical projection diagram
    const cx = width / 2
    const cy = 438
    ctx.strokeStyle = '#7c5d2c'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.arc(cx, cy, 108, 0, Math.PI * 2)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(124, 93, 44, 0.7)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, 78, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(cx, cy, 108, 38, -0.32, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.ellipse(cx, cy, 42, 108, 0.22, 0, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - 126, cy)
    ctx.lineTo(cx + 126, cy)
    ctx.moveTo(cx, cy - 126)
    ctx.lineTo(cx, cy + 126)
    ctx.stroke()

    // Cardinal labels
    ctx.fillStyle = '#6b532f'
    ctx.font = '600 10px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ZENITH · XC°', cx, cy - 134)
    ctx.fillText('NADIR · CCLXX°', cx, cy + 144)
    ctx.fillText('FIG. I · ARMILLARY PROJECTION', cx, 608)
  } else {
    // Right leaf: crisp editorial text + warm gold & emerald highlights + freehand ink marginalia
    ctx.fillStyle = '#251d14'
    ctx.font = '600 20px Georgia, serif'
    ctx.textAlign = 'left'
    ctx.fillText('Non-Destructive Marginalia', 54, 122)

    // Warm translucent highlight bands behind specific phrases
    ctx.fillStyle = 'rgba(224, 178, 72, 0.42)'
    ctx.fillRect(52, 146, 368, 18)
    ctx.fillRect(52, 168, 286, 18)

    ctx.fillStyle = 'rgba(116, 178, 134, 0.34)'
    ctx.fillRect(52, 314, 384, 18)
    ctx.fillRect(52, 336, 210, 18)

    ctx.fillStyle = 'rgba(214, 148, 86, 0.36)'
    ctx.fillRect(52, 476, 350, 18)

    const paragraphs = [
      [
        'Every highlight, ink stroke, and bookmark lands',
        'precisely beneath your cursor without altering',
        'the underlying PDF bytes on your disk.'
      ],
      [
        'Full-text FTS5 indexing surfaces any passage,',
        'author, or margin note across thousands of',
        'local volumes in a single keystroke.'
      ],
      [
        'Study Mode clears the chrome away, leaving',
        'only archival paper, warm lamp tone, and',
        'a quiet session timer for deep work.'
      ]
    ]

    ctx.fillStyle = '#2d2318'
    ctx.font = '13.5px Georgia, serif'
    let y = 160
    paragraphs.forEach((lines) => {
      lines.forEach((line) => {
        ctx.fillText(line, 54, y)
        y += 22
      })
      y += 88
    })

    // Freehand sepia-gold ink underline & margin bracket
    ctx.strokeStyle = '#9c4328'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(54, 192)
    ctx.bezierCurveTo(138, 196, 232, 189, 342, 194)
    ctx.stroke()

    // Expressive ink bracket in right margin
    ctx.strokeStyle = '#7e5a23'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.moveTo(434, 308)
    ctx.quadraticCurveTo(450, 332, 434, 362)
    ctx.stroke()

    ctx.fillStyle = '#7e5a23'
    ctx.font = 'italic 12px Georgia, serif'
    ctx.fillText('cf. SQLite FTS5', 348, 396)

    // Ink circle accent around a footnote cue
    ctx.strokeStyle = '#9c4328'
    ctx.lineWidth = 1.9
    ctx.beginPath()
    ctx.ellipse(396, 486, 28, 12, -0.08, 0, Math.PI * 2)
    ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function createPageEdgeTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 256)
  ctx.fillStyle = '#d7c39a'
  ctx.fillRect(0, 0, 64, 256)
  for (let y = 0; y < 256; y += 3) {
    ctx.fillStyle = y % 6 === 0 ? 'rgba(130, 96, 44, 0.35)' : 'rgba(255, 245, 220, 0.3)'
    ctx.fillRect(0, y, 64, 1)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function createDustMoteTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(64, 64)
  const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
  grad.addColorStop(0, 'rgba(255, 235, 185, 1)')
  grad.addColorStop(0.32, 'rgba(218, 178, 102, 0.65)')
  grad.addColorStop(1, 'rgba(200, 162, 91, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createProceduralTextureBundle(): ProceduralTextureBundle {
  const brass = createBrassBandTextures()
  const leather = createLeatherTextures()
  const parchmentLeft = createParchmentLeafTexture('left')
  const parchmentRight = createParchmentLeafTexture('right')
  const pageEdge = createPageEdgeTexture()
  const dustMote = createDustMoteTexture()

  return {
    brassEngraving: brass.albedo,
    brassBump: brass.bump,
    leatherCover: leather.albedo,
    leatherBump: leather.bump,
    parchmentLeft,
    parchmentRight,
    pageEdge,
    dustMote,
    dispose: () => {
      brass.albedo.dispose()
      brass.bump.dispose()
      leather.albedo.dispose()
      leather.bump.dispose()
      parchmentLeft.dispose()
      parchmentRight.dispose()
      pageEdge.dispose()
      dustMote.dispose()
    }
  }
}
