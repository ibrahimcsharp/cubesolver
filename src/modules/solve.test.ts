import { describe, expect, it } from 'vitest'
import {
  applyMoves,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
} from '@/modules/cube'
import { solve } from './solve'

describe('solve (style toggle)', () => {
  const colors = [...toFacelets(applyMoves(solvedCube(), parseMoves("R U2 F' L D B2 U R'")))].map(
    (ch) => STANDARD_CENTERS[ch as keyof typeof STANDARD_CENTERS],
  )
  const cube = validateColors(colors)
  if (!cube.ok) throw new Error('bad test cube')

  it('gives a short solution in optimal style and a staged one in beginner style', () => {
    const fast = solve(cube, 'optimal')
    const learn = solve(cube, 'beginner')
    expect(fast.style).toBe('optimal')
    expect(fast.moveCount).toBeLessThanOrEqual(8)
    expect(learn.style).toBe('beginner')
    expect(learn.stages.length).toBeGreaterThan(3)
    expect(learn.startFacelets).toBe(fast.startFacelets)
  })
})
