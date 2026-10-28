import { FACES, type Face } from './constants'

/** 1 = clockwise quarter turn, 2 = half turn, 3 = counter-clockwise (prime). */
export type Turns = 1 | 2 | 3

export type Move = { face: Face; turns: Turns }

/** Whole-cube rotations used by the beginner method. */
export type Rotation = 'y' | "y'" | 'y2' | 'z2'

const SUFFIX: Record<Turns, string> = { 1: '', 2: '2', 3: "'" }

export function formatMove(move: Move): string {
  return move.face + SUFFIX[move.turns]
}

export function formatMoves(moves: readonly Move[]): string {
  return moves.map(formatMove).join(' ')
}

const MOVE_TOKEN = /^([URFDLB])(2|'|’|2'|)$/

/** Parses notation such as "R U2 F' D" into moves. Throws on unknown tokens. */
export function parseMoves(text: string): Move[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  return tokens.map((token) => {
    const match = MOVE_TOKEN.exec(token)
    if (!match) throw new Error(`Unknown move "${token}"`)
    const face = match[1] as Face
    const suffix = match[2]
    const turns: Turns = suffix === '' ? 1 : suffix === "'" || suffix === '’' ? 3 : 2
    return { face, turns }
  })
}

export function invertMove(move: Move): Move {
  return { face: move.face, turns: (4 - move.turns) as Turns }
}

export function invertMoves(moves: readonly Move[]): Move[] {
  return [...moves].reverse().map(invertMove)
}

/** All 18 face turns, in the order U U2 U' R R2 R' ... */
export const ALL_MOVES: readonly Move[] = FACES.flatMap((face) =>
  ([1, 2, 3] as const).map((turns) => ({ face, turns })),
)
