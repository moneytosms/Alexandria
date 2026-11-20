import { cancelImports, runQueuedImports } from '../import-actions'
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
  const importing = useImportStore((state) => state.importing)
  const progress = useImportStore((state) => state.progress)
  const lastRun = useImportStore((state) => state.lastRun)
  const clear = useImportStore((state) => state.clear)

  if (candidates.length === 0 && rejected.length === 0 && !error && !lastRun && !importing) {
    return null
  }

  const title = importing
    ? 'Importing…'
    : candidates.length > 0
      ? `${candidates.length} ${candidates.length === 1 ? 'volume' : 'volumes'} queued`
      : lastRun
        ? 'Import finished'
        : 'Nothing queued'

  const failures = lastRun?.outcomes.filter((outcome) => outcome.status === 'failed') ?? []

  return (
    <aside className="queue" aria-label="Import queue" aria-live="polite">
      <div className="queue__head">
        <div>
          <p className="eyebrow">Import queue</p>
          <h2>{title}</h2>
        </div>
        <div className="queue__actions">
          {importing ? (
            <button className="queue__clear" type="button" onClick={() => void cancelImports()}>
              Cancel
            </button>
          ) : (
            <button className="queue__clear" type="button" onClick={clear}>
              Clear
            </button>
          )}
          {candidates.length > 0 ? (
            <button
              className="button queue__import"
              type="button"
              onClick={() => void runQueuedImports()}
              disabled={importing}
            >
              {importing ? 'Working…' : 'Import now'}
            </button>
          ) : null}
        </div>
      </div>

      {importing && progress ? (
        <div className="queue__progress">
          <div className="queue__progress-head">
            <span title={progress.name}>{progress.name}</span>
            <span>
              {progress.index}/{progress.total}
            </span>
          </div>
          <div className="queue__bar" aria-hidden="true">
            <span
              style={{
                width: `${
                  progress.phase === 'indexing' && progress.pages
                    ? Math.round(((progress.current ?? 0) / progress.pages) * 100)
                    : Math.round(((progress.index - 1) / Math.max(1, progress.total)) * 100)
                }%`
              }}
            />
          </div>
          <p className="queue__phase">
            {progress.phase === 'queued'
              ? 'Waiting'
              : progress.phase === 'converting'
                ? 'Converting with LibreOffice'
                : progress.phase === 'reading'
                  ? 'Reading the converted PDF'
                  : progress.pages
                    ? `Indexing page ${progress.current ?? 0} of ${progress.pages}`
                    : 'Indexing text'}
          </p>
        </div>
      ) : null}

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

      {lastRun ? (
        <p className="queue__summary">
          {lastRun.imported} imported · {lastRun.duplicates} duplicate
          {lastRun.duplicates === 1 ? '' : 's'} · {lastRun.failed} failed
        </p>
      ) : null}

      {failures.length > 0 ? (
        <ul className="queue__failures">
          {failures.slice(0, 3).map((outcome) => (
            <li key={outcome.path} title={outcome.path}>
              {outcome.name} · {outcome.message ?? 'import failed'}
            </li>
          ))}
        </ul>
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
