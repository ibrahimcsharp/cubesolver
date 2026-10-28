import { describe, expect, it } from 'vitest'
import {
  IDENTITY_ORIENTATION,
  invertMove,
  parseMoves,
  randomCube,
  seededRandom,
  STANDARD_CENTERS,
  toFacelets,
  turnStickers,
  validateColors,
  viewFacelets,
  type Face,
  type Move,
  type StickerColor,
} from '@/modules/cube'
import { flattenSteps, type Step } from '@/modules/solution'
import { solveBeginner } from '@/modules/solver-beginner'
import { centeredBox, sampleFace, type FaceSample } from '@/modules/vision'
import { LIGHTINGS, makeFaceImage, type Lighting } from '@/modules/vision/synthetic'
import { cameraArrow, cameraSees } from './camera-view'
import { MoveChecker } from './checker'

const move = (m: string): Step => ({ kind: 'move', move: parseMoves(m)[0]! }) as Step

describe('arrow on the camera picture (camera sees the back side)', () => {
  it('R: left column of the picture, pointing down', () => {
    const a = cameraArrow(move('R'))
    expect(a.kind).toBe('line')
    if (a.kind !== 'line') return
    expect(a.from[0]).toBeCloseTo(-1)
    expect(a.to[0]).toBeCloseTo(-1)
    expect(a.to[1]).toBeLessThan(a.from[1])
  })

  it("U: top row, moving left in the picture; U' moves right", () => {
    const u = cameraArrow(move('U'))
    const ui = cameraArrow(move("U'"))
    if (u.kind !== 'line' || ui.kind !== 'line') throw new Error('expected lines')
    expect(u.from[1]).toBeCloseTo(1)
    expect(u.to[0]).toBeLessThan(u.from[0])
    expect(ui.to[0]).toBeGreaterThan(ui.from[0])
  })

  it('B turns the side facing the camera clockwise; F is the far side, counter-clockwise from here', () => {
    expect(cameraArrow(move('B'))).toMatchObject({ kind: 'circle', clockwise: true, far: false })
    expect(cameraArrow(move('F'))).toMatchObject({ kind: 'circle', clockwise: false, far: true })
  })

  it('whole-cube turn y: a wide arrow across the middle', () => {
    const a = cameraArrow({ kind: 'rotation', rotation: 'y' } as Step)
    expect(a).toMatchObject({ kind: 'line', wholeCube: true })
  })
})

// ---------- simulated live session ----------

const W = 200
const H = 150
const BOX = centeredBox(W, H, 0.6)

function setup(seed: number) {
  const rand = seededRandom(seed)
  const colors = [...toFacelets(randomCube(rand))].map((ch) => STANDARD_CENTERS[ch as Face])
  const cube = validateColors(colors)
  if (!cube.ok) throw new Error('bad cube')
  const solution = solveBeginner(cube)
  const steps = flattenSteps(solution)
  const views = [
    viewFacelets(solution.startFacelets, IDENTITY_ORIENTATION),
    ...steps.map((s) => viewFacelets(s.faceletsAfter, s.orientationAfter)),
  ]
  return { rand, steps, views, colorOf: solution.colorOf }
}

function frame(
  face: string,
  colorOf: Record<Face, StickerColor>,
  lighting: Lighting,
  rand: () => number,
  shiftX = 0,
): FaceSample {
  const img = makeFaceImage({
    width: W,
    height: H,
    box: { ...BOX, x: BOX.x + shiftX },
    colors: [...face].map((ch) => colorOf[ch as Face]),
    lighting,
    rand,
    stickerShift: Array.from({ length: 9 }, () => [0, 0, 0] as const),
  })
  return sampleFace(img, BOX)
}

describe('checking moves from the camera (simulated)', { timeout: 60_000 }, () => {
  for (const lighting of [LIGHTINGS[0]!, LIGHTINGS[1]!]) {
    it(`follows 40 beginner steps in ${lighting.name} without false alarms`, () => {
      const { rand, steps, views, colorOf } = setup(lighting.name.length * 7)
      const checker = new MoveChecker(views, steps, colorOf)
      let index = 0
      let t = 0
      let unchecked = 0
      const events: string[] = []
      const run = (face: string, frames: number, shift = 0) => {
        const out: string[] = []
        for (let k = 0; k < frames; k++, t += 100) {
          checker.setIndex(index)
          const r = checker.push(
            frame(face, colorOf, lighting, rand, shift ? Math.round((rand() - 0.5) * shift) : 0),
            t,
          )
          out.push(r.status)
          if (r.status === 'done' || r.status === 'done-unchecked') {
            if (r.status === 'done-unchecked') unchecked++
            index += r.advance!
            checker.setIndex(index)
          }
          if (r.status === 'wrong') events.push(`wrong at ${index}`)
        }
        return out
      }

      run(cameraSees(views[0]!), 10) // the user shows the cube and holds still
      for (let i = 0; i < 40; i++) {
        expect(index).toBe(i)
        const before = run(cameraSees(views[i]!), 6)
        expect(before, `held still before step ${i}`).not.toContain('done')
        run(cameraSees(views[i]!), 4, 120) // hands moving the cube around
        run(cameraSees(views[i + 1]!), 10) // the move is done; held still
        expect(index, `after step ${i}`).toBe(i + 1)
      }
      expect(events).toEqual([])
      // Moves that don't change the back side can't be checked, only trusted.
      const invisible = steps
        .slice(0, 40)
        .filter((_, i) => cameraSees(views[i]!) === cameraSees(views[i + 1]!)).length
      expect(unchecked).toBe(invisible)
    })
  }

  it('spots a wrong turn and suggests the undo', () => {
    const { rand, steps, views, colorOf } = setup(5)
    const checker = new MoveChecker(views, steps, colorOf)
    checker.setIndex(0)
    // Find a turn that changes the back side differently from the right move.
    const right = cameraSees(views[1]!)
    const wrongMove = parseMoves("R U L' D B2 U2").find((m) => {
      const seen = cameraSees(turnStickers(views[0]!, m.face, m.turns))
      return seen !== right && seen !== cameraSees(views[0]!)
    }) as Move
    const wrongFace = cameraSees(turnStickers(views[0]!, wrongMove.face, wrongMove.turns))

    let t = 0
    const statuses: string[] = []
    let undo: Move | undefined
    for (let k = 0; k < 10; k++, t += 100)
      checker.push(frame(cameraSees(views[0]!), colorOf, LIGHTINGS[0]!, rand), t)
    for (let k = 0; k < 10; k++, t += 100) {
      const r = checker.push(frame(wrongFace, colorOf, LIGHTINGS[0]!, rand), t)
      statuses.push(r.status)
      undo ??= r.undo
    }
    expect(statuses).toContain('wrong')
    // Doing the suggested undo gets back to where the step started.
    const undone = turnStickers(
      turnStickers(views[0]!, wrongMove.face, wrongMove.turns),
      undo!.face,
      undo!.turns,
    )
    expect(cameraSees(undone)).toBe(cameraSees(views[0]!))
    expect(undo).toEqual(invertMove(wrongMove))
  })
})
