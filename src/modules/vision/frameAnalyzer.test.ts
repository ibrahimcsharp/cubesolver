import { describe, expect, it } from 'vitest'
import { seededRandom } from '@/modules/cube'
import { createFrameAnalyzer } from './frameAnalyzer'
import type { Pixels } from './sample'
import { LIGHTINGS, LOW_LIGHTINGS, makeFaceImage } from './synthetic'

const pal = ['red', 'green', 'white', 'blue', 'yellow', 'orange'] as const

describe('frame analyzer', () => {
  it('finds a cube anywhere, then follows it as it moves', () => {
    const rand = seededRandom(2)
    const colors = Array.from({ length: 9 }, () => pal[Math.floor(rand() * 6)]!)
    const analyzer = createFrameAnalyzer()
    const hows: string[] = []
    let box = { x: 60, y: 120, size: 200 }
    for (let f = 0; f < 10; f++, box = { ...box, x: box.x + 12, y: box.y - 6 }) {
      const img = makeFaceImage({
        width: 640,
        height: 480,
        box,
        colors,
        lighting: LOW_LIGHTINGS[1]!,
        rand,
      })
      const r = analyzer.analyze(img, f * 66)
      hows.push(r.how)
      expect(r.sample.looksLikeFace).toBe(true)
      expect(Math.abs(r.box.x - box.x)).toBeLessThan(20)
    }
    expect(hows[0]).toBe('found')
    expect(hows.slice(1).every((h) => h === 'tracked')).toBe(true)
  })

  it('never treats a plain wall as a cube side', () => {
    const rand = seededRandom(3)
    const analyzer = createFrameAnalyzer()
    for (let f = 0; f < 6; f++) {
      const data = new Uint8ClampedArray(640 * 480 * 4)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 190 + (rand() - 0.5) * 20
        data[i + 1] = 178
        data[i + 2] = 150
        data[i + 3] = 255
      }
      const r = analyzer.analyze({ data, width: 640, height: 480 } as Pixels, f * 400)
      expect(r.sample.looksLikeFace).toBe(false)
    }
  })

  it('reads the colors of a cube found off-center', () => {
    const rand = seededRandom(4)
    const colors = Array.from({ length: 9 }, () => pal[Math.floor(rand() * 6)]!)
    const img = makeFaceImage({
      width: 640,
      height: 480,
      box: { x: 380, y: 40, size: 180 },
      colors,
      lighting: LIGHTINGS[0]!,
      rand,
    })
    const r = createFrameAnalyzer().analyze(img, 0)
    expect(r.how).toBe('found')
    expect(r.sample.looksLikeFace).toBe(true)
  })
})
