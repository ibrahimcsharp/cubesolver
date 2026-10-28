import { expect, test } from '@playwright/test'

test('home page loads and links to the scan screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('CubeSolver')
  await page.getByRole('link', { name: /scan my cube/i }).click()
  await expect(page).toHaveURL(/\/scan$/)
  await expect(page.getByRole('heading', { name: /scan your cube/i })).toBeVisible()
})
