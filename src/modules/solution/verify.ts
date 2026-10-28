/**
 * Replays a solution from the start, independently of the solver, and checks
 * it really ends solved. Used by tests and as a safety net before showing a
 * solution to the user.
 */
import {
  applyMove,
  fromFacelets,
  IDENTITY_ORIENTATION,
  isSolved,
  rotate,
  toFacelets,
  toFixedMove,
} from '@/modules/cube'
import { flattenSteps, type Solution } from './types'

export function verifySolution(solution: Solution): { ok: true } | { ok: false; reason: string } {
  const { cube, problems } = fromFacelets(solution.startFacelets)
  if (problems.length) return { ok: false, reason: 'Start state is not a valid cube' }

  let c = cube
  let o = IDENTITY_ORIENTATION
  let moves = 0
  for (const [i, step] of flattenSteps(solution).entries()) {
    if (step.kind === 'rotation') {
      o = rotate(o, step.rotation)
    } else {
      const fixed = toFixedMove(o, step.move)
      if (fixed.face !== step.fixedMove.face || fixed.turns !== step.fixedMove.turns)
        return { ok: false, reason: `Step ${i + 1}: fixed move does not match the hold` }
      c = applyMove(c, fixed)
      moves++
    }
    if (toFacelets(c) !== step.faceletsAfter)
      return { ok: false, reason: `Step ${i + 1}: recorded state is wrong` }
    if (JSON.stringify(o) !== JSON.stringify(step.orientationAfter))
      return { ok: false, reason: `Step ${i + 1}: recorded hold is wrong` }
  }
  if (moves !== solution.moveCount) return { ok: false, reason: 'Move count is wrong' }
  if (!isSolved(c)) return { ok: false, reason: 'Cube is not solved at the end' }
  return { ok: true }
}
