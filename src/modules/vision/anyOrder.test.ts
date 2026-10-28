import { describe, expect, it } from 'vitest'
import { randomCube, seededRandom, STANDARD_CENTERS, toFacelets, type Face } from '@/modules/cube'
import { AutoCapture } from './autoCapture'
import type { RGB } from './color'
import { rotateGridClockwise, SCAN_STEP_FACELETS } from './faceMapping'
import { reconstructCube } from './reconstruct'
import { centeredBox, sampleFace } from './sample'
import { LIGHTINGS, LOW_LIGHTINGS, makeFaceImage, type Lighting } from './synthetic'

const W = 200
const H = 150
const BOX = centeredBox(W, H, 0.6)

/** A hands-free scan where the person shows the sides in any order and any way up. */
function freeScan(lighting: Lighting, seed: number) {
  const rand = seededRandom(seed)
  const truth = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as Face])
  const order = [0, 1, 2, 3, 4, 5].sort(() => rand() - 0.5)
  order.push(order[0]!) // ...and shows the first side again at the end, turned
  const auto = new AutoCapture()
  const captures: RGB[][] = []
  let t = 0
  let repeatCaptured = false
  order.forEach((step, k) => {
    let colors = SCAN_STEP_FACELETS[step]!.map((i) => truth[i]!)
    const turns = k === 6 ? 1 : Math.floor(rand() * 4)
    for (let q = 0; q < turns; q++) colors = rotateGridClockwise(colors)
    const stickerShift = colors.map(
      () => [0, 1, 2].map(() => (rand() - 0.5) * 20) as unknown as RGB,
    )
    const frame = (dx: number) =>
      sampleFace(
        makeFaceImage({
          width: W,
          height: H,
          box: { ...BOX, x: BOX.x + dx },
          colors,
          lighting,
          rand,
          stickerShift,
        }),
        BOX,
      )
    for (let f = 0; f < 8; f++, t += 100) auto.push(frame(Math.round((rand() - 0.5) * 80)), t) // turning
    for (let f = 0; f < 12; f++, t += 100) {
      const r = auto.push(frame(0), t)
      if (r.status === 'capture') {
        if (k === 6) repeatCaptured = true
        else captures.push(r.rgbs!)
      }
    }
  })
  return { truth, captures, repeatCaptured }
}

describe('hands-free scan in any order', { timeout: 120_000 }, () => {
  for (const lighting of [LIGHTINGS[0]!, LOW_LIGHTINGS[1]!, LOW_LIGHTINGS[2]!]) {
    it(`captures each side once and rebuilds the exact cube (${lighting.name})`, () => {
      for (let n = 0; n < 5; n++) {
        const { truth, captures, repeatCaptured } = freeScan(lighting, 70 + n)
        expect(captures).toHaveLength(6)
        expect(repeatCaptured).toBe(false)
        expect(reconstructCube(captures).colors).toEqual(truth)
      }
    })
  }
})
