import { describe, expect, it } from 'vitest'
import {
  randomCube,
  seededRandom,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
  type CubieCube,
  type ValidCube,
} from '@/modules/cube'
import { flattenSteps, verifySolution } from '@/modules/solution'
import { solveBeginner } from './index'

function valid(c: CubieCube): ValidCube {
  const colors = [...toFacelets(c)].map(
    (ch) => STANDARD_CENTERS[ch as keyof typeof STANDARD_CENTERS],
  )
  const r = validateColors(colors)
  if (!r.ok) throw new Error('invalid test cube')
  return r
}

describe('beginner solver', () => {
  it('returns an empty solution for a solved cube', () => {
    const s = solveBeginner(valid(solvedCube()))
    expect(s.moveCount).toBe(0)
    expect(s.stages).toEqual([])
  })

  it('solves 1000 random cubes, verified by replaying every step', { timeout: 60_000 }, () => {
    const rand = seededRandom(7)
    let total = 0
    for (let i = 0; i < 1000; i++) {
      const s = solveBeginner(valid(randomCube(rand)))
      const check = verifySolution(s)
      expect(check, `cube #${i}`).toEqual({ ok: true })
      total += s.moveCount
    }
    expect(total / 1000).toBeLessThan(170)
  })

  it('uses the 7 stages in order, with plain-English text on every step', () => {
    const s = solveBeginner(valid(randomCube(seededRandom(3))))
    expect(s.stages.map((x) => x.id)).toEqual(
      [
        'cross',
        'first-corners',
        'flip',
        'middle',
        'last-cross',
        'last-edges',
        'last-corners-position',
        'last-corners-twist',
        'finish',
      ].filter((id) => s.stages.some((x) => x.id === id)),
    )
    expect(s.stages[0]!.title).toBe('Stage 1: White cross')
    for (const step of flattenSteps(s)) expect(step.text.length).toBeGreaterThan(10)
    for (const stage of s.stages) for (const g of stage.groups) expect(g.explanation).toBeTruthy()
  })
})
