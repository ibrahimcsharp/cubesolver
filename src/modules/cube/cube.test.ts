import * as min2phase from 'min2phase.js'
import { describe, expect, it } from 'vitest'
import {
  ALL_MOVES,
  applyMoves,
  COLORS,
  FACES,
  formatMoves,
  fromFacelets,
  IDENTITY_ORIENTATION,
  invertMoves,
  isSolved,
  parseMoves,
  randomCube,
  rotate,
  seededRandom,
  SOLVED_FACELETS,
  solvedCube,
  STANDARD_CENTERS,
  toFacelets,
  toFixedMove,
  validateColors,
  type StickerColor,
} from './index'

const rand = seededRandom(42)

function randomScramble(length: number): string {
  return Array.from({ length }, () => formatMoves([ALL_MOVES[Math.floor(rand() * 18)]!])).join(' ')
}

describe('moves', () => {
  it('parses and formats notation', () => {
    expect(formatMoves(parseMoves("R U2 F' d".replace('d', 'D')))).toBe("R U2 F' D")
    expect(() => parseMoves('R X')).toThrow(/Unknown move "X"/)
  })

  it('returns to solved after 4 quarter turns of any face', () => {
    for (const f of FACES)
      expect(isSolved(applyMoves(solvedCube(), parseMoves(`${f} ${f} ${f} ${f}`)))).toBe(true)
  })

  it("returns to solved after 6 repeats of R U R' U'", () => {
    const seq = parseMoves("R U R' U' ".repeat(6))
    expect(isSolved(applyMoves(solvedCube(), seq))).toBe(true)
  })

  it('undoes a scramble with its inverse', () => {
    const s = parseMoves(randomScramble(30))
    expect(isSolved(applyMoves(applyMoves(solvedCube(), s), invertMoves(s)))).toBe(true)
  })

  it('matches an independent cube implementation (min2phase.js) on 200 scrambles', () => {
    for (let i = 0; i < 200; i++) {
      const scramble = randomScramble(25)
      const ours = toFacelets(applyMoves(solvedCube(), parseMoves(scramble)))
      expect(ours).toBe(min2phase.fromScramble(scramble + ' '))
    }
  })
})

describe('facelets', () => {
  it('converts the solved cube', () => {
    expect(toFacelets(solvedCube())).toBe(SOLVED_FACELETS)
  })

  it('round-trips 1000 random cubes', () => {
    for (let i = 0; i < 1000; i++) {
      const c = randomCube(rand)
      const { cube, problems } = fromFacelets(toFacelets(c))
      expect(problems).toEqual([])
      expect(cube).toEqual(c)
    }
  })
})

describe('orientation', () => {
  it('returns to the start after 4 y turns or 2 upside-down flips', () => {
    let o = IDENTITY_ORIENTATION
    for (let i = 0; i < 4; i++) o = rotate(o, 'y')
    expect(o).toEqual(IDENTITY_ORIENTATION)
    expect(rotate(rotate(IDENTITY_ORIENTATION, 'z2'), 'z2')).toEqual(IDENTITY_ORIENTATION)
  })

  it('maps user moves to fixed faces after turning the cube', () => {
    // After y the old right side faces you, so "F" turns the fixed R face.
    expect(toFixedMove(rotate(IDENTITY_ORIENTATION, 'y'), { face: 'F', turns: 1 })).toEqual({
      face: 'R',
      turns: 1,
    })
    // Upside down: "U" turns the fixed D face, "R" turns the fixed L face.
    const flipped = rotate(IDENTITY_ORIENTATION, 'z2')
    expect(flipped.U).toBe('D')
    expect(flipped.R).toBe('L')
  })
})

describe('validateColors', () => {
  const toColors = (facelets: string) =>
    [...facelets].map((ch) => STANDARD_CENTERS[ch as keyof typeof STANDARD_CENTERS])
  const scrambled = toColors(toFacelets(randomCube(rand)))

  it('accepts solved and scrambled cubes', () => {
    expect(validateColors(toColors(SOLVED_FACELETS)).ok).toBe(true)
    const r = validateColors(scrambled)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.colorOf.U).toBe('white')
  })

  it('accepts any color scheme, as long as the centers differ', () => {
    // Swap blue and yellow everywhere: a different (but consistent) scheme.
    const swap: Partial<Record<StickerColor, StickerColor>> = { blue: 'yellow', yellow: 'blue' }
    expect(validateColors(scrambled.map((c) => swap[c] ?? c)).ok).toBe(true)
  })

  it('reports a wrong color count', () => {
    const colors = [...scrambled]
    const i = colors.findIndex((c, idx) => c === 'orange' && idx % 9 !== 4)
    colors[i] = 'red'
    const r = validateColors(colors)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe('color-count')
      expect(r.errors[0]!.message).toMatch(/10 red and 8 orange/)
    }
  })

  it('reports two faces with the same center', () => {
    const colors = toColors(SOLVED_FACELETS)
    // Make the red center white too (the U center is already white),
    // and one white sticker red so there are still 9 of each color.
    colors[13] = 'white'
    colors[0] = 'red'
    const r = validateColors(colors)
    expect(!r.ok && r.errors.some((e) => e.code === 'duplicate-centers')).toBe(true)
  })

  it('reports a twisted corner', () => {
    const c = solvedCube()
    c.co[0] = 1
    const r = validateColors(toColors(toFacelets(c)))
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(['twisted-corner'])
  })

  it('reports a flipped edge', () => {
    const c = solvedCube()
    c.eo[0] = 1
    const r = validateColors(toColors(toFacelets(c)))
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(['flipped-edge'])
  })

  it('reports two swapped pieces', () => {
    const c = solvedCube()
    ;[c.ep[0], c.ep[1]] = [c.ep[1]!, c.ep[0]!]
    const r = validateColors(toColors(toFacelets(c)))
    expect(!r.ok && r.errors.map((e) => e.code)).toEqual(['swapped-pieces'])
  })

  it('reports a piece that cannot exist', () => {
    // Swap two stickers so the UB edge becomes green-blue, which doesn't exist.
    const colors = toColors(SOLVED_FACELETS)
    ;[colors[19], colors[1]] = [colors[1]!, colors[19]!] // keeps 9 of each color
    const r = validateColors(colors)
    expect(!r.ok && r.errors.some((e) => e.code === 'impossible-piece')).toBe(true)
    expect(COLORS).toHaveLength(6)
  })
})
