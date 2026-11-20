# Alexandria TODO

Last updated: 2026-11-20
Spec: `./SPEC.md`
Handoff: `./NEXT_STEPS.md`

Status: M0 complete, M1 starting.

## How to work

1. Read `SPEC.md` for the area you are touching.
2. Pick the first unchecked task in the current milestone.
3. Branch: `feat/<task-id>-<slug>`.
4. Implement only that task. Keep the diff surgical.
5. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.
6. Mark the task `[x]` here and add one line to the Done Log.
7. If the plan changed, update `NEXT_STEPS.md`.
8. Commit: conventional message, imperative, under 72 characters.

Status: `[ ]` todo, `[~]` in progress, `[x]` done, `[!]` blocked.

## Current focus

`M1-01 Import entry points`

## Planning

- [x] **P-01 Write SPEC v1.** `SPEC.md` covers intent, v1, data model, architecture, future scope.
- [x] **P-02 Builder review.** Fresh builder found 8 gaps; all resolved in `SPEC.md`.
- [x] **P-03 Settle defaults.** Copy-on-import, append-only layout, Linux v1 target.
- [x] **P-04 Create TODO.** This file.
- [x] **P-05 Create handoff.** `NEXT_STEPS.md`.

## M0 Foundation

Nothing ships until this is solid. Keep it boring.

- [x] **M0-01 Repo scaffold.** `git init`, `pnpm init`, electron-vite, Electron, React, strict TypeScript, `.gitignore`, `README.md`. Done when `pnpm dev` opens a blank window and `pnpm build` succeeds.
- [x] **M0-02 Toolchain.** ESLint, Prettier, Vitest, Playwright, path aliases, `pnpm lint`, `pnpm typecheck`, `pnpm test`. Done when all three pass on the empty project.
- [x] **M0-03 Secure app shell.** Main, preload, renderer. `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict CSP, no remote content. Done when the renderer has no Node globals and the app still runs.
- [x] **M0-04 Typed IPC.** Shared contract in `src/shared/ipc.ts`, validated handlers, `contextBridge` API. Done when one round-trip call works and is typed end to end.
- [x] **M0-05 Database.** node:sqlite, WAL, foreign keys, `user_version` migrations, repository helpers. Done when a fresh DB migrates to v1 and reopens cleanly.
- [x] **M0-06 Library folder.** First-run folder picker, default `~/Alexandria`, `config.json`, settings table, path resolution. Done when the app creates the folder tree and remembers it.
- [x] **M0-07 Logging and errors.** Rotating local log, main-process error boundary, renderer error boundary. Done when a thrown test error is logged and the UI stays alive.
- [x] **M0-08 CI.** GitHub Actions: install, lint, typecheck, test, Linux build. Done when CI is green on the scaffold.
- [x] **M0-09 UI shell.** View router (room, reader, map, librarian, index), theme tokens, bundled fonts, base components. Done when all five empty views navigate.
- [x] **M0-10 Test harness.** Unit test setup, Electron E2E smoke test. Done when `pnpm test` and `pnpm test:e2e` both run.

## M1 Import and index

- [ ] **M1-01 Import entry points.** Drag and drop, file picker, folder scan with extension filter. Done when a PDF can be queued from all three.
- [ ] **M1-02 Detect, hash, dedupe.** Format detection, SHA-256, duplicate focus. Done when importing the same file twice yields one book.
- [ ] **M1-03 Copy or link.** Copy into `books/` by default, link optional, `rel_path` for copies. Done when both modes import and resolve after restart.
- [ ] **M1-04 PDF metadata.** Title, author, page count via pdfjs-dist, filename fallback. Done when a fixture PDF gets correct values.
- [ ] **M1-05 Cover and thumbnails.** Page 1 cover at 512px, lazy page thumbs at 256px, disk cache. Done when covers appear in the index and survive restart.
- [ ] **M1-06 Text extraction.** Page text into `pages` and `pages_fts`. Done when a query returns the right page on a fixture.
- [ ] **M1-07 Import queue.** Background worker, concurrency cap, progress events, cancel, per-file errors. Done when importing 50 files never blocks the UI.
- [ ] **M1-08 Office conversion.** LibreOffice headless for pptx, ppt, docx, doc, odp, odt into `cache/`. Done when a PPTX imports as a readable PDF.
- [ ] **M1-09 Encrypted PDFs.** Import locked, no cover or text, unlock on open, index after unlock, password never stored. Done when a password fixture behaves.
- [ ] **M1-10 Placement and growth.** Default to current or last shelf, inbox opt-in, append-only growth, undo. Done when overflow creates a bay without moving existing books.
- [ ] **M1-11 Index view.** Sortable table, title, author, pages, added, last read, shelf, status. Keyboard navigation. Done when 500 rows scroll at 60fps.
- [ ] **M1-12 Basic reader open.** PDF.js canvas, open from index, close back. Done when a book opens and closes without errors.
- [ ] **M1-13 Missing files.** Startup check for linked files, missing badge, relink dialog. Done when moving a linked file surfaces the flow.
- [ ] **M1-14 Fixtures and tests.** Text PDF, scanned PDF, 500-page PDF, encrypted PDF, corrupt PDF, PPTX. Done when import tests cover all six.

## M2 Reader and annotations

- [ ] **M2-01 Reader shell.** Full-screen view, open and close, return to saved anchor, chrome auto-hide. Done when opening and closing returns to the same spot.
- [ ] **M2-02 Render modes.** Page, continuous, spread, fit width, fit page, zoom 50 to 400, rotate. Done when every combination renders correctly.
- [ ] **M2-03 Virtualization.** Render visible pages plus two, dispose offscreen pages. Done when a 500-page PDF stays smooth.
- [ ] **M2-04 Text layer and selection.** Selection toolbar with copy, highlight, note, search. Done when selection is accurate at 100% and 200% zoom.
- [ ] **M2-05 Sidebar.** Contents from outline, thumbnails, resizable and collapsible, remembers width. Done when all tabs work on a fixture.
- [ ] **M2-06 In-book search.** Match count, next and previous, scroll to match. Done when query terms highlight on the page.
- [ ] **M2-07 Progress and finished.** Save page and scroll, auto-finish on last page, manual override. Done when state survives restart.
- [ ] **M2-08 Highlights.** Five colors, normalized rects, edit and delete. Done when highlights stay aligned at any zoom.
- [ ] **M2-09 Notes.** Attached to highlight or standalone pin, edit and delete. Done when notes reopen in the right place.
- [ ] **M2-10 Ink.** Pressure support, smoothing, undo, redo, eraser. Done when a stroke survives restart and zoom.
- [ ] **M2-11 Bookmarks.** Page bookmarks with labels, jump, delete. Done when bookmarks list and navigate.
- [ ] **M2-12 Annotations panel.** Grouped by page, filter by type, jump, edit, delete. Done when all types appear.
- [ ] **M2-13 Per-book settings.** Theme, dimming, mode, zoom, saved in `reader_json`. Done when two books keep separate settings.
- [ ] **M2-14 Shortcuts.** `v h n i e b`, arrows, space, zoom, search, escape, full screen. Done when documented in the settings panel.
- [ ] **M2-15 Reader tests.** Coordinate transforms, annotation persistence, progress restore. Done when the suite is green.

## M3 Library model

- [ ] **M3-01 Layout CRUD.** Floors, rooms, sections, bays, shelves. Create, rename, reorder, delete with reassignment. Done when a two-floor library can be built in the UI.
- [ ] **M3-02 Growth rules.** Append-only bay, section, room, floor. Undo last growth. Done when overflow never reflows existing books.
- [ ] **M3-03 Librarian mode.** Toggle, frozen camera, management overlays, container tree. Done when all CRUD actions are reachable.
- [ ] **M3-04 Move and sort.** Drag books between shelves, multi-select, manual and metadata sorts. Done when order persists.
- [ ] **M3-05 Desk.** Reading, pinned, finished in 30 days, cap at five. Done when pin and unpin work.
- [ ] **M3-06 Inbox.** Cart view, shelve action, bulk shelve. Done when unshelved books are exactly the inbox.
- [ ] **M3-07 Map.** 2D isometric plan, floor tabs, zoom and pan, you-are-here, click to travel. Done when every bay is reachable in two clicks.
- [ ] **M3-08 Tags.** Create, assign, filter in index and librarian. Done when tags survive restart.
- [ ] **M3-09 Book details.** Metadata edit, cover, path, stats, annotations count, remove and relink. Done when all actions work.
- [ ] **M3-10 Library tests.** Layout invariants, growth, move, sort, delete reassignment. Done when green.

## M4 The room

- [ ] **M4-01 3D bootstrap.** react-three-fiber canvas, quality presets, resize handling, pause when hidden. Done when a test scene renders at 60fps.
- [ ] **M4-02 Room shell.** Procedural walls, floor, ceiling, columns, windows, rugs, ladders. Done when a room looks intentional at all four walls.
- [ ] **M4-03 Shelves from layout.** Bays, rows, book slots generated from DB. Done when changing the layout changes the room.
- [ ] **M4-04 Books.** Instanced spines, texture atlas with title and author, per-book size jitter. Done when 500 books render in one or few draw calls.
- [ ] **M4-05 Lighting and materials.** Warm key, dusk fill, baked-style AO, vignette, optional bloom, dust motes. Done when the palette matches the spec.
- [ ] **M4-06 Camera.** Bay anchors, spline glide, look-at blend, fades between rooms and floors. Done when travel never clips.
- [ ] **M4-07 Picking.** Hover lift, tooltip, click selection on instanced mesh. Done when picking is accurate at all angles.
- [ ] **M4-08 Pull animation.** Book out, cover in, reader crossfade, reverse on close. Done when it feels weighty and never blocks input.
- [ ] **M4-09 Props.** Desk with books, inbox cart, gramophone, lamps. Done when the desk and cart reflect live data.
- [ ] **M4-10 Render loop.** Continuous when focused, 15fps unfocused, paused in reader, dust pause. Done when CPU and GPU drop as specified.
- [ ] **M4-11 Reduced motion.** Cuts instead of glides, fades instead of pulls, no dust. Done when the setting changes behavior instantly.
- [ ] **M4-12 Performance HUD.** Frame time, draw calls, instances, atlas memory. Dev only. Done when it can be toggled.
- [ ] **M4-13 Performance test.** 500-book fixture at 1080p medium on integrated graphics. Done when frame time stays under 16.6ms.

## M5 Search, music, polish

- [ ] **M5-01 Global search.** Cmd/Ctrl+K palette, FTS snippets, title and author ranking, annotation notes. Done when queries return in under 150ms.
- [ ] **M5-02 Search navigation.** Open at page, highlight query, back to results. Done when it works from room, reader, and index.
- [ ] **M5-03 Music scan.** Folder picker, recursive scan, embedded tags and art via music-metadata, unreadable report. Done when a 100-track folder scans.
- [ ] **M5-04 Music player.** Transport, queue, browse panel, search, play folder, shuffle all, seek, volume. Done when playback survives view changes.
- [ ] **M5-05 Music persistence.** Remember folders, volume, last track. Media keys while focused. Done when restart resumes state.
- [ ] **M5-06 Sound effects.** Page turn, book pull, shelf thud, UI ticks. Independent mute, low default. Done when they never overlap badly.
- [ ] **M5-07 Empty states and onboarding.** First-run folder choice, empty shelves, import prompt, shortcut hints. Done when a new user can import without docs.
- [ ] **M5-08 Settings panel.** Library, import, quality, reduced motion, sound, music, shortcuts, about. Done when every setting persists.
- [ ] **M5-09 Linux packaging.** AppImage and deb, icon, desktop entry, clean-machine install. Done when it launches on a clean Linux user.
- [ ] **M5-10 Other platforms.** CI builds unsigned NSIS and dmg. Done when artifacts download and open with expected warnings.
- [ ] **M5-11 Branding.** App icon, window title, about screen, README screenshots. Done when the app feels named.
- [ ] **M5-12 Accessibility pass.** Keyboard paths, focus rings, labels, reduced motion, index parity. Done when the index view can do everything without 3D.

## M6 Hardening

- [ ] **M6-01 Missing files.** Startup scan, missing state, relink, bulk relink. Done when a moved folder can be repaired.
- [ ] **M6-02 Bad PDFs.** Corrupt, encrypted, huge, zero pages. Done when each shows a useful error and never crashes.
- [ ] **M6-03 Crash recovery.** Import queue resume, annotation autosave, DB integrity check on start. Done when killing the app mid-import is safe.
- [ ] **M6-04 Disk full.** Copy and conversion failures surface and roll back cleanly. Done when a simulated full disk leaves no half-books.
- [ ] **M6-05 Low-end performance.** Quality auto-detect, index fallback, memory ceiling. Done when the app is usable on integrated graphics.
- [ ] **M6-06 Backup.** Export a library manifest and annotation JSON. Done when a library can be verified without the app.
- [ ] **M6-07 Diagnostics.** Log viewer, library health report, version info. Done when support can be handled from the app.
- [ ] **M6-08 E2E suite.** Import, read, annotate, restart, search, move, package smoke. Done when green in CI.
- [ ] **M6-09 Release checklist.** Version, changelog, fixtures, clean install, backup restore. Done when v1 is tagged.

## Done log

Newest first. One line per task: date, task, note.

- 2026-11-20 M0-05 to M0-09: schema and book queries, first-run location, rotating log and error boundaries, CI, five-view shell with bundled fonts. CI workflow is local-verified; remote run awaits first push.
- 2026-11-20 M0-01 to M0-04, M0-10: scaffold, toolchain, secure shell, typed IPC, test harness.
- 2026-11-20 P-01 to P-05: spec, review, defaults, TODO, handoff.

## Blocked

Nothing.
