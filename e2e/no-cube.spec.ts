import { expect, test } from '@playwright/test'

/**
 * A room with no cube in view (a wall, a person, a chair, a switch board):
 * the guide box must stay still, show no color dots, and capture nothing.
 * (A user saw the box jumping onto their head.)
 */
test('stays calm when no cube is in view', async ({ page }) => {
  test.setTimeout(60_000)
  await page.addInitScript(() => {
    const c = document.createElement('canvas')
    c.width = 640
    c.height = 480
    const ctx = c.getContext('2d')!
    const draw = () => {
      ctx.fillStyle = '#e9e9e6'
      ctx.fillRect(0, 0, 640, 480)
      ctx.fillStyle = '#c8c8c4'
      ctx.fillRect(0, 0, 90, 480)
      ctx.fillStyle = '#d0d0cc'
      ctx.fillRect(80, 200, 90, 30)
      ctx.fillStyle = '#999'
      for (let i = 0; i < 4; i++) ctx.fillRect(88 + i * 20, 207, 10, 16)
      ctx.fillStyle = '#5a3a22'
      ctx.fillRect(220, 330, 420, 150)
      ctx.fillStyle = '#c99a7c'
      ctx.fillRect(330, 360, 240, 120)
      ctx.fillStyle = '#1a1512'
      ctx.beginPath()
      ctx.ellipse(470, 210, 70, 60, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#a87358'
      ctx.beginPath()
      ctx.ellipse(470, 280, 60, 80, 0, 0, Math.PI * 2)
      ctx.fill()
      const img = ctx.getImageData(0, 0, 640, 480)
      for (let i = 0; i < img.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 18
        img.data[i] += n
        img.data[i + 1] += n
        img.data[i + 2] += n
      }
      ctx.putImageData(img, 0, 0)
    }
    setInterval(draw, 66)
    draw()
    const s = c.captureStream(15)
    navigator.mediaDevices.getUserMedia = async () => s
    navigator.mediaDevices.enumerateDevices = async () => []
  })

  await page.goto('/scan')
  await page.getByRole('button', { name: 'Turn on camera' }).click()
  await page.waitForTimeout(1500)

  const positions = new Set<string>()
  for (let i = 0; i < 30; i++) {
    const state = await page.evaluate(() => {
      const box = [...document.querySelectorAll<HTMLElement>('div[aria-hidden]')].find(
        (d) => d.style.left,
      )
      return {
        at: box ? `${box.style.left},${box.style.top},${box.style.width}` : 'none',
        dots: box ? box.querySelectorAll('span').length : 0,
      }
    })
    positions.add(state.at)
    expect(state.dots).toBe(0)
    await page.waitForTimeout(100)
  }
  expect(positions.size).toBe(1)
  await expect(page.getByRole('button', { name: /^Retake side/ })).toHaveCount(0)
})
