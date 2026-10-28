/**
 * One entry point for both solution styles, so the toggle only changes the
 * `style` argument. Every solution is replayed and checked before it is returned.
 */
import type { ValidCube } from '@/modules/cube'
import { verifySolution, type Solution, type SolveStyle } from '@/modules/solution'
import { solveBeginner } from '@/modules/solver-beginner'
import { solveOptimal } from '@/modules/solver-optimal'

export function solve(cube: ValidCube, style: SolveStyle): Solution {
  const solution = style === 'optimal' ? solveOptimal(cube) : solveBeginner(cube)
  const check = verifySolution(solution)
  if (!check.ok) throw new Error(`Solution check failed: ${check.reason}`)
  return solution
}
