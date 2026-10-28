import { describe, expect, it } from 'vitest'
import {
  CENTER_FACELETS,
  FACES,
  randomCube,
  SCAN_ORDER,
  seededRandom,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
  type StickerColor,
} from '@/modules/cube'
import { AutoCapture } from './autoCapture'
import { classifyStickers } from './classify'
import type { RGB } from './color'
import { SCAN_STEP_FACELETS } from './faceMapping'
import { centeredBox, sampleFace, type FaceSample } from './sample'
import { LIGHTINGS, makeFaceImage, type Lighting } from './synthetic'

const FPS = 10
const W = 200
const H = 150

type Frame = { t: number; sample: FaceSample; showing: number | null }

/**
 * A person scanning: for each side, ~1 s of turning the cube (the box shows
 * a moving, partly visible cube), then `holdMs` holding it still.
 */
function simulateScan(lighting: Lighting, seed: number, holdMs = 1200) {
  const rand = seededRandom(seed)
  const truth = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as Face])
  const box = centeredBox(W, H, 0.6)
  const frames: Frame[] = []
  let t = 0
  SCAN_ORDER.forEach((_, step) => {
    const colors = SCAN_STEP_FACELETS[step]!.map((i) => truth[i]!)
    // Each sticker's plastic looks slightly different, the same in every frame.
    const stickerShift = colors.map(
      () => [0, 1, 2].map(() => (rand() - 0.5) * 20) as unknown as RGB,
    )
    // Turning: the cube passes through the box at a different place each frame.
    for (let k = 0; k < FPS; k++, t += 1000 / FPS) {
      const shift = Math.round((rand() - 0.5) * box.size)
      const img = makeFaceImage({
        width: W,
        height: H,
        box: { ...box, x: box.x + shift, y: box.y + Math.round((rand() - 0.5) * 30) },
        colors,
        lighting,
        rand,
        stickerShift,
      })
      frames.push({ t, sample: sampleFace(img, box), showing: null })
    }
    // Holding still: same position, fresh camera noise each frame.
    for (let k = 0; k < (holdMs / 1000) * FPS; k++, t += 1000 / FPS) {
      const img = makeFaceImage({ width: W, height: H, box, colors, lighting, rand, stickerShift })
      frames.push({ t, sample: sampleFace(img, box), showing: step })
    }
  })
  return { truth, frames, durationMs: t }
}

function runAutoCapture(frames: Frame[]) {
  const auto = new AutoCapture()
  const captured: { step: number; showing: number | null; rgbs: RGB[]; t: number }[] = []
  for (const f of frames) {
    const step = captured.length
    if (step >= 6) break
    const r = auto.push(
      f.sample,
      f.t,
      SCAN_ORDER[step]!.front,
      SCAN_ORDER.slice(0, step).map((s) => s.front),
    )
    if (r.status === 'capture')
      captured.push({ step, showing: f.showing, rgbs: f.sample.stickers.map((s) => s.rgb), t: f.t })
  }
  return captured
}

describe('automatic capture (simulated video scans)', { timeout: 60_000 }, () => {
  for (const lighting of [LIGHTINGS[0]!, LIGHTINGS[1]!, LIGHTINGS[3]!]) {
    it(`captures all 6 sides in order, hands-free, in ${lighting.name}`, () => {
      let totalCorrect = 0
      for (let n = 0; n < 8; n++) {
        const { truth, frames, durationMs } = simulateScan(lighting, 100 + n)
        const captured = runAutoCapture(frames)
        expect(captured.map((c) => c.step)).toEqual([0, 1, 2, 3, 4, 5])
        // Every capture happened while that side was being held still.
        expect(captured.map((c) => c.showing)).toEqual([0, 1, 2, 3, 4, 5])
        expect(durationMs).toBeLessThan(60_000)

        const rgbs: RGB[] = Array(54)
        captured.forEach((c) =>
          SCAN_STEP_FACELETS[c.step]!.forEach((facelet, cell) => (rgbs[facelet] = c.rgbs[cell]!)),
        )
        const centers = Object.fromEntries(
          FACES.map((f) => [f, truth[CENTER_FACELETS[f]]!]),
        ) as Record<Face, StickerColor>
        const read = classifyStickers(rgbs, centers).colors
        totalCorrect += read.filter((c, i) => c === truth[i]).length
      }
      expect(totalCorrect / (8 * 54)).toBeGreaterThanOrEqual(0.98)
    })
  }

  it('does not capture the same side twice when it is held for a long time', () => {
    const { frames } = simulateScan(LIGHTINGS[0]!, 7, 4000)
    const captured = runAutoCapture(frames)
    expect(captured.map((c) => c.showing)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('does not capture when the wrong side faces the camera', () => {
    const { frames } = simulateScan(LIGHTINGS[0]!, 11)
    const auto = new AutoCapture()
    // Frames show sides 1-5 held still, but the step still asks for green (side 0).
    const statuses = frames
      .filter((f) => f.showing !== null && f.showing > 0)
      .map((f) => auto.push(f.sample, f.t, 'green', []).status)
    expect(statuses).not.toContain('capture')
    expect(statuses).toContain('wrong-side')
  })

  it('waits while the cube is moving', () => {
    const { frames } = simulateScan(LIGHTINGS[0]!, 9)
    const moving = frames.filter((f) => f.showing === null)
    const auto = new AutoCapture()
    const results = moving.map((f) => auto.push(f.sample, f.t, 'green', []).status)
    expect(results).not.toContain('capture')
  })
})
