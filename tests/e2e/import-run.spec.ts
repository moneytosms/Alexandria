import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let libraryPath: string
let sourcePath: string
let first: string
let second: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-run-e2e-'))
  sourcePath = mkdtempSync(join(tmpdir(), 'alexandria-run-src-'))
  first = join(sourcePath, 'dup-a.pdf')
  second = join(sourcePath, 'dup-b.pdf')
  writeFileSync(first, 'identical content')
  writeFileSync(second, 'identical content')
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
  rmSync(sourcePath, { recursive: true, force: true })
})

test('imports a PDF, dedupes identical content, and persists it', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()

  await page.getByRole('button', { name: 'Librarian', exact: true }).click()

  await app.evaluate(
    async ({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths })
    },
    [first, second]
  )

  await page.getByRole('button', { name: 'Import files', exact: true }).click()

  const queue = page.getByRole('complementary', { name: 'Import queue' })
  await expect(queue.getByText('2 volumes queued')).toBeVisible()

  await queue.getByRole('button', { name: 'Import now', exact: true }).click()

  await expect(queue.getByText('1 imported · 1 duplicate · 0 failed')).toBeVisible()
  await expect(queue.getByText('Import finished')).toBeVisible()

  const books = await page.evaluate(() => window.alexandria.listBooks())
  expect(books).toHaveLength(1)
  expect(books[0].title).toBe('dup-a')
  expect(books[0].storageMode).toBe('copy')
  expect(books[0].relPath).toMatch(/^books\//)
  expect(existsSync(books[0].filePath)).toBe(true)
  expect(readdirSync(join(libraryPath, 'books'))).toHaveLength(1)

  await queue.getByRole('button', { name: 'Clear', exact: true }).click()
  await page.getByRole('button', { name: 'Index', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'The index', level: 1 })).toBeVisible()
  await expect(page.getByText('1 volume', { exact: true })).toBeVisible()
  await expect(page.getByText('dup-a', { exact: true })).toBeVisible()

  await app.close()

  const reopened = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const reopenedPage = await reopened.firstWindow()

  await reopenedPage.getByRole('button', { name: 'Index', exact: true }).click()
  await expect(reopenedPage.getByText('dup-a', { exact: true })).toBeVisible()

  const persisted = await reopenedPage.evaluate(() => window.alexandria.listBooks())
  expect(persisted).toHaveLength(1)
  expect(existsSync(persisted[0].filePath)).toBe(true)

  await reopened.close()
})
