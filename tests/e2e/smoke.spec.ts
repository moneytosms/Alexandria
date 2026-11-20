import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let libraryPath: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-e2e-'))
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
})

test('opens the Alexandria shell with a fresh library', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()

  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()
  await expect(page.getByText('Library ready')).toBeVisible()
  await expect(page.getByText(libraryPath)).toBeVisible()

  const shelves = page.locator('.room__hud-stats div', { hasText: 'Volumes' }).locator('dd')
  await expect(shelves).toHaveText('0')

  const renderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    return gl ? gl.getParameter(gl.RENDERER) : null
  })

  expect(renderer).not.toBeNull()

  const nodeGlobals = await page.evaluate(() => ({
    require: typeof (window as unknown as { require?: unknown }).require,
    process: typeof (window as unknown as { process?: unknown }).process
  }))

  expect(nodeGlobals.require).toBe('undefined')
  expect(nodeGlobals.process).toBe('undefined')
  expect(existsSync(join(libraryPath, 'library.db'))).toBe(true)
  expect(existsSync(join(libraryPath, 'config.json'))).toBe(true)

  await app.close()
})

test('navigates all five views', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()

  const views = [
    { nav: 'Room', heading: 'The reading room' },
    { nav: 'Reader', heading: 'No volume open' },
    { nav: 'Map', heading: 'Ground floor' },
    { nav: 'Librarian', heading: 'Maintenance' },
    { nav: 'Index', heading: 'The index' }
  ]

  for (const view of views) {
    const button = page.getByRole('button', { name: view.nav, exact: true })
    await button.click()
    await expect(button).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('heading', { name: view.heading, level: 1 })).toBeVisible()
  }

  await page.getByRole('button', { name: 'Index', exact: true }).click()
  await expect(page.getByText('Empty catalogue')).toBeVisible()

  await app.close()
})

test('logs a thrown renderer error and keeps the UI alive', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()

  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()

  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('deliberate smoke-test explosion')
    }, 0)
  })

  const logFile = join(libraryPath, 'logs', 'main.log')

  await expect
    .poll(() => (existsSync(logFile) ? readFileSync(logFile, 'utf8') : ''), {
      timeout: 5_000
    })
    .toContain('deliberate smoke-test explosion')

  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()

  await app.close()
})
