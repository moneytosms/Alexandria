import { _electron as electron, expect, test } from '@playwright/test'

test('opens the Alexandria shell and reaches the main process', async () => {
  const app = await electron.launch({ args: ['.'] })
  const page = await app.firstWindow()

  await expect(page.getByRole('heading', { name: 'The library is being built.' })).toBeVisible()
  await expect(page.getByText('ready')).toBeVisible()

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

  await app.close()
})
