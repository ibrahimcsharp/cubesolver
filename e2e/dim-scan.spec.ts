import { expect, test } from '@playwright/test'
import { goToSolution, waitForCaptures } from './helpers'
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
 * The problem users hit: a dim room, sides shown in a different order and
 * turned. The fake webcam draws a scrambled cube darkly with camera grain;
 * the app must still read a real cube and get to a solution.
 */
test('scans a scrambled cube in a dim room, sides in any order and turned', async ({ page }) => {
  test.setTimeout(90_000)
  const truth = [
    ...toFacelets(applyMoves(solvedCube(), parseMoves("R U2 F' L D B2 R' U F2 L'"))),
  ].map((ch) => STANDARD_CENTERS[ch as Face])
  // Shown in this order, each turned this many quarter turns.
  const shown: [number, number][] = [
    [3, 1],
    [0, 2],
    [5, 3],
    [1, 0],
    [4, 1],
    [2, 2],
  ]
  const sides = shown.map(([step, turns]) => {
    let colors = SCAN_STEP_FACELETS[step]!.map((i) => truth[i]!)
    for (let t = 0; t < turns; t++) colors = rotateGridClockwise(colors)
    return colors
  })

  await page.addInitScript(() => {
    // Dim webcam colors: dark, washed out, warm.
    const hex: Record<string, [number, number, number]> = {
      white: [92, 86, 70],
      yellow: [95, 80, 30],
      green: [30, 62, 40],
      blue: [28, 38, 66],
      red: [78, 26, 28],
      orange: [98, 52, 28],
    }
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')!
    let colors: string[] | null = null
    const draw = () => {
      ctx.fillStyle = '#2a2622'
      ctx.fillRect(0, 0, 640, 480)
      if (colors) {
        const size = 288
        const x = (640 - size) / 2
        const y = (480 - size) / 2
        ctx.fillStyle = '#0c0c0c'
        ctx.fillRect(x - 6, y - 6, size + 12, size + 12)
        const cell = size / 3
        colors.forEach((c, i) => {
          const [r, g, b] = hex[c]!
          ctx.fillStyle = `rgb(${r},${g},${b})`
          ctx.fillRect(
            x + (i % 3) * cell + 7,
            y + Math.floor(i / 3) * cell + 7,
            cell - 14,
            cell - 14,
          )
        })
      }
      // Camera grain.
      const img = ctx.getImageData(0, 0, 640, 480)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() + Math.random() + Math.random() - 1.5) * 34
        img.data[i] += n
        img.data[i + 1] += n
        img.data[i + 2] += n
      }
      ctx.putImageData(img, 0, 0)
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
  for (const [i, colors] of sides.entries()) {
    await show(null)
    await page.waitForTimeout(400)
    await show(colors)
    await waitForCaptures(page, i + 1)
  }

  await goToSolution(page)
  await expect(page.getByRole('heading', { name: 'Your solution' })).toBeVisible()

  // And it's the right cube.
  const stored = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cubesolver-cube')!).state.stickers as string[],
  )
  expect(stored).toEqual(truth)
})
