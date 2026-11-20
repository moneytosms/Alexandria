import type { Page } from '@playwright/test'

/** Dismiss the first-run tour if this profile has not seen it yet. */
export async function dismissWelcome(page: Page): Promise<void> {
  const start = page.getByRole('button', { name: 'Start reading' })
  try {
    await start.waitFor({ state: 'visible', timeout: 1_500 })
    await start.click()
  } catch {
    // The flag is already set for this profile.
  }
}
