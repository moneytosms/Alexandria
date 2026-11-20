# Alexandria: Next Steps

Last updated: 2026-11-20
Audience: the next session, human or agent.

## What this is

Alexandria is a local-first desktop library for a curated PDF collection. It is a 3D dark-academia room with real shelves, a full-screen reader, and non-destructive annotations. Electron plus TypeScript, PDF.js, SQLite with FTS5, three.js.

The full design is in `SPEC.md`. The task list is in `TODO.md`.

## Current state

- Design complete and reviewed by a fresh builder. All eight review gaps are resolved.
- No code written yet. The project folder `/home/sms/Projects/Alexandria` is empty and is not a git repository.
- `SPEC.md`, `TODO.md`, and this file are in `/home/sms/.opencode/plan` because the planning session could not write to the project.
- Defaults settled: imports copy into the library by default, layout growth is append-only, Linux is the v1 install target, assets are procedural or CC0.

## First 10 minutes

1. Copy the three docs into the repo:

```sh
mkdir -p /home/sms/Projects/Alexandria
cp /home/sms/.opencode/plan/SPEC.md /home/sms/Projects/Alexandria/
cp /home/sms/.opencode/plan/TODO.md /home/sms/Projects/Alexandria/
cp /home/sms/.opencode/plan/NEXT_STEPS.md /home/sms/Projects/Alexandria/
```

2. Read `SPEC.md` sections 6, 9, and 10. Those define the experience, the architecture, and the room.
3. Start `M0-01` in `TODO.md`.

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
- SQLite WAL, foreign keys, `user_version` migrations.
- Layout tables are authoritative. The 3D room is projected from them. Growth only appends.
- The library is a folder: `library.db`, `config.json`, `books/`, `covers/`, `thumbs/`, `cache/`, `logs/`.

## Commands to create (M0)

```sh
pnpm install
pnpm dev          # Electron app with HMR
pnpm build        # production build
pnpm typecheck
pnpm lint
pnpm test         # Vitest
pnpm test:e2e     # Playwright Electron
pnpm dist:linux   # AppImage + deb
```

Node 26, pnpm 12, LibreOffice, and ffmpeg are installed on this machine.

## Decisions that constrain the build

- Electron, not Tauri. The product is a 3D room plus a PDF canvas; one Chromium is worth more than a small binary.
- PDF.js is the only PDF engine in v1.
- PDFs are immutable. Annotations live in SQLite, normalized to page coordinates.
- SQLite plus FTS5 is the library format. No cloud, no accounts, no telemetry.
- Imports copy by default. Linking is an option.
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
