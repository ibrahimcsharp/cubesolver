import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import {
  applyMoves,
  IDENTITY_ORIENTATION,
  parseMoves,
  rotate,
  solvedCube,
  STICKERS,
  toFacelets,
  turnStickers,
  viewFacelets,
  type Rotation,
} from '@/modules/cube'
import type { Step } from '@/modules/solution'
import { stepAnimation, type TurnAnimation } from './animation'

/** Where each sticker's color ends up after rotating by the animation, in 3D. */
function animateStickers(view: string, anim: TurnAnimation): string {
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...anim.axis), anim.angle)
  const key = (p: THREE.Vector3, n: THREE.Vector3) =>
    [p.x, p.y, p.z, n.x, n.y, n.z].map((v) => Math.round(v)).join(',')
  const index = new Map(
    STICKERS.map((s, i) => [
      key(new THREE.Vector3(...s.position), new THREE.Vector3(...s.normal)),
      i,
    ]),
  )
  const out = [...view]
  STICKERS.forEach((s, i) => {
    const p = new THREE.Vector3(...s.position)
    const n = new THREE.Vector3(...s.normal)
    const moves = anim.kind === 'whole' || p.dot(new THREE.Vector3(...anim.axis)) > 0.5
    if (!moves) return
    out[index.get(key(p.applyQuaternion(q), n.applyQuaternion(q)))!] = view[i]!
  })
  return out.join('')
}

const start = toFacelets(applyMoves(solvedCube(), parseMoves("R U2 F' L D B'")))

describe('3D turn animation', () => {
  it('turns each face layer the same way as the cube model', () => {
    for (const move of parseMoves("U U2 U' R R2 R' F F2 F' D D2 D' L L2 L' B B2 B'")) {
      const step = { kind: 'move', move } as Step
      expect(animateStickers(start, stepAnimation(step)), move.face + move.turns).toBe(
        turnStickers(start, move.face, move.turns),
      )
    }
  })

  it('turns the whole cube to match the new way of holding it', () => {
    for (const rotation of ['y', "y'", 'y2', 'z2'] as Rotation[]) {
      const before = viewFacelets(start, IDENTITY_ORIENTATION)
      const after = viewFacelets(start, rotate(IDENTITY_ORIENTATION, rotation))
      const step = { kind: 'rotation', rotation } as Step
      expect(animateStickers(before, stepAnimation(step)), rotation).toBe(after)
    }
  })
})
