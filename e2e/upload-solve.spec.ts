import { expect, test } from '@playwright/test'

/** Draws a photo of one solved face (9 stickers of one color with black gaps) as a PNG. */
async function facePhotos(page: import('@playwright/test').Page): Promise<Buffer[]> {
  const urls = await page.evaluate(() => {
    // Scan order: green, red, blue, orange, white, yellow.
    const colors = ['#239655', '#a51e2a', '#1e4baa', '#e86420', '#d7dad6', '#dec82d']
    return colors.map((color, k) => {
      const c = document.createElement('canvas')
      c.width = 480
      c.height = 360
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#8a9a7a'
      ctx.fillRect(0, 0, 480, 360)
      const size = 180 + k * 10
      const x = 60 + k * 20
      const y = 50 + k * 8
      ctx.fillStyle = '#141416'
      ctx.fillRect(x - 8, y - 8, size + 16, size + 16)
      const cell = size / 3
      ctx.fillStyle = color
      for (let r = 0; r < 3; r++)
        for (let col = 0; col < 3; col++)
          ctx.fillRect(x + col * cell + 5, y + r * cell + 5, cell - 10, cell - 10)
      return c.toDataURL('image/png')
    })
  })
  return urls.map((u) => Buffer.from(u.split(',')[1]!, 'base64'))
}

test('upload 6 photos, check the scan, and get a solution', async ({ page }) => {
  await page.goto('/upload')
  const photos = await facePhotos(page)
  await page
    .locator('input[type=file][multiple]')
    .setInputFiles(
      photos.map((buffer, i) => ({ name: `side-${i}.png`, mimeType: 'image/png', buffer })),
    )
  await expect(page.getByText('6 of 6 photos added')).toBeVisible()
  await expect(page.getByText(/Cube found/).first()).toBeVisible()

  await page.getByRole('button', { name: 'Read my cube' }).click()
  await expect(page).toHaveURL(/\/check$/)
  await expect(page.getByText(/Every sticker was read clearly/)).toBeVisible()

  await page.getByRole('button', { name: /check & solve/i }).click()
  await expect(page).toHaveURL(/\/solution$/)
  await expect(page.getByText('This cube is already solved. Nothing to do!')).toBeVisible()
})

test('scan page explains the camera and offers other ways in', async ({ page }) => {
  await page.goto('/scan')
  await expect(page.getByRole('button', { name: 'Turn on camera' })).toBeVisible()
  await expect(page.getByText(/Hold green toward the camera, white on top/)).toBeVisible()
  await expect(page.getByRole('link', { name: /upload photos/i }).first()).toBeVisible()
})
