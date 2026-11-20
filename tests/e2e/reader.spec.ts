import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writePdf } from '../fixtures/pdf'
import { dismissWelcome } from './helpers'

let libraryPath: string
let sourcePath: string
let pdfPath: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-reader-e2e-'))
  sourcePath = mkdtempSync(join(tmpdir(), 'alexandria-reader-src-'))
  pdfPath = join(sourcePath, 'Reader Smoke.pdf')
  writePdf(pdfPath, {
    title: null,
    author: null,
    pages: [
      'The first page speaks of the great library and its keepers.',
      'The second page mentions parchment, ink, and quiet rooms.',
      'The third page closes the volume with a catalogue of names.'
    ]
  })
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
  rmSync(sourcePath, { recursive: true, force: true })
})

async function importBook(page: Page, app: Awaited<ReturnType<typeof electron.launch>>): Promise<void> {
  await page.getByRole('button', { name: 'Librarian', exact: true }).click()

  await app.evaluate(
    async ({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths })
    },
    [pdfPath]
  )

  await page.getByRole('button', { name: 'Import files', exact: true }).click()
  const queue = page.getByRole('complementary', { name: 'Import queue' })
  await queue.getByRole('button', { name: 'Import now', exact: true }).click()
  await expect(queue.getByText('1 imported · 0 duplicates · 0 failed')).toBeVisible()
}

test('opens a PDF, turns pages, bookmarks, and searches inside it', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()
  await dismissWelcome(page)
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()

  await importBook(page, app)

  await page.getByRole('button', { name: 'Index', exact: true }).click()
  await page.getByText('Reader Smoke', { exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Reader Smoke', level: 1 })).toBeVisible()
  await expect(page.locator('.pdf-page canvas')).toBeVisible()

  const pager = page.locator('.reader__page-input input')
  await expect(pager).toHaveValue('1')
  await expect(page.getByText('/ 3')).toBeVisible()

  await page.getByRole('button', { name: 'Next page' }).click()
  await expect(pager).toHaveValue('2')

  await page.getByTitle('Bookmark this page (B)').click()
  await expect(page.locator('.pdf-page__bookmark')).toBeVisible()

  await page.getByTitle('Search inside').click()
  const search = page.getByPlaceholder('Search this volume…')
  await search.fill('parchment')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(page.getByText('1 match')).toBeVisible()
  await page.getByRole('button', { name: /p\. 2/ }).click()
  await expect(pager).toHaveValue('2')

  const book = await page.evaluate(() => window.alexandria.listBooks())
  expect(book).toHaveLength(1)
  expect(book[0].pageCount).toBe(3)

  await app.close()

  const reopened = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const reopenedPage = await reopened.firstWindow()
  await reopenedPage.getByRole('button', { name: 'Index', exact: true }).click()
  await expect(reopenedPage.getByText('Reader Smoke', { exact: true })).toBeVisible()
  await reopenedPage.getByText('Reader Smoke', { exact: true }).click()
  await expect(reopenedPage.getByRole('heading', { name: 'Reader Smoke', level: 1 })).toBeVisible()

  const annotations = await reopenedPage.evaluate(() => window.alexandria.listAnnotations(1))
  expect(annotations.some((annotation) => annotation.type === 'bookmark')).toBe(true)

  await reopened.close()
})
