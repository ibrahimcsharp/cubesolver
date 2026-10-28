import { describe, expect, it } from 'vitest'
import {
  applyMoves,
  FACES,
  IDENTITY_ORIENTATION,
  parseMoves,
  rotate,
  SOLVED_FACELETS,
  solvedCube,
  toFacelets,
  toFixedMove,
  turnStickers,
  viewFacelets,
  type Orientation,
  type Rotation,
} from './index'

function allOrientations(): Orientation[] {
  const seen = new Map<string, Orientation>()
  const stack: Orientation[] = [IDENTITY_ORIENTATION]
  while (stack.length) {
    const o = stack.pop()!
    const k = JSON.stringify(o)
    if (seen.has(k)) continue
    seen.set(k, o)
    for (const r of ['y', 'z2'] as Rotation[]) stack.push(rotate(o, r))
  }
  return [...seen.values()]
}

describe('viewFacelets', () => {
  it('changes nothing when the cube is held normally', () => {
    const f = toFacelets(applyMoves(solvedCube(), parseMoves("R U F' D2")))
    expect(viewFacelets(f, IDENTITY_ORIENTATION)).toBe(f)
  })

  it('shows each held face fully in its own color on a solved cube', () => {
    for (const o of allOrientations()) {
      const view = viewFacelets(SOLVED_FACELETS, o)
      FACES.forEach((face, i) => expect(view.slice(i * 9, i * 9 + 9)).toBe(o[face].repeat(9)))
    }
  })

  it('turns stickers in 3D exactly like the piece model', () => {
    let c = applyMoves(solvedCube(), parseMoves("R U2 F' L D B'"))
    for (const m of parseMoves("R U F D L B R2 U' F2 D' L2 B2 R'")) {
      const expected = toFacelets(applyMoves(c, [m]))
      expect(turnStickers(toFacelets(c), m.face, m.turns)).toBe(expected)
      c = applyMoves(c, [m])
    }
  })

  it('shows a user move the same way however the cube is held', () => {
    // Doing "R" while holding the cube any way must look, to the user, like
    // the right side turning on the cube they see.
    const start = applyMoves(solvedCube(), parseMoves("R U2 F' L D B'"))
    for (const o of allOrientations()) {
      for (const m of parseMoves("R U F D L B R2 U'")) {
        const seenBefore = viewFacelets(toFacelets(start), o)
        const seenAfter = viewFacelets(toFacelets(applyMoves(start, [toFixedMove(o, m)])), o)
        expect(seenAfter).toBe(turnStickers(seenBefore, m.face, m.turns))
      }
    }
  })
})
