import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export interface TouchMoveVector {
  forward: number
  right: number
}

interface Props {
  onVectorChange: (vector: TouchMoveVector) => void
}

const MAX_RADIUS = 38

/**
 * Translucent obsidian-and-brass virtual analog thumbstick for 3D Grand Hall
 * walking and stair ascent on touch devices (tablets & mobile browsers).
 */
export function TouchMovePad({ onVectorChange }: Props) {
  const padRef = useRef<HTMLDivElement | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const [knob, setKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false
  })

  const updateFromClient = (clientX: number, clientY: number): void => {
    const pad = padRef.current
    if (!pad) return
    const rect = pad.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = clientX - cx
    let dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    if (dist > MAX_RADIUS) {
      const scale = MAX_RADIUS / dist
      dx *= scale
      dy *= scale
    }
    setKnob({ x: dx, y: dy, active: true })
    const normX = Math.abs(dx) < 5 ? 0 : dx / MAX_RADIUS
    const normY = Math.abs(dy) < 5 ? 0 : -dy / MAX_RADIUS
    onVectorChange({ forward: normY, right: normX })
  }

  const reset = (): void => {
    activePointerRef.current = null
    setKnob({ x: 0, y: 0, active: false })
    onVectorChange({ forward: 0, right: 0 })
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (activePointerRef.current !== null) return
    event.stopPropagation()
    activePointerRef.current = event.pointerId
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromClient(event.clientX, event.clientY)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (activePointerRef.current !== event.pointerId) return
    event.stopPropagation()
    updateFromClient(event.clientX, event.clientY)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (activePointerRef.current !== event.pointerId) return
    event.stopPropagation()
    reset()
  }

  return (
    <div
      ref={padRef}
      className={`touch-pad ${knob.active ? 'touch-pad--active' : ''}`}
      role="application"
      aria-label="Walk movement pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <span className="touch-pad__crosshair" aria-hidden="true" />
      <span
        className="touch-pad__knob"
        aria-hidden="true"
        style={{ transform: `translate3d(${knob.x}px, ${knob.y}px, 0)` }}
      />
      <span className="touch-pad__label" aria-hidden="true">
        Move
      </span>
    </div>
  )
}
