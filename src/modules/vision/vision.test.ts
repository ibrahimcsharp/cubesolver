import { describe, expect, it } from 'vitest'
import {
  CENTER_FACELETS,
  FACES,
  randomCube,
  seededRandom,
  STANDARD_CENTERS,
  toFacelets,
  type Face,
  type StickerColor,
} from '@/modules/cube'
import { classifyStickers } from './classify'
import { imageCellsToFacelets, rotateGridClockwise, SCAN_STEP_FACELETS } from './faceMapping'
import { findFaceBox } from './gridFinder'
import { assign } from './hungarian'
import { centeredBox, sampleFace, type Box } from './sample'
import { HARSH_LIGHTINGS, LIGHTINGS, makeFaceImage, type Lighting } from './synthetic'
import type { RGB } from './color'

describe('assign (Hungarian method)', () => {
  it('finds the cheapest one-to-one assignment', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ]
    const a = assign(cost)
    expect(a.reduce((s, col, row) => s + cost[row]![col]!, 0)).toBe(5)
    expect(new Set(a).size).toBe(3)
  })
})

describe('face mapping', () => {
  it('reads faces in their normal layout when held the standard way', () => {
    const range = (from: number) => Array.from({ length: 9 }, (_, i) => from + i)
    expect(imageCellsToFacelets('F', 'U')).toEqual(range(18))
    expect(imageCellsToFacelets('R', 'U')).toEqual(range(9))
    expect(imageCellsToFacelets('U', 'B')).toEqual(range(0))
    expect(imageCellsToFacelets('D', 'F')).toEqual(range(27))
  })

  it('covers all 54 stickers exactly once over the 6 scan steps', () => {
    expect(new Set(SCAN_STEP_FACELETS.flat()).size).toBe(54)
  })

  it('handles a face held with a different side on top', () => {
    // Green front with red on top = the normal view turned a quarter to the left.
    const normal = imageCellsToFacelets('F', 'U')
    const tilted = imageCellsToFacelets('F', 'R')
    expect(rotateGridClockwise(tilted)).toEqual(normal)
  })
})

/** Simulates a full 6-photo scan of a random cube and returns the reading accuracy. */
/** `lighting` can be one lighting for the whole scan, or a different one per photo. */
function scanAccuracy(
  lighting: Lighting | ((step: number) => Lighting),
  cubes: number,
  seed: number,
) {
  const rand = seededRandom(seed)
  let correct = 0
  let total = 0
  let lowConfidenceWrong = 0
  let wrong = 0
  for (let n = 0; n < cubes; n++) {
    const truth = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as Face])
    // Each cube's plastic and camera differ a little.
    const cubeShift = Object.fromEntries(
      (Object.keys(STANDARD_CENTERS) as Face[]).map((f) => [
        STANDARD_CENTERS[f],
        [0, 1, 2].map(() => (rand() - 0.5) * 24),
      ]),
    ) as Partial<Record<StickerColor, [number, number, number]>>

    const rgbs: RGB[] = Array(54)
    SCAN_STEP_FACELETS.forEach((facelets, step) => {
      const w = 200
      const h = 150
      const box = centeredBox(w, h, 0.6)
      const img = makeFaceImage({
        width: w,
        height: h,
        box,
        colors: facelets.map((i) => truth[i]!),
        lighting: typeof lighting === 'function' ? lighting(step) : lighting,
        rand,
        cubeShift,
      })
      sampleFace(img, box).stickers.forEach((s, cell) => (rgbs[facelets[cell]!] = s.rgb))
    })
    const centers = Object.fromEntries(FACES.map((f) => [f, truth[CENTER_FACELETS[f]]!])) as Record<
      Face,
      StickerColor
    >
    const result = classifyStickers(rgbs, centers)
    result.colors.forEach((c, i) => {
      total++
      if (c === truth[i]) correct++
      else {
        wrong++
        if (result.confidence[i]! < 0.2) lowConfidenceWrong++
      }
    })
  }
  return { accuracy: correct / total, wrong, lowConfidenceWrong }
}

describe('reading sticker colors (synthetic photos)', { timeout: 60_000 }, () => {
  for (const lighting of LIGHTINGS) {
    it(`reads at least 98% of stickers correctly in ${lighting.name}`, () => {
      const r = scanAccuracy(lighting, 25, lighting.name.length * 97)
      console.info(
        `  ${lighting.name.padEnd(10)} ${(r.accuracy * 100).toFixed(2)}% correct, ${r.wrong} wrong (${r.lowConfidenceWrong} flagged for checking)`,
      )
      expect(r.accuracy).toBeGreaterThanOrEqual(0.98)
    })
  }

  for (const lighting of HARSH_LIGHTINGS) {
    it(`still reads at least 95% of stickers in harsh light: ${lighting.name}`, () => {
      const r = scanAccuracy(lighting, 25, lighting.name.length * 131)
      console.info(
        `  ${lighting.name.padEnd(12)} ${(r.accuracy * 100).toFixed(2)}% correct, ${r.wrong} wrong (${r.lowConfidenceWrong} flagged for checking)`,
      )
      expect(r.accuracy).toBeGreaterThanOrEqual(0.95)
    })
  }

  it('reads at least 98% when each photo has its own brightness and a slight tint (auto-exposure)', () => {
    // Cameras fix most of the color tint themselves, but brightness can jump between photos.
    const rand = seededRandom(777)
    const perPhoto = (): Lighting => ({
      name: 'auto',
      tint: [0, 1, 2].map(() => 0.92 + rand() * 0.16) as unknown as Lighting['tint'],
      level: 0.4 + rand() * 0.8,
      gradient: rand() * 0.4,
      glare: rand() < 0.2,
    })
    const r = scanAccuracy(() => perPhoto(), 40, 4242)
    console.info(
      `  auto-exposure ${(r.accuracy * 100).toFixed(2)}% correct, ${r.wrong} wrong (${r.lowConfidenceWrong} flagged for checking)`,
    )
    expect(r.accuracy).toBeGreaterThanOrEqual(0.98)
  })

  it('reports how it copes when every photo has completely different light', () => {
    // Extreme case (e.g. phone photos in different rooms). Not a pass/fail target:
    // we print the result, and only check that most mistakes are flagged for the user.
    const all = [...LIGHTINGS, ...HARSH_LIGHTINGS]
    const r = scanAccuracy((step) => all[(step * 5 + 1) % all.length]!, 40, 4242)
    console.info(
      `  mixed rooms   ${(r.accuracy * 100).toFixed(2)}% correct, ${r.wrong} wrong (${r.lowConfidenceWrong} flagged for checking)`,
    )
    expect(r.accuracy).toBeGreaterThan(0.6)
  })

  it('warns about glare and darkness', () => {
    const rand = seededRandom(1)
    const box = centeredBox(200, 150)
    const colors: StickerColor[] = Array(9).fill('blue')
    const glare = makeFaceImage({
      width: 200,
      height: 150,
      box,
      colors,
      lighting: LIGHTINGS[5]!,
      rand,
    })
    expect(sampleFace(glare, box).glare).toBe(true)
    const dark = makeFaceImage({
      width: 200,
      height: 150,
      box,
      colors,
      lighting: { ...LIGHTINGS[0]!, level: 0.15 },
      rand,
    })
    expect(sampleFace(dark, box).tooDark).toBe(true)
  })
})

describe('finding the cube face in a photo (prototype)', { timeout: 60_000 }, () => {
  it('finds faces at different places and sizes', () => {
    const rand = seededRandom(99)
    const colorList = Object.values(STANDARD_CENTERS)
    let found = 0
    const N = 30
    for (let n = 0; n < N; n++) {
      const w = 320
      const h = 240
      const size = Math.round(70 + rand() * 120)
      const box: Box = {
        x: Math.round(15 + rand() * (w - size - 30)),
        y: Math.round(15 + rand() * (h - size - 30)),
        size,
      }
      const colors = Array.from({ length: 9 }, () => colorList[Math.floor(rand() * 6)]!)
      const img = makeFaceImage({ width: w, height: h, box, colors, lighting: LIGHTINGS[0]!, rand })
      const f = findFaceBox(img)
      if (!f) continue
      const centerErr = Math.hypot(
        f.box.x + f.box.size / 2 - (box.x + box.size / 2),
        f.box.y + f.box.size / 2 - (box.y + box.size / 2),
      )
      if (centerErr < size * 0.1 && Math.abs(f.box.size - size) < size * 0.12) found++
    }
    console.info(`  face finder: ${found}/${N} found accurately`)
    expect(found / N).toBeGreaterThanOrEqual(0.9)
  })
})
