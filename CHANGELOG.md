# Changelog

All notable changes to **Alexandria** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **Product Landing Page (`site/`):** Scroll-choreographed Obsidian & Gilded Brass editorial site anchored by a procedural 3D Brass Celestial Armillary Sphere cradling a hinged Leather-Bound Illuminated Folio that opens smoothly on scroll.
- **Automated GitHub Pages Deployment (`.github/workflows/pages.yml`):** Automatically builds and deploys the landing page and an interactive in-browser static Web Demo (`/demo/`) to `<username>.github.io/Alexandria` on every push to `main`.
- **Live OS Installer Detection:** Automatically detects Linux, Windows, and macOS visitors and fetches live release artifacts, file sizes, and `SHA256SUMS.txt` links from GitHub Releases.
- **Product Documentation & Open-Source Suite:** Redesigned `README.md` with custom product SVGs (`hero-banner.svg`, `capabilities.svg`, `architecture.svg`, `release-pipeline.svg`), dedicated `docs/USER_GUIDE.md`, `docs/CONTROLS.md`, `docs/ARCHITECTURE.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and structured GitHub Issue & PR templates.

### Changed
- **Automated Cross-Platform Releases (`.github/workflows/release.yml`):** Automated packaging for Linux (`.AppImage`, `.deb`), Windows (`-setup.exe`, `-portable.exe`), and macOS (`.dmg`, `.zip`) with `SHA256SUMS.txt` on every push to `main` and `v*` tag.
- **3D Grand Hall Craft & Controls:** Walkable upper mezzanine balcony with grand staircase, rotating celestial armillary centerpiece, compass rose medallion, rolling ladders, marble busts, bronze braziers, switchable hall themes (Dark Academia, Sunlit Marble, Observatory), procedural ambient soundscape, live corner mini-map, drag-and-drop shelf management, and fixed WASD / `D` movement physics.
- **Precision PDF Reader:** Flicker-free double-buffered offscreen rendering, exact-where-you-click Highlight / Ink / Erase tools, and distraction-free Study Mode with session timer.

---

## [0.1.0] — Initial Local-First Architecture

### Added
- Electron + React + TypeScript + Three.js + PDF.js + SQLite FTS5 foundation.
- SHA-256 deduplicating importer for PDFs and optional LibreOffice conversion for Office formats.
- Append-only 3D Reading Room, 2D Floor Map, Librarian management view, sortable Index, Reading Desk, Tags, global `Ctrl/Cmd+K` full-text search, and local Music Dock.
