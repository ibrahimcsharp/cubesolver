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
import { solveOptimal } from './index'

function valid(c: CubieCube): ValidCube {
  const colors = [...toFacelets(c)].map(
    (ch) => STANDARD_CENTERS[ch as keyof typeof STANDARD_CENTERS],
  )
  const r = validateColors(colors)
  if (!r.ok) throw new Error('invalid test cube')
  return r
}

describe('optimal solver', () => {
  it('returns an empty solution for a solved cube', () => {
    expect(solveOptimal(valid(solvedCube())).moveCount).toBe(0)
  })

  it('solves 300 random cubes in at most 21 moves, with no whole-cube turns', () => {
    const rand = seededRandom(5)
    for (let i = 0; i < 300; i++) {
      const s = solveOptimal(valid(randomCube(rand)))
      expect(verifySolution(s), `cube #${i}`).toEqual({ ok: true })
      expect(s.moveCount).toBeLessThanOrEqual(21)
      expect(flattenSteps(s).every((step) => step.kind === 'move')).toBe(true)
    }
  })
})
