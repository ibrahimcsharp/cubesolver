/**
 * What to animate for each step, in the user's frame (x = right, y = up,
 * z = toward the user). A negative angle is clockwise when looking at the
 * face from outside, like a normal face turn.
 */
import { FACE_NORMALS, type Face, type Vec3 } from '@/modules/cube'
import type { Step } from '@/modules/solution'

export type TurnAnimation =
  | { kind: 'layer'; face: Face; axis: Vec3; angle: number }
  | { kind: 'whole'; axis: Vec3; angle: number }

const QUARTER = Math.PI / 2

export function stepAnimation(step: Step): TurnAnimation {
  if (step.kind === 'move') {
    const t = step.move.turns
    const angle = t === 3 ? QUARTER : -QUARTER * t
    return { kind: 'layer', face: step.move.face, axis: FACE_NORMALS[step.move.face], angle }
  }
  switch (step.rotation) {
    case 'y':
      return { kind: 'whole', axis: [0, 1, 0], angle: -QUARTER }
    case "y'":
      return { kind: 'whole', axis: [0, 1, 0], angle: QUARTER }
    case 'y2':
      return { kind: 'whole', axis: [0, 1, 0], angle: -2 * QUARTER }
    case 'z2':
      return { kind: 'whole', axis: [0, 0, 1], angle: -2 * QUARTER }
  }
}

export function reverse(a: TurnAnimation): TurnAnimation {
  return { ...a, angle: -a.angle }
}

/** How long a turn takes, given the time for a quarter turn. */
export function turnDuration(a: TurnAnimation, quarterMs: number): number {
  return Math.abs(a.angle) > QUARTER + 0.01 ? quarterMs * 1.5 : quarterMs
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
