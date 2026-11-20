# Alexandria: Next Steps

Last updated: 2026-11-21
Audience: the next session, human or agent.

## What this is

Alexandria is a local-first desktop library for a curated PDF collection: a
3D dark-academia room, real shelves, a full-screen reader, and non-destructive
annotations. Electron, TypeScript, PDF.js, SQLite with FTS5, three.js.

The design lives in `SPEC.md`. The task list and its real status live in
`TODO.md`.

## Current state

- The app builds, launches, imports PDFs and Office documents, reads them,
  annotates them, searches them, and projects the library into a 3D room.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test` (43 tests), and
  `pnpm test:e2e` (10 tests) all pass locally.
- M0–M4 are complete apart from the partials listed in `TODO.md` (thumbnail
  cache, encrypted-fixture coverage, layout tests, drag-and-drop shelving).
  M5 is nearly done; M6 is in its hardening pass.
- The working tree is committed. The only untracked file, `mise.toml`, is a
  local tool pin and intentionally not part of the project.
- There is still no git remote, so CI has never run remotely.
- Defaults: imports copy into the library, layout growth is append-only, Linux
  is the v1 install target, music and art are read from the user's folders.

## First 10 minutes

1. Run `pnpm install`, then `pnpm typecheck`, `pnpm test`, and `pnpm build`.
2. Read `SPEC.md` sections 6 (experience), 9 (architecture), and 10 (the room).
3. Open `TODO.md` and continue at `Current focus`.
4. Skim `src/renderer/src/views/RoomView.tsx` (shell, lighting, camera) and
   `ReaderView.tsx` (spread, ink, selection) before the release push, then work
   the partials in `TODO.md`.

## How to resume

- Open `TODO.md`, find `Current focus`, and pick up there.
- A `[~]` task names what is still missing; do only that remainder.
- Read the matching `SPEC.md` section before changing behavior.
- Update `TODO.md` when a task is done. Move `Current focus` forward.
- Append to the Done Log, newest first.
- If a decision the spec did not cover is made, add it to `SPEC.md` under
  Decisions Made and note it here.
- Leave the repo clean and every gate green.

## Dependency order

M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6, with M2 and M3 parallel after M1.
M4 depends on M3 because the room is projected from persisted layout. M5's
settings panel supplies the quality and reduced-motion settings M4 consumes,
so wire the setting first, then the behavior.

## Architecture in one screen

- Electron main owns filesystem, SQLite, the import queue, LibreOffice
  conversion, music scanning, and settings.
- Preload exposes a typed, minimal IPC API. No Node in the renderer.
- Renderer owns three.js, PDF.js, the annotation overlay, map, librarian,
  index, and player.
- PDF inspection and text extraction run in the main process with
  pdfjs-dist and @napi-rs/canvas.
- SQLite through node:sqlite, WAL, foreign keys, `user_version` migrations.
- Layout tables are authoritative; the 3D room is projected from them, and
  growth only appends.
- The library is a folder: `library.db`, `config.json`, `books/`, `covers/`,
  `thumbs/`, `cache/`, `logs/`.
- The library location lives in Electron `userData`. `ALEXANDRIA_LIBRARY_PATH`
  overrides it for tests and portable runs.
- Main logs rotate at 2MB to `logs/main.log.1`. Renderer errors cross IPC into
  the same log.
- The renderer uses a dependency-free hash router (`#/room`, `#/reader`,
  `#/map`, `#/librarian`, `#/index`).
- Settings are key/value rows in the `settings` table, read and written over
  IPC (`getSettings`, `setSetting`) and seeded from `library/settings.ts`.

## Commands

```sh
pnpm install
pnpm dev          # Electron app with HMR
pnpm build        # typecheck and production build
pnpm typecheck
pnpm lint
pnpm test         # Vitest
pnpm test:e2e     # build, then Playwright Electron
pnpm dist:linux   # AppImage + deb
```

Node 22 or newer and pnpm are required. LibreOffice is optional and enables
Office-document import.

## Decisions that constrain the build

- Electron, not Tauri. One Chromium is worth more than a small binary.
- PDF.js is the only PDF engine in v1.
- PDFs are immutable. Annotations live in SQLite, normalized to page
  coordinates.
- SQLite plus FTS5 is the library format. No cloud, no accounts, no telemetry.
- Imports copy by default; linking is an option.
- Layout is append-only. Existing books never reflow because the collection
  grew.
- A shelf is one row, a bay is five rows, a section is a run of bays.
- The reader pauses the 3D loop.
- The index view is a first-class alternative to 3D, not a fallback.
- The room uses raw three.js rather than react-three-fiber; both the camera and
  the render loop are managed imperatively.

## Open questions

1. Stylus or drawing tablet? Affects how much pressure and palm rejection is
   worth implementing for ink.
2. Music folder locations and approximate collection size?
3. Spine text: full title and author, or title only? The spec assumes both; the
   atlas work should settle it.
4. Sound effects on by default at low volume, or off? The spec assumes low and
   on.

## Known risks

- 3D performance on integrated GPUs. Mitigation: instancing, simpler lighting
  presets, a paused loop, and the index fallback.
- Procedural rooms looking generic. Mitigation: palette, modular prefabs,
  lighting, texture work.
- PDF.js edge cases and memory. Mitigation: fixtures, disposal, cache caps.
- Scope creep. Mitigation: the v1 list is fixed; everything else belongs in
  `SPEC.md` Future Scope.

## Definition of done for a task

- Strict TypeScript compiles; lint and tests pass.
- The acceptance line in `TODO.md` is met.
- No new network calls, no new telemetry.
- The change is committed with a conventional message.
- `TODO.md` is updated.

## Handoff protocol if this session ends

1. Do not leave the repo dirty. Commit or stash.
2. Mark the current task `[~]` with a one-line note if unfinished.
3. Add a Done Log entry for completed work.
4. Update `Current focus`.
5. Add anything surprising here under Current state.
6. If a decision changed, update `SPEC.md` and record it here.
