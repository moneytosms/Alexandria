import type { LibraryInfo } from '@shared/api'
import type { Shelf } from '@shared/types'
import { useEffect, useMemo, useState } from 'react'
import { pickImportFiles, pickImportFolder } from '../import-actions'
import { useImportStore } from '../state/import-store'
import { useLibraryStore } from '../state/library-store'
import { usePlayerStore } from '../state/ui-store'

interface Props {
  library: LibraryInfo | null
}

export function LibrarianView({ library }: Props) {
  const layout = useLibraryStore((state) => state.layout)
  const books = useLibraryStore((state) => state.books)
  const refresh = useLibraryStore((state) => state.refresh)
  const refreshBooks = useLibraryStore((state) => state.refreshBooks)
  const queued = useImportStore((state) => state.candidates.length)
  const importing = useImportStore((state) => state.importing)
  const setTracks = usePlayerStore((state) => state.setTracks)

  const [settings, setSettings] = useState<Record<string, string>>({})
  const [missing, setMissing] = useState<number[]>([])
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tags, setTags] = useState<Array<{ id: number; name: string; count: number }>>([])
  const [newTag, setNewTag] = useState('')
  const [shelfId, setShelfId] = useState<number | null>(null)
  const [capacity, setCapacity] = useState(24)
  const [musicFolders, setMusicFolders] = useState<string[]>([])
  const [musicScanning, setMusicScanning] = useState(false)
  const [relinking, setRelinking] = useState<number | null>(null)

  const shelves = useMemo(() => {
    const flat: Array<{ shelf: Shelf; label: string }> = []
    for (const floor of layout) {
      for (const room of floor.rooms) {
        for (const section of room.sections) {
          for (const bay of section.bays) {
            for (const shelf of bay.shelves) {
              flat.push({
                shelf,
                label: `${floor.name} · ${room.name} · ${section.name} · Shelf ${shelf.id}`
              })
            }
          }
        }
      }
    }
    return flat
  }, [layout])

  const selected = shelves.find((entry) => entry.shelf.id === shelfId)?.shelf ?? null

  useEffect(() => {
    if (selected) {
      setCapacity(selected.capacity)
    }
  }, [selected])

  useEffect(() => {
    void (async () => {
      const [loadedSettings, loadedTags, folders] = await Promise.all([
        window.alexandria.getSettings(),
        window.alexandria.listTags(),
        window.alexandria.musicFolders()
      ])
      setSettings(loadedSettings)
      setTags(loadedTags)
      setMusicFolders(folders)
    })().catch(() => undefined)
  }, [])

  useEffect(() => {
    void (async () => {
      setScanning(true)
      try {
        const result = await window.alexandria.scanMissing()
        setMissing(result.missing)
        if (result.missing.length > 0) await refreshBooks()
      } finally {
        setScanning(false)
      }
    })()
  }, [refreshBooks])

  const updateSetting = async (key: string, value: string): Promise<void> => {
    await window.alexandria.setSetting(key, value)
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const rescan = async (): Promise<void> => {
    setScanning(true)
    setMessage(null)
    try {
      const result = await window.alexandria.scanMissing()
      setMissing(result.missing)
      await refreshBooks()
      setMessage(
        result.missing.length === 0
          ? `Checked ${result.checked} files; everything is where it should be.`
          : `${result.missing.length} of ${result.checked} files could not be found.`
      )
    } finally {
      setScanning(false)
    }
  }

  const relink = async (id: number): Promise<void> => {
    setRelinking(id)
    try {
      await window.alexandria.relinkBook(id)
      const result = await window.alexandria.scanMissing()
      setMissing(result.missing)
      await refreshBooks()
    } catch (relinkError) {
      setError(relinkError instanceof Error ? relinkError.message : 'Could not relink the file')
    } finally {
      setRelinking(null)
    }
  }

  const saveShelf = async (): Promise<void> => {
    if (!selected) return
    setBusy(true)
    try {
      await window.alexandria.updateContainer({
        kind: 'shelf',
        id: selected.id,
        capacity,
        sortMode: selected.sortMode,
        sortDir: selected.sortDir
      })
      await window.alexandria.resortShelf(selected.id)
      await refresh()
      setMessage(`Shelf ${selected.id} updated.`)
    } finally {
      setBusy(false)
    }
  }

  const sortShelf = async (mode: Shelf['sortMode'], direction: Shelf['sortDir']): Promise<void> => {
    if (!selected) return
    setBusy(true)
    try {
      await window.alexandria.updateContainer({
        kind: 'shelf',
        id: selected.id,
        sortMode: mode,
        sortDir: direction
      })
      await window.alexandria.resortShelf(selected.id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const undoGrowth = async (): Promise<void> => {
    setBusy(true)
    try {
      const undone = await window.alexandria.undoGrowth()
      setMessage(undone ? 'Removed the last empty auto-created bay.' : 'No empty auto-created bay to remove.')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const addBay = async (): Promise<void> => {
    const room = layout[0]?.rooms[0]
    if (!room) return
    setBusy(true)
    try {
      await window.alexandria.createContainer({ kind: 'bay', parentId: room.sections[0]?.id ?? null })
      await refresh()
      setMessage('A new bay was added to the first section.')
    } finally {
      setBusy(false)
    }
  }

  const addFloor = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.alexandria.createContainer({ kind: 'floor', parentId: null })
      await refresh()
      setMessage('A new floor was added.')
    } finally {
      setBusy(false)
    }
  }

  const createTag = async (): Promise<void> => {
    if (newTag.trim().length === 0) return
    await window.alexandria.createTag(newTag.trim())
    setNewTag('')
    setTags(await window.alexandria.listTags())
  }

  const removeTag = async (id: number): Promise<void> => {
    await window.alexandria.deleteTag(id)
    setTags(await window.alexandria.listTags())
    await refreshBooks()
  }

  const chooseMusic = async (): Promise<void> => {
    const folders = await window.alexandria.pickMusicFolders()
    setMusicFolders(folders)
  }

  const scanMusic = async (): Promise<void> => {
    setMusicScanning(true)
    try {
      const result = await window.alexandria.scanMusic()
      setTracks(result.tracks)
      setMessage(
        `${result.tracks.length} tracks found${result.unreadable.length > 0 ? `; ${result.unreadable.length} unreadable` : ''}.`
      )
    } finally {
      setMusicScanning(false)
    }
  }

  const missingBooks = books.filter((book) => book.missing)

  return (
    <div className="librarian">
      <article className="panel panel--wide">
        <p className="eyebrow">Collection</p>
        <h2 className="display">
          {missingBooks.length > 0 ? `${missingBooks.length} volumes need attention.` : 'The desk is clear.'}
        </h2>
        <p className="lede">
          Imports, relinking, and shelf repairs happen here. Missing files are flagged, never
          deleted. Sort orders only rearrange the shelf you choose.
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
            <dd>{library ? Math.max(0, library.slots - library.books) : '—'}</dd>
          </div>
          <div>
            <dt>Missing</dt>
            <dd>{missingBooks.length}</dd>
          </div>
        </dl>
        {message ? <p className="panel__message">{message}</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Import</h3>
          <span className="badge">{importing ? 'Working' : queued > 0 ? `${queued} queued` : 'Idle'}</span>
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

        <div className="panel__settings">
          <label className="field field--compact">
            <span>Storage</span>
            <select
              value={settings['import.storage'] ?? 'copy'}
              onChange={(event) => void updateSetting('import.storage', event.target.value)}
            >
              <option value="copy">Copy into the library</option>
              <option value="link">Link the original file</option>
            </select>
          </label>
          <label className="field field--compact">
            <span>Destination</span>
            <select
              value={settings['import.destination'] ?? 'shelf'}
              onChange={(event) => void updateSetting('import.destination', event.target.value)}
            >
              <option value="shelf">Next free shelf</option>
              <option value="inbox">Inbox</option>
            </select>
          </label>
        </div>
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Integrity</h3>
          <span className={missingBooks.length === 0 ? 'badge badge--calm' : 'badge badge--warn'}>
            {scanning ? 'Checking' : missingBooks.length === 0 ? 'Checked' : 'Missing files'}
          </span>
        </div>
        <p>
          {library
            ? `${library.floors} floor · ${library.sections} sections · ${library.shelves} shelves`
            : 'Waiting for the library.'}{' '}
          Linked files are verified here, at launch, and whenever a volume fails to open.
        </p>
        <div className="panel__actions">
          <button className="button button--quiet" type="button" onClick={() => void rescan()} disabled={scanning}>
            {scanning ? 'Checking…' : 'Check every file'}
          </button>
        </div>
        {missingBooks.length > 0 ? (
          <ul className="missing-list">
            {missingBooks.map((book) => (
              <li key={book.id}>
                <span>{book.title}</span>
                <button
                  type="button"
                  className="link-button"
                  disabled={relinking === book.id}
                  onClick={() => void relink(book.id)}
                >
                  {relinking === book.id ? 'Locating…' : 'Locate'}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {missing.length > 0 && missingBooks.length === 0 ? (
          <p className="panel__muted">{missing.length} files flagged; refreshing the catalogue.</p>
        ) : null}
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Shelves</h3>
          <span className="badge">{shelves.length} total</span>
        </div>
        <label className="field field--compact">
          <span>Shelf</span>
          <select
            value={shelfId ?? ''}
            onChange={(event) => setShelfId(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Choose a shelf…</option>
            {shelves.map((entry) => (
              <option key={entry.shelf.id} value={entry.shelf.id}>
                {entry.label} ({entry.shelf.bookCount}/{entry.shelf.capacity})
              </option>
            ))}
          </select>
        </label>

        {selected ? (
          <div className="panel__settings">
            <label className="field field--compact">
              <span>Capacity</span>
              <input
                type="number"
                min={1}
                max={200}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
              />
            </label>
            <label className="field field--compact">
              <span>Order</span>
              <select
                value={selected.sortMode}
                onChange={(event) =>
                  void sortShelf(event.target.value as Shelf['sortMode'], selected.sortDir)
                }
              >
                <option value="manual">Manual</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="added">Date added</option>
                <option value="read">Last read</option>
                <option value="format">Format</option>
              </select>
            </label>
            <label className="field field--compact">
              <span>Direction</span>
              <select
                value={selected.sortDir}
                onChange={(event) =>
                  void sortShelf(selected.sortMode, event.target.value as Shelf['sortDir'])
                }
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
          </div>
        ) : null}

        <div className="panel__actions">
          <button className="button button--quiet" type="button" onClick={() => void saveShelf()} disabled={!selected || busy}>
            Save shelf
          </button>
          <button className="button button--quiet" type="button" onClick={() => void addBay()} disabled={busy}>
            Add bay
          </button>
          <button className="button button--quiet" type="button" onClick={() => void addFloor()} disabled={busy}>
            Add floor
          </button>
          <button className="button button--quiet" type="button" onClick={() => void undoGrowth()} disabled={busy}>
            Undo growth
          </button>
        </div>
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Tags</h3>
          <span className="badge">{tags.length}</span>
        </div>
        <form
          className="tag-form"
          onSubmit={(event) => {
            event.preventDefault()
            void createTag()
          }}
        >
          <input
            type="text"
            value={newTag}
            placeholder="New tag"
            onChange={(event) => setNewTag(event.target.value)}
          />
          <button className="button button--quiet" type="submit" disabled={newTag.trim().length === 0}>
            Add
          </button>
        </form>
        {tags.length === 0 ? (
          <p>No tags yet. Tag volumes from the reader or the index.</p>
        ) : (
          <ul className="tag-list">
            {tags.map((tag) => (
              <li key={tag.id}>
                <span className="tag">{tag.name}</span>
                <span className="tag-list__count">{tag.count}</span>
                <button type="button" className="link-button" onClick={() => void removeTag(tag.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Music</h3>
          <span className="badge">{musicFolders.length} folders</span>
        </div>
        <p>
          Scan folders of audio files to play while reading. Artwork and tags are read from each
          file; playback stays on this machine.
        </p>
        <div className="panel__actions">
          <button className="button button--quiet" type="button" onClick={() => void chooseMusic()}>
            Choose folders
          </button>
          <button
            className="button button--quiet"
            type="button"
            onClick={() => void scanMusic()}
            disabled={musicScanning || musicFolders.length === 0}
          >
            {musicScanning ? 'Scanning…' : 'Scan music'}
          </button>
        </div>
        {musicFolders.length > 0 ? (
          <ul className="folder-list">
            {musicFolders.map((folder) => (
              <li key={folder} title={folder}>
                {folder}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      <article className="panel">
        <div className="panel__head">
          <h3>Library folder</h3>
          <span className="badge badge--calm">Local only</span>
        </div>
        <p className="panel__path">{library?.root ?? 'Preparing…'}</p>
        <p>
          The database, imported files, covers, thumbnails, and logs live together in this folder.
          Back it up by copying it.
        </p>
      </article>
    </div>
  )
}
