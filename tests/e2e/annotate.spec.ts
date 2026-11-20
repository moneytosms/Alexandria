import { _electron as electron, expect, test, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writePdf } from '../fixtures/pdf'

let libraryPath: string
let sourcePath: string
let pdfPath: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-annotate-e2e-'))
  sourcePath = mkdtempSync(join(tmpdir(), 'alexandria-annotate-src-'))
  pdfPath = join(sourcePath, 'Marginalia.pdf')
  writePdf(pdfPath, {
    title: null,
    author: null,
    pages: [
      'Notes in the margin are the oldest conversation with a book.',
      'The second leaf holds the colophon.'
    ]
  })
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
  rmSync(sourcePath, { recursive: true, force: true })
})

function launch(): ReturnType<typeof electron.launch> {
  return electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
}

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

test('draws ink, adds a note, moves the book, and keeps both across restart', async () => {
  const app = await launch()
  const page = await app.firstWindow()
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()

  await importBook(page, app)

  await page.getByRole('button', { name: 'Index', exact: true }).click()
  await page.getByText('Marginalia', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Marginalia', level: 1 })).toBeVisible()
  await expect(page.locator('.pdf-page canvas')).toBeVisible()

  await page.getByTitle('Draw with ink (I)').click()
  const ink = page.locator('.pdf-page__ink')
  await expect(ink).toBeVisible()
  const box = await ink.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    await page.mouse.move(box.x + 70, box.y + 80)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 110, { steps: 6 })
    await page.mouse.move(box.x + 170, box.y + 90, { steps: 6 })
    await page.mouse.up()
  }

  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listAnnotations(1))).length)
    .toBe(1)

  await page.getByRole('tab', { name: 'Notes' }).click()
  await expect(page.getByText('Handwritten annotation')).toBeVisible()
  await page.getByPlaceholder('Add a note on this page…').fill('A note about parchment')
  await page.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(page.getByText('A note about parchment')).toBeVisible()

  await page.getByLabel('Back to the room').click()
  await page.getByRole('button', { name: 'Index', exact: true }).click()
  await page.getByLabel('Details for Marginalia').click()

  const shelf = page.getByLabel('Shelf')
  await expect(shelf).toBeVisible()
  await shelf.selectOption({ index: 1 })
  const targetShelf = Number(await shelf.inputValue())
  expect(targetShelf).toBeGreaterThan(0)
  await page.getByRole('button', { name: 'Save changes' }).click()

  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listBooks()))[0]?.shelfId)
    .toBe(targetShelf)
  await page.getByLabel('Close details').click()

  const annotations = await page.evaluate(() => window.alexandria.listAnnotations(1))
  expect(annotations.some((annotation) => annotation.type === 'ink')).toBe(true)
  expect(annotations.some((annotation) => annotation.note === 'A note about parchment')).toBe(true)

  await app.close()

  const reopened = await launch()
  const pageAgain = await reopened.firstWindow()
  await pageAgain.getByRole('button', { name: 'Index', exact: true }).click()

  await expect
    .poll(async () => (await pageAgain.evaluate(() => window.alexandria.listBooks()))[0]?.shelfId)
    .toBe(targetShelf)

  const persisted = await pageAgain.evaluate(() => window.alexandria.listAnnotations(1))
  expect(persisted).toHaveLength(2)
  expect(persisted.some((annotation) => annotation.type === 'ink')).toBe(true)
  expect(persisted.some((annotation) => annotation.note === 'A note about parchment')).toBe(true)

  await reopened.close()
})
