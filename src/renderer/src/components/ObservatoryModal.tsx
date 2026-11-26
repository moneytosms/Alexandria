import { useEffect, useRef, useState } from 'react'
import type { HallMood } from '../room/atmosphere'
import { playSound } from '../sound'

interface Props {
  mood: HallMood
  onChangeMood: (mood: HallMood) => void
  onClose: () => void
}

interface Constellation {
  name: string
  latin: string
  note: string
  stars: Array<[number, number, number]> // normalized [-1..1] sky coords + magnitude radius
  edges: Array<[number, number]>
}

const CONSTELLATIONS: Constellation[] = [
  {
    name: 'Carina & Canopus',
    latin: 'ARGO NAVIS · ALPHA CARINAE',
    note: 'The guiding southern star used by Alexandrian navigators and Posidonius to measure Earth latitude.',
    stars: [
      [-0.58, 0.34, 3.4],
      [-0.38, 0.42, 2.0],
      [-0.22, 0.25, 2.2],
      [-0.45, 0.14, 1.8]
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0]
    ]
  },
  {
    name: 'Orion',
    latin: 'ORIONIS · EQUATORIAL HUNTER',
    note: 'Anchored by Betelgeuse and Rigel; its three belt stars cross the celestial equator above the Mediterranean.',
    stars: [
      [0.08, -0.36, 3.0],
      [0.34, -0.32, 2.2],
      [0.14, -0.06, 2.3],
      [0.21, -0.04, 2.4],
      [0.28, -0.02, 2.3],
      [0.06, 0.28, 2.1],
      [0.36, 0.26, 3.1]
    ],
    edges: [
      [0, 1],
      [0, 2],
      [1, 4],
      [2, 3],
      [3, 4],
      [2, 5],
      [4, 6],
      [5, 6]
    ]
  },
  {
    name: 'Ursa Major',
    latin: 'SEPTENTRIO · NORTHERN BEAR',
    note: 'Circumpolar pointers Dubhe and Merak trace directly toward the northern pole of the armillary meridian.',
    stars: [
      [-0.68, -0.44, 2.3],
      [-0.52, -0.48, 2.4],
      [-0.38, -0.39, 2.1],
      [-0.26, -0.34, 2.4],
      [-0.24, -0.18, 2.2],
      [-0.08, -0.2, 2.4],
      [-0.08, -0.36, 2.7]
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 3]
    ]
  },
  {
    name: 'Cassiopeia',
    latin: 'CASSIOPEIAE · CELESTIAL THRONE',
    note: 'Five luminous stars opposite the Bear across the pole, marking the winter Milky Way band.',
    stars: [
      [0.48, -0.46, 2.3],
      [0.57, -0.32, 2.5],
      [0.67, -0.42, 2.4],
      [0.77, -0.27, 2.2],
      [0.86, -0.38, 2.0]
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4]
    ]
  },
  {
    name: 'Lyra & Vega',
    latin: 'LYRAE · ALPHA LYRAE',
    note: 'Home to brilliant blue-white Vega, zenith beacon of Alexandrian summer nights.',
    stars: [
      [0.56, 0.22, 3.3],
      [0.64, 0.34, 2.0],
      [0.74, 0.32, 2.0],
      [0.72, 0.46, 1.9],
      [0.62, 0.48, 1.9]
    ],
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 1]
    ]
  }
]

const SKY_MOODS: Array<{ id: HallMood; label: string }> = [
  { id: 'dusk', label: 'Warm Dusk' },
  { id: 'dawn', label: 'Morning Dawn' },
  { id: 'afternoon', label: 'Golden Sun' },
  { id: 'storm', label: 'Stormy Night' }
]

export function ObservatoryModal({ mood, onChangeMood, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 })

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const cx = w / 2 + pan.x
    const cy = h / 2 + pan.y

    // Sky backdrop based on active mood
    const bgGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.6)
    if (mood === 'afternoon') {
      bgGrad.addColorStop(0, '#273852')
      bgGrad.addColorStop(1, '#101824')
    } else if (mood === 'storm') {
      bgGrad.addColorStop(0, '#131d2d')
      bgGrad.addColorStop(1, '#070a10')
    } else if (mood === 'dawn') {
      bgGrad.addColorStop(0, '#1c243a')
      bgGrad.addColorStop(1, '#090c16')
    } else {
      bgGrad.addColorStop(0, '#1c1824')
      bgGrad.addColorStop(1, '#09070b')
    }
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, w, h)

    // Subtle brass celestial coordinate grid
    ctx.strokeStyle = 'rgba(200, 162, 91, 0.16)'
    ctx.lineWidth = 1
    for (const r of [90, 175, 260]) {
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    for (let deg = 0; deg < 180; deg += 30) {
      const rad = (deg * Math.PI) / 180
      ctx.beginPath()
      ctx.moveTo(cx - Math.cos(rad) * 320, cy - Math.sin(rad) * 320)
      ctx.lineTo(cx + Math.cos(rad) * 320, cy + Math.sin(rad) * 320)
      ctx.stroke()
    }

    // Deterministic background starfield
    for (let i = 0; i < 160; i += 1) {
      const sx = ((Math.sin(i * 127.1 + 3.1) * 43758.5453) % 1 + 1) % 1
      const sy = ((Math.sin(i * 269.5 + 1.7) * 28461.1234) % 1 + 1) % 1
      const px = ((sx * w + pan.x * 0.45) % w + w) % w
      const py = ((sy * h + pan.y * 0.45) % h + h) % h
      const alpha = 0.2 + (i % 5) * 0.12
      ctx.fillStyle = `rgba(242, 232, 206, ${alpha})`
      ctx.beginPath()
      ctx.arc(px, py, i % 7 === 0 ? 1.5 : 0.9, 0, Math.PI * 2)
      ctx.fill()
    }

    // Constellations
    CONSTELLATIONS.forEach((con, idx) => {
      const active = idx === selectedIdx
      const pts = con.stars.map(([nx, ny, r]) => ({
        x: cx + nx * (w * 0.42),
        y: cy + ny * (h * 0.42),
        r
      }))

      ctx.strokeStyle = active ? 'rgba(227, 194, 107, 0.85)' : 'rgba(200, 162, 91, 0.34)'
      ctx.lineWidth = active ? 1.6 : 1
      for (const [a, b] of con.edges) {
        const pa = pts[a]
        const pb = pts[b]
        if (!pa || !pb) continue
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.stroke()
      }

      for (const p of pts) {
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (active ? 4.2 : 2.8))
        glow.addColorStop(0, active ? 'rgba(255, 244, 210, 0.95)' : 'rgba(240, 224, 188, 0.7)')
        glow.addColorStop(1, 'rgba(200, 162, 91, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * (active ? 4.2 : 2.8), 0, Math.PI * 2)
        ctx.fill()

        ctx.fillStyle = active ? '#fff8e2' : '#eadcc0'
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      const labelPt = pts[0]
      if (labelPt) {
        ctx.font = active ? '600 12px Inter, sans-serif' : '500 10px Inter, sans-serif'
        ctx.fillStyle = active ? '#e9c878' : 'rgba(218, 200, 168, 0.65)'
        ctx.fillText(con.name.toUpperCase(), labelPt.x + 10, labelPt.y - 8)
      }
    })

    // Brass eyepiece reticle ring
    ctx.strokeStyle = 'rgba(200, 162, 91, 0.5)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.46, 0, Math.PI * 2)
    ctx.stroke()
  }, [mood, pan, selectedIdx])

  const selected = CONSTELLATIONS[selectedIdx]

  return (
    <div className="dialog-scrim" role="presentation" onClick={onClose}>
      <div
        className="dialog observatory-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Observatory Telescope Star Chart"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="observatory-modal__head">
          <div>
            <p className="eyebrow">North-West Mezzanine · Brass Refractor</p>
            <h2 className="display">Alexandria Observatory</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close Observatory"
          >
            ×
          </button>
        </header>

        <div className="observatory-modal__body">
          <div
            className="observatory-modal__lens"
            onPointerDown={(e) => {
              dragRef.current = { active: true, x: e.clientX, y: e.clientY }
            }}
            onPointerMove={(e) => {
              if (!dragRef.current.active) return
              const dx = e.clientX - dragRef.current.x
              const dy = e.clientY - dragRef.current.y
              dragRef.current = { active: true, x: e.clientX, y: e.clientY }
              setPan((p) => ({
                x: Math.max(-130, Math.min(130, p.x + dx)),
                y: Math.max(-95, Math.min(95, p.y + dy))
              }))
            }}
            onPointerUp={() => {
              dragRef.current.active = false
            }}
            onPointerLeave={() => {
              dragRef.current.active = false
            }}
          >
            <canvas ref={canvasRef} width={580} height={340} />
            <span className="observatory-modal__drag-hint">Drag sky chart to pan · 31°12′ N 29°55′ E</span>
          </div>

          <div className="observatory-modal__sidebar">
            <div className="observatory-modal__section">
              <p className="eyebrow">Tracked Constellations</p>
              <div className="observatory-modal__list">
                {CONSTELLATIONS.map((c, idx) => (
                  <button
                    key={c.name}
                    type="button"
                    className={`observatory-modal__item ${idx === selectedIdx ? 'observatory-modal__item--on' : ''}`}
                    onClick={() => {
                      playSound('tick')
                      setSelectedIdx(idx)
                      setPan({ x: 0, y: 0 })
                    }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="observatory-modal__note">
              <p className="observatory-modal__latin">{selected.latin}</p>
              <p>{selected.note}</p>
            </div>

            <div className="observatory-modal__section">
              <p className="eyebrow">Hall Sky &amp; Weather</p>
              <div className="observatory-modal__moods">
                {SKY_MOODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`chip ${mood === m.id ? 'chip--active' : ''}`}
                    onClick={() => {
                      playSound('tick')
                      onChangeMood(m.id)
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
