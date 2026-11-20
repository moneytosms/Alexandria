import type { LibraryInfo } from '@shared/api'
import { navigate } from '../router'

interface Props {
  library: LibraryInfo | null
}

export function IndexView({ library }: Props) {
  const empty = !library || library.books === 0

  return (
    <div className="index">
      <div className="index__bar">
        <p className="index__count">
          {library?.books ?? '—'} {library?.books === 1 ? 'volume' : 'volumes'}
        </p>
        <span className="index__hint">Sorted by date added</span>
      </div>

      <div className="index__table-wrap">
        <table className="index__table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Author</th>
              <th scope="col">Pages</th>
              <th scope="col">Shelf</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {empty ? (
              <tr>
                <td colSpan={5}>
                  <div className="index__empty">
                    <p className="eyebrow">Empty catalogue</p>
                    <p>No volumes yet. The first import will appear here and on a shelf.</p>
                    <button
                      className="button button--quiet"
                      type="button"
                      onClick={() => navigate('room')}
                    >
                      Return to the room
                    </button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="index__footnote">
        {library ? library.root : 'The library folder is being prepared.'}
      </p>
    </div>
  )
}
