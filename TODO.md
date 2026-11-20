# Alexandria TODO

Last updated: 2026-11-21
Spec: `./SPEC.md`
Handoff: `./NEXT_STEPS.md`

Status: M0 complete. M1–M4 substantially complete; the room has its full shell,
lighting, camera travel, and performance check. M5 is nearly done and M6 is in
its hardening pass. The app runs, imports, reads, annotates, searches, plays
music, and browses as a 3D room; it is not yet release-ready.

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

`M5/M6 Release hardening` — close the remaining partials that a user can see:
music browse, encrypted and bad-PDF fixtures, packaging on a clean machine, the
log viewer, and the release checklist. Reader, room, map, and index features are
feature-complete for v1.

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
- [~] **M1-05 Cover and thumbnails.** Covers are generated, and the reader's
  Pages tab renders lazy page thumbnails. There is still no on-disk thumbnail
  cache and covers have no PDF-page fallback.
- [x] **M1-06 Text extraction.** Pages and `pages_fts` populated on import.
- [x] **M1-07 Import queue.** Concurrency cap, progress events, cancel.
- [x] **M1-08 Office conversion.** LibreOffice headless into `cache/`.
- [~] **M1-09 Encrypted PDFs.** Locked import and unlock-on-open work; indexing
  after unlock and the password fixture still need a test.
- [x] **M1-10 Placement and growth.** Append-only growth and undo.
- [x] **M1-11 Index view.** Sortable table with metadata, filters, and
  ArrowUp/ArrowDown row navigation.
- [x] **M1-12 Basic reader open.**
- [x] **M1-13 Missing files.** Scan, badge, relink.
- [~] **M1-14 Fixtures and tests.** Generated text PDF and import/convert tests
  exist. Scanned, 500-page, encrypted, and corrupt fixtures do not.

## M2 Reader and annotations

- [~] **M2-01 Reader shell.** Full-screen open/close and progress restore; the
  saved anchor is page-level, and chrome does not auto-hide.
- [x] **M2-02 Render modes.** Page, continuous, fit width/page, custom zoom,
  rotate, and a two-page spread that folds away on narrow viewports.
- [x] **M2-03 Virtualization.** Visible pages ±2 with cleanup on unmount.
- [x] **M2-04 Text layer and selection.** Selection with copy and a floating
  toolbar carrying five highlight swatches; rendered through a portal so the
  next page cannot cover it.
- [x] **M2-05 Sidebar.** Contents, search, notes, and Pages tabs; lazy page
  thumbnails, a resize handle, and a remembered width.
- [x] **M2-06 In-book search.** Result list, page jump, match highlighting, an
  active result, and a previous/next stepper with a match count.
- [x] **M2-07 Progress and finished.** Page progress, auto-finish, override.
- [~] **M2-08 Highlights.** Five colors, normalized rects, delete. No edit.
- [~] **M2-09 Notes.** Standalone notes and notes attached to annotations,
  edit and delete. No pinned-page notes.
- [x] **M2-10 Ink.** Freehand strokes with pressure-aware width, smoothed paths,
  undo/redo (buttons and Ctrl/Cmd+Z), and an eraser tool.
- [x] **M2-11 Bookmarks.**
- [x] **M2-12 Annotations panel.** One list with page, type, jump, edit note,
  delete, a type filter, and grouping by page.
- [x] **M2-13 Per-book settings.** Persisted in `reader_json`.
- [x] **M2-14 Shortcuts.** Arrows/PageUp/PageDown and Space, Home/End, +/- zoom,
  F, B, H, I, E, S, Ctrl/Cmd+F, Ctrl/Cmd+Z, `?`, and Escape, with a documented
  list in the reader and in settings.
- [~] **M2-15 Reader tests.** Unit tests now cover spread, ink, selection, and
  search math; E2E covers spread, thumbnails, selection toolbar, ink undo, and
  search stepping. No unit test for annotation persistence or progress restore.

## M3 Library model

- [x] **M3-01 Layout CRUD.** Floors, rooms, sections, bays, shelves.
- [x] **M3-02 Growth rules.** Append-only growth with undo.
- [x] **M3-03 Librarian mode.**
- [~] **M3-04 Move and sort.** Move, unshelve, shelf sorts. No drag-and-drop
  between shelves and no multi-select.
- [x] **M3-05 Desk.** Reading, pinned, finished-in-30-days, five-book cap.
- [~] **M3-06 Inbox.** Desk drawer inbox with per-book shelving. No bulk
  shelve and no cart view.
- [x] **M3-07 Map.** 2D wall plan with floor tabs, zoom/pan, a you-are-here
  marker, per-bay travel chips, and a return to the room.
- [x] **M3-08 Tags.**
- [x] **M3-09 Book details.** Edit metadata, cover, path, stats, remove, relink.
- [~] **M3-10 Library tests.** Book queries and library service only. No layout
  invariants, growth, move, or delete-reassignment tests.

## M4 The room

- [x] **M4-01 3D bootstrap.** Raw three.js renderer, resize handling, a custom
  camera, low/medium/high quality presets, and a paused loop while hidden.
- [x] **M4-02 Room shell.** Walls, floor, rug, bays, desk, lamp, ceiling with
  beams, four columns, clerestory windows, a rolling ladder, and a gramophone.
- [x] **M4-03 Shelves from layout.**
- [x] **M4-04 Books.** Procedural spines baked into one 32×16 texture atlas and
  merged into a single pickable mesh, so the whole shelf is one draw call.
  (Merged batch rather than `InstancedMesh`; same one-draw-call outcome.)
- [x] **M4-05 Lighting and materials.** Warm key, dusk fill, lamp, ACES tone
  mapping, contact shadows, additive glows, a CSS vignette, and quality-gated
  dust motes.
- [x] **M4-06 Camera.** OrbitControls plus per-shelf anchors, eased glides with
  a look-at blend, a reduced-motion cut, an opening doorway glide, and a fade on
  room change. Neighbouring rooms are not kept mounted.
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
- [~] **M5-04 Music player.** Transport, seek, volume, next/previous, dock, a
  queue panel, play-all, and shuffle. No music browse/search panel and no
  play-folder command.
- [x] **M5-05 Music persistence.** Volume, last track, and collapse state in
  `localStorage`; Media Session metadata and media keys.
- [x] **M5-06 Sound effects.** Procedural page, pull, tick, and thud sounds with
  a settings volume; no audio assets.
- [x] **M5-07 Empty states and onboarding.** First-run folder choice, empty
  shelves, import prompt, a first-run tour of four tips, and a rail button to
  reopen it.
- [x] **M5-08 Settings panel.** Library, import, quality, reduced motion, sound,
  music, shortcuts, and diagnostics; opened with Ctrl/Cmd + ,.
- [~] **M5-09 Linux packaging.** AppImage/deb config, app icon, executable name,
  and desktop entry exist and `--linux dir` builds. No clean-machine test yet.
- [ ] **M5-10 Other platforms.**
- [~] **M5-11 Branding.** Name, title, palette, display serif, app icon, and a
  version/platform line in settings diagnostics. No about window or README
  screenshots.
- [x] **M5-12 Accessibility pass.** Labels, roles, focus rings, a keyboard path
  through the room (arrow shelf travel, Escape), reader keyboard tools, and
  reduced-motion behavior.

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
- [~] **M6-07 Diagnostics.** Library health API, rotating log file, and version
  and platform in settings. No log viewer.
- [~] **M6-08 E2E suite.** Ten tests across annotate, import, import-run, perf,
  reader, reader-features, room, and smoke, including restarts, a shelf move,
  spread, ink undo, search stepping, and quality switching. No packaged binary
  smoke test.
- [ ] **M6-09 Release checklist.**

## Done log

Newest first. One line per task or coherent batch.

- 2026-11-21 Feature completion pass: full room shell (ceiling, columns,
  windows, ladder, gramophone), contact shadows, glows, vignette, dust, doorway
  glide and room fade; reader spread, Pages thumbnails, resizable sidebar,
  portal selection toolbar, search stepper, ink undo/redo and eraser, filtered
  annotation grouping, shortcut overlay; music queue, shuffle and play-all;
  first-run tour; index arrow keys; map zoom/pan, you-are-here, bay travel;
  settings version line; pure reader math plus unit tests; reader-features and
  room E2E specs. Typecheck, lint, 43 unit tests, 10 E2E green.
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
