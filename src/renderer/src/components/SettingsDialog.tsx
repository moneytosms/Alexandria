import type { AppInfo, LibraryHealth, LibraryInfo } from '@shared/api'
import { useEffect, useMemo, useState } from 'react'
import { formatShortcut, usePlatformCapabilities } from '../platform'
import { useLibraryStore } from '../state/library-store'
import { useSettingsStore } from '../state/settings-store'
import { usePlayerStore, useUiStore } from '../state/ui-store'
import { isDemoBridgeActive, resetStaticDemoLibrary } from '../static-demo-bridge'

interface Props {
  library: LibraryInfo | null
}

export function SettingsDialog({ library }: Props) {
  const platform = usePlatformCapabilities()
  const shortcuts = useMemo<Array<[string, string]>>(
    () => [
      [formatShortcut('K', platform), 'Search the library'],
      ['← / →, PgUp / PgDn', 'Turn pages'],
      ['Home / End', 'First / last page'],
      ['+ / -', 'Zoom in / out'],
      ['F', 'Full screen'],
      ['B', 'Bookmark this page'],
      ['H', 'Highlight tool'],
      ['I', 'Ink tool'],
      ['E', 'Eraser'],
      ['S', 'Two-page spread'],
      [formatShortcut('Z', platform), 'Undo ink'],
      [formatShortcut('F', platform), 'Search inside the book'],
      ['?', 'Reader shortcut list'],
      ['Esc', 'Close the reader sidebar'],
      [formatShortcut(',', platform), 'Open settings']
    ],
    [platform]
  )
  const open = useUiStore((state) => state.settingsOpen)
  const setOpen = useUiStore((state) => state.setSettingsOpen)
  const values = useSettingsStore((state) => state.values)
  const setValue = useSettingsStore((state) => state.setValue)
  const load = useSettingsStore((state) => state.load)
  const refresh = useLibraryStore((state) => state.refresh)
  const setTracks = usePlayerStore((state) => state.setTracks)

  const [health, setHealth] = useState<LibraryHealth | null>(null)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMessage(null)
    void load()
    void window.alexandria.libraryHealth().then(setHealth).catch(() => setHealth(null))
    void window.alexandria.appInfo().then(setInfo).catch(() => setInfo(null))
    void window.alexandria.musicFolders().then(setFolders).catch(() => setFolders([]))
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null

  const setting = (key: string, fallback: string): string => values[key] ?? fallback

  const change = (key: string, value: string): void => {
    void setValue(key, value)
  }

  const chooseMusic = async (): Promise<void> => {
    setFolders(await window.alexandria.pickMusicFolders())
  }

  const scanMusic = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.alexandria.scanMusic()
      setTracks(result.tracks)
      setMessage(
        `${result.tracks.length} tracks found${result.unreadable.length > 0 ? `, ${result.unreadable.length} unreadable` : ''}.`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Music scan failed.')
    } finally {
      setBusy(false)
    }
  }

  const checkFiles = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.alexandria.scanMissing()
      await refresh()
      setMessage(`${result.checked} files checked; ${result.missing.length} missing.`)
    } finally {
      setBusy(false)
    }
  }

  const exportLibrary = async (): Promise<void> => {
    setBusy(true)
    try {
      const result = await window.alexandria.exportLibrary()
      setMessage(
        result.path
          ? `Exported ${result.books} books and ${result.annotations} annotations to ${result.path}.`
          : 'Export cancelled.'
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-scrim" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="dialog dialog--wide settings"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings__head">
          <div>
            <p className="eyebrow">Preferences</p>
            <h2 className="display">Settings</h2>
          </div>
          <button className="icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close settings">
            ×
          </button>
        </header>

        <div className="settings__grid">
          <section className="settings__section">
            <h3>Library</h3>
            <p className="settings__path" title={library?.root}>
              {library?.root ?? 'Locating library…'}
            </p>
            <dl className="settings__stats">
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
            <div className="settings__row">
              <button className="button button--quiet" type="button" onClick={() => void checkFiles()} disabled={busy}>
                Check files
              </button>
              <button className="button button--quiet" type="button" onClick={() => void exportLibrary()} disabled={busy}>
                Export catalogue
              </button>
              {isDemoBridgeActive() ? (
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => void resetStaticDemoLibrary()}
                  disabled={busy}
                >
                  Reset demo library
                </button>
              ) : null}
            </div>
          </section>

          <section className="settings__section">
            <h3>Import</h3>
            <label className="field">
              <span>Storage</span>
              <select
                value={setting('import.storage', 'copy')}
                onChange={(event) => change('import.storage', event.target.value)}
              >
                <option value="copy">Copy into the library</option>
                <option value="link">Link the original file</option>
              </select>
            </label>
            <label className="field">
              <span>New books go to</span>
              <select
                value={setting('import.destination', 'shelf')}
                onChange={(event) => change('import.destination', event.target.value)}
              >
                <option value="shelf">Next open shelf</option>
                <option value="inbox">Inbox</option>
              </select>
            </label>
          </section>

          <section className="settings__section">
            <h3>Appearance</h3>
            <label className="field">
              <span>3D quality</span>
              <select value={setting('ui.quality', 'auto')} onChange={(event) => change('ui.quality', event.target.value)}>
                <option value="auto">Automatic — adaptive FPS scaling</option>
                <option value="low">Low — no shadows</option>
                <option value="medium">Medium — balanced</option>
                <option value="high">High — full detail</option>
              </select>
            </label>
            <label className="settings__check">
              <input
                type="checkbox"
                checked={setting('ui.reducedMotion', 'false') === 'true'}
                onChange={(event) => change('ui.reducedMotion', String(event.target.checked))}
              />
              <span>Reduce motion — cut instead of glide, skip the pull animation</span>
            </label>
          </section>

          <section className="settings__section">
            <h3>Sound</h3>
            <label className="settings__check">
              <input
                type="checkbox"
                checked={setting('sound.enabled', 'true') === 'true'}
                onChange={(event) => change('sound.enabled', String(event.target.checked))}
              />
              <span>Page turns, book pulls, and UI ticks</span>
            </label>
            <label className="field">
              <span>Volume · {Math.round(Number(setting('sound.volume', '0.3')) * 100)}%</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={setting('sound.volume', '0.3')}
                onChange={(event) => change('sound.volume', event.target.value)}
              />
            </label>
          </section>

          <section className="settings__section">
            <h3>Music</h3>
            {folders.length === 0 ? (
              <p className="settings__muted">No music folders chosen yet.</p>
            ) : (
              <ul className="settings__folders">
                {folders.map((folder) => (
                  <li key={folder} title={folder}>
                    {folder}
                  </li>
                ))}
              </ul>
            )}
            <div className="settings__row">
              <button className="button button--quiet" type="button" onClick={() => void chooseMusic()}>
                Choose folders
              </button>
              <button className="button button--quiet" type="button" onClick={() => void scanMusic()} disabled={busy || folders.length === 0}>
                {busy ? 'Scanning…' : 'Scan now'}
              </button>
            </div>
          </section>

          <section className="settings__section">
            <h3>Shortcuts</h3>
            <dl className="settings__shortcuts">
              {shortcuts.map(([keys, action]) => (
                <div key={keys}>
                  <dt>
                    <kbd>{keys}</kbd>
                  </dt>
                  <dd>{action}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="settings__section">
            <h3>Diagnostics</h3>
            {health ? (
              <dl className="settings__stats">
                <div>
                  <dt>Database</dt>
                  <dd>{health.database}</dd>
                </div>
                <div>
                  <dt>Schema</dt>
                  <dd>v{health.schemaVersion}</dd>
                </div>
                <div>
                  <dt>Pages</dt>
                  <dd>{health.pages}</dd>
                </div>
                <div>
                  <dt>Annotations</dt>
                  <dd>{health.annotations}</dd>
                </div>
                <div>
                  <dt>Missing</dt>
                  <dd>{health.missing}</dd>
                </div>
              </dl>
            ) : (
              <p className="settings__muted">Health report unavailable.</p>
            )}
            <p className="settings__path" title={health?.logFile}>
              Log: {health?.logFile ?? '—'}
            </p>
            <p className="settings__muted">
              {info ? `${info.name} ${info.version} · Electron ${info.electron} · ${info.platform}` : `Electron ${navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? '—'}`}
            </p>
            <p className="settings__muted">
              Local-first: no accounts, no cloud, no telemetry. The library lives in the folder
              above; export the catalogue from the Library section to back it up.
            </p>
          </section>
        </div>

        {message ? <p className="settings__message">{message}</p> : null}
      </div>
    </div>
  )
}
