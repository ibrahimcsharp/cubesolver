import { expect, type Page } from '@playwright/test'

/**
 * Waits until side number `count` has been captured. After the 6th side the
 * app reads the cube by itself and leaves the scan page, so for that one we
 * just wait until it has moved on.
 */
export async function waitForCaptures(page: Page, count: number) {
  if (count < 6) {
    await expect(page.getByRole('button', { name: /^Retake side/ })).toHaveCount(count, {
      timeout: 10_000,
    })
  } else {
    await expect(page).toHaveURL(/\/(check|solution)$/, { timeout: 10_000 })
  }
}

/**
 * After a scan the app opens the solution straight away when the reading is
 * clear, or the Check screen when something should be looked at. Gets to the
 * solution either way.
 */
export async function goToSolution(page: Page) {
  await expect(page).toHaveURL(/\/(check|solution)$/, { timeout: 10_000 })
  if (page.url().endsWith('/check')) {
    await page.getByRole('button', { name: /check & solve/i }).click()
  }
  await expect(page).toHaveURL(/\/solution$/)
}
