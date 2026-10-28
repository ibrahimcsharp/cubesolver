/**
 * The Kociemba-style library behind Optimal mode (docs/decisions/0001-solver-library.md).
 * An engine takes a facelet string and returns moves like "R U2 F'".
 */
import * as min2phase from 'min2phase.js'

export type SolverEngine = {
  name: string
  /** One-time table setup (about 0.15 s). Safe to call more than once. */
  init: () => void
  solve: (facelets: string) => string
}

let min2phaseReady = false
export const min2phaseEngine: SolverEngine = {
  name: 'min2phase.js',
  init: () => {
    if (!min2phaseReady) min2phase.initFull()
    min2phaseReady = true
  },
  solve: (facelets) => min2phase.solve(facelets).trim(),
}
