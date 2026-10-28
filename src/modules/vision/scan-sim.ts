/**
 * Simulated scans for tests: a person shows the 6 sides of a random cube to
 * a camera, possibly in a different order or turned, in a given light.
 */
import {
  randomCube,
  seededRandom,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
  type StickerColor,
} from '@/modules/cube'
import type { RGB } from './color'
import { rotateGridClockwise, SCAN_STEP_FACELETS } from './faceMapping'
import { centeredBox, sampleFace } from './sample'
import { makeFaceImage, type Lighting } from './synthetic'

export type SimOptions = {
  lighting: Lighting
  seed: number
  /** Show the sides in a random order. */
  shuffle?: boolean
  /** Hold each side turned by a random quarter turn. */
  turn?: boolean
  /** Average this many camera frames per capture (1 = single frame). */
  frames?: number
}

export type SimScan = {
  /** The real sticker colors, U R F D L B order. */
  truth: StickerColor[]
  /** What was captured: 9 colors per side, as the camera saw them. */
  captures: RGB[][]
  /** Which scan step's side each capture really is, and how it was turned. */
  shown: { step: number; turns: number }[]
}

export function simulateScan(o: SimOptions): SimScan {
  const rand = seededRandom(o.seed)
  const truth = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as Face])
  const order = [0, 1, 2, 3, 4, 5]
  if (o.shuffle) order.sort(() => rand() - 0.5)
  const W = 200
  const H = 150
  const box = centeredBox(W, H, 0.6)
  const shown: SimScan['shown'] = []
  const captures = order.map((step) => {
    const turns = o.turn ? Math.floor(rand() * 4) : 0
    shown.push({ step, turns })
    let colors = SCAN_STEP_FACELETS[step]!.map((i) => truth[i]!)
    for (let t = 0; t < turns; t++) colors = rotateGridClockwise(colors)
    // The same sticker looks the same in every frame; only camera grain changes.
    const stickerShift = colors.map(
      () => [0, 1, 2].map(() => (rand() - 0.5) * 20) as unknown as RGB,
    )
    const frames = o.frames ?? 1
    const sum = Array.from({ length: 9 }, () => [0, 0, 0])
    for (let f = 0; f < frames; f++) {
      const img = makeFaceImage({
        width: W,
        height: H,
        box,
        colors,
        lighting: o.lighting,
        rand,
        stickerShift,
      })
      sampleFace(img, box).stickers.forEach((s, i) =>
        s.rgb.forEach((v, k) => (sum[i]![k]! += v / frames)),
      )
    }
    return sum as unknown as RGB[]
  })
  return { truth, captures, shown }
}
