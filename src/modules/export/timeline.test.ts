import { describe, expect, it } from 'vitest'
import {
  applyMoves,
  parseMoves,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  validateColors,
  type Face,
} from '@/modules/cube'
import { flattenSteps } from '@/modules/solution'
import { solveBeginner } from '@/modules/solver-beginner'
import { exportSteps, wrapText } from './timeline'

describe('export timeline', () => {
  const colors = [...toFacelets(applyMoves(solvedCube(), parseMoves("R U2 F' L D")))].map(
    (ch) => STANDARD_CENTERS[ch as Face],
  )
  const cube = validateColors(colors)
  if (!cube.ok) throw new Error('bad cube')
  const solution = solveBeginner(cube)

  it('lists every step once, chained before → after, numbering only face turns', () => {
    const { start, items } = exportSteps(solution)
    expect(items).toHaveLength(flattenSteps(solution).length)
    expect(items[0]!.before).toBe(start)
    items.slice(1).forEach((it, k) => expect(it.before).toBe(items[k]!.after))
    const numbers = items.flatMap((i) => (i.moveNumber ? [i.moveNumber] : []))
    expect(numbers).toEqual(Array.from({ length: solution.moveCount }, (_, k) => k + 1))
    expect(items.filter((i) => i.stageStart)).toHaveLength(solution.stages.length)
  })

  it('wraps text to the given width', () => {
    const lines = wrapText('one two three four five', 9, (s) => s.length)
    expect(lines).toEqual(['one two', 'three', 'four five'])
  })
})
