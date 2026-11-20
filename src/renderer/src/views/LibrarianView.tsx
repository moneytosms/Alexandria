import type { LibraryInfo } from '@shared/api'

interface Props {
  library: LibraryInfo | null
}

export function LibrarianView({ library }: Props) {
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
          <h3>Import queue</h3>
          <span className="badge">Idle</span>
        </div>
        <p>No files waiting. Drag a PDF anywhere in the room to add it.</p>
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
