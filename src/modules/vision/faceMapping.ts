/**
 * Which cube sticker each cell of a captured image belongs to.
 *
 * The camera sees the face from outside. If we know which face points at the
 * camera and which face is on top, every image cell (row, column) lands on
 * exactly one of the 54 stickers.
 */
import {
  FACE_NORMALS,
  SCAN_ORDER,
  STANDARD_CENTERS,
  STICKERS,
  type Face,
  type StickerColor,
  type Vec3,
} from '@/modules/cube'

const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

/** For image cells 0-8 (row by row, as the camera sees them), the sticker index 0-53. */
export function imageCellsToFacelets(front: Face, top: Face): number[] {
  const n = FACE_NORMALS[front]
  const up = FACE_NORMALS[top]
  if (Math.abs(n[0] * up[0] + n[1] * up[1] + n[2] * up[2]) !== 0)
    throw new Error('The top face must be next to the front face')
  const right = cross(up, n)
  return Array.from({ length: 9 }, (_, cell) => {
    const r = Math.floor(cell / 3)
    const c = cell % 3
    const pos = [0, 1, 2].map((k) => n[k]! + up[k]! * (1 - r) + right[k]! * (c - 1))
    const idx = STICKERS.findIndex(
      (s) => s.normal.every((v, k) => v === n[k]) && s.position.every((v, k) => v === pos[k]),
    )
    if (idx < 0) throw new Error('No sticker at that position')
    return idx
  })
}

const FACE_OF_COLOR = Object.fromEntries(
  Object.entries(STANDARD_CENTERS).map(([face, color]) => [color, face]),
) as Record<StickerColor, Face>

/** Sticker indices for each of the 6 scan steps (PLAN.md section 4.3). */
export const SCAN_STEP_FACELETS: readonly number[][] = SCAN_ORDER.map((step) =>
  imageCellsToFacelets(FACE_OF_COLOR[step.front], FACE_OF_COLOR[step.top]),
)

/** Rotates a 3x3 grid (row by row) a quarter turn clockwise. */
export function rotateGridClockwise<T>(cells: readonly T[]): T[] {
  return [6, 3, 0, 7, 4, 1, 8, 5, 2].map((i) => cells[i]!)
}
