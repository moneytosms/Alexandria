import { GALLERY_Y, EYE_HEIGHT } from '../room/physics'

export interface HallTourStop {
  id: string
  chapter: string
  title: string
  caption: string
  position: [number, number, number]
  lookAt: [number, number, number]
  floorY: number
  durationMs: number
}

export const HALL_TOUR_STOPS: HallTourStop[] = [
  {
    id: 'entrance',
    chapter: 'STOP I OF VI',
    title: 'The Grand Nave & Celestial Armillary',
    caption:
      'Welcome to Alexandria. Beneath the vaulted oculus, counter-rotating brass meridians turn slowly above the inlaid marble compass rose.',
    position: [0, EYE_HEIGHT, 4.9],
    lookAt: [0, 3.2, -1.8],
    floorY: 0,
    durationMs: 6500
  },
  {
    id: 'desk',
    chapter: 'STOP II OF VI',
    title: 'The Architect Reading Desk & Scholar Ledger',
    caption:
      'Active volumes, inbox folios, your study timer, and daily reading quests gather under twin emerald banker lamps at the heart of the hall.',
    position: [1.65, EYE_HEIGHT, 2.35],
    lookAt: [0, 0.95, 0.35],
    floorY: 0,
    durationMs: 6500
  },
  {
    id: 'hearth-ladders',
    chapter: 'STOP III OF VI',
    title: 'The Limestone Hearth & Rolling Ladders',
    caption:
      'Stoke the carved fireplace in the South-West nave for warm firelight and crackling cedar audio, or climb rolling walnut ladders along the tall bays.',
    position: [-2.6, EYE_HEIGHT, 3.3],
    lookAt: [-4.55, 1.15, 6.2],
    floorY: 0,
    durationMs: 6500
  },
  {
    id: 'staircase',
    chapter: 'STOP IV OF VI',
    title: 'Ascending the Flush Corner Staircase',
    caption:
      'Anchored seamlessly along the South and East walls, two walnut-and-brass flights rise smoothly past the corner landing onto the wide gallery.',
    position: [4.2, 1.05 + EYE_HEIGHT, 5.9],
    lookAt: [6.8, 2.7, 3.2],
    floorY: 1.05,
    durationMs: 6500
  },
  {
    id: 'observatory',
    chapter: 'STOP V OF VI',
    title: 'The Wide Upper Gallery & Observatory',
    caption:
      'The 2.15 m promenade wraps cleanly around the nave. Peer through the North-West brass refractor to explore classical Alexandrian star charts.',
    position: [-5.5, GALLERY_Y + EYE_HEIGHT, -5.65],
    lookAt: [0, 3.6, 0.2],
    floorY: GALLERY_Y,
    durationMs: 7000
  },
  {
    id: 'secret-nook',
    chapter: 'STOP VI OF VI',
    title: 'The Secret Upper Study Nook',
    caption:
      'Tucked behind a pierced walnut screen at the far South-West gallery awaits a candlelit leather armchair and the Rare Archival Codex.',
    position: [-4.35, GALLERY_Y + EYE_HEIGHT, 5.85],
    lookAt: [-6.45, GALLERY_Y + 0.95, 6.05],
    floorY: GALLERY_Y,
    durationMs: 7500
  }
]

interface Props {
  stopIndex: number
  paused: boolean
  onPrev: () => void
  onNext: () => void
  onTogglePause: () => void
  onExit: () => void
}

export function HallTourOverlay({
  stopIndex,
  paused,
  onPrev,
  onNext,
  onTogglePause,
  onExit
}: Props) {
  const stop = HALL_TOUR_STOPS[stopIndex] ?? HALL_TOUR_STOPS[0]

  return (
    <div className="tour-card" role="region" aria-label="Guided Grand Hall Tour">
      <div className="tour-card__top">
        <span className="tour-card__chapter">{stop.chapter}</span>
        <div className="tour-card__progress" aria-hidden="true">
          {HALL_TOUR_STOPS.map((entry, idx) => (
            <span
              key={entry.id}
              className={`tour-card__bar ${idx <= stopIndex ? 'tour-card__bar--on' : ''}`}
            />
          ))}
        </div>
      </div>

      <h3 className="tour-card__title">{stop.title}</h3>
      <p className="tour-card__caption">{stop.caption}</p>

      <div className="tour-card__controls">
        <button type="button" className="tour-card__btn" onClick={onPrev} disabled={stopIndex === 0}>
          Previous
        </button>
        <button type="button" className="tour-card__btn" onClick={onTogglePause}>
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="tour-card__btn tour-card__btn--primary"
          onClick={stopIndex >= HALL_TOUR_STOPS.length - 1 ? onExit : onNext}
        >
          {stopIndex >= HALL_TOUR_STOPS.length - 1 ? 'Finish Tour' : 'Next Stop'}
        </button>
        <button type="button" className="tour-card__exit" onClick={onExit} title="Exit Tour (Esc)">
          Exit (Esc)
        </button>
      </div>
    </div>
  )
}
