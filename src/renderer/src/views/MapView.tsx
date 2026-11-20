import type { LibraryInfo } from '@shared/api'

interface Props {
  library: LibraryInfo | null
}

export function MapView({ library }: Props) {
  return (
    <div className="map">
      <div className="map__plan" aria-label="Ground floor plan">
        <div className="map__section map__section--north">
          <span className="map__wall">North</span>
          <span className="map__detail">1 bay</span>
        </div>
        <div className="map__section map__section--west">
          <span className="map__wall">West</span>
          <span className="map__detail">1 bay</span>
        </div>
        <div className="map__hall">
          <span className="map__hall-name">Main Hall</span>
          <span className="map__detail">Reading desks · entrance</span>
        </div>
        <div className="map__section map__section--east">
          <span className="map__wall">East</span>
          <span className="map__detail">1 bay</span>
        </div>
        <div className="map__section map__section--south">
          <span className="map__wall">South</span>
          <span className="map__detail">1 bay</span>
        </div>
      </div>

      <aside className="map__side">
        <p className="eyebrow">Ground floor</p>
        <h2 className="display">One hall, four walls.</h2>
        <p className="lede">
          Each wall holds a section. A section grows by adding bays at its end; nothing already
          shelved moves when the collection does.
        </p>

        <dl className="map__stats">
          <div>
            <dt>Floors</dt>
            <dd>{library?.floors ?? '—'}</dd>
          </div>
          <div>
            <dt>Sections</dt>
            <dd>{library?.sections ?? '—'}</dd>
          </div>
          <div>
            <dt>Shelves</dt>
            <dd>{library?.shelves ?? '—'}</dd>
          </div>
          <div>
            <dt>Slots</dt>
            <dd>{library?.slots ?? '—'}</dd>
          </div>
        </dl>
      </aside>
    </div>
  )
}
