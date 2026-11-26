import { useEffect, useRef, useState } from 'react'
import {
  GALLERY_Y,
  ROOM_DEPTH,
  ROOM_WIDTH,
  SECRET_NOOK_BOUNDS,
  STAIR_SPEC,
  WALKWAY_DEPTH
} from '../room/physics'

export interface MiniMapMarker {
  id: string
  anchorId: string
  label: string
  kind: 'shelf' | 'desk' | 'globe' | 'gramophone' | 'fireplace' | 'balcony' | 'stairs' | 'nook' | 'ladder'
  x: number
  z: number
  level: 1 | 2
  shelfId?: number
  count?: number
}

export interface MiniMapPlayerPose {
  x: number
  y: number
  z: number
  yaw: number
}

interface Props {
  markers: MiniMapMarker[]
  poseRef: React.MutableRefObject<MiniMapPlayerPose>
  onJump: (anchorId: string) => void
  visible: boolean
  onToggleVisible: () => void
}

const SVG_W = 192
const SVG_H = 168
const PAD = 14

function toSvgX(worldX: number): number {
  return PAD + ((worldX + ROOM_WIDTH / 2) / ROOM_WIDTH) * (SVG_W - PAD * 2)
}

function toSvgY(worldZ: number): number {
  return PAD + ((worldZ + ROOM_DEPTH / 2) / ROOM_DEPTH) * (SVG_H - PAD * 2)
}

export function MiniMapHud({ markers, poseRef, onJump, visible, onToggleVisible }: Props) {
  const [viewLevel, setViewLevel] = useState<'auto' | 1 | 2>('auto')
  const [liveLevel, setLiveLevel] = useState<1 | 2>(1)
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null)
  const playerGroupRef = useRef<SVGGElement | null>(null)

  useEffect(() => {
    if (!visible) return
    let raf = 0
    let lastLevel: 1 | 2 = 1

    const update = (): void => {
      const pose = poseRef.current
      const el = playerGroupRef.current
      if (el) {
        const sx = toSvgX(pose.x)
        const sy = toSvgY(pose.z)
        // Camera looks along (-sin(yaw), -cos(yaw)); SVG up is -Y, so rotate by -yaw deg
        const deg = (-pose.yaw * 180) / Math.PI
        el.setAttribute('transform', `translate(${sx.toFixed(1)}, ${sy.toFixed(1)}) rotate(${deg.toFixed(1)})`)
      }
      const nextLevel: 1 | 2 = pose.y >= GALLERY_Y * 0.55 ? 2 : 1
      if (nextLevel !== lastLevel) {
        lastLevel = nextLevel
        setLiveLevel(nextLevel)
      }
      raf = requestAnimationFrame(update)
    }

    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [poseRef, visible])

  if (!visible) {
    return (
      <button
        type="button"
        className="minimap-pill"
        onClick={onToggleVisible}
        title="Show Hall Mini-Map (N)"
      >
        Mini-Map
      </button>
    )
  }

  const activeLevel: 1 | 2 = viewLevel === 'auto' ? liveLevel : viewLevel
  const levelMarkers = markers.filter((m) => m.level === activeLevel || m.kind === 'stairs')

  const innerX = ROOM_WIDTH / 2 - WALKWAY_DEPTH
  const innerZ = ROOM_DEPTH / 2 - WALKWAY_DEPTH

  return (
    <aside className="minimap" aria-label="Hall Mini-Map">
      <div className="minimap__head">
        <span className="minimap__title">
          {activeLevel === 1 ? 'Ground Nave' : 'Mezzanine'}
        </span>
        <div className="minimap__controls">
          <button
            type="button"
            className={`minimap__lvl ${activeLevel === 1 ? 'minimap__lvl--on' : ''}`}
            onClick={() => setViewLevel(1)}
            title="Ground floor plan"
          >
            L1
          </button>
          <button
            type="button"
            className={`minimap__lvl ${activeLevel === 2 ? 'minimap__lvl--on' : ''}`}
            onClick={() => setViewLevel(2)}
            title="Upper mezzanine balcony"
          >
            L2
          </button>
          <button
            type="button"
            className="minimap__close"
            onClick={onToggleVisible}
            aria-label="Hide mini-map"
            title="Hide Mini-Map (N)"
          >
            ×
          </button>
        </div>
      </div>

      <svg
        className="minimap__svg"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        role="img"
        aria-label="Grand Hall floor plan"
      >
        {/* Outer hall walls */}
        <rect
          x={PAD}
          y={PAD}
          width={SVG_W - PAD * 2}
          height={SVG_H - PAD * 2}
          className="minimap__room"
        />

        {activeLevel === 1 ? (
          <>
            {/* Central Runner Rug */}
            <rect
              x={toSvgX(-2.2)}
              y={toSvgY(-4.35)}
              width={toSvgX(2.2) - toSvgX(-2.2)}
              height={toSvgY(4.85) - toSvgY(-4.35)}
              className="minimap__rug"
            />
            {/* Reading Desk footprint */}
            <rect
              x={toSvgX(-1.45)}
              y={toSvgY(-0.31)}
              width={toSvgX(1.45) - toSvgX(-1.45)}
              height={toSvgY(1.01) - toSvgY(-0.31)}
              className="minimap__desk"
            />
            {/* Grand Staircase footprint (South-East) */}
            <rect
              x={toSvgX(STAIR_SPEC.f1StartX)}
              y={toSvgY(STAIR_SPEC.f1MinZ)}
              width={toSvgX(STAIR_SPEC.landingMaxX) - toSvgX(STAIR_SPEC.f1StartX)}
              height={toSvgY(STAIR_SPEC.f1MaxZ) - toSvgY(STAIR_SPEC.f1MinZ)}
              className="minimap__stairs"
            />
            <rect
              x={toSvgX(STAIR_SPEC.f2MinX)}
              y={toSvgY(STAIR_SPEC.f2EndZ)}
              width={toSvgX(STAIR_SPEC.f2MaxX) - toSvgX(STAIR_SPEC.f2MinX)}
              height={toSvgY(STAIR_SPEC.f2StartZ) - toSvgY(STAIR_SPEC.f2EndZ)}
              className="minimap__stairs"
            />
          </>
        ) : (
          <>
            {/* Open central nave void on Mezzanine level */}
            <rect
              x={toSvgX(-innerX)}
              y={toSvgY(-innerZ)}
              width={toSvgX(innerX) - toSvgX(-innerX)}
              height={toSvgY(innerZ) - toSvgY(-innerZ)}
              className="minimap__void"
            />
            {/* Open stairwell cutout (South-East) */}
            <rect
              x={toSvgX(STAIR_SPEC.southBalconyMaxX)}
              y={toSvgY(STAIR_SPEC.f2EndZ)}
              width={toSvgX(ROOM_WIDTH / 2) - toSvgX(STAIR_SPEC.southBalconyMaxX)}
              height={toSvgY(ROOM_DEPTH / 2) - toSvgY(STAIR_SPEC.f2EndZ)}
              className="minimap__stairs"
            />
            {/* Secret Upper Study Nook alcove (South-West) */}
            <rect
              x={toSvgX(SECRET_NOOK_BOUNDS.minX)}
              y={toSvgY(SECRET_NOOK_BOUNDS.minZ)}
              width={toSvgX(SECRET_NOOK_BOUNDS.maxX) - toSvgX(SECRET_NOOK_BOUNDS.minX)}
              height={toSvgY(SECRET_NOOK_BOUNDS.maxZ) - toSvgY(SECRET_NOOK_BOUNDS.minZ)}
              className="minimap__nook"
            />
          </>
        )}

        {/* Interactive Shelf & Landmark Markers */}
        {levelMarkers.map((marker) => {
          const mx = toSvgX(marker.x)
          const my = toSvgY(marker.z)
          const isShelf = marker.kind === 'shelf'
          return (
            <g
              key={marker.id}
              className={`minimap__marker minimap__marker--${marker.kind}`}
              onClick={() => onJump(marker.anchorId)}
              onMouseEnter={() => setHoveredLabel(marker.label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <title>{marker.label}</title>
              {isShelf ? (
                <rect x={mx - 4.5} y={my - 4.5} width={9} height={9} rx={1.5} />
              ) : (
                <circle cx={mx} cy={my} r={4} />
              )}
            </g>
          )
        })}

        {/* Live Player Dot & Gaze Cone */}
        <g
          ref={playerGroupRef}
          className={`minimap__player ${liveLevel !== activeLevel ? 'minimap__player--ghost' : ''}`}
        >
          <path d="M 0 0 L -8 -18 A 20 20 0 0 1 8 -18 Z" className="minimap__cone" />
          <circle cx={0} cy={0} r={3.6} className="minimap__dot" />
        </g>
      </svg>

      <div className="minimap__foot">
        <span>{hoveredLabel ?? 'Click marker to glide'}</span>
      </div>
    </aside>
  )
}
