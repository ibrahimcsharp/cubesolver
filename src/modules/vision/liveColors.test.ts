import { describe, expect, it } from 'vitest'
import { COLORS, seededRandom } from '@/modules/cube'
import { LiveColors } from './liveColors'
import { centeredBox, sampleFace } from './sample'
import {
  HARSH_LIGHTINGS,
  LIGHTINGS,
  LOW_LIGHTINGS,
  makeFaceImage,
  type Lighting,
} from './synthetic'

/** Share of stickers guessed right, before and after learning the 6 middle colors. */
function accuracy(lighting: Lighting, seed: number) {
  const rand = seededRandom(seed)
  const box = centeredBox(200, 150, 0.6)
  const live = new LiveColors()
  // Each side: middle sticker is its own color, the rest random.
  const sides = COLORS.map((center) => {
    const colors = Array.from({ length: 9 }, (_, i) =>
      i === 4 ? center : COLORS[Math.floor(rand() * 6)]!,
    )
    const s = sampleFace(
      makeFaceImage({ width: 200, height: 150, box, colors, lighting, rand }),
      box,
    )
    return { colors, rgbs: s.stickers.map((x) => x.rgb) }
  })
  const score = () =>
    sides.reduce(
      (n, s) => n + s.rgbs.filter((rgb, i) => live.guess(rgb) === s.colors[i]).length,
      0,
    ) / 54
  const before = score()
  live.learn(sides.map((s) => s.rgbs[4]!))
  return { before, after: score() }
}

describe('live color guesses', () => {
  it('are right in normal light', () => {
    expect(accuracy(LIGHTINGS[0]!, 1).after).toBeGreaterThanOrEqual(0.95)
  })

  for (const lighting of [LIGHTINGS[1]!, HARSH_LIGHTINGS[0]!, LOW_LIGHTINGS[1]!]) {
    it(`get better after learning the room's colors (${lighting.name})`, () => {
      let before = 0
      let after = 0
      for (let n = 0; n < 6; n++) {
        const r = accuracy(lighting, 10 + n)
        before += r.before / 6
        after += r.after / 6
      }
      console.info(
        `  ${lighting.name.padEnd(12)} before ${(before * 100).toFixed(0)}%  after ${(after * 100).toFixed(0)}%`,
      )
      expect(after).toBeGreaterThanOrEqual(0.9)
      expect(after).toBeGreaterThanOrEqual(before)
    })
  }
})
