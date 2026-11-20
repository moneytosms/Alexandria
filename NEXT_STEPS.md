# Alexandria: Next Steps

Last updated: 2026-11-20
Audience: the next session, human or agent.

## What this is

Alexandria is a local-first desktop library for a curated PDF collection. It is a 3D dark-academia room with real shelves, a full-screen reader, and non-destructive annotations. Electron plus TypeScript, PDF.js, SQLite with FTS5, three.js.

The full design is in `SPEC.md`. The task list is in `TODO.md`.

## Current state

- M0 is complete. The app builds, launches, creates a library folder, and shows a five-view shell.
- Git repository initialized at `/home/sms/Projects/Alexandria`. Commits: scaffold, database, and the in-progress M0 completion commit.
- Working: electron-vite, React, strict TypeScript, secure preload, typed IPC, node:sqlite with FTS5, migrations, first-run library location, settings, rotating logs, error boundaries, five-view hash router, bundled Almendra and Inter, Vitest, Playwright, electron-builder, CI workflow.
- Import entry points are working: file picker, folder scan, and drag and drop feed a visible queue with unsupported and unreadable files reported. Nothing is written to the database yet.
- Tests: `pnpm test` has 6 files and 23 passing tests. `pnpm test:e2e` has 4 passing Electron tests. `pnpm build` and `pnpm exec electron-builder --linux dir` pass locally.
- CI workflow exists at `.github/workflows/ci.yml` but has not run remotely because the repo has no remote yet.
- Not started: hashing and import processing, PDF metadata, reader, 3D room, map projection, librarian actions, music.
- Defaults settled: imports copy into the library by default, layout growth is append-only, Linux is the v1 install target, assets are procedural or CC0.

## First 10 minutes

1. Run `pnpm install`, `pnpm test`, and `pnpm build` to confirm the environment.
2. Read `SPEC.md` sections 6, 9, and 10. Those define the experience, the architecture, and the room.
3. Open `TODO.md` and start `M1-02 Detect, hash, dedupe`.
4. Keep `pdfjs-dist` work out of the main process. Plan the PDF worker or utility process before M1-04.

## How to resume

- Open `TODO.md`, find `Current focus`, and pick up there.
- If the current task is blocked, check `Blocked`, then take the first unchecked task whose dependencies are done.
- Read the matching `SPEC.md` section before changing behavior.
- Update `TODO.md` when a task is done. Move `Current focus` forward.
- Append to the Done Log, newest first.
- If you make a decision the spec did not cover, add it to `SPEC.md` under Decisions Made, and note it here.

## Dependency order

M0 -> M1 -> M2 -> M3 -> M4 -> M5 -> M6.

M2 (reader and annotations) and M3 (library model) can run in parallel after M1. M4 depends on M3 because the room is projected from persisted layout. M5 depends on M4 for music and search entry points. Do not start M4 before M3-01 and M3-02 are solid.

## Architecture in one screen

- Electron main process owns filesystem, SQLite, import queue, LibreOffice conversion, music scanning, settings.
- Preload exposes a typed, minimal IPC API. No Node in the renderer.
- Renderer owns three.js, PDF.js, annotations overlay, map, librarian, index, player.
- PDF extraction runs in a worker or utility process with pdfjs-dist and @napi-rs/canvas.
- SQLite through node:sqlite, WAL, foreign keys, `user_version` migrations. No native database module.
- Layout tables are authoritative. The 3D room is projected from them. Growth only appends.
- The library is a folder: `library.db`, `config.json`, `books/`, `covers/`, `thumbs/`, `cache/`, `logs/`.
- The library location lives outside the library in Electron `userData/app-config.json`. `ALEXANDRIA_LIBRARY_PATH` overrides it for tests and portable runs.
- Main logs rotate at 2MB to `logs/main.log.1`. Renderer errors cross IPC into the same log.
- The renderer uses a hash router (`#/room`, `#/reader`, `#/map`, `#/librarian`, `#/index`). No routing dependency.

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

Node 26, pnpm 12, LibreOffice, and ffmpeg are installed on this machine.

## Decisions that constrain the build

- Electron, not Tauri. The product is a 3D room plus a PDF canvas; one Chromium is worth more than a small binary.
- PDF.js is the only PDF engine in v1.
- PDFs are immutable. Annotations live in SQLite, normalized to page coordinates.
- SQLite plus FTS5 is the library format. No cloud, no accounts, no telemetry.
- Imports copy by default. Linking is an option.
- First run asks for a library location and defaults to `~/Alexandria`.
- Layout is append-only. Existing books never reflow because the collection grew.
- A shelf is one row, a bay is five rows, a section is a run of bays.
- The reader pauses the 3D loop.
- The index view is a first-class alternative to 3D, not a fallback.

## Open questions

These do not block M0 to M3. Ask the user when the relevant work starts.

1. Stylus or drawing tablet? Affects how much pressure and palm rejection work is worth.
2. Music folder locations and approximate collection size? Needed for M5-03.
3. Spine text: full title and author, or title only? Spec assumes both.
4. Sound effects on by default at low volume, or off? Spec assumes low and on.

## Known risks

- 3D performance on integrated GPUs. Mitigation: instancing, baked-style lighting, quality presets, index fallback.
- Procedural rooms looking generic. Mitigation: strong palette, modular prefabs, lighting, texture work. Budget time for M4-02 and M4-05.
- PDF.js edge cases. Mitigation: fixture suite in M1-14, graceful errors.
- Electron memory. Mitigation: pause the render loop, dispose PDF pages, cap caches.
- Scope creep. Mitigation: the v1 list is fixed. Everything else is in `SPEC.md` Future Scope.

## Definition of done for a task

- Code compiles with strict TypeScript.
- Lint, typecheck, and tests pass.
- The acceptance line in `TODO.md` is met.
- No new network calls, no new telemetry.
- The change is committed with a conventional message.
- `TODO.md` is updated.

## Handoff protocol if this session ends

1. Do not leave the repo dirty. Commit or stash.
2. Mark the current task `[~]` with a one-line note if unfinished.
3. Add a Done Log entry for completed work.
4. Update `Current focus`.
5. Add anything surprising to this file under Current state.
6. If a decision changed, update `SPEC.md` and record it here.
