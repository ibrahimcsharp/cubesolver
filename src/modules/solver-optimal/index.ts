/**
 * Optimal (Fast) mode: about 20 moves, cube held in one position the whole time.
 */
import { isSolved, parseMoves, type ValidCube } from '@/modules/cube'
import { SolutionBuilder, type Solution } from '@/modules/solution'
import { min2phaseEngine, type SolverEngine } from './engines'

export function solveOptimal(cube: ValidCube, engine: SolverEngine = min2phaseEngine): Solution {
  engine.init()
  const builder = new SolutionBuilder(cube.cube, 'optimal', cube.colorOf)
  builder.startStage(
    'optimal',
    'Fast solution',
    `Hold the cube with ${cube.colorOf.U} on top and ${cube.colorOf.F} facing you, and keep it that way. Follow each move in order.`,
  )
  const text = isSolved(cube.cube) ? '' : engine.solve(cube.facelets)
  if (/error/i.test(text)) throw new Error(`Solver failed: ${text}`)
  builder.moves(parseMoves(text), 'Follow these moves in order.')
  return builder.build()
}
