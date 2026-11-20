import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

let libraryPath: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-perf-e2e-'))
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
})

function launch(): ReturnType<typeof electron.launch> {
  return electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
}

interface RoomStats {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
  books: number
  bookBatches: number
}

test('renders a 500-book room as one book batch within a frame budget', async () => {
  // First launch creates the schema and the default four-wall layout.
  const first = await launch()
  const firstPage = await first.firstWindow()
  await expect(firstPage.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()
  await first.close()

  const db = new DatabaseSync(join(libraryPath, 'library.db'))

  // Add a second bay to each section so 500 volumes fit without overflow.
  const room = db.prepare('SELECT id FROM rooms LIMIT 1').get() as { id: number }
  const sections = db.prepare('SELECT id FROM sections WHERE room_id = ?').all(room.id) as Array<{
    id: number
  }>
  const insertBay = db.prepare('INSERT INTO bays (section_id, sort_index) VALUES (?, 1)')
  const insertShelf = db.prepare(
    'INSERT INTO shelves (bay_id, row_index, capacity, sort_mode, sort_dir) VALUES (?, ?, 24, ?, ?)'
  )

  for (const section of sections) {
    const bay = insertBay.run(section.id)
    for (let row = 0; row < 5; row += 1) {
      insertShelf.run(Number(bay.lastInsertRowid), row, 'manual', 'asc')
    }
  }

  const shelves = db.prepare('SELECT id FROM shelves ORDER BY id').all() as Array<{ id: number }>
  expect(shelves.length).toBeGreaterThanOrEqual(20)

  const insertBook = db.prepare(
    `INSERT INTO books (title, author, format, file_path, storage_mode, sha256, shelf_id, slot_index)
     VALUES (?, ?, 'pdf', ?, 'copy', ?, ?, ?)`
  )

  db.exec('BEGIN')
  for (let index = 0; index < 500; index += 1) {
    const shelf = shelves[index % shelves.length]
    insertBook.run(
      `Perf Volume ${index + 1}`,
      'Atlas',
      join(libraryPath, 'books', `perf-${index}.pdf`),
      `perf-${index}`,
      shelf.id,
      index
    )
  }
  db.exec('COMMIT')
  db.close()

  const app = await launch()
  const page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()

  const info = await page.evaluate(() => window.alexandria.libraryInfo())
  expect(info.books).toBe(500)

  await page.waitForFunction(
    () =>
      Boolean(
        (window as unknown as { __alexandriaRoomStats?: () => RoomStats }).__alexandriaRoomStats?.()
      ),
    undefined,
    { timeout: 20_000 }
  )

  const stats = await page.evaluate(() =>
    (window as unknown as { __alexandriaRoomStats?: () => RoomStats }).__alexandriaRoomStats?.()
  )

  expect(stats).toBeDefined()
  expect(stats?.books).toBe(500)
  expect(stats?.bookBatches).toBe(1)
  // The room shell and props add draw calls; all 500 spines must share one.
  expect(stats?.drawCalls).toBeLessThan(200)
  // Loose smoke budget. The 16.6ms acceptance target needs real GPU hardware.
  expect(stats?.frameMs).toBeLessThan(100)

  await app.close()
})
