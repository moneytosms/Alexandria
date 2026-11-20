# Alexandria TODO

Last updated: 2026-11-21
Spec: `./SPEC.md`
Handoff: `./NEXT_STEPS.md`

Status: M0 complete. M1–M3 substantially complete. M4 mostly done: the room
batches, animates, and has a performance check. M5 and M6 are well started. The
app runs, imports, reads, annotates, searches, plays music, and browses as a 3D
room; it is not yet release-ready.

## How to work

1. Read `SPEC.md` for the area you are touching.
2. Pick the first unchecked or partial task in the current milestone.
3. Implement only that task. Keep the diff surgical.
4. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e` when the
   change touches the renderer or main-process wiring.
5. Mark the task here and add one line to the Done Log.
6. Update `NEXT_STEPS.md` if the plan or the current focus changed.
7. Commit: conventional message, imperative, under 72 characters.

Status: `[ ]` todo, `[~]` started or partial, `[x]` done, `[!]` blocked.
A `[~]` task's unmet acceptance line is written next to it.

## Current focus

`M4 Finish the room` — the remaining shell props, lighting passes, and camera
travel between rooms. The batch, pull animation, reduced motion, and performance
check are done.

## Planning

- [x] **P-01 Write SPEC v1.**
- [x] **P-02 Builder review.**
- [x] **P-03 Settle defaults.**
- [x] **P-04 Create TODO.**
- [x] **P-05 Create handoff.**

## M0 Foundation

- [x] **M0-01 Repo scaffold.**
- [x] **M0-02 Toolchain.**
- [x] **M0-03 Secure app shell.**
- [x] **M0-04 Typed IPC.**
- [x] **M0-05 Database.** node:sqlite, WAL, foreign keys, migrations.
- [x] **M0-06 Library folder.**
- [x] **M0-07 Logging and errors.**
- [x] **M0-08 CI.** Workflow exists; remote run still awaits a push.
- [x] **M0-09 UI shell.** Five-view hash router, theme, bundled fonts.
- [x] **M0-10 Test harness.**

## M1 Import and index

- [x] **M1-01 Import entry points.** File picker, folder scan, drag and drop.
- [x] **M1-02 Detect, hash, dedupe.** SHA-256, duplicate focus; covered by E2E.
- [x] **M1-03 Copy or link.** `import.storage` setting; copies land in `books/`.
- [x] **M1-04 PDF metadata.** pdfjs-dist title/author/page count with fallbacks.
- [~] **M1-05 Cover and thumbnails.** Covers are generated; lazy 256px page
  thumbnails and their cache are not implemented.
- [x] **M1-06 Text extraction.** Pages and `pages_fts` populated on import.
- [x] **M1-07 Import queue.** Concurrency cap, progress events, cancel.
- [x] **M1-08 Office conversion.** LibreOffice headless into `cache/`.
- [~] **M1-09 Encrypted PDFs.** Locked import and unlock-on-open work; indexing
  after unlock and the password fixture still need a test.
- [x] **M1-10 Placement and growth.** Append-only growth and undo.
- [~] **M1-11 Index view.** Sortable table with metadata and filters; keyboard
  row activation only, no arrow-key navigation.
- [x] **M1-12 Basic reader open.**
- [x] **M1-13 Missing files.** Scan, badge, relink.
- [~] **M1-14 Fixtures and tests.** Generated text PDF and import/convert tests
  exist. Scanned, 500-page, encrypted, and corrupt fixtures do not.

## M2 Reader and annotations

- [~] **M2-01 Reader shell.** Full-screen open/close and progress restore; the
  saved anchor is page-level, and chrome does not auto-hide.
- [~] **M2-02 Render modes.** Page, continuous, fit width/page, custom zoom,
  rotate. Spread mode is missing.
- [x] **M2-03 Virtualization.** Visible pages ±2 with cleanup on unmount.
- [~] **M2-04 Text layer and selection.** Selection with copy and highlight;
  no floating selection toolbar.
- [~] **M2-05 Sidebar.** Contents, search, and notes tabs. No thumbnails, no
  resize handle, width is not remembered.
- [~] **M2-06 In-book search.** Result list, page jump, and match highlighting.
  No next/previous stepper or match count.
- [x] **M2-07 Progress and finished.** Page progress, auto-finish, override.
- [~] **M2-08 Highlights.** Five colors, normalized rects, delete. No edit.
- [~] **M2-09 Notes.** Standalone notes and notes attached to annotations,
  edit and delete. No pinned-page notes.
- [~] **M2-10 Ink.** Freehand strokes persisted and rendered. No pressure,
  smoothing, undo/redo, or eraser.
- [x] **M2-11 Bookmarks.**
- [~] **M2-12 Annotations panel.** One list with page, type, jump, edit note,
  delete. No type filter or page grouping.
- [x] **M2-13 Per-book settings.** Persisted in `reader_json`.
- [~] **M2-14 Shortcuts.** Arrows/PageUp/PageDown, Home/End, +/- zoom, F, B, H, I,
  Escape. Space, search, and a documented list are missing.
- [~] **M2-15 Reader tests.** One E2E journey. No unit tests for coordinate
  transforms, annotation persistence, or progress restore.

## M3 Library model

- [x] **M3-01 Layout CRUD.** Floors, rooms, sections, bays, shelves.
- [x] **M3-02 Growth rules.** Append-only growth with undo.
- [x] **M3-03 Librarian mode.**
- [~] **M3-04 Move and sort.** Move, unshelve, shelf sorts. No drag-and-drop
  between shelves and no multi-select.
- [x] **M3-05 Desk.** Reading, pinned, finished-in-30-days, five-book cap.
- [~] **M3-06 Inbox.** Desk drawer inbox with per-book shelving. No bulk
  shelve and no cart view.
- [~] **M3-07 Map.** 2D wall plan with floor tabs and travel to the room.
  No zoom/pan, you-are-here marker, or click-to-travel per bay.
- [x] **M3-08 Tags.**
- [x] **M3-09 Book details.** Edit metadata, cover, path, stats, remove, relink.
- [~] **M3-10 Library tests.** Book queries and library service only. No layout
  invariants, growth, move, or delete-reassignment tests.

## M4 The room

- [x] **M4-01 3D bootstrap.** Raw three.js renderer, resize handling, a custom
  camera, low/medium/high quality presets, and a paused loop while hidden.
- [~] **M4-02 Room shell.** Walls, floor, rug, bays, desk, lamp. No ceiling,
  columns, windows, ladders, or gramophone.
- [x] **M4-03 Shelves from layout.**
- [x] **M4-04 Books.** Procedural spines baked into one 32×16 texture atlas and
  merged into a single pickable mesh, so the whole shelf is one draw call.
  (Merged batch rather than `InstancedMesh`; same one-draw-call outcome.)
- [~] **M4-05 Lighting and materials.** Warm key, dusk fill, lamp, ACES tone
  mapping. No AO, vignette, bloom, or dust.
- [~] **M4-06 Camera.** OrbitControls plus per-shelf anchors, eased glides with
  a look-at blend, and a reduced-motion cut. No room-to-room transitions.
- [x] **M4-07 Picking.** Raycast hover and click on spines, shelf boards, desk.
- [x] **M4-08 Pull animation.** Spine proxies fly to the camera, grow, and hand
  off to the reader; returning books fly back to their shelf slot.
- [x] **M4-09 Props.** Desk, lamp, open book, inbox stack.
- [x] **M4-10 Render loop.** Paused while hidden, throttled to 15 fps while
  unfocused, and torn down while the reader is open.
- [x] **M4-11 Reduced motion.** `ui.reducedMotion` cuts the camera, skips the
  pull flight, and opens the book directly.
- [x] **M4-12 Performance HUD.** Dev-only overlay and a
  `__alexandriaRoomStats` hook for tests.
- [x] **M4-13 Performance test.** 500-book fixture asserts one book batch and a
  loose frame budget in `tests/e2e/perf.spec.ts`.

## M5 Search, music, polish

- [x] **M5-01 Global search.** Cmd/Ctrl+K, FTS snippets, titles, notes.
- [x] **M5-02 Search navigation.** Opens the book at the hit page.
- [x] **M5-03 Music scan.** Folder picker and recursive scan with tags/art.
- [~] **M5-04 Music player.** Transport, seek, volume, next/previous, dock.
  No queue panel, browse/search panel, shuffle, or play-folder.
- [x] **M5-05 Music persistence.** Volume, last track, and collapse state in
  `localStorage`; Media Session metadata and media keys.
- [x] **M5-06 Sound effects.** Procedural page, pull, tick, and thud sounds with
  a settings volume; no audio assets.
- [~] **M5-07 Empty states and onboarding.** First-run folder choice, empty
  shelves, import prompt. No shortcut hints or guided tour.
- [x] **M5-08 Settings panel.** Library, import, quality, reduced motion, sound,
  music, shortcuts, and diagnostics; opened with Ctrl/Cmd + ,.
- [~] **M5-09 Linux packaging.** AppImage/deb config, app icon, executable name,
  and desktop entry exist and `--linux dir` builds. No clean-machine test yet.
- [ ] **M5-10 Other platforms.**
- [~] **M5-11 Branding.** Name, title, palette, display serif. No icon, about
  screen, or README screenshots.
- [~] **M5-12 Accessibility pass.** Labels, roles, focus rings on most controls.
  No full keyboard path through the room and no reduced-motion behavior.

## M6 Hardening

- [x] **M6-01 Missing files.** Startup and manual scan, relink, relink all.
- [~] **M6-02 Bad PDFs.** Import failures surface per file. No fixtures for
  corrupt, huge, or zero-page PDFs.
- [x] **M6-03 Crash recovery.** Startup `PRAGMA quick_check`, orphaned-copy
  sweep, and restart coverage for persisted annotations.
- [x] **M6-04 Disk full.** Import failures roll back copies and conversions;
  ENOSPC/EDQUOT and permission errors are reported in plain language.
- [ ] **M6-05 Low-end performance.**
- [x] **M6-06 Backup.** Manifest and annotation JSON export.
- [~] **M6-07 Diagnostics.** Library health API and rotating log file. No log
  viewer or version/about UI.
- [~] **M6-08 E2E suite.** Eight tests across annotate, import, import-run,
  perf, reader, and smoke, including a restart and a shelf move. No packaged
  binary smoke test.
- [ ] **M6-09 Release checklist.**

## Done log

Newest first. One line per task or coherent batch.

- 2026-11-21 M4 room finish: one-batch atlas spines, pull and return flights,
  shelf camera glides, quality presets, loop throttling, reduced motion,
  performance HUD and its 500-book test. M5-05/06/08 (player persistence, sound,
  settings). M6-03/04 (crash recovery, disk-full reporting). New annotate and
  perf E2E specs; details dialog made scrollable so long forms stay reachable.
- 2026-11-20 Repair: `ReaderView` compile break from the search-highlighting
  refactor fixed; typecheck, build, and 6 E2E tests pass again.
- 2026-11-20 Repo hygiene: the 6k-line uncommitted feature set is committed as
  shared, db, import, main, room, reader, library, shell, test, and chore
  commits.
- 2026-11-20 M1-01 to M3-09: import pipeline, reader with annotations, layout
  and shelving, desk/inbox, map, tags, details, search, and music.
- 2026-11-20 M0-01 to M0-10: scaffold through test harness.

## Blocked

Nothing.
