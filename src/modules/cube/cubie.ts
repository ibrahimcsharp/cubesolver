/**
 * Piece-level ("cubie") cube model, following Kociemba's conventions.
 *
 * Corners: URF UFL ULB UBR DFR DLF DBL DRB (indices 0-7)
 * Edges:   UR UF UL UB DR DF DL DB FR FL BL BR (indices 0-11)
 *
 * cp[i] = which corner piece sits in position i; co[i] = its twist (0-2).
 * ep[i] = which edge piece sits in position i;   eo[i] = its flip (0-1).
 * Twist/flip are measured against the U/D sticker, so co = 0 means the
 * piece's U or D colored sticker is on the U or D face.
 */
import { FACES, type Face } from './constants'
import type { Move } from './moves'

export type CubieCube = {
  cp: number[]
  co: number[]
  ep: number[]
  eo: number[]
}

export const CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'] as const
export const EDGE_NAMES = [
  'UR',
  'UF',
  'UL',
  'UB',
  'DR',
  'DF',
  'DL',
  'DB',
  'FR',
  'FL',
  'BL',
  'BR',
] as const

export function solvedCube(): CubieCube {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  }
}

export function cloneCube(c: CubieCube): CubieCube {
  return { cp: [...c.cp], co: [...c.co], ep: [...c.ep], eo: [...c.eo] }
}

export function cubesEqual(a: CubieCube, b: CubieCube): boolean {
  for (let i = 0; i < 8; i++) if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false
  for (let i = 0; i < 12; i++) if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false
  return true
}

export function isSolved(c: CubieCube): boolean {
  return cubesEqual(c, SOLVED)
}

/** Returns a * b (apply a, then b). */
export function multiply(a: CubieCube, b: CubieCube): CubieCube {
  const r = solvedCube()
  for (let i = 0; i < 8; i++) {
    const from = b.cp[i]!
    r.cp[i] = a.cp[from]!
    r.co[i] = (a.co[from]! + b.co[i]!) % 3
  }
  for (let i = 0; i < 12; i++) {
    const from = b.ep[i]!
    r.ep[i] = a.ep[from]!
    r.eo[i] = (a.eo[from]! + b.eo[i]!) % 2
  }
  return r
}

// Clockwise quarter turns of each face (Kociemba's basic moves).
const [URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB] = [0, 1, 2, 3, 4, 5, 6, 7]
const [UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const Z8 = [0, 0, 0, 0, 0, 0, 0, 0]
const Z12 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

const BASIC: Record<Face, CubieCube> = {
  U: {
    cp: [UBR, URF, UFL, ULB, DFR, DLF, DBL, DRB],
    co: Z8,
    ep: [UB, UR, UF, UL, DR, DF, DL, DB, FR, FL, BL, BR],
    eo: Z12,
  },
  R: {
    cp: [DFR, UFL, ULB, URF, DRB, DLF, DBL, UBR],
    co: [2, 0, 0, 1, 1, 0, 0, 2],
    ep: [FR, UF, UL, UB, BR, DF, DL, DB, DR, FL, BL, UR],
    eo: Z12,
  },
  F: {
    cp: [UFL, DLF, ULB, UBR, URF, DFR, DBL, DRB],
    co: [1, 2, 0, 0, 2, 1, 0, 0],
    ep: [UR, FL, UL, UB, DR, FR, DL, DB, UF, DF, BL, BR],
    eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0],
  },
  D: {
    cp: [URF, UFL, ULB, UBR, DLF, DBL, DRB, DFR],
    co: Z8,
    ep: [UR, UF, UL, UB, DF, DL, DB, DR, FR, FL, BL, BR],
    eo: Z12,
  },
  L: {
    cp: [URF, ULB, DBL, UBR, DFR, UFL, DLF, DRB],
    co: [0, 1, 2, 0, 0, 2, 1, 0],
    ep: [UR, UF, BL, UB, DR, DF, FL, DB, FR, UL, DL, BR],
    eo: Z12,
  },
  B: {
    cp: [URF, UFL, UBR, DRB, DFR, DLF, ULB, DBL],
    co: [0, 0, 1, 2, 0, 0, 2, 1],
    ep: [UR, UF, UL, BR, DR, DF, DL, BL, FR, FL, UB, DB],
    eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1],
  },
}

const SOLVED = solvedCube()

/** MOVE_CUBES[face][turns] = the cube after that move from solved. */
const MOVE_CUBES = Object.fromEntries(
  FACES.map((face) => {
    const q = BASIC[face]
    const h = multiply(q, q)
    return [face, { 1: q, 2: h, 3: multiply(h, q) }]
  }),
) as Record<Face, Record<1 | 2 | 3, CubieCube>>

export function moveCube(move: Move): CubieCube {
  return MOVE_CUBES[move.face][move.turns]
}

export function applyMove(c: CubieCube, move: Move): CubieCube {
  return multiply(c, MOVE_CUBES[move.face][move.turns])
}

export function applyMoves(c: CubieCube, moves: readonly Move[]): CubieCube {
  let r = c
  for (const m of moves) r = applyMove(r, m)
  return r
}

/** Position index currently holding the given corner piece. */
export function cornerPosition(c: CubieCube, piece: number): number {
  return c.cp.indexOf(piece)
}

/** Position index currently holding the given edge piece. */
export function edgePosition(c: CubieCube, piece: number): number {
  return c.ep.indexOf(piece)
}

/** Even (0) or odd (1) permutation parity. */
export function permutationParity(perm: readonly number[]): 0 | 1 {
  let parity = 0
  for (let i = 0; i < perm.length; i++)
    for (let j = i + 1; j < perm.length; j++) if (perm[i]! > perm[j]!) parity ^= 1
  return parity as 0 | 1
}
