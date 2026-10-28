import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  applyMoves,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
} from '@/modules/cube'

/** Puts a cube a few moves from solved into the app, so the exports are quick. */
async function loadScrambledCube(page: import('@playwright/test').Page) {
  const stickers = [...toFacelets(applyMoves(solvedCube(), parseMoves("R U F' L")))].map(
    (ch) => STANDARD_CENTERS[ch as Face],
  )
  await page.goto('/manual')
  await page.evaluate((stickers) => {
    localStorage.setItem('cubesolver-cube', JSON.stringify({ state: { stickers }, version: 1 }))
  }, stickers)
}

test('downloads a PDF booklet and a video of the solution', async ({ page }) => {
  test.setTimeout(180_000)
  await loadScrambledCube(page)
  await page.goto('/solution')
  await expect(page.getByRole('heading', { name: 'Your solution' })).toBeVisible()

  // PDF (beginner method: several pages with a picture per step).
  const pdfDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download PDF' }).click()
  const pdf = await pdfDownload
  expect(pdf.suggestedFilename()).toBe('cube-solution-beginner.pdf')
  await pdf.saveAs('test-results/solution.pdf')
  const pdfBytes = readFileSync('test-results/solution.pdf')
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdfBytes.length).toBeGreaterThan(100_000)

  // Video of the short (optimal) solution.
  await page.getByRole('radio', { name: /optimal/i }).click()
  const videoDownload = page.waitForEvent('download', { timeout: 150_000 })
  await page.getByRole('button', { name: 'Make video' }).click()
  const video = await videoDownload
  const name = video.suggestedFilename()
  expect(name).toMatch(/^cube-solution-fast\.(mp4|webm)$/)
  await video.saveAs(`test-results/${name}`)
  const videoBytes = readFileSync(`test-results/${name}`)
  expect(videoBytes.length).toBeGreaterThan(50_000)
  if (name.endsWith('.mp4')) expect(videoBytes.subarray(4, 8).toString()).toBe('ftyp')

  // The video plays in the browser: grab a frame from the middle.
  const url = `data:video/${name.endsWith('.mp4') ? 'mp4' : 'webm'};base64,${videoBytes.toString('base64')}`
  const info = await page.evaluate(async (src) => {
    const v = document.createElement('video')
    v.muted = true
    v.src = src
    v.style.cssText = 'position:fixed;inset:0;width:100vw;height:auto;z-index:9999;background:#000'
    document.body.appendChild(v)
    await new Promise((r) => (v.onloadeddata = r))
    v.currentTime = Math.min(5.2, v.duration / 2)
    await new Promise((r) => (v.onseeked = r))
    return { duration: v.duration, width: v.videoWidth, height: v.videoHeight }
  }, url)
  expect(info.width).toBe(1280)
  expect(info.height).toBe(720)
  expect(info.duration).toBeGreaterThan(8)
  await page.screenshot({ path: 'test-results/video-frame.png' })
})
