import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dismissWelcome } from './helpers'

let libraryPath: string
let fixtures: string
let dropDir: string
let alpha: string
let beta: string
let deck: string
let dropped: string

function touch(path: string): void {
  writeFileSync(path, 'fixture')
}

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-import-e2e-'))
  fixtures = mkdtempSync(join(tmpdir(), 'alexandria-fixtures-'))
  dropDir = mkdtempSync(join(tmpdir(), 'alexandria-drop-'))
  mkdirSync(join(fixtures, 'office'), { recursive: true })

  alpha = join(fixtures, 'alpha.pdf')
  beta = join(fixtures, 'beta.PDF')
  deck = join(fixtures, 'office', 'deck.pptx')
  dropped = join(dropDir, 'dropped.pdf')

  touch(alpha)
  touch(beta)
  touch(deck)
  touch(dropped)
  touch(join(fixtures, 'notes.txt'))
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
  rmSync(fixtures, { recursive: true, force: true })
  rmSync(dropDir, { recursive: true, force: true })
})

async function launch(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()
  await dismissWelcome(page)
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()
  return { app, page }
}

test('queues files from the picker, a folder scan, and a drop', async () => {
  const { app, page } = await launch()

  await page.getByRole('button', { name: 'Librarian', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Maintenance', level: 1 })).toBeVisible()

  await app.evaluate(
    async ({ dialog }, filePaths) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths })
    },
    [alpha, beta]
  )

  await page.getByRole('button', { name: 'Import files', exact: true }).click()

  const queue = page.getByRole('complementary', { name: 'Import queue' })
  await expect(queue).toBeVisible()
  await expect(queue.getByText('2 volumes queued')).toBeVisible()
  await expect(queue.getByText('alpha.pdf')).toBeVisible()
  await expect(queue.getByText('beta.PDF')).toBeVisible()

  await app.evaluate(
    async ({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
    },
    fixtures
  )

  await page.getByRole('button', { name: 'Scan folder', exact: true }).click()

  await expect(queue.getByText('3 volumes queued')).toBeVisible()
  await expect(queue.getByText('deck.pptx')).toBeVisible()
  await expect(queue.getByText('1 file was skipped')).toBeVisible()
  await expect(queue.getByText(/notes\.txt/)).toBeVisible()

  await page.evaluate(() => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['x'], 'dropped.pdf'))
    document
      .querySelector('.app')
      ?.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }))
  })

  await expect(page.getByText('Add to the library')).toBeVisible()

  await page.evaluate((path) => {
    const transfer = new DataTransfer()
    const file = new File(['x'], 'dropped.pdf')
    Object.defineProperty(file, 'path', { value: path })
    transfer.items.add(file)
    document
      .querySelector('.app')
      ?.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }))
  }, dropped)

  await expect(page.getByText('Add to the library')).toBeHidden()
  await expect(queue.getByText('4 volumes queued')).toBeVisible()
  await expect(queue.getByText('dropped.pdf')).toBeVisible()

  await queue.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(queue).toBeHidden()

  await app.close()
})
