import { expect, test } from '@playwright/test'
import {
  applyMoves,
  IDENTITY_ORIENTATION,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
  viewFacelets,
  type Face,
} from '@/modules/cube'
import { cameraSees } from '@/modules/live-guide/camera-view'
import { flattenSteps } from '@/modules/solution'
import { solveBeginner } from '@/modules/solver-beginner'

/**
 * Live guide with a fake webcam: the page's camera is replaced by a canvas,
 * on which the test draws the side the camera should see before and after
 * each move. The app should notice each move and go on to the next one.
 */
test('live guide follows moves seen by the (fake) webcam', async ({ page }) => {
  test.setTimeout(60_000)
  const stickers = [...toFacelets(applyMoves(solvedCube(), parseMoves("R U2 F' L D B2 R' U")))].map(
    (ch) => STANDARD_CENTERS[ch as Face],
  )
  const cube = validateColors(stickers)
  if (!cube.ok) throw new Error('bad test cube')
  const solution = solveBeginner(cube)
  const steps = flattenSteps(solution)
  const views = [
    viewFacelets(solution.startFacelets, IDENTITY_ORIENTATION),
    ...steps.map((s) => viewFacelets(s.faceletsAfter, s.orientationAfter)),
  ]
  // What the camera should see before each of the first few steps, as color names.
  const seen = views
    .slice(0, 6)
    .map((v) => [...cameraSees(v)].map((ch) => solution.colorOf[ch as Face]))

  await page.addInitScript(
    ({ stickers }) => {
      localStorage.setItem('cubesolver-cube', JSON.stringify({ state: { stickers }, version: 1 }))
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
      const w = window as unknown as { showSide: (colors: string[]) => void }
      let current: string[] = Array(9).fill('white')
      const draw = () => {
        ctx.fillStyle = '#7d8c74'
        ctx.fillRect(0, 0, 640, 480)
        const size = 288 // the app's box: 60% of the shorter side, centered
        const x = (640 - size) / 2
        const y = (480 - size) / 2
        ctx.fillStyle = '#141416'
        ctx.fillRect(x - 6, y - 6, size + 12, size + 12)
        if (current.length === 0) return // hands in the way: no cube side visible
        const cell = size / 3
        current.forEach((c, i) => {
          ctx.fillStyle = hex[c]!
          ctx.fillRect(
            x + (i % 3) * cell + 7,
            y + Math.floor(i / 3) * cell + 7,
            cell - 14,
            cell - 14,
          )
        })
      }
      w.showSide = (colors) => {
        current = colors
        draw()
      }
      draw()
      setInterval(draw, 100)
      const stream = canvas.captureStream(15)
      navigator.mediaDevices.getUserMedia = async () => stream
      navigator.mediaDevices.enumerateDevices = async () => []
    },
    { stickers },
  )

  await page.goto('/live')
  await expect(page.getByText(/^Move 0 of \d+$/)).toBeVisible()
  await page.evaluate(
    (c) => (window as unknown as { showSide: (c: string[]) => void }).showSide(c),
    seen[0]!,
  )
  await page.getByRole('button', { name: 'Turn on camera' }).click()

  // Holding still before the move: the app waits.
  await expect(page.getByText('Do the move shown, then hold the cube still.')).toBeVisible()
  await expect(page.locator('svg marker')).toHaveCount(1) // the arrow is drawn

  // Each time: hands move the cube (no side visible for a moment), then the side
  // is held still as it looks after the move. The app should move on.
  for (let i = 1; i <= 5; i++) {
    await page.evaluate(() =>
      (window as unknown as { showSide: (c: string[]) => void }).showSide([]),
    )
    await page.waitForTimeout(500)
    await page.evaluate(
      (c) => (window as unknown as { showSide: (c: string[]) => void }).showSide(c),
      seen[i]!,
    )
    const moves = steps.slice(0, i).filter((s) => s.kind === 'move').length
    await expect(page.getByText(new RegExp(`^Move ${moves} of [0-9]+$`))).toBeVisible({
      timeout: 8000,
    })
  }
  await page.screenshot({ path: 'test-results/live-guide.png' })
})
