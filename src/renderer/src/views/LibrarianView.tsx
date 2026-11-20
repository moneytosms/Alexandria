import type { LibraryInfo } from '@shared/api'
import { pickImportFiles, pickImportFolder } from '../import-actions'
import { useImportStore } from '../state/import-store'

interface Props {
  library: LibraryInfo | null
}

export function LibrarianView({ library }: Props) {
  const queued = useImportStore((state) => state.candidates.length)

  return (
    <div className="librarian">
      <article className="panel panel--wide">
        <p className="eyebrow">Collection</p>
        <h2 className="display">The desk is clear.</h2>
        <p className="lede">
          Imports, relinking, and shelf repairs will queue here. Nothing needs attention in a
          fresh library.
        </p>
        <dl className="panel__stats">
          <div>
            <dt>Volumes</dt>
            <dd>{library?.books ?? '—'}</dd>
          </div>
          <div>
            <dt>Shelves</dt>
            <dd>{library?.shelves ?? '—'}</dd>
          </div>
          <div>
            <dt>Open slots</dt>
            <dd>{library ? library.slots - library.books : '—'}</dd>
          </div>
        </dl>
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Import</h3>
          <span className="badge">{queued > 0 ? `${queued} queued` : 'Idle'}</span>
        </div>
        <p>Drop files or folders anywhere in the room, or choose them here.</p>
        <div className="panel__actions">
          <button className="button" type="button" onClick={() => void pickImportFiles()}>
            Import files
          </button>
          <button className="button button--quiet" type="button" onClick={() => void pickImportFolder()}>
            Scan folder
          </button>
        </div>
        <p className="panel__formats">PDF, PPTX, PPT, DOCX, DOC, ODP, ODT</p>
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Layout</h3>
          <span className="badge badge--calm">Stable</span>
        </div>
        <p>
          {library
            ? `${library.floors} floor · ${library.sections} sections · ${library.shelves} shelves`
            : 'Waiting for the library.'}
        </p>
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Integrity</h3>
          <span className="badge badge--calm">Checked</span>
        </div>
        <p>Linked files are verified at launch. Missing volumes are flagged, never deleted.</p>
      </article>
    </div>
  )
}
