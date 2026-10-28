import { expect, test } from '@playwright/test'

test('enter a cube by hand and step through its solution', async ({ page }) => {
  await page.goto('/manual')
  await expect(page.getByRole('button', { name: /check & solve/i })).toBeDisabled()

  await page.getByRole('button', { name: /try a random cube/i }).click()
  await expect(page.getByText('All stickers filled')).toBeVisible()
  await page.getByRole('button', { name: /check & solve/i }).click()

  await expect(page).toHaveURL(/\/solution$/)
  await expect(page.getByRole('heading', { name: 'Your solution' })).toBeVisible()
  await expect(page.getByText(/Stage 1:.*cross/).first()).toBeVisible()
  await expect(page.getByText(/^Move 0 of \d+$/)).toBeVisible()

  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText(/^Move 1 of \d+$/)).toBeVisible()

  // Switch to the short solution and finish it.
  await page.getByRole('radio', { name: /optimal/i }).click()
  await expect(page.getByText(/^\d+ moves\./)).toBeVisible()
  const next = page.getByRole('button', { name: 'Next' })
  while (await next.isEnabled()) await next.click()
  await expect(page.getByText('Your cube is solved. Well done!')).toBeVisible()

  // The cube survives a page reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Your solution' })).toBeVisible()
})
