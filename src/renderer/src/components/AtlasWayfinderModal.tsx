import { useEffect } from 'react'
import type { RoomAnchor } from '../room/scene-builders'
import { navigate } from '../router'
import { playSound } from '../sound'

interface AnchorEntry {
  id: string
  label: string
  meta?: string
  kind: RoomAnchor['kind']
  level: 1 | 2
}

interface Props {
  anchors: AnchorEntry[]
  totalBooks: number
  onJump: (anchorId: string) => void
  onClose: () => void
}

export function AtlasWayfinderModal({ anchors, totalBooks, onJump, onClose }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ground = anchors.filter((a) => a.level === 1)
  const upper = anchors.filter((a) => a.level === 2)

  return (
    <div className="dialog-scrim" role="presentation" onClick={onClose}>
      <div
        className="dialog atlas-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Hall Atlas Wayfinder"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="observatory-modal__head">
          <div>
            <p className="eyebrow">East Nave · Brass Armillary Globe</p>
            <h2 className="display">Hall Atlas Wayfinder</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close Atlas">
            ×
          </button>
        </header>

        <p className="atlas-modal__intro">
          {totalBooks} {totalBooks === 1 ? 'volume' : 'volumes'} shelved across Ground Nave and Wide Upper Gallery. Choose any wing or landmark to glide directly there.
        </p>

        <div className="atlas-modal__cols">
          <section>
            <p className="eyebrow">Ground Nave (Level 1)</p>
            <div className="atlas-modal__grid">
              {ground.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="atlas-modal__spot"
                  onClick={() => {
                    playSound('tick')
                    onJump(a.id)
                    onClose()
                  }}
                >
                  <span className="atlas-modal__spot-title">{a.label}</span>
                  {a.meta ? <span className="atlas-modal__spot-meta">{a.meta}</span> : null}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="eyebrow">Wide Upper Gallery (Level 2)</p>
            <div className="atlas-modal__grid">
              {upper.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="atlas-modal__spot"
                  onClick={() => {
                    playSound('tick')
                    onJump(a.id)
                    onClose()
                  }}
                >
                  <span className="atlas-modal__spot-title">{a.label}</span>
                  {a.meta ? <span className="atlas-modal__spot-meta">{a.meta}</span> : null}
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="atlas-modal__foot">
          <button
            type="button"
            className="button"
            onClick={() => {
              playSound('tick')
              onClose()
              navigate('map')
            }}
          >
            Open Full 2D Floor Plan
          </button>
          <button type="button" className="button button--quiet" onClick={onClose}>
            Return to Hall
          </button>
        </footer>
      </div>
    </div>
  )
}
