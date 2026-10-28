/**
 * Records steps while a solver works: it keeps the cube state and the way the
 * user is holding it, and turns user-side moves into fixed-face moves.
 */
import {
  applyMove,
  cloneCube,
  formatMove,
  IDENTITY_ORIENTATION,
  parseMoves,
  rotate,
  toFacelets,
  toFixedMove,
  type CubieCube,
  type Face,
  type Move,
  type Orientation,
  type Rotation,
  type StickerColor,
} from '@/modules/cube'
import { describeMove, describeRotation } from './describe'
import type { Solution, SolveStyle, Stage, StageId, Step, StepGroup } from './types'

export class SolutionBuilder {
  cube: CubieCube
  orientation: Orientation = IDENTITY_ORIENTATION
  private readonly startFacelets: string
  private readonly stages: Stage[] = []
  private moveCount = 0
  private readonly style: SolveStyle
  private readonly colorOf: Record<Face, StickerColor>

  constructor(start: CubieCube, style: SolveStyle, colorOf: Record<Face, StickerColor>) {
    this.cube = cloneCube(start)
    this.startFacelets = toFacelets(start)
    this.style = style
    this.colorOf = colorOf
  }

  startStage(id: StageId, title: string, goal: string): void {
    this.stages.push({ id, title, goal, groups: [] })
  }

  /** Applies user-side moves (e.g. "R' D' R D") as one explained group. */
  moves(sequence: string | Move[], explanation: string, algorithm?: string): void {
    const moves = typeof sequence === 'string' ? parseMoves(sequence) : sequence
    if (moves.length === 0) return
    const steps: Step[] = moves.map((move) => {
      const fixedMove = toFixedMove(this.orientation, move)
      this.cube = applyMove(this.cube, fixedMove)
      this.moveCount++
      return {
        kind: 'move',
        move,
        fixedMove,
        notation: formatMove(move),
        text: describeMove(move),
        faceletsAfter: toFacelets(this.cube),
        orientationAfter: this.orientation,
      }
    })
    this.pushGroup({ explanation, algorithm, steps })
  }

  rotate(rotation: Rotation, explanation: string): void {
    this.orientation = rotate(this.orientation, rotation)
    this.pushGroup({
      explanation,
      steps: [
        {
          kind: 'rotation',
          rotation,
          notation: rotation,
          text: describeRotation(rotation),
          faceletsAfter: toFacelets(this.cube),
          orientationAfter: this.orientation,
        },
      ],
    })
  }

  /** Color name of whatever fixed face is at the given user side. */
  colorAt(userFace: Face): StickerColor {
    return this.colorOf[this.orientation[userFace]]
  }

  colorOfFixed(face: Face): StickerColor {
    return this.colorOf[face]
  }

  private pushGroup(group: StepGroup): void {
    const stage = this.stages.at(-1)
    if (!stage) throw new Error('startStage() must be called before adding steps')
    stage.groups.push(group)
  }

  build(): Solution {
    return {
      style: this.style,
      startFacelets: this.startFacelets,
      startOrientation: IDENTITY_ORIENTATION,
      colorOf: this.colorOf,
      // Drop stages that needed no steps (e.g. the cross was already solved).
      stages: this.stages.filter((s) => s.groups.length > 0),
      moveCount: this.moveCount,
    }
  }
}
