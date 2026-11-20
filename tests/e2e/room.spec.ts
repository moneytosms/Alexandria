import { _electron as electron, expect, test } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dismissWelcome } from './helpers'

let libraryPath: string

test.beforeAll(() => {
  libraryPath = mkdtempSync(join(tmpdir(), 'alexandria-room-e2e-'))
})

test.afterAll(() => {
  rmSync(libraryPath, { recursive: true, force: true })
})

test('walks shelves from the keyboard and honours the quality setting', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, ALEXANDRIA_LIBRARY_PATH: libraryPath } as Record<string, string>
  })
  const page = await app.firstWindow()
  await dismissWelcome(page)
  await expect(page.getByRole('heading', { name: 'The reading room', level: 1 })).toBeVisible()
  await expect(page.locator('.room__canvas canvas')).toBeVisible()
  await expect(page.locator('.room__fade')).toHaveCount(1)

  await page.keyboard.press('ArrowRight')
  const drawer = page.getByRole('complementary', { name: 'Shelf contents' })
  await expect(drawer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()

  // Low quality drops shadows and dust but keeps the scene rendering.
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('3D quality').selectOption('low')
  await page.getByRole('button', { name: 'Close settings' }).click()

  await expect
    .poll(async () =>
      page.evaluate(() => {
        const stats = (window as unknown as { __alexandriaRoomStats?: () => { drawCalls: number } })
          .__alexandriaRoomStats
        return stats ? stats().drawCalls : -1
      })
    )
    .toBeGreaterThan(0)

  await app.close()
})
