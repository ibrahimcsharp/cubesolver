/**
 * What the webcam sees in live guided mode, and the arrow to draw on it.
 *
 * The user holds the cube the normal way (front toward themselves), so the
 * webcam in front of them sees the cube's BACK side, upright. All positions
 * here are in the camera picture as the camera sees it (not mirrored):
 * x to the right, y up, cells 0-8 row by row.
 */
import { FACE_NORMALS, type Face, type Vec3 } from '@/modules/cube'
import type { Step } from '@/modules/solution'
import { stepAnimation } from '@/components/cube3d/animation'
import { imageCellsToFacelets } from '@/modules/vision'

/** The side (in the user's frame) that faces the webcam. */
export const CAMERA_FACE: Face = 'B'

/** Sticker indices (user's view) of the 9 cells the camera sees. */
export const CAMERA_CELLS = imageCellsToFacelets(CAMERA_FACE, 'U')

/** The 9 face letters the camera should see, given what the user sees. */
export function cameraSees(view: string): string {
  return CAMERA_CELLS.map((i) => view[i]).join('')
}

const N = FACE_NORMALS[CAMERA_FACE]
const UP: Vec3 = [0, 1, 0]
const RIGHT: Vec3 = [
  UP[1] * N[2] - UP[2] * N[1],
  UP[2] * N[0] - UP[0] * N[2],
  UP[0] * N[1] - UP[1] * N[0],
]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
/** 3D point or direction to camera-picture x/y. */
const toPicture = (v: Vec3): [number, number] => [dot(v, RIGHT), dot(v, UP)]

export type CameraArrow =
  /** Straight arrow along a row/column of the visible side, from → to in cell units (-1.5…1.5). */
  | { kind: 'line'; from: [number, number]; to: [number, number]; wholeCube: boolean }
  /** Round arrow on the visible side; `far` = the turning side is the one facing the user. */
  | { kind: 'circle'; clockwise: boolean; far: boolean; half: boolean; wholeCube: boolean }

/** The arrow to draw over the camera picture for this step. */
export function cameraArrow(step: Step): CameraArrow {
  const anim = stepAnimation(step)
  const axis = anim.axis
  const half = Math.abs(anim.angle) > Math.PI / 2 + 0.01
  const wholeCube = anim.kind === 'whole'
  const facing = dot(axis, N) // +1: turns the side facing the camera, -1: the opposite side

  if (facing !== 0) {
    // Seen from the camera, a negative angle about an axis pointing at the camera is clockwise.
    const clockwise = facing > 0 ? anim.angle < 0 : anim.angle > 0
    return { kind: 'circle', clockwise, far: facing < 0 && !wholeCube, half, wholeCube }
  }

  // A layer (or the whole cube) turning sideways: its stickers on the visible
  // side slide along a straight row or column.
  const layerCenter: Vec3 = wholeCube ? N : [N[0] + axis[0], N[1] + axis[1], N[2] + axis[2]]
  const sign = anim.angle < 0 ? -1 : 1
  const motion = cross(axis, layerCenter).map((v) => v * sign) as unknown as Vec3
  const [cx, cy] = toPicture(layerCenter)
  const [mx, my] = toPicture(motion)
  const len = Math.hypot(mx, my) || 1
  const reach = 1.25
  return {
    kind: 'line',
    from: [cx - (mx / len) * reach, cy - (my / len) * reach],
    to: [cx + (mx / len) * reach, cy + (my / len) * reach],
    wholeCube,
  }
}
