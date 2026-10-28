import { expect, test } from '@playwright/test'

test('the app can be installed and works offline', async ({ page, context }) => {
  await page.goto('/')
  // Installable: a web app manifest with icons.
  const manifest = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifest).toBeTruthy()
  const res = await page.request.get(`/${manifest!.replace(/^\//, '')}`)
  const json = await res.json()
  expect(json.name).toBe('CubeSolver')
  expect(json.icons.length).toBeGreaterThanOrEqual(2)

  // Works offline once the service worker has saved the app.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page
    .waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15_000 })
    .catch(() => page.reload())
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await page.goto('/notation')
  await expect(page.getByRole('heading', { name: 'Learn the move notation' })).toBeVisible()
  await context.setOffline(false)
})
