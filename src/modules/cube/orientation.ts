/**
 * How the user is holding the cube.
 *
 * The cube model never rotates: its faces are fixed by the scan (U = the face
 * that was on top during the first scan step, F = the face toward the camera).
 * When the beginner method says "turn the whole cube", only this mapping
 * changes. `orientation[userFace]` is the fixed face that is currently in that
 * place, e.g. after "turn upside down" orientation.U === 'D'.
 */
import { FACES, type Face } from './constants'
import type { Move, Rotation } from './moves'

export type Orientation = Readonly<Record<Face, Face>>

export const IDENTITY_ORIENTATION: Orientation = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' }

/** y: turn the whole cube like a U move, so the right side comes to the front. */
function rotateY(o: Orientation): Orientation {
  return { ...o, F: o.R, R: o.B, B: o.L, L: o.F }
}

/** z2: turn the cube upside down, keeping the front facing you. */
function rotateZ2(o: Orientation): Orientation {
  return { ...o, U: o.D, D: o.U, R: o.L, L: o.R }
}

export function rotate(o: Orientation, rotation: Rotation): Orientation {
  switch (rotation) {
    case 'y':
      return rotateY(o)
    case 'y2':
      return rotateY(rotateY(o))
    case "y'":
      return rotateY(rotateY(rotateY(o)))
    case 'z2':
      return rotateZ2(o)
  }
}

/** Converts a move written from the user's point of view into a fixed-face move. */
export function toFixedMove(o: Orientation, move: Move): Move {
  return { face: o[move.face], turns: move.turns }
}

/** Which user-side face a fixed face is currently at. */
export function userFaceOf(o: Orientation, fixed: Face): Face {
  return FACES.find((f) => o[f] === fixed)!
}
