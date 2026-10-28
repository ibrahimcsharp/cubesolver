/**
 * The shared solution format. Both solvers produce it; the steps list, 3D
 * player, live guide, PDF and video all read it (PLAN.md section 7.4).
 */
import type { Face, Move, Orientation, Rotation, StickerColor } from '@/modules/cube'

export type SolveStyle = 'optimal' | 'beginner'

type StepBase = {
  /** Notation as the user reads it, e.g. "R'", "U2" or "y". */
  notation: string
  /** Plain-English instruction, e.g. "Turn the right side down, toward you". */
  text: string
  /** Fixed-face facelet string after this step (unchanged by whole-cube turns). */
  faceletsAfter: string
  /** How the user is holding the cube after this step. */
  orientationAfter: Orientation
}

/** A face turn, written from the user's point of view. */
export type MoveStep = StepBase & {
  kind: 'move'
  move: Move
  /** The same turn on the fixed cube model (what the 3D view and checks use). */
  fixedMove: Move
}

/** "Turn the whole cube…" — the stickers don't change, only how it is held. */
export type RotationStep = StepBase & {
  kind: 'rotation'
  rotation: Rotation
}

export type Step = MoveStep | RotationStep

/** A few steps that do one job, e.g. "Insert the green-red edge on the right". */
export type StepGroup = {
  explanation: string
  /** Name of the standard pattern used, if any, e.g. "R' D' R D". */
  algorithm?: string
  steps: Step[]
}

export type StageId =
  | 'optimal'
  | 'cross'
  | 'first-corners'
  | 'flip'
  | 'middle'
  | 'last-cross'
  | 'last-edges'
  | 'last-corners-position'
  | 'last-corners-twist'
  | 'finish'

export type Stage = {
  id: StageId
  /** e.g. "Stage 1: White cross" */
  title: string
  goal: string
  groups: StepGroup[]
}

export type Solution = {
  style: SolveStyle
  /** Facelet string of the scanned cube (fixed faces). */
  startFacelets: string
  /** How to hold the cube before the first step. */
  startOrientation: Orientation
  /** Real color of each fixed face's center, for instructions. */
  colorOf: Record<Face, StickerColor>
  stages: Stage[]
  /** Number of face turns (whole-cube turns are not counted). */
  moveCount: number
}

/** All steps in order, ignoring stages and groups. */
export function flattenSteps(solution: Solution): Step[] {
  return solution.stages.flatMap((s) => s.groups.flatMap((g) => g.steps))
}
