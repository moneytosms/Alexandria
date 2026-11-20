import type { LibraryInfo } from '@shared/api'
import { pickImportFiles } from '../import-actions'
import { navigate } from '../router'

interface Props {
  library: LibraryInfo | null
}

export function RoomView({ library }: Props) {
  return (
    <div className="room">
      <div className="room__glow" aria-hidden="true" />
      <div className="room__copy">
        <p className="eyebrow">Ground floor · Main hall</p>
        <h2 className="display">Every library begins with one shelf.</h2>
        <p className="lede">
          Alexandria keeps your PDFs in a room you can walk through. Import a collection, shelve
          it by hand, and read without leaving the building.
        </p>

        <div className="room__actions">
          <button className="button" type="button" onClick={() => void pickImportFiles()}>
            Import files
          </button>
          <button className="button button--quiet" type="button" onClick={() => navigate('index')}>
            Browse the index
          </button>
        </div>

        <dl className="room__stats">
          <div>
            <dt>Volumes</dt>
            <dd>{library?.books ?? '—'}</dd>
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
      </div>

      <div className="room__architecture" aria-hidden="true">
        <div className="arch arch--far" />
        <div className="arch arch--mid" />
        <div className="arch arch--near" />
        <div className="room__floor" />
      </div>
    </div>
  )
}
