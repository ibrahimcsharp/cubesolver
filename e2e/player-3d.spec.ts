import { expect, test } from '@playwright/test'

test('3D player animates, plays, and can switch to the flat map', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto('/manual')
  await page.getByRole('button', { name: /try a random cube/i }).click()
  await page.getByRole('button', { name: /check & solve/i }).click()
  await expect(page).toHaveURL(/\/solution$/)

  // The 3D cube loads on demand and draws into a canvas.
  await expect(page.getByRole('img', { name: /3D cube held with/ })).toBeVisible()
  await expect(page.locator('canvas')).toBeVisible()

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Move 1 of \d+$/)).toBeVisible()

  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByText(/^Move [3-9] of \d+$/)).toBeVisible({ timeout: 8000 })
  await page.getByRole('button', { name: 'Pause' }).click()

  await page.getByRole('radio', { name: 'Flat map' }).click()
  await expect(page.getByRole('group', { name: 'Cube as you are holding it' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)

  expect(errors).toEqual([])
})
