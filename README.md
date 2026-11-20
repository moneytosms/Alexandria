# Alexandria

A local-first 3D library for the PDFs you actually read.

Dark academia reading room, real shelves, a clean full-screen reader, and non-destructive annotations. Electron, TypeScript, PDF.js, SQLite, three.js.

## Status

Scaffold. See [SPEC.md](SPEC.md) for the design and [TODO.md](TODO.md) for the build plan.

## Development

```sh
pnpm install
pnpm dev
```

Requires Node 22 or newer, pnpm, and optionally LibreOffice for office document import.

## Scripts

```sh
pnpm dev          # Electron app with HMR
pnpm build        # typecheck and production build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm dist:linux
```
