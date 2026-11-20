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
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-reader-features-'))
  sourcePath = mkdtempSync(join(tmpdir(), 'alexandria-reader-features-src-'))
  pdfPath = join(sourcePath, 'Marginal Notes.pdf')
  writePdf(pdfPath, {
    title: null,
    author: null,
    pages: [
      'The first page speaks of parchment and the keepers of the library.',
      'The second page mentions parchment, ink, and quiet rooms.',
      'The third page repeats the word parchment once more.',
      'The fourth page closes the volume.'
    ]
  })
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
  rmSync(sourcePath, { recursive: true, force: true })
})

async function launch(): Promise<Awaited<ReturnType<typeof electron.launch>>> {
  return electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
}

async function openBook(page: Page, app: Awaited<ReturnType<typeof electron.launch>>): Promise<void> {
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

  await page.getByRole('button', { name: 'Index', exact: true }).click()
  await page.getByText('Marginal Notes', { exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Marginal Notes', level: 1 })).toBeVisible()
  await expect(page.locator('.pdf-page canvas')).toBeVisible()
}

test('spreads pages, browses thumbnails, steps search hits, and undoes ink', async () => {
  const app = await launch()
  const page = await app.firstWindow()
  await dismissWelcome(page)
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()
  await openBook(page, app)

  // A spread needs room, so close the panel first.
  await page.getByRole('button', { name: 'Close panel' }).click()
  await page.getByRole('button', { name: 'Two-page spread' }).click()
  await expect(page.locator('.reader__spread .pdf-page')).toHaveCount(2)

  // The page panel shows thumbnails and jumps on click.
  await page.getByTitle('Outline').click()
  await page.getByRole('tab', { name: 'Pages' }).click()
  await expect(page.locator('.thumb canvas').first()).toBeVisible()
  await page.getByRole('tab', { name: 'Contents' }).click()
  await page.getByRole('button', { name: 'Close panel' }).click()

  // A text selection opens the floating toolbar, and a swatch makes a highlight.
  await expect
    .poll(async () =>
      page.evaluate(() => document.querySelectorAll('.textLayer span').length)
    )
    .toBeGreaterThan(0)
  await expect
    .poll(
      async () => {
        const selected = await page.evaluate(() => {
          const pageElement = document.querySelector('.pdf-page')
          const span = Array.from(pageElement?.querySelectorAll('.textLayer span') ?? []).find(
            (element) => element.getBoundingClientRect().width > 0
          )
          if (!pageElement || !span) return false
          const range = document.createRange()
          range.selectNodeContents(span)
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          pageElement.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
          return true
        })
        if (!selected) return false
        return page.getByRole('toolbar', { name: 'Selection actions' }).isVisible()
      },
      { timeout: 15_000 }
    )
    .toBe(true)
  await page.getByLabel(/Highlight in/).first().click()
  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listAnnotations(1))).length)
    .toBe(1)

  // Single page again so the stroke and its undo clearly share a page.
  await page.getByRole('button', { name: 'Two-page spread' }).click()
  await expect(page.locator('.reader__spread')).toHaveCount(0)

  // Ink, then undo and redo from the keyboard.
  await page.getByTitle('Draw with ink (I)').click()
  const ink = page.locator('.pdf-page__ink').first()
  const box = await ink.boundingBox()
  expect(box).not.toBeNull()
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 60)
    await page.mouse.down()
    await page.mouse.move(box.x + 90, box.y + 90, { steps: 5 })
    await page.mouse.up()
  }
  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listAnnotations(1))).length)
    .toBe(2)
  await page.getByRole('button', { name: 'Undo ink' }).click()
  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listAnnotations(1))).length)
    .toBe(1)
  await page.getByRole('button', { name: 'Redo ink' }).click()
  await expect
    .poll(async () => (await page.evaluate(() => window.alexandria.listAnnotations(1))).length)
    .toBe(2)

  // Search steps through every hit, not just the first.
  await page.getByTitle('Search inside').click()
  await page.getByPlaceholder('Search this volume…').fill('parchment')
  await page.getByRole('button', { name: 'Find', exact: true }).click()
  await expect(page.locator('.search-stepper')).toContainText('of 3 matches')
  await page.getByRole('button', { name: 'Next match' }).click()
  await expect(page.locator('.search-stepper')).toContainText('2 of 3 matches')

  // The shortcut overlay lists the new keys.
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Reader shortcuts' })).toBeVisible()
  await expect(page.getByText('Undo ink')).toBeVisible()

  await app.close()
})
