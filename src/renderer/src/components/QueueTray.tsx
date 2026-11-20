import { useImportStore } from '../state/import-store'

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function rejectionReason(reason: 'unsupported' | 'unreadable'): string {
  return reason === 'unsupported' ? 'not a supported document' : 'could not be read'
}

export function QueueTray() {
  const candidates = useImportStore((state) => state.candidates)
  const rejected = useImportStore((state) => state.rejected)
  const error = useImportStore((state) => state.error)
  const clear = useImportStore((state) => state.clear)

  if (candidates.length === 0 && rejected.length === 0 && !error) return null

  return (
    <aside className="queue" aria-label="Import queue" aria-live="polite">
      <div className="queue__head">
        <div>
          <p className="eyebrow">Import queue</p>
          <h2>
            {candidates.length} {candidates.length === 1 ? 'volume' : 'volumes'} queued
          </h2>
        </div>
        <button className="queue__clear" type="button" onClick={clear}>
          Clear
        </button>
      </div>

      {candidates.length > 0 ? (
        <ul className="queue__list">
          {candidates.slice(0, 6).map((file) => (
            <li key={file.path}>
              <span className="queue__name" title={file.path}>
                {file.name}
              </span>
              <span className="queue__meta">
                {file.format.toUpperCase()} · {formatSize(file.size)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {candidates.length > 6 ? (
        <p className="queue__more">and {candidates.length - 6} more</p>
      ) : null}

      {rejected.length > 0 ? (
        <div className="queue__rejected">
          <p>
            {rejected.length} {rejected.length === 1 ? 'file was' : 'files were'} skipped
          </p>
          <ul>
            {rejected.slice(0, 3).map((file) => (
              <li key={file.path} title={file.path}>
                {file.name} · {rejectionReason(file.reason)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {error ? <p className="queue__error">{error}</p> : null}
    </aside>
  )
}
