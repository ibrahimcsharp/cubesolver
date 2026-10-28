import { describe, expect, it } from 'vitest'
import { validateColors } from '@/modules/cube'
import { reconstructCube } from './reconstruct'
import { simulateScan } from './scan-sim'
import { HARSH_LIGHTINGS, LIGHTINGS, LOW_LIGHTINGS, type Lighting } from './synthetic'

/** Scans of random cubes; returns how many came out as the exact right cube. */
function exactCount(
  lighting: Lighting,
  opts: { shuffle: boolean; turn: boolean; frames?: number },
  n: number,
) {
  let exact = 0
  let real = 0
  for (let k = 0; k < n; k++) {
    const sim = simulateScan({ lighting, seed: 4000 + k * 7, ...opts })
    const r = reconstructCube(sim.captures)
    if (validateColors(r.colors).ok) real++
    if (r.colors.every((c, i) => c === sim.truth[i])) exact++
  }
  return { exact, real }
}

describe('rebuilding the cube from 6 captures', { timeout: 120_000 }, () => {
  it('works when sides are shown in any order and turned any way (was 0 of 30 before)', () => {
    const r = exactCount(LIGHTINGS[0]!, { shuffle: true, turn: true }, 15)
    expect(r.exact).toBe(15)
  })

  for (const lighting of LOW_LIGHTINGS) {
    it(`works in low light: ${lighting.name}`, () => {
      const r = exactCount(lighting, { shuffle: true, turn: true }, 12)
      expect(r.exact).toBeGreaterThanOrEqual(11)
    })
  }

  it('works in very warm light', () => {
    expect(
      exactCount(HARSH_LIGHTINGS[0]!, { shuffle: true, turn: true }, 12).exact,
    ).toBeGreaterThanOrEqual(11)
  })

  it('works in candle-like light when several frames are averaged', () => {
    const candle: Lighting = {
      name: 'candle',
      tint: [1.3, 0.95, 0.5],
      level: 0.3,
      gradient: 0.5,
      glare: false,
      noise: 40,
      saturation: 0.5,
    }
    expect(
      exactCount(candle, { shuffle: true, turn: true, frames: 6 }, 12).exact,
    ).toBeGreaterThanOrEqual(11)
  })

  it('names each capture by its middle color', () => {
    const sim = simulateScan({ lighting: LIGHTINGS[1]!, seed: 1, shuffle: true, turn: true })
    const r = reconstructCube(sim.captures)
    const order = ['green', 'red', 'blue', 'orange', 'white', 'yellow']
    expect(r.sides).toEqual(sim.shown.map((s) => order[s.step]))
  })

  it('reads a webcam that sends mirror images', () => {
    for (let n = 0; n < 6; n++) {
      const sim = simulateScan({
        lighting: LIGHTINGS[0]!,
        seed: 300 + n,
        shuffle: true,
        turn: true,
      })
      const mirrored = sim.captures.map((c) => [2, 1, 0, 5, 4, 3, 8, 7, 6].map((i) => c[i]!))
      const r = reconstructCube(mirrored)
      expect(r.colors).toEqual(sim.truth)
      expect(r.mirrored).toBe(true)
    }
  })

  it('points at the bad photo when one capture is junk, or flags what it guessed', () => {
    let named = 0
    for (let n = 0; n < 6; n++) {
      const sim = simulateScan({
        lighting: LIGHTINGS[0]!,
        seed: 600 + n,
        shuffle: true,
        turn: true,
      })
      const junk = sim.captures.map((c, k) =>
        k === n ? c.map((_, i) => (i === 4 ? c[4]! : ([200 + i, 190, 170] as const))) : c,
      )
      const r = reconstructCube(junk)
      if (r.suspects.includes(n)) named++
      if (r.valid) {
        // If it repaired its way to a real cube, every sticker it got wrong is flagged.
        const wrong = r.colors.flatMap((c, i) => (c === sim.truth[i] ? [] : [i]))
        for (const i of wrong) expect(r.uncertain).toContain(i)
      }
    }
    expect(named).toBeGreaterThanOrEqual(4)
  })
})
