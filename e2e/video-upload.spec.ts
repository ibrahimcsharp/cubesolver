import { expect, test } from '@playwright/test'

/**
 * Records a short WebM in the page: a solved cube turned through the 6 sides
 * in scan order, moving between sides and held still on each.
 */
async function recordScanVideo(page: import('@playwright/test').Page): Promise<Buffer> {
  const base64 = await page.evaluate(async () => {
    const colors = ['#239655', '#a51e2a', '#1e4baa', '#e86420', '#d7dad6', '#dec82d']
    const c = document.createElement('canvas')
    c.width = 480
    c.height = 360
    const ctx = c.getContext('2d')!
    const drawSide = (color: string, dx: number) => {
      ctx.fillStyle = '#7d8c74'
      ctx.fillRect(0, 0, 480, 360)
      const x = 140 + dx
      const y = 70
      const size = 210
      ctx.fillStyle = '#141416'
      ctx.fillRect(x - 8, y - 8, size + 16, size + 16)
      const cell = size / 3
      ctx.fillStyle = color
      for (let r = 0; r < 3; r++)
        for (let col = 0; col < 3; col++)
          ctx.fillRect(x + col * cell + 6, y + r * cell + 6, cell - 12, cell - 12)
    }
    drawSide(colors[0]!, 120)
    const rec = new MediaRecorder(c.captureStream(15), { mimeType: 'video/webm' })
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => chunks.push(e.data)
    rec.start(200)
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    for (const [i, color] of colors.entries()) {
      for (let k = 0; k < 6; k++) {
        drawSide(color, (k % 2 ? -1 : 1) * 130) // moving between sides
        await sleep(100)
      }
      // Hold each side still; the last one a bit longer, as people do before stopping.
      for (let k = 0; k < (i === colors.length - 1 ? 20 : 12); k++) {
        drawSide(color, 0) // held still
        await sleep(100)
      }
    }
    rec.stop()
    await new Promise((r) => (rec.onstop = r))
    const blob = new Blob(chunks, { type: 'video/webm' })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  })
  return Buffer.from(base64, 'base64')
}

test('reads all 6 sides from an uploaded video', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/upload')
  const video = await recordScanVideo(page)

  await page.getByLabel('Choose a video').setInputFiles({
    name: 'scan.webm',
    mimeType: 'video/webm',
    buffer: video,
  })
  await expect(page.getByText('Found all 6 sides in the video.', { exact: false })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText('6 of 6 photos added')).toBeVisible()

  await page.getByRole('button', { name: 'Read my cube' }).click()
  await expect(page).toHaveURL(/\/check$/)
  await page.getByRole('button', { name: /check & solve/i }).click()
  await expect(page.getByText('This cube is already solved. Nothing to do!')).toBeVisible()
})
