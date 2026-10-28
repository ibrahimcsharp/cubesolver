/**
 * Sticker-level ("facelet") view of the cube.
 *
 * A facelet string has 54 letters in face order U, R, F, D, L, B. Each face is
 * read row by row, top-left to bottom-right, with the face held as Kociemba
 * defines it (U seen from above with B at the top, D seen from below with F at
 * the top, the four side faces seen from outside with U at the top).
 * Each letter names the face whose center has that sticker's color.
 */
import { FACES, type Face } from './constants'
import { solvedCube, type CubieCube } from './cubie'

/** Facelet indices for each corner position, starting with its U/D sticker. */
export const CORNER_FACELETS: readonly (readonly [number, number, number])[] = [
  [8, 9, 20], // URF
  [6, 18, 38], // UFL
  [0, 36, 47], // ULB
  [2, 45, 11], // UBR
  [29, 26, 15], // DFR
  [27, 44, 24], // DLF
  [33, 53, 42], // DBL
  [35, 17, 51], // DRB
]

/** Facelet indices for each edge position. */
export const EDGE_FACELETS: readonly (readonly [number, number])[] = [
  [5, 10], // UR
  [7, 19], // UF
  [3, 37], // UL
  [1, 46], // UB
  [32, 16], // DR
  [28, 25], // DF
  [30, 43], // DL
  [34, 52], // DB
  [23, 12], // FR
  [21, 41], // FL
  [50, 39], // BL
  [48, 14], // BR
]

/** Colors (as face letters) of each corner piece, in the same sticker order. */
export const CORNER_COLORS: readonly (readonly [Face, Face, Face])[] = [
  ['U', 'R', 'F'],
  ['U', 'F', 'L'],
  ['U', 'L', 'B'],
  ['U', 'B', 'R'],
  ['D', 'F', 'R'],
  ['D', 'L', 'F'],
  ['D', 'B', 'L'],
  ['D', 'R', 'B'],
]

export const EDGE_COLORS: readonly (readonly [Face, Face])[] = [
  ['U', 'R'],
  ['U', 'F'],
  ['U', 'L'],
  ['U', 'B'],
  ['D', 'R'],
  ['D', 'F'],
  ['D', 'L'],
  ['D', 'B'],
  ['F', 'R'],
  ['F', 'L'],
  ['B', 'L'],
  ['B', 'R'],
]

/** Center sticker index of each face. */
export const CENTER_FACELETS: Record<Face, number> = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 }

/** Face that a sticker index belongs to. */
export function faceOfFacelet(index: number): Face {
  return FACES[Math.floor(index / 9)]!
}

export function toFacelets(c: CubieCube): string {
  const f: Face[] = FACES.flatMap((face) => Array<Face>(9).fill(face))
  for (let i = 0; i < 8; i++) {
    const piece = c.cp[i]!
    const ori = c.co[i]!
    for (let n = 0; n < 3; n++) f[CORNER_FACELETS[i]![(n + ori) % 3]!] = CORNER_COLORS[piece]![n]!
  }
  for (let i = 0; i < 12; i++) {
    const piece = c.ep[i]!
    const ori = c.eo[i]!
    for (let n = 0; n < 2; n++) f[EDGE_FACELETS[i]![(n + ori) % 2]!] = EDGE_COLORS[piece]![n]!
  }
  return f.join('')
}

export type PieceProblem =
  | { kind: 'corner'; position: number; facelets: readonly number[] }
  | { kind: 'edge'; position: number; facelets: readonly number[] }

/**
 * Builds the piece model from a facelet string. Positions whose stickers do
 * not form a real piece are reported in `problems` (and left as -1 in the cube).
 */
export function fromFacelets(facelets: string): { cube: CubieCube; problems: PieceProblem[] } {
  const cube = solvedCube()
  const problems: PieceProblem[] = []

  for (let i = 0; i < 8; i++) {
    const idx = CORNER_FACELETS[i]!
    const ori = [0, 1, 2].find((o) => {
      const ch = facelets[idx[o]!]
      return ch === 'U' || ch === 'D'
    })
    const piece =
      ori === undefined
        ? -1
        : CORNER_COLORS.findIndex(
            (col) =>
              col[0] === facelets[idx[ori]!] &&
              col[1] === facelets[idx[(ori + 1) % 3]!] &&
              col[2] === facelets[idx[(ori + 2) % 3]!],
          )
    if (piece < 0 || ori === undefined) {
      problems.push({ kind: 'corner', position: i, facelets: idx })
      cube.cp[i] = -1
      cube.co[i] = 0
    } else {
      cube.cp[i] = piece
      cube.co[i] = ori
    }
  }

  for (let i = 0; i < 12; i++) {
    const [a, b] = EDGE_FACELETS[i]!
    const ca = facelets[a]
    const cb = facelets[b]
    let piece = -1
    let ori = 0
    for (let j = 0; j < 12; j++) {
      const [x, y] = EDGE_COLORS[j]!
      if (ca === x && cb === y) {
        piece = j
        ori = 0
        break
      }
      if (ca === y && cb === x) {
        piece = j
        ori = 1
        break
      }
    }
    if (piece < 0) problems.push({ kind: 'edge', position: i, facelets: [a, b] })
    cube.ep[i] = piece
    cube.eo[i] = ori
  }

  return { cube, problems }
}
