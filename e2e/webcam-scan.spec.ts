import { expect, test } from '@playwright/test'

/** Webcam scan with a fake camera: each side is shown, held still, and captured automatically. */
test('webcam scan captures all 6 sides hands-free', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    let color: string | null = null
    const draw = () => {
      ctx.fillStyle = '#7d8c74'
      ctx.fillRect(0, 0, 640, 480)
      if (!color) return // between sides: no cube in the box
      const size = 288
      const x = (640 - size) / 2
      const y = (480 - size) / 2
      ctx.fillStyle = '#141416'
      ctx.fillRect(x - 6, y - 6, size + 12, size + 12)
      const cell = size / 3
      ctx.fillStyle = color
      for (let i = 0; i < 9; i++)
        ctx.fillRect(x + (i % 3) * cell + 7, y + Math.floor(i / 3) * cell + 7, cell - 14, cell - 14)
    }
    ;(window as unknown as { showColor: (c: string | null) => void }).showColor = (c) => {
      color = c
      draw()
    }
    setInterval(draw, 100)
    const stream = canvas.captureStream(15)
    navigator.mediaDevices.getUserMedia = async () => stream
    navigator.mediaDevices.enumerateDevices = async () => []
  })

  await page.goto('/scan')
  await page.getByRole('button', { name: 'Turn on camera' }).click()
  await expect(page.getByRole('checkbox', { name: /capture automatically/i })).toBeChecked()

  // A solved cube, shown in scan order: green, red, blue, orange, white, yellow.
  const sides = ['#239655', '#a51e2a', '#1e4baa', '#e86420', '#d7dad6', '#dec82d']
  const show = (c: string | null) =>
    page.evaluate(
      (x) => (window as unknown as { showColor: (c: string | null) => void }).showColor(x),
      c,
    )
  for (const [i, color] of sides.entries()) {
    await show(null)
    await page.waitForTimeout(400)
    await show(color)
    // The side's progress button turns into "Retake" once it has been captured.
    await expect(page.getByRole('button', { name: /^Retake side/ })).toHaveCount(i + 1, {
      timeout: 8000,
    })
  }

  await expect(page.getByText('All 6 sides scanned.')).toBeVisible()
  await page.getByRole('button', { name: 'Read my cube' }).click()
  await expect(page).toHaveURL(/\/check$/)
  await page.getByRole('button', { name: /check & solve/i }).click()
  await expect(page.getByText('This cube is already solved. Nothing to do!')).toBeVisible()
})
