import { expect, test } from '@playwright/test'
import {
  applyMoves,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
} from '@/modules/cube'
import { rotateGridClockwise, SCAN_STEP_FACELETS } from '@/modules/vision'

/**
 * Real-webcam troubles in one go: a plain wall in view before the cube, the
 * cube held smaller than the box and off to one side, and a webcam that sends
 * mirror images. Nothing junk may be captured, and the right cube must come out.
 */
test('ignores a wall, follows an off-center cube, and reads a mirroring webcam', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const truth = [...toFacelets(applyMoves(solvedCube(), parseMoves("F R' U2 L B' D R2 F'")))].map(
    (ch) => STANDARD_CENTERS[ch as Face],
  )
  const shown: [number, number][] = [
    [2, 0],
    [4, 3],
    [0, 1],
    [5, 2],
    [3, 0],
    [1, 1],
  ]
  const MIRROR = [2, 1, 0, 5, 4, 3, 8, 7, 6]
  const sides = shown.map(([step, turns]) => {
    let colors = SCAN_STEP_FACELETS[step]!.map((i) => truth[i]!)
    for (let t = 0; t < turns; t++) colors = rotateGridClockwise(colors)
    return MIRROR.map((i) => colors[i]!) // the webcam mirrors the picture
  })

  await page.addInitScript(() => {
    const hex: Record<string, string> = {
      white: '#d7dad6',
      yellow: '#dec82d',
      green: '#239655',
      blue: '#1e4baa',
      red: '#a51e2a',
      orange: '#e86420',
    }
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    let colors: string[] | null = null
    const draw = () => {
      // A beige wall fills the picture.
      ctx.fillStyle = '#c8b9a0'
      ctx.fillRect(0, 0, 640, 480)
      if (!colors) return
      // The cube: smaller than the app's box and off to the left.
      const size = 210
      const x = 70
      const y = 150
      ctx.fillStyle = '#121212'
      ctx.fillRect(x - 6, y - 6, size + 12, size + 12)
      const cell = size / 3
      colors.forEach((c, i) => {
        ctx.fillStyle = hex[c]!
        ctx.fillRect(x + (i % 3) * cell + 6, y + Math.floor(i / 3) * cell + 6, cell - 12, cell - 12)
      })
    }
    ;(window as unknown as { showSide: (c: string[] | null) => void }).showSide = (c) => {
      colors = c
      draw()
    }
    setInterval(draw, 100)
    const stream = canvas.captureStream(15)
    navigator.mediaDevices.getUserMedia = async () => stream
    navigator.mediaDevices.enumerateDevices = async () => []
  })

  await page.goto('/scan')
  await page.getByRole('button', { name: 'Turn on camera' }).click()
  const show = (c: string[] | null) =>
    page.evaluate(
      (x) => (window as unknown as { showSide: (c: string[] | null) => void }).showSide(x),
      c,
    )

  // Only the wall: nothing is captured, and the Capture button refuses too.
  await page.waitForTimeout(2000)
  await page.getByRole('button', { name: /capture now/i }).click()
  await expect(page.getByText(/can't see a whole cube side/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /^Retake side/ })).toHaveCount(0)

  for (const [i, colors] of sides.entries()) {
    await show(null)
    await page.waitForTimeout(500)
    await show(colors)
    await expect(page.getByRole('button', { name: /^Retake side/ })).toHaveCount(i + 1, {
      timeout: 10_000,
    })
  }

  await page.getByRole('button', { name: 'Read my cube' }).click()
  await expect(page).toHaveURL(/\/check$/)
  await page.getByRole('button', { name: /check & solve/i }).click()
  await expect(page.getByRole('heading', { name: 'Your solution' })).toBeVisible()
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cubesolver-cube')!).state.stickers as string[],
  )
  expect(stored).toEqual(truth)
})
