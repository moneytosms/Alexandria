# Alexandria: SPEC v1

Status: draft for build
Date: 2026-11-20
Owner: sms

## 0. In one paragraph

Alexandria is a local-first desktop library for the documents you actually use. It looks and feels like a quiet dark-academia library: marble, dark wood, warm lamps, tall shelves. Your PDFs live on those shelves as physical books. You walk up, pull one out, the room falls away, and you read and annotate it full screen. It is curated, not a file manager. It is fast, offline, and yours.

## 1. Intent

### The problem

PDFs end up scattered across Downloads, Desktop, project folders, and cloud drives. Finding the right one means remembering a filename. Reading means a browser tab with a toolbar. Annotating means a separate app or nothing at all. No part of it feels like a place you want to spend time in.

### The bet

A small, beautiful, curated library with a real sense of place makes you return to your documents. The 3D room is not decoration. It is spatial memory: you remember where a book is, not what it is called.

### Success looks like

- You open Alexandria instead of your file manager when you want to read.
- You find a book faster than with Spotlight or Finder.
- You annotate without thinking about where the annotations are stored.
- The room feels calm, not like a game.
- Adding a book takes seconds.

## 2. Users and scale

Single user, personal machine, local files. The user is technical enough to manage folders and backups.

The library is curated: tens to a few hundred documents, up to about 500 as the v1 design target and 2,000 as the hard target. It is not a mirror of a downloads folder.

Cross-platform: Linux first-class, Windows and macOS supported from the same codebase. Offline only.

## 3. Goals

1. A 3D library that feels like a real, aged place and grows with the collection.
2. A reading and annotation experience good enough to replace a browser PDF viewer.
3. Library management that is simple: floors, rooms, sections, bays, shelves, sorting.
4. Speed. 60fps camera, instant book opening, search in milliseconds.
5. Local, portable, and non-destructive. The original files stay untouched.
6. Enough atmosphere (music, light, sound) that you want to stay.

## 4. Non-goals for v1

- EPUB, MOBI, CBZ, DJVU. PDF only, plus conversion of office documents.
- Sync, accounts, cloud, mobile, sharing, multi-user.
- OCR for scanned PDFs.
- AI features of any kind.
- Streaming music (Spotify, YouTube, Apple Music).
- Free-walk first-person controls.
- Annotation export.
- Auto-updating.
- Multiple libraries open at once.

## 5. Anti-goals

- Eye candy that slows reading down.
- Game friction: walking, stamina, puzzles, inventory.
- Becoming a file manager or a Calibre clone.
- Lock-in: a library that cannot be moved, backed up, or read without the app.
- Feature creep in the reader. It should be calm.
- Network calls without an explicit user action.

## 6. The experience

### 6.1 Entering

The window opens on the room, not on a list. Warm light, tall shelves, a desk near the entrance, an inbox cart with a few books. A quiet loading state shows the room shell first, then the books stream in. No splash screen.

### 6.2 The room

One room per floor. Marble columns, dark wood shelving, brass rails and lamps, tall arched windows with dusk light, worn rugs, ladders leaning against shelves. Stylized realism, not photoreal.

Books stand as spines on the shelves, sorted however the user arranged them. A book's height, width, and color vary slightly so the shelves look alive. Spine text is legible when close.

### 6.3 Navigation

The camera glides, it does not walk. Each bay has a standing point at reading distance. Clicking a shelf, a map location, or a search result moves the camera along a smooth path in 600 to 900ms with ease-in-out. There is no collision, no WASD, no mouse-look in v1.

The map (key `M`) is an isometric plan of the library, not a 3D view. Floor tabs, room and section labels, shelf occupancy, and a you-are-here marker. Click any location to travel there. Between floors, the screen fades to black and back rather than walking stairs.

The index view (key `I`) is a plain, fast, keyboard-first table of every book. It exists for speed, accessibility, and as a fallback when the GPU is weak. It is not a lesser mode; it is the same library without the room.

### 6.4 Shelves and books

A section is a named run of bays along a wall. A bay is a shelving unit with five rows. A shelf is one row, holding 24 books by default. Books fill left to right in the shelf's order.

The layout is persisted and stable. Growth only appends: a new bay at the end of a section, a new section on a free wall, a new room, then a new floor. Existing books never reflow because the collection grew, so the room you learned stays the room you learned. Manual reordering in librarian mode is the only thing that moves a shelf.

When a shelf fills, the next book goes to the next shelf in the bay. When the bay fills, a new bay is appended and the librarian is told. When the wall is full, a new room is created, then a new floor. Growth can be undone. Nothing is ever auto-deleted or hidden because the room is full.

Hovering a spine raises it slightly and shows a small label with title and author. Clicking pulls it out: the book slides forward, turns to face the camera, its cover fades in, then the room falls away and the reader opens. Escape, or closing the book, returns to the same shelf and camera position.

### 6.5 The desk

A table near the entrance holds what you are reading and what you recently finished. It is generated from reading state, not manually stocked, though books can be pinned to it. Up to five books. Clicking one opens it.

### 6.6 The inbox

New imports go onto a shelf by default: the shelf you are standing at, the last shelf you used, or the first shelf with room. If you want to sort later, drop the file onto the cart or choose "Send to inbox" in the import dialog. The cart is the set of books with no shelf. Opening it shows the same grid/list used in librarian mode, with a "shelve" action. The inbox can be emptied in one session or left alone forever.

### 6.7 Librarian mode

Key `L`. The camera freezes and management overlays appear. This is the back office:

- Create, rename, reorder, and delete floors, rooms, sections, bays, and shelves.
- Set shelf capacity and sort mode: manual, title, author, date added, last read, format.
- Drag books between shelves, or select many and move them.
- Import files and folders.
- Edit book metadata, cover, tags.
- Remove a book from the library, with a clear choice between forgetting it and deleting the file (delete is only offered for copies owned by the library).
- Relink a missing file.
- Create and assign tags.

Deleting a floor or room asks where its books should go first. Books are never silently orphaned.

### 6.8 The reader

Full screen, clean, customizable. The 3D scene is hidden and its render loop paused while reading. A thin thread back: the ambient music keeps playing, and the close action returns to the exact shelf and camera position.

Reader controls:

- Page or continuous scroll.
- Single page or two-page spread.
- Fit width, fit page, or custom zoom from 50% to 400%.
- Rotate 90 degrees.
- Background themes: paper, sepia, charcoal.
- Dimming slider for bright PDFs.
- Sidebar tabs: contents, thumbnails, annotations, search.
- Chrome hides itself and appears on edge hover or key press.
- Remembered position per book, saved continuously.

### 6.9 Annotations

- Highlight with a small palette: yellow, green, blue, pink, orange.
- Add a note to a highlight.
- Standalone notes pinned to a page position.
- Freehand ink with pressure support when a stylus is present, mouse and trackpad otherwise. Undo, redo, eraser.
- Bookmarks with optional labels.
- Annotations panel lists everything, grouped by page, click to jump.
- Autosaved, debounced, and stored in the library database. The PDF itself is never modified.
- Annotation geometry is normalized to the page so it stays correct at any zoom, rotation, or window size.
- v1 does not export annotations. The data model and UI are built so export can be added without migration.

### 6.10 Search

Global search (Cmd/Ctrl+K) across title, author, filename, full text, and annotations. Results are grouped by book, with a snippet and page number. Enter opens the book at that page with the query highlighted. Full-text search is local, built at import time, and does not require the network.

Scanned PDFs without a text layer will not appear in full-text results in v1. The UI says so in the empty state.

### 6.11 Music

Point Alexandria at one or more music folders. It scans them on demand, not with a file watcher. Playback uses a small player in the corner with play/pause, next, previous, shuffle, repeat, volume, and a seek bar. It keeps playing across the room, the map, and the reader. Media keys work when the app has focus.

Supported formats are whatever Chromium can decode: mp3, m4a/AAC, flac, ogg, opus, wav. No streaming, no accounts, no network.

A gramophone in the room animates while music plays. Optional, can be turned off.

### 6.12 Atmosphere

- Warm 2700K key light, cool dusk fill from windows.
- Subtle dust motes in light shafts on high quality.
- Vignette and very light bloom, both toggleable.
- Optional sound effects: page turn, book pull, shelf thud, UI ticks. Default volume low, can be muted independently of music.
- No ambience soundscapes in v1.

## 7. Functional requirements

### Library and organization

- LIB-01 First run creates a library folder with one floor, one room, an entrance, a desk, an inbox cart, and four sections of one five-row bay each (480 slots).
- LIB-02 Floors, rooms, sections, bays, and shelves can be created, renamed, reordered, and deleted in librarian mode.
- LIB-03 Deleting a container requires reassigning or moving its books first.
- LIB-04 Books can be moved between shelves by drag or by "Move to..." in the book menu.
- LIB-05 Each shelf has a capacity and a sort mode, with manual order as the default.
- LIB-06 A full shelf moves overflow to the next shelf, then appends a bay, section, room, or floor. Growth never reflows existing books and can be undone.
- LIB-07 The desk shows currently reading books, pinned books, and books finished in the last 30 days.
- LIB-08 The inbox is exactly the set of books with no shelf.
- LIB-09 A book details panel shows title, author, format, pages, file path, size, added date, last read, tags, and annotations count.
- LIB-10 Removing a book can forget it or delete the file. Delete is only offered for copies stored inside the library.
- LIB-11 Linked files that are missing are marked and can be relinked.
- LIB-12 Imports are deduplicated by SHA-256. Importing a duplicate focuses the existing book.
- LIB-13 Tags can be created, assigned, and filtered.
- LIB-14 Title and author are editable and persist.
- LIB-15 The index view lists every book with sortable columns and keyboard navigation.

### Import

- IMP-01 Import by drag and drop onto the window, a file picker, or a folder scan.
- IMP-02 Accepted directly: PDF, including password-protected PDFs, which import locked. Converted via LibreOffice when installed: pptx, ppt, docx, doc, odp, odt. Other formats are rejected with a clear message.
- IMP-03 Each import is copied into the library by default, or linked to the original path. Copy is the default because a curated library should survive the original being moved or deleted. Linking is available per import and in settings.
- IMP-04 Import extracts title, author, page count, a cover image, and full text.
- IMP-05 Import runs in the background with progress, cancel, and per-file errors. The UI never blocks.
- IMP-06 Duplicate detection uses SHA-256.
- IMP-07 Office conversion writes a PDF into the library cache and keeps the original untouched.
- IMP-08 Errors (corrupt file, missing LibreOffice, disk full) are surfaced per file and do not abort the queue. A locked PDF is not an error; it is imported with a lock badge and no cover or text until unlocked.

### Reader

- READ-01 A book opens from a shelf, the desk, the inbox, the index, the map, or search.
- READ-02 Page and continuous modes, single and spread, fit width and fit page, 50% to 400% zoom, rotation.
- READ-03 Page turns are under 50ms warm.
- READ-04 Contents come from the PDF outline when present. If absent, the tab shows page thumbnails.
- READ-05 Page thumbnails load lazily and are cached to disk.
- READ-06 Reading position and state save automatically.
- READ-07 Internal and external links work. External links open in the system browser with a confirmation.
- READ-08 Text selection supports copy, highlight, and note.
- READ-09 In-book search with next and previous, showing match count.
- READ-10 Keyboard shortcuts cover navigation, zoom, search, annotation tools, close, and full screen.
- READ-11 Password-protected PDFs prompt for a password for the session only. A successful unlock extracts the cover and text for indexing. The password is never stored.
- READ-12 Very large documents render progressively and never freeze the UI.
- READ-13 Closing the book returns to the exact shelf and camera position.
- READ-14 The 3D render loop pauses while reading.
- READ-15 A book is marked finished automatically when the last page is reached, or manually from the menu. Mark unread clears the finished date.

### Annotations

- ANN-01 Highlight with five colors.
- ANN-02 Notes can attach to highlights or stand alone.
- ANN-03 Freehand ink supports pressure, smoothing, undo, redo, and eraser.
- ANN-04 Bookmarks with optional labels.
- ANN-05 The annotations panel lists, filters, and jumps to annotations.
- ANN-06 Autosave is debounced and survives a crash of the renderer.
- ANN-07 Geometry is stored normalized to the page, independent of zoom and rotation.
- ANN-08 Annotations can be edited and deleted.
- ANN-09 The PDF file is never modified.
- ANN-10 Annotation data is included in the library backup and future export.

### Search

- SRCH-01 Global search opens from anywhere with Cmd/Ctrl+K.
- SRCH-02 Full-text results include a snippet and page number.
- SRCH-03 Title, author, and filename matches rank above body matches.
- SRCH-04 Annotation notes are searchable.
- SRCH-05 Selecting a result opens the book at the page and highlights the query.
- SRCH-06 Search over 500 books and 150k pages returns in under 150ms.

### Map

- MAP-01 Isometric plan of all floors, rooms, and sections.
- MAP-02 Floor tabs and zoom/pan.
- MAP-03 Click a location to travel there.
- MAP-04 A you-are-here marker follows the camera.
- MAP-05 Shelf occupancy is visible at a glance.
- MAP-06 The map is fully keyboard navigable.

### Music

- MUS-01 Add and remove music folders.
- MUS-02 Scan on demand and report unreadable files.
- MUS-03 Play, pause, next, previous, shuffle, repeat, volume, seek.
- MUS-04 Playback persists across all views and into the reader.
- MUS-05 Mini player is always reachable and can be collapsed.
- MUS-06 Media keys work while the app is focused.
- MUS-07 No network access is used for music.
- MUS-08 A browse panel lists folders and tracks, with search, play folder, and shuffle all. Embedded title, artist, album, and art are shown when present.

### 3D room

- ROOM-01 The room is generated procedurally from library data. No hand-placed books.
- ROOM-02 Adding books grows the shelving naturally.
- ROOM-03 The camera glides between standing points and never clips through geometry.
- ROOM-04 Hover and click picking work on instanced books.
- ROOM-05 Three quality presets (low, medium, high) with auto-detection and manual override.
- ROOM-06 60fps at 1080p on integrated graphics with 500 books at medium quality.
- ROOM-07 Reduced motion replaces camera travel with cuts and pull animations with fades.
- ROOM-08 The index view provides equivalent access if 3D cannot run.

## 8. Data model

SQLite, WAL mode, foreign keys on. One database per library. Schema version tracked with `PRAGMA user_version`.

```sql
CREATE TABLE floors (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id         INTEGER PRIMARY KEY,
  floor_id   INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
  id         INTEGER PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  wall       TEXT NOT NULL DEFAULT 'north'
             CHECK (wall IN ('north','east','south','west')),
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bays (
  id         INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shelves (
  id         INTEGER PRIMARY KEY,
  bay_id     INTEGER NOT NULL REFERENCES bays(id) ON DELETE CASCADE,
  label      TEXT,
  row_index  INTEGER NOT NULL DEFAULT 0,
  capacity   INTEGER NOT NULL DEFAULT 24,
  sort_mode  TEXT NOT NULL DEFAULT 'manual'
             CHECK (sort_mode IN ('manual','title','author','added','read','format')),
  sort_dir   TEXT NOT NULL DEFAULT 'asc' CHECK (sort_dir IN ('asc','desc'))
);

CREATE TABLE books (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  author          TEXT,
  format          TEXT NOT NULL DEFAULT 'pdf',
  original_format TEXT,
  file_path       TEXT NOT NULL,
  rel_path        TEXT,
  storage_mode    TEXT NOT NULL CHECK (storage_mode IN ('link','copy')),
  sha256          TEXT NOT NULL UNIQUE,
  file_size       INTEGER,
  page_count      INTEGER,
  cover_path      TEXT,
  encrypted       INTEGER NOT NULL DEFAULT 0,
  shelf_id        INTEGER REFERENCES shelves(id) ON DELETE SET NULL,
  slot_index      INTEGER NOT NULL DEFAULT 0,
  reading_state   TEXT NOT NULL DEFAULT 'unread'
                  CHECK (reading_state IN ('unread','reading','finished')),
  desk_pinned     INTEGER NOT NULL DEFAULT 0,
  last_page       INTEGER NOT NULL DEFAULT 1,
  last_scroll     REAL NOT NULL DEFAULT 0,
  finished_at     TEXT,
  added_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at  TEXT,
  metadata_json   TEXT,
  reader_json     TEXT
);

CREATE INDEX idx_books_shelf ON books(shelf_id, slot_index);
CREATE INDEX idx_books_recent ON books(last_opened_at DESC);

CREATE TABLE annotations (
  id         INTEGER PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page       INTEGER NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('highlight','note','ink','bookmark')),
  color      TEXT,
  rects_json TEXT,
  path_json  TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX idx_annotations_book ON annotations(book_id, page);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

CREATE TABLE pages (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page    INTEGER NOT NULL,
  text    TEXT NOT NULL,
  PRIMARY KEY (book_id, page)
);

CREATE VIRTUAL TABLE pages_fts USING fts5(
  text,
  book_id UNINDEXED,
  page UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Notes:

- `shelf_id IS NULL` means the book is in the inbox.
- `slot_index` is only meaningful when `sort_mode = 'manual'`.
- `finished_at` is set automatically when the last page is reached, or manually from the book menu. The desk uses it for the last 30 days.
- `reader_json` holds per-book reader preferences: theme, dimming, mode, zoom, and sidebar width.
- `encrypted` marks a locked PDF. It has no cover or text until the user unlocks it once.
- Copied books live under `books/` in the library and have `rel_path`. Linked books have a NULL `rel_path` and may point anywhere.
- If the library folder is moved, copied book absolute paths are rebuilt from `rel_path` at startup.
- Layout rows (floors, rooms, sections, bays, shelves) are the source of truth for the 3D room. The scene is projected from them, never the reverse.
- Annotation rectangles and ink points are normalized to the page's intrinsic coordinate space at rotation 0.

## 9. Architecture

### Stack

- Electron with TypeScript everywhere.
- Renderer: React, Vite, three.js through react-three-fiber, Zustand for state.
- PDF: pdfjs-dist in the renderer. Text extraction and cover generation in a background process with pdfjs-dist plus @napi-rs/canvas.
- Database: node:sqlite in the main process. Electron 45 bundles Node 24 with SQLite and FTS5, so there is no native module to rebuild.
- Ink: perfect-freehand for smoothing.
- Packaging: electron-builder.
- Tests: Vitest, Playwright for Electron.

Electron is chosen over Tauri because the product is a 3D room plus a PDF canvas. One bundled Chromium gives identical WebGL and PDF.js behavior on every OS. The cost is install size and about a second of cold start, which is acceptable for a personal library.

### Processes

- Main: window lifecycle, filesystem, SQLite, import queue, LibreOffice conversion, music scanning, settings.
- Preload: typed, minimal IPC surface through contextBridge. No Node in the renderer.
- Renderer: room, reader, map, librarian, index, player, UI.
- Utility process or worker threads: PDF text and thumbnail extraction so the main process and UI stay responsive.

### IPC contract

Namespaced, typed, validated on the main side:

- `library:create`, `library:open`, `library:settings`
- `books:import`, `books:list`, `books:get`, `books:update`, `books:remove`, `books:move`, `books:relink`
- `containers:list`, `containers:create`, `containers:update`, `containers:delete`
- `annotations:list`, `annotations:create`, `annotations:update`, `annotations:delete`
- `search:global`, `search:inBook`
- `music:scan`
- `progress:update`
- `settings:get`, `settings:set`

### Project layout

```
src/
  main/
    index.ts
    ipc/
    db/
      migrations/
      queries/
    importer/
    pdf/
    music/
    settings/
  preload/
  renderer/
    app/
    views/
      Library3D/
      Reader/
      Map/
      Librarian/
      Index/
    components/
    state/
    three/
      room/
      books/
      camera/
      materials/
    styles/
  shared/
    types/
    ipc.ts
    constants.ts
```

### Library folder

```
Alexandria/
  library.db
  library.db-wal
  config.json
  books/          copied originals
  covers/         generated cover images
  thumbs/         generated page thumbnails
  cache/          converted office PDFs
  logs/
```

The library folder is self-contained and movable. Linked files outside it are referenced by absolute path and are the only thing that can break.

### Layout stability

The layout tables are authoritative. The 3D room is projected from them, never the reverse.

- Growth only appends. A new bay goes at the end of its section, a new section on a free wall, a new room, then a new floor. Existing bays, shelves, and books never shift because the collection grew.
- Camera anchors are keyed by section id and bay id with a small local offset, not raw world coordinates. A stable layout means the anchor stays valid.
- When a book opens, the current anchor is saved. Closing the reader restores that anchor. If the book was moved while reading, the reader returns to its new shelf instead.
- Manual reordering in librarian mode is the only operation that moves a shelf. Anchors resolve by id, so they still land in the right place.

### Asset pipeline

- Room geometry is procedural from modular prefabs in code. No Blender dependency for v1.
- Textures are generated at build time from procedural noise and CC0 sources, packed into atlases. No runtime downloads.
- Fonts are OFL and bundled.
- Sound effects are CC0 or synthesized and bundled. Music is user-owned and never bundled.
- Asset budget is under 40MB, separate from the Electron runtime.
- No commissioned art in v1. A later art pass can replace textures and prefabs without touching the layout or data model.

### Import pipeline

1. Enqueue file or folder scan.
2. Detect format. Convert office files to PDF in `cache/` if LibreOffice is present.
3. Hash the PDF with SHA-256. If it exists, focus the existing book.
4. Copy into `books/` or keep the link, per settings and per-import override.
5. If the PDF is encrypted, insert it locked with no cover or text and stop. Indexing happens after the first successful unlock.
6. Extract metadata, page count, cover, and page 1 thumbnail.
7. Extract full text into `pages` and `pages_fts` on a background queue.
8. Insert the book at the default destination: the current shelf, the last used shelf, or the first shelf with room. The inbox is opt-in.
9. Emit progress and completion events.

The queue is sequential per file with limited concurrency, cancellable, and resumes cleanly after a crash by re-checking hashes.

### Rendering pipeline for 3D

- Room shell built procedurally from modular prefabs: wall, column, window, shelf bay, ladder, desk, cart, lamp, rug.
- Book spines batched into an instanced mesh with a texture atlas. Spine textures are rendered at import time with the title and author.
- Covers are separate textures, loaded only when a book is pulled.
- Lighting is stylized: baked ambient occlusion in textures, two or three real lights, fake contact shadows. No expensive dynamic shadows.
- Post-processing is optional and tied to quality.
- The scene renders continuously while visible and focused. It drops to 15fps when unfocused and stops entirely when the reader is open.

### Performance budgets

| Area | Budget |
|---|---|
| Cold start to interactive | 2.0s |
| Warm start to interactive | 1.0s |
| Room frame time | 16.6ms at 1080p, 500 books, medium, integrated GPU |
| Book click to first page | 250ms warm, 500ms cold |
| Page turn | 50ms |
| Global search | 150ms for 500 books and 150k pages |
| Import throughput | 20 PDFs per minute for text and cover extraction |
| Memory | under 1.2GB with room and reader open |
| Idle CPU in reader | under 5% |

## 10. 3D design

### Art direction

Stylized realism with a painterly texture treatment. Low-poly geometry, detailed surfaces. The room should read as old and warm, not dusty or broken. Think a maintained research library at dusk.

Palette:

- Ink `#12100E`
- Walnut `#2A1F18`
- Leather `#3E2A20`
- Oxblood `#5A1F1F`
- Forest `#1F2E23`
- Brass `#B08D57`
- Parchment `#E8DCC4`
- Lamplight `#FFB86B`
- Marble `#D9D2C5`

Typography: a serif display face for room labels and book titles (EB Garamond or Cormorant), a clean sans for UI (Inter). Both bundled, OFL licensed.

Motion: weighty and slow. Camera 600 to 900ms ease-in-out. UI 200 to 250ms. No bounce, no spring, no cartoon easing.

### Room generation

- Each floor has one or more rooms. Each room has four walls. Each wall holds sections, each section is a run of bays, and each bay is a five-row shelving unit.
- The room is projected from persisted layout rows. Book count never reshapes an existing room; it only triggers appends at the end of a section.
- Book dimensions vary slightly by hash: height plus or minus 4%, thickness 18 to 45mm. Slots are uniform in the data model, the visual jitter is cosmetic.
- A bay holds five shelf rows. Each row is a shelf record with its own capacity and sort.

### Camera

- Each bay has one standing point at 2.2m from the shelf, eye height 1.65m, looking at the bay center. Moving within a section slides between bay anchors.
- Travel between standing points uses a Catmull-Rom spline through the room, with a look-at blend. The path avoids columns and furniture via precomputed waypoints.
- Clicking a far location uses a fade-through-black of 250ms rather than a long walk.
- No collision detection is needed because the camera never leaves the spline.

### Interaction

- Pointer move raycasts against the instanced book mesh at most every other frame. Hover lifts the book 2cm and shows a DOM tooltip.
- Click starts the pull animation. The book instance is hidden, a real mesh with the cover texture takes its place, moves out and turns, then the reader crossfades in.
- Escape reverses the animation and restores the shelf.

### Rendering loop

- The room renders continuously while visible and focused, at the quality preset's target.
- Unfocused: 15fps. Hidden or reader open: paused.
- Dust motes pause after 60 seconds without input and resume on pointer or key activity.
- The gramophone animates only while music plays.
- A dev-only performance HUD shows frame time, draw calls, and instance count.

### Quality presets

- Low: device pixel ratio 1, no post, one light, no dust, atlas 2048.
- Medium: DPR 1.5, vignette, two lights, few particles, atlas 4096.
- High: DPR 2, bloom and vignette, three lights, dust motes, atlas 4096.

Auto-detect by measuring the first 120 frames and stepping down if the average frame time exceeds 20ms. Manual override in settings.

## 11. Reader design

- PDF.js canvas plus text layer, virtualized in continuous mode with only visible pages plus two rendered.
- Page mode renders the current page and pre-renders the next.
- Annotation overlay is a separate transparent layer above the canvas, so highlights and ink never touch the PDF bitmap.
- Text selection uses the PDF.js text layer. A selection produces a floating toolbar with highlight colors, note, copy, and search.
- Ink uses pointer events with pressure, smoothed by perfect-freehand, stored as normalized points.
- The sidebar is resizable, collapsible, and remembers its width.
- Chrome auto-hides after 2 seconds of no pointer movement. Any key or edge hover brings it back.
- Cmd/Ctrl+F opens in-book search, Cmd/Ctrl+K opens global search.
- Tool shortcuts: `v` select, `h` highlight, `n` note, `i` ink, `e` eraser, `b` bookmark.
- Escape closes the reader and returns to the room.
- The reader background and dimming are per-book settings, remembered.

## 12. Security and privacy

- No network calls in v1 except an explicit external link click, which opens the system browser.
- No telemetry, no accounts, no analytics.
- Renderer runs with `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Strict CSP, all assets local.
- All IPC inputs validated and typed in the main process.
- PDFs are untrusted input. PDF.js is configured with scripting and eval disabled where possible.
- The renderer can only read paths the user picked or paths inside the library.
- No secrets are stored. There are none.

## 13. Accessibility

- The index view provides full access to every book without 3D.
- Keyboard navigation covers the index, map, reader, annotations, and librarian actions.
- Visible focus rings everywhere.
- Reduced motion setting: camera cuts, no dust, pull becomes a fade.
- Reader font and UI scale settings.
- Canvas content is not exposed to screen readers. Anything essential on the canvas has a DOM equivalent.
- High contrast UI theme in v1.1, not v1.

## 14. Packaging and distribution

- electron-builder targets: AppImage and deb on Linux, NSIS on Windows, dmg on macOS.
- CI matrix builds all three from one codebase.
- The v1 clean-machine target is Linux. Windows and macOS builds are unsigned developer builds, not the supported install path in v1.
- Code signing and notarization are out of scope for v1. They are future work.
- Native dependencies: only @napi-rs/canvas, which ships prebuilt binaries. SQLite is built into Node.
- No auto-update in v1. Builds are manual.
- Linux on Wayland may need `--ozone-platform-hint=auto`.
- Application ID `dev.sms.alexandria`, product name `Alexandria`.

## 15. Testing

- Unit: path resolution, dedupe, schema migrations, annotation coordinate transforms, shelf sorting, importer format detection.
- Integration: IPC handlers against a temporary library folder with fixture PDFs.
- E2E with Playwright for Electron: launch, import, open, annotate, restart, verify annotations and position.
- Fixtures: a small text PDF, a scanned PDF, a large 500-page PDF, a password-protected PDF, a corrupt file, a PPTX.
- Performance smoke: generate 300 small PDFs, import, measure extraction throughput, room frame time, search latency.
- Visual: manual review at each milestone. No screenshot diffing in v1.

## 16. Milestones

Rough estimates for one focused developer.

### M0: Shell

Electron, Vite, TypeScript, window, settings, SQLite with migrations, library creation, logging. No features yet.

Exit: app launches, creates a library, reads and writes settings.

### M1: Import and index

File and folder import, hashing, metadata, cover, text extraction, default shelf and inbox placement, index view, basic PDF.js open.

Exit: import 50 PDFs, see them in the index, open one, restart and find it.

### M2: Reader and annotations

Full reader, modes, TOC, thumbnails, search, highlights, notes, ink, bookmarks, progress.

Exit: annotate a book in every way, restart, everything persists and lands correctly at any zoom.

### M3: Library model

Floors, rooms, sections, bays, shelves, librarian mode, desk, map, sorting, moving books.

Exit: build a two-floor library by hand, move books, navigate with the map.

### M4: The room

Procedural 3D room, shelves, books, camera, pull animation, lighting, quality presets, reduced motion.

Exit: 500 books, 60fps medium at 1080p, open a book from a shelf and return to the spot.

### M5: Polish

Global search, music player, sound effects, empty states, onboarding, packaging for three platforms.

Exit: install the Linux build on a clean machine and use it for a day without touching a terminal.

### M6: Hardening

Missing files, relink, corrupt and password PDFs, huge PDFs, disk full, crash recovery, performance on low-end hardware.

Exit: the fixture error cases all behave and the app stays usable.

## 17. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| WebGL performance on weak GPUs | Room feels bad | Instancing, baked lighting, quality presets, index fallback |
| 3D scope consumes the project | Reading features never land | Build reader before room, keep the room procedural |
| Procedural rooms look generic | Loses the aesthetic | Strong art direction, modular prefabs, lighting and texture work |
| PDF.js edge cases | Broken books | Fixture suite, graceful errors, external open as last resort |
| Electron memory | Heavy app | Pause render loop, dispose PDF pages, cap caches |
| Import of huge libraries | Slow first run | Background queue, progressive indexing, search works while indexing |
| Linked files move | Missing books | Startup check, clear missing state, relink flow |
| Scope creep | Never ships | Hard v1 list, future section is explicit |

## 18. Future scope

Everything here is deliberately out of v1. The data model and architecture should not make any of it impossible.

### Formats and content

- EPUB and MOBI/AZW3 via epub.js, with reflowable text, themes, and its own annotation model.
- CBZ and CBR comics with spread-aware reading.
- DJVU.
- Markdown, HTML, and plain text as first-class readable documents.
- Image folders as photo books.
- OCR for scanned PDFs with Tesseract, making them searchable.
- Handwriting recognition for ink annotations, making them searchable.
- Audio and video attachments per book.

### Annotation and notes

- Export annotations to a flattened PDF, Markdown, JSON, and Obsidian or Readwise.
- A notes workspace that collects highlights across books into one page.
- Citation export in BibTeX, RIS, and CSL.
- Annotation sharing and comments.
- Drawing shapes, arrows, and stamps.
- Sticky note colors and custom palettes.
- Versioned annotation history.

### Library and organization

- Smart shelves driven by rules: tags, authors, date, reading state, format.
- Saved searches.
- Reading lists and cross-shelf collections.
- Duplicate merging and metadata reconciliation.
- Automatic metadata lookup from Open Library or Crossref, opt-in and offline by default.
- Import from Calibre, Zotero, and a watched Downloads folder.
- Multiple libraries open at once.
- Library statistics: pages read, time per book, streaks, heatmap.
- Reading goals.
- Full-text search across annotations and notes.
- Password-protected vaults for private documents.
- Print support.

### Sync and devices

- A sync-friendly library layout, tested with Syncthing and iCloud Drive.
- End-to-end encrypted sync with conflict resolution for annotations and reading position.
- A tablet and mobile companion for reading and annotating, syncing progress.
- Web reader for a single book, served from the local machine.
- Read-only sharing of a book with its annotations.
- Book clubs or shared shelves, far future.

### The room

- Free-walk first-person mode with collision, for people who want it.
- More spaces: map room, globe room, rare books room, archive basement, reading garden.
- Furniture and room customization: desks, chairs, rugs, paintings, windows.
- Time of day and weather that affect the light.
- Seasons and occasional events.
- A fireplace that reacts to music.
- More ambient soundscapes: rain, fire, wind, distant pages.
- Local music integrations beyond folders (MPD, Navidrome) and optional streaming.
- Physical book physics: pulling, stacking, leaning.
- VR support, far future.
- Multiple simultaneous readers on different screens.

### Reading experience

- Tabs and split view for multiple books.
- Multiple windows.
- Text-to-speech with local voices and word highlighting.
- Local AI: semantic search over the library, chapter summaries, and "ask this book", fully offline with a local model.
- Translation of selected text.
- Focus mode with a single page and no chrome at all.
- Reading themes with custom fonts and spacing for reflowable formats.
- A "continue reading" queue.
- Bookmarks that sync across devices.

### Platform and engineering

- Auto-update with signed releases.
- Plugin API for themes, room geometry, and importers.
- Theme editor for the UI and the room.
- Localization.
- High contrast and full screen reader support for the 3D view.
- Crash reporting, opt-in and local.
- A CLI for import, search, and export.
- A public library format spec so other tools can read Alexandria libraries.

### Packaging and distribution

- Flatpak and AUR packages.
- Microsoft Store and Mac App Store builds.
- A portable build that keeps everything in one folder.

## 19. Decisions made

- Electron plus TypeScript over Tauri, because the app is a 3D room and a PDF canvas, and one Chromium is worth more than a small binary.
- PDF.js as the only PDF engine in v1.
- SQLite plus FTS5 as the library format. The folder is portable.
- Database access uses node:sqlite, not better-sqlite3. It is built into Electron's Node, supports FTS5, and removes native rebuilds.
- Local-first, no accounts, no network.
- Curated library, not a downloads mirror.
- 3D with glide navigation, no free-walk.
- Book spines are legible, not abstract blocks.
- Annotations are non-destructive and live in the database.
- Music is local folders only, with folder and track browsing, embedded tags, and embedded art when present.
- The index view exists and is a first-class alternative to 3D.
- A shelf is one row, a bay is five rows, a section is a run of bays.
- Layout is persisted and append-only. Growth never reflows existing shelves.
- Books finish automatically at the last page, with a manual override.
- Password-protected PDFs import locked and unlock on demand. Passwords are never stored.
- The default import destination is a shelf, not the inbox.
- Imports are copied into the library by default. Linking is available per import.
- Assets are procedural or CC0. No commissioned art in v1.
- Linux is the v1 shipping target. Windows and macOS builds are unsigned.

## 20. Open questions

These are for the user, not the builder.

1. Do you have a stylus or drawing tablet? Ink works either way, but pressure support matters more with one.
2. Where do your music folders live, and roughly how large is the collection?
3. Spine text: full title and author, or title only? The spec assumes legible title and author.
4. Sound effects on by default at low volume, or off by default?

Decided: imports copy by default with linking as an option; auto-growth appends without asking; the desk uses automatic state plus pinning; Linux is the v1 target with unsigned Windows and macOS builds.
