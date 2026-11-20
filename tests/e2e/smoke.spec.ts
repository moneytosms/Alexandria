import { _electron as electron, expect, test } from '@playwright/test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
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

  await expect(page.getByRole('heading', { name: 'The library is being built.' })).toBeVisible()
  await expect(page.getByText('ready')).toBeVisible()
  await expect(page.getByText(libraryPath)).toBeVisible()

  const shelves = page.locator('.stat', { hasText: 'Shelves' }).locator('dd')
  await expect(shelves).toHaveText('20')

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
