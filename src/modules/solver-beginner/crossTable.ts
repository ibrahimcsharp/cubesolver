/**
 * Shortest-move lookup tables for placing cross edges.
 *
 * For a set of k edges we record, for every place/flip combination of those
 * edges, how many moves it takes to put them all home. Walking "downhill" in
 * the table gives the shortest way to add one more edge to the cross without
 * breaking the edges already placed. The largest table (4 edges) has about
 * 190,000 reachable entries and is built once, in well under a second.
 */
import { ALL_MOVES, moveCube, type CubieCube, type Move } from '@/modules/cube'

const EDGE_STATES = 24 // 12 positions x 2 flips

/** EDGE_MOVE[m][code] = code after move m, where code = position * 2 + flip. */
const EDGE_MOVE: Uint8Array[] = ALL_MOVES.map((move) => {
  const m = moveCube(move)
  const table = new Uint8Array(EDGE_STATES)
  for (let pos = 0; pos < 12; pos++) {
    const newPos = m.ep.indexOf(pos)
    for (let flip = 0; flip < 2; flip++) {
      table[pos * 2 + flip] = newPos * 2 + ((flip + m.eo[newPos]!) % 2)
    }
  }
  return table
})

function encode(codes: readonly number[]): number {
  let idx = 0
  for (let i = codes.length - 1; i >= 0; i--) idx = idx * EDGE_STATES + codes[i]!
  return idx
}

function decode(idx: number, k: number): number[] {
  const codes: number[] = []
  for (let i = 0; i < k; i++) {
    codes.push(idx % EDGE_STATES)
    idx = Math.floor(idx / EDGE_STATES)
  }
  return codes
}

function applyToCodes(codes: readonly number[], moveIndex: number): number[] {
  const t = EDGE_MOVE[moveIndex]!
  return codes.map((c) => t[c]!)
}

const cache = new Map<string, Int8Array>()

/** Distance table for the given edge pieces (sorted piece numbers). */
function tableFor(pieces: readonly number[]): Int8Array {
  const key = pieces.join(',')
  const cached = cache.get(key)
  if (cached) return cached

  const k = pieces.length
  const dist = new Int8Array(EDGE_STATES ** k).fill(-1)
  const start = encode(pieces.map((p) => p * 2)) // every edge home, unflipped
  dist[start] = 0
  let frontier = [start]
  for (let depth = 0; frontier.length > 0; depth++) {
    const next: number[] = []
    for (const idx of frontier) {
      const codes = decode(idx, k)
      for (let m = 0; m < ALL_MOVES.length; m++) {
        const n = encode(applyToCodes(codes, m))
        if (dist[n] === -1) {
          dist[n] = depth + 1
          next.push(n)
        }
      }
    }
    frontier = next
  }
  cache.set(key, dist)
  return dist
}

function codesOf(cube: CubieCube, pieces: readonly number[]): number[] {
  return pieces.map((p) => {
    const pos = cube.ep.indexOf(p)
    return pos * 2 + cube.eo[pos]!
  })
}

/** Fewest moves to have all these edges home at once. */
export function edgesDistance(cube: CubieCube, pieces: readonly number[]): number {
  const sorted = [...pieces].sort((a, b) => a - b)
  return tableFor(sorted)[encode(codesOf(cube, sorted))]!
}

/** Shortest move sequence that puts all these edges home. */
export function solveEdges(cube: CubieCube, pieces: readonly number[]): Move[] {
  const sorted = [...pieces].sort((a, b) => a - b)
  const dist = tableFor(sorted)
  let codes = codesOf(cube, sorted)
  let d = dist[encode(codes)]!
  const moves: Move[] = []
  while (d > 0) {
    let stepped = false
    for (let m = 0; m < ALL_MOVES.length; m++) {
      const next = applyToCodes(codes, m)
      if (dist[encode(next)] === d - 1) {
        moves.push(ALL_MOVES[m]!)
        codes = next
        d--
        stepped = true
        break
      }
    }
    if (!stepped) throw new Error('Cross table is inconsistent')
  }
  return moves
}
