# Alexandria

A local-first 3D library for the PDFs you actually read.

Dark academia reading room, real shelves, a clean full-screen reader, and
non-destructive annotations. Electron, TypeScript, PDF.js, SQLite with FTS5,
and three.js. No accounts, no cloud, no telemetry.

## Status

Early but usable. The app imports and indexes books, renders them in a 3D room
and a 2D plan, reads PDFs with highlights, notes, ink, and bookmarks, searches
the whole library, and plays music from local folders. The remaining v1 work is
tracked in [TODO.md](TODO.md); the design is in [SPEC.md](SPEC.md).

Verified locally: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test`
(43 tests), and `pnpm test:e2e` (10 Electron tests) pass. Linux packaging config exists but has
not been checked on a clean machine.

## What works today

- **Import:** file picker, folder scan, and drag-and-drop; duplicate detection
  by SHA-256; copy into the library or link the original; PDF metadata, covers,
  text extraction, and optional LibreOffice conversion for Office documents.
- **Library:** append-only shelves, rooms, and floors; librarian CRUD; desk,
  inbox, tags, book details, missing-file scan and relink; sortable index.
- **Room:** procedural 3D hall with shelves projected from the database,
  hover and click picking, shelf drawer, and desk drawer.
- **Reader:** page and continuous modes, fit/zoom/rotate, text selection,
  highlights in five colors, freehand ink, notes, bookmarks, in-book search,
  progress restore, and per-book settings.
- **Search:** `Ctrl/Cmd+K` across titles, authors, full text, and annotation
  notes; results open the right page.
- **Music:** scan local folders with embedded tags and art, then play with a
  dock that stays across views.

## Development

```sh
pnpm install
pnpm dev
```

Requires Node 22 or newer and pnpm. LibreOffice is optional; install it to
import PPTX, PPT, DOCX, DOC, ODP, and ODT files.

On first run the app asks where the library should live and defaults to
`~/Alexandria`. The library is a plain folder containing `library.db`,
`config.json`, `books/`, `covers/`, `thumbs/`, `cache/`, and `logs/`. Set
`ALEXANDRIA_LIBRARY_PATH` to override the location for tests or portable use.

## Using it

The left rail switches between **Room**, **Reader**, **Map**, **Librarian**,
and **Index**.

1. Drop PDFs anywhere in the window, or use **Librarian → Import files /
   Import folder**, then confirm in the queue tray.
2. Click a spine in the Room or a row in the Index to open a book.
3. In the reader, use the toolbar for zoom, rotation, theme, highlights, ink,
   and bookmarks; the sidebar holds contents, in-book search, and notes.
4. Press `Ctrl/Cmd+K` to search the library from anywhere.

Reader shortcuts: `←`/`→` or `PgUp`/`PgDn` to turn pages, `Home`/`End` to jump,
`+`/`-` to zoom, `f` full screen, `b` bookmark, `h` highlight tool, `i` ink
tool, `Esc` to close the sidebar.

## Scripts

```sh
pnpm dev          # Electron app with HMR
pnpm build        # typecheck and production build
pnpm typecheck
pnpm lint
pnpm test         # Vitest unit and integration tests
pnpm test:e2e     # build, then Playwright Electron tests
pnpm dist:linux   # AppImage + deb
```

## Layout

```text
src/main      Electron main: SQLite, importer, PDF inspection, media, music, IPC
src/preload   Typed contextBridge API
src/renderer  React UI: room, reader, map, librarian, index, player
src/shared    Types, API contract, IPC channel names
tests         Playwright E2E specs and fixtures
```
