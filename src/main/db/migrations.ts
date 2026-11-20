import type { DatabaseSync } from 'node:sqlite'

interface Migration {
  version: number
  name: string
  up: string
}

const initialSchema = `
CREATE TABLE floors (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE rooms (
  id         INTEGER PRIMARY KEY,
  floor_id   INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sort_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sections (
  id         INTEGER PRIMARY KEY,
  room_id    INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  wall       TEXT NOT NULL DEFAULT 'north'
             CHECK (wall IN ('north','east','south','west')),
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE bays (
  id         INTEGER PRIMARY KEY,
  section_id INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  sort_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE shelves (
  id         INTEGER PRIMARY KEY,
  bay_id     INTEGER NOT NULL REFERENCES bays(id) ON DELETE CASCADE,
  label      TEXT,
  row_index  INTEGER NOT NULL DEFAULT 0,
  capacity   INTEGER NOT NULL DEFAULT 24,
  sort_mode  TEXT NOT NULL DEFAULT 'manual'
             CHECK (sort_mode IN ('manual','title','author','added','read','format')),
  sort_dir   TEXT NOT NULL DEFAULT 'asc' CHECK (sort_dir IN ('asc','desc'))
);

CREATE TABLE books (
  id              INTEGER PRIMARY KEY,
  title           TEXT NOT NULL,
  author          TEXT,
  format          TEXT NOT NULL DEFAULT 'pdf',
  original_format TEXT,
  file_path       TEXT NOT NULL,
  rel_path        TEXT,
  storage_mode    TEXT NOT NULL CHECK (storage_mode IN ('link','copy')),
  sha256          TEXT NOT NULL UNIQUE,
  file_size       INTEGER,
  page_count      INTEGER,
  cover_path      TEXT,
  encrypted       INTEGER NOT NULL DEFAULT 0,
  shelf_id        INTEGER REFERENCES shelves(id) ON DELETE SET NULL,
  slot_index      INTEGER NOT NULL DEFAULT 0,
  reading_state   TEXT NOT NULL DEFAULT 'unread'
                  CHECK (reading_state IN ('unread','reading','finished')),
  desk_pinned     INTEGER NOT NULL DEFAULT 0,
  last_page       INTEGER NOT NULL DEFAULT 1,
  last_scroll     REAL NOT NULL DEFAULT 0,
  finished_at     TEXT,
  added_at        TEXT NOT NULL DEFAULT (datetime('now')),
  last_opened_at  TEXT,
  metadata_json   TEXT,
  reader_json     TEXT
);

CREATE INDEX idx_books_shelf ON books(shelf_id, slot_index);
CREATE INDEX idx_books_recent ON books(last_opened_at DESC);

CREATE TABLE annotations (
  id         INTEGER PRIMARY KEY,
  book_id    INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page       INTEGER NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('highlight','note','ink','bookmark')),
  color      TEXT,
  rects_json TEXT,
  path_json  TEXT,
  note       TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX idx_annotations_book ON annotations(book_id, page);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE book_tags (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (book_id, tag_id)
);

CREATE TABLE pages (
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page    INTEGER NOT NULL,
  text    TEXT NOT NULL,
  PRIMARY KEY (book_id, page)
);

CREATE VIRTUAL TABLE pages_fts USING fts5(
  text,
  book_id UNINDEXED,
  page UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial',
    up: initialSchema
  },
  {
    version: 2,
    name: 'import-state',
    up: `
ALTER TABLE books ADD COLUMN unlocked_at TEXT;
ALTER TABLE books ADD COLUMN missing INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bays ADD COLUMN auto_created INTEGER NOT NULL DEFAULT 0;
`
  }
]

function getUserVersion(db: DatabaseSync): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version?: number } | undefined
  return Number(row?.user_version ?? 0)
}

export function migrate(db: DatabaseSync): number {
  let version = getUserVersion(db)

  for (const migration of migrations) {
    if (migration.version <= version) continue

    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(migration.up)
      db.exec(`PRAGMA user_version = ${migration.version}`)
      db.exec('COMMIT')
      version = migration.version
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return getUserVersion(db)
}

export function currentSchemaVersion(): number {
  return migrations.at(-1)?.version ?? 0
}
