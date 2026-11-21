# Contributing to Alexandria

Thank you for your interest in contributing to **Alexandria**! Every bug report, documentation improvement, 3D craft polish, and feature pull request helps make local-first reading better for everyone.

---

## Ways to Contribute

- **Report Bugs:** Open a [Bug Report](.github/ISSUE_TEMPLATE/bug_report.yml) with your OS, Alexandria version, and clear reproduction steps.
- **Suggest Enhancements:** Share ideas via the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.yml) template—especially around 3D Grand Hall immersion, PDF annotation ergonomics, accessibility, or local indexing.
- **Improve Documentation:** Clarify guides in `docs/`, expand keyboard references, or refine setup instructions.
- **Submit Code:** Fix issues, add tests, optimize rendering, or build requested features.

---

## Local Development Setup

### Prerequisites

- **Node.js 22+** and **npm**
- **Git**
- *(Optional)* **LibreOffice** if you are testing `.docx`, `.pptx`, `.odt`, or `.odp` import conversion

### Getting Started

```sh
# 1. Fork the repository on GitHub, then clone your fork
git clone https://github.com/<your-username>/Alexandria.git
cd Alexandria

# 2. Install dependencies
npm install

# 3. Verify your local baseline
npm run typecheck
npm run lint
npm test
```

### Running Locally

- **Web preview (Landing Page at `/` + Live App at `/demo/`):**
  ```sh
  npm run dev
  ```
- **Native Electron desktop app:**
  ```sh
  npm run dev:electron
  ```
- **GitHub Pages bundle (Landing + Static Browser Demo):**
  ```sh
  npm run build:pages
  ```

Use `ALEXANDRIA_LIBRARY_PATH=/tmp/alexandria-dev` if you want to keep test libraries isolated from your personal books.

---

## Architecture & Coding Standards

Before making architectural changes, please review [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md):

1. **Preserve Local-First Guarantees:** Alexandria must never send telemetry, require user accounts, or silently mutate a user's original PDF files.
2. **Respect the Typed Bridge (`src/shared/api.ts`):** All renderer-to-backend calls belong on `window.alexandria`. If you add a new RPC/IPC method, implement it across:
   - `src/preload/index.ts` & `src/main/ipc/` (Electron)
   - `server.ts` & `src/renderer/src/web-bridge.ts` (Local Web)
   - `src/renderer/src/static-demo-bridge.ts` (Static Browser Demo)
3. **Strict TypeScript & Formatting:** Keep `strict: true` clean with zero `any` escapes unless thoroughly justified. Run `npm run format` (Prettier) and `npm run lint` (ESLint) before pushing.
4. **Tests First Where Practical:** Add or update Vitest unit/integration tests for database queries, importers, geometry/layout math, and reader coordinate transforms.

---

## Pull Request Process

1. Create a focused branch from `main`:
   ```sh
   git checkout -b feat/your-concise-topic
   ```
2. Keep commits clean and descriptive (e.g., `fix(reader): align highlight hit-testing at 150% zoom`).
3. Run the full verification suite before opening your PR:
   ```sh
   npm run lint
   npm run typecheck
   npm test
   npm run build
   npm run build:pages
   ```
4. Open a Pull Request filling out `.github/PULL_REQUEST_TEMPLATE.md`. Include before/after screenshots or a short screen recording for any visual or 3D scene changes.

---

## Community

All contributors and maintainers are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Thank you for helping build Alexandria!
