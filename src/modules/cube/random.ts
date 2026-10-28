import { permutationParity, type CubieCube } from './cubie'

/** Small seeded random number generator (mulberry32), so tests are repeatable. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(n: number, rand: () => number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
  return arr
}

/** A uniformly random, solvable cube state. */
export function randomCube(rand: () => number = Math.random): CubieCube {
  const cp = shuffle(8, rand)
  const ep = shuffle(12, rand)
  // Corner and edge permutations must have the same parity.
  if (permutationParity(cp) !== permutationParity(ep)) [ep[0], ep[1]] = [ep[1]!, ep[0]!]

  const co = Array.from({ length: 8 }, () => Math.floor(rand() * 3))
  co[7] = (3 - (co.slice(0, 7).reduce((s, x) => s + x, 0) % 3)) % 3
  const eo = Array.from({ length: 12 }, () => Math.floor(rand() * 2))
  eo[11] = eo.slice(0, 11).reduce((s, x) => s + x, 0) % 2

  return { cp, co, ep, eo }
}
