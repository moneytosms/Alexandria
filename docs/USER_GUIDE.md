# Alexandria User Guide

Welcome to **Alexandria**—a local-first 3D library and precision PDF reader designed for deep, distraction-free reading. This guide walks through installation, setting up your library folder, exploring the 3D Grand Hall, annotating PDFs, and backing up your archive.

---

## 1. Installation & First Run

### Desktop Installers (Recommended)

Download the latest release for your operating system from the [GitHub Releases](../../releases/latest) page or the Alexandria landing page:

- **Linux (`x64`)**
  - **AppImage (Portable):** Make the file executable and launch directly—no root privileges required:
    ```sh
    chmod +x Alexandria-*.AppImage
    ./Alexandria-*.AppImage
    ```
  - **Debian / Ubuntu (`.deb`):** Install via `sudo apt install ./Alexandria-*.deb`.
- **Windows (`x64`)**
  - **Installer (`-setup.exe`):** Standard NSIS installer with Start Menu and desktop shortcut options.
  - **Portable (`-portable.exe`):** Single self-contained executable you can run from any folder or USB drive.
- **macOS (Apple Silicon `arm64`)**
  - **Disk Image (`.dmg`):** Open the `.dmg` and drag **Alexandria** into your `Applications` folder.
  - **Archive (`.zip`):** Extract and move `Alexandria.app` into `Applications`.

### Choosing Your Library Folder

On first launch, Alexandria defaults to `~/Alexandria`. Every library is a transparent, plain directory on your disk:

```text
~/Alexandria/
├── library.db      # SQLite database: shelves, metadata, FTS5 full-text index & annotations
├── config.json     # Library name and local preferences
├── books/          # Copied PDF volumes (if Copy import mode is selected)
├── covers/         # Rendered first-page cover PNGs
├── thumbs/         # Cached page thumbnails
├── cache/          # Temporary conversion and upload scratch directory
└── logs/           # Local diagnostic log (never transmitted anywhere)
```

> **Tip (Portable Libraries):** Set the `ALEXANDRIA_LIBRARY_PATH` environment variable before launching to open an alternate library directory.

---

## 2. Importing Documents

You can add books to Alexandria in three ways:

1. **Drag & Drop:** Drag individual files or entire nested folders directly onto the Alexandria window from anywhere in the app.
2. **File / Folder Picker:** Open **Manage (Librarian)** from the navigation bar and select **Import Files** or **Import Folder**.
3. **Review Queue:** Confirm the staged items in the **Queue Tray** before shelving.

### Supported Formats

- **Native:** `.pdf` (full metadata extraction, cover rendering, and page-by-page FTS5 indexing).
- **Office Documents (Optional):** `.docx`, `.doc`, `.pptx`, `.ppt`, `.odt`, `.odp` are converted to archival PDFs automatically when [LibreOffice](https://www.libreoffice.org/) is installed on your system.

### Copy vs. Link Mode & Deduplication

- **Copy Mode (Default):** Copies documents into `books/` so your library remains 100% self-contained even if you reorganize your Downloads folder.
- **Link Mode:** References the original file path on disk without duplicating bytes. Use **Manage → Scan Missing / Relink** if linked files move later.
- **SHA-256 Deduplication:** Every imported file is hashed automatically so importing the same folder twice never creates duplicate books.

---

## 3. Exploring the 3D Grand Hall

The **Room** view opens into the Grand Hall—a walkable architectural space projected directly from your SQLite database:

- **Move & Look:** Use `W`, `A`, `S`, `D` (or Arrow keys) to walk the marble floor and ascend the grand staircase to the upper mezzanine balcony. Drag on the canvas to look smoothly around the room.
- **Inspect & Open Books:** Hover any leather spine to read its title and reading progress marker; click to open the **Quick Preview Card** with cover art, tags, progress stats, and one-click **Open in Reader**.
- **Drag-and-Drop Shelving:** Drag books directly between shelves right inside the 3D hall, or add and customize new shelves and wings from the hall controls.
- **Switchable Hall Themes:** Open the Hall atmosphere panel to switch instantaneously between:
  - **Dark Academia** — Candlelit walnut bays, gilded brass, warm hearth glow
  - **Sunlit Marble** — Bright classical limestone colonnade and daylight skylights
  - **Observatory** — Deep midnight indigo dome beneath the rotating celestial armillary
- **Dynamic Weather & Ambient Soundscape:** Toggle time-of-day moods (Dawn, Day, Dusk, Night), weather atmospheres, and procedural ambient audio (gentle rain, fireplace crackle, soft chimes).
- **Corner Mini-Map:** Keep your orientation across floor bays and mezzanine wings with the live interactive mini-map.
- **Reading Desk:** Pin active volumes to your Reading Desk so your current books stay one click away.

For the full list of movement and interaction bindings, see [CONTROLS.md](CONTROLS.md).

---

## 4. Using the Precision PDF Reader

Click any book from the Grand Hall, Floor Map, or Index to launch the full-screen Reader:

### Reading Modes & Appearance

- Switch between **Single Page**, **Continuous Scroll**, and **Two-Page Spread** layouts.
- Choose **Fit Width**, **Fit Page**, or custom zoom (`+` / `-`) and rotate pages in 90° increments.
- Pick from three archival reading tones: **Paper**, **Sepia**, and **Charcoal**, plus an adjustable brightness dimmer for late-night reading.
- Alexandria remembers your zoom, spread, rotation, theme, and exact scroll position **per book**.

### Exact-Click Annotations (Non-Destructive)

All annotations are stored in `library.db`—your underlying PDF files are never altered:

- **Highlight (`H`):** Select one of five archival colors and drag directly across any passage or click-mark cleanly on the page.
- **Freehand Ink (`I`):** Sketch underlines, margin brackets, and diagrams with smooth stroke capture that lands precisely beneath your cursor.
- **Eraser:** Click or sweep directly across any highlight or ink stroke to remove it cleanly.
- **Notes & Bookmarks (`B`):** Attach searchable text notes to highlights or bookmark key pages; inspect all annotations from the collapsible Reader sidebar.

### Distraction-Free Study Mode & Session Timer

Activate **Study Mode** from the Reader toolbar to hide navigation chrome and start a focused reading timer. Completed reading time and page progress are tracked automatically across sessions.

---

## 5. Instant Global Search (`Ctrl/Cmd + K`)

Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS) from any view to open the global search overlay powered by **SQLite FTS5**:

- Searches simultaneously across **Book Titles & Authors**, **Extracted Full Page Text**, and **Personal Annotation Notes**.
- Selecting any search result opens that book immediately and jumps directly to the matching page.

---

## 6. Local Music Dock

Alexandria includes an optional local audio player that persists seamlessly as you move between the Grand Hall and Reader:

1. Open the **Music Dock** and add one or more local music folders (`.mp3`, `.m4a`, `.flac`, `.ogg`, `.opus`, `.wav`).
2. Alexandria scans embedded ID3/Vorbis metadata and album artwork locally.
3. Combine your own albums with the Grand Hall's procedural ambient soundscape for a tailored study environment.

---

## 7. Backups, Portability & Health Checks

Because your library is a single plain folder:

- **Backup:** Copy `~/Alexandria` with Time Machine, rsync, Borg, or Syncthing while Alexandria is closed.
- **JSON Export:** Use **Settings → Export Library Manifest** to write a clean human-readable JSON snapshot of all books, tags, and annotations.
- **Database Integrity:** Open **Settings → Library Health** at any time to run SQLite `PRAGMA quick_check`, verify schema version, and detect any missing linked files.
